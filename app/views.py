import json
import logging
from django.db import transaction
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated,IsAdminUser,AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import status,viewsets,permissions,serializers
from rest_framework.pagination import PageNumberPagination
from django.db.models import Count, Sum
from .models import Employee, Retailer, Order, Truck, Shipment, Product, Category,OdooCredentials,Invoice,Company, PasswordResetOTP
from .serializers import (
    EmployeeSerializer, RetailerSerializer, CompanySerializer,
    OrderSerializer,InvoiceSerializer, ProductSerializer, TruckSerializer, ShipmentSerializer, CategorySerializer,UserRegistrationSerializer,
    ForgotPasswordSerializer, VerifyOTPSerializer, ResetPasswordSerializer
)
from .allocation import allocate_shipments
from django.db.models import F
from django.shortcuts import redirect
from django.contrib.auth.models import User,Group
from django.http import JsonResponse
from .permissions import IsEmployeeUser
from django.contrib.admin.models import LogEntry;
from django.contrib.admin.models import LogEntry
from .utils import send_otp_email, send_password_reset_confirmation

from django.db.models.functions import TruncMonth

from .odoo_connector import authenticate_with_odoo, add_product_to_odoo

class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated]  

    def get_queryset(self):
        # Only return companies related to the logged-in user
        return Company.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().order_by("-order_date")
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset
    
# ✅ Custom Pagination Class
class StandardPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100

# ✅ Custom JWT Login View
class CustomAuthToken(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        user = request.user
        return Response(
            {
                "access": response.data["access"],
                "refresh": response.data["refresh"],
                "user_id": user.id,
                "username": user.username,
            },
            status=status.HTTP_200_OK,
        )


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        company_id = self.request.query_params.get('company')
        if company_id:
            queryset = queryset.filter(company_id=company_id)
        return queryset
    
    def perform_create(self, serializer):
        """
        When an invoice is created, automatically update product quantities
        """
        with transaction.atomic():
            # Create the invoice first
            invoice = serializer.save()
            
            # Update product quantities based on invoice items
            for item in invoice.items.all():
                product = item.Product
                shipped_quantity = item.quantity
                
                # Update total shipped quantity
                product.total_shipped += shipped_quantity
                
                # Reduce available quantity
                if product.available_quantity >= shipped_quantity:
                    product.available_quantity -= shipped_quantity
                else:
                    # If insufficient stock, you can either:
                    # 1. Raise an error (uncomment below)
                    # raise serializers.ValidationError(f'Insufficient stock for {product.name}')
                    # 2. Or set available quantity to 0
                    product.available_quantity = 0
                
                # Save the product (this will trigger the update_status method)
                product.save()

    def perform_update(self, serializer):
        """
        When an invoice is updated, handle quantity adjustments if needed
        """
        # Get the original invoice before update
        original_invoice = self.get_object()
        original_items = {item.Product.product_id: item.quantity for item in original_invoice.items.all()}
        
        with transaction.atomic():
            # Update the invoice
            invoice = serializer.save()
            
            # Calculate quantity differences and update products
            for item in invoice.items.all():
                product = item.Product
                new_quantity = item.quantity
                original_quantity = original_items.get(product.product_id, 0)
                quantity_difference = new_quantity - original_quantity
                
                if quantity_difference != 0:
                    # Update total shipped
                    product.total_shipped += quantity_difference
                    
                    # Update available quantity (inverse of shipped)
                    product.available_quantity -= quantity_difference
                    
                    # Ensure available quantity doesn't go negative
                    if product.available_quantity < 0:
                        product.available_quantity = 0
                    
                    product.save()

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        company_id = self.request.query_params.get('company')
        if company_id:
            queryset = queryset.filter(company_id=company_id)
        return queryset

    def perform_create(self, serializer):
        company_id = self.request.data.get('company')
        if not company_id:
            raise serializers.ValidationError({'company': 'This field is required.'})
        serializer.save(company_id=company_id)

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        company_id = self.request.query_params.get('company')
        if company_id:
            queryset = queryset.filter(company_id=company_id)
        return queryset

    def perform_create(self, serializer):
        # Set the company from the request data
        company_id = self.request.data.get('company')
        if not company_id:
            raise serializers.ValidationError({'company': 'This field is required.'})
        serializer.save(company_id=company_id, created_by=self.request.user)


@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    """
    API to register a new user and assign them to a group.
    Returns JWT token on success.
    """
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        # Generate JWT token for the new user
        refresh = RefreshToken.for_user(user)
        return Response({
            "message": "User registered successfully.",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user_id": user.id,
            "username": user.username,
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])  # Only admins can add retailers
def add_retailer(request):
    """
    API to add a new retailer.
    Expects 'company' in request data or as a query param (?company=).
    """
    data = request.data.copy()
    company_id = request.query_params.get('company')
    if not company_id:
        return Response({"error": "company_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    data['company'] = company_id

    serializer = RetailerSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve_order(request):
    """
    Approve an order by adding it to shipments (no status change).
    Request: { "order_id": <int> }
    """
    order_id = request.data.get("order_id")
    if not order_id:
        return Response({"error": "order_id is required"}, status=400)
    try:
        order = Order.objects.get(order_id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)
    if hasattr(order, "shipment"):
        return Response({"error": "Order already has a shipment"}, status=400)
    
    Shipment.objects.create(order=order, employee= None)  # Create shipment without assigning an employee
    # Do NOT change order.status here
    return Response({"message": "Order approved and added to shipments"}, status=200)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def invoice_count(request):
    company_id = request.query_params.get("company")
    if not company_id:
        return Response({"error": "company_id is required"}, status=400)
    count = Invoice.objects.filter(company_id=company_id).count()
    return Response({"count": count})

# ✅ Logout View (Blacklist Refresh Token)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"error": "Refresh token is required"}, status=status.HTTP_400_BAD_REQUEST)

        token = RefreshToken(refresh_token)
        token.blacklist()

        return Response({"message": "Logged out successfully"}, status=status.HTTP_205_RESET_CONTENT)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def shipment_stats(request):
    """
    Returns monthly shipment counts per product for the given company.
    Query param: company (company_id)
    """
    company_id = request.query_params.get("company")
    if not company_id:
        return Response({"error": "company_id is required"}, status=400)

    from .models import InvoiceItem

    # Filter InvoiceItems by company
    stats = (
        InvoiceItem.objects
        .filter(invoice__company_id=company_id)
        .annotate(month=TruncMonth('invoice__invoice_date'))
        .values('month', 'Product__name')
        .annotate(count=Sum('quantity'))
        .order_by('month', 'Product__name')
    )

    # Format for frontend
    data = [
        {
            "month": stat["month"].strftime("%B"),
            "product": stat["Product__name"],
            "count": stat["count"]
        }
        for stat in stats
    ]
    return Response({"data": data})

# ✅ Get Employees (Admin Only)
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminUser])
def get_employees(request):
    try:
        employees = Employee.objects.all()
        paginator = StandardPagination()
        paginated_employees = paginator.paginate_queryset(employees, request)
        serializer = EmployeeSerializer(paginated_employees, many=True)
        return paginator.get_paginated_response(serializer.data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_retailers(request):
    try:
        company_id = request.query_params.get("company")
        if company_id:
            retailers = Retailer.objects.filter(company_id=company_id)
        else:
            retailers = Retailer.objects.all()
        paginator = StandardPagination()
        paginated_retailers = paginator.paginate_queryset(retailers, request)
        serializer = RetailerSerializer(paginated_retailers, many=True)
        return paginator.get_paginated_response(serializer.data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ✅ Get Orders (Anyone Logged In)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_orders(request):
    try:
        status_filter = request.GET.get("status")
        orders = Order.objects.all().order_by("-order_date")

        if status_filter:
            orders = orders.filter(status=status_filter)

        paginator = StandardPagination()
        paginated_orders = paginator.paginate_queryset(orders, request)
        serializer = OrderSerializer(paginated_orders, many=True)
        return paginator.get_paginated_response(serializer.data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ✅ Get Trucks (Admin Only)
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminUser])
def get_trucks(request):
    try:
        trucks = Truck.objects.all()
        paginator = StandardPagination()
        paginated_trucks = paginator.paginate_queryset(trucks, request)
        serializer = TruckSerializer(paginated_trucks, many=True)
        return paginator.get_paginated_response(serializer.data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ✅ Get Shipments (Anyone Logged In)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_shipments(request):
    try:
        company_id = request.query_params.get("company")
        if not company_id:
            return Response({"error": "company_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        # Filter shipments by company via the related order's company
        shipments = Shipment.objects.filter(order__company_id=company_id).order_by("-shipment_date")
        paginator = StandardPagination()
        paginated_shipments = paginator.paginate_queryset(shipments, request)
        serializer = ShipmentSerializer(paginated_shipments, many=True)
        return paginator.get_paginated_response(serializer.data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_available_employees_for_order(request):
    """
    Given an order_id, return employees for the order's company and retailer.
    Query param: order_id
    """
    order_id = request.query_params.get("order_id")
    if not order_id:
        return Response({"error": "order_id is required"}, status=400)
    try:
        order = Order.objects.get(order_id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)

    company_employees = Employee.objects.filter(company=order.company)
    retailer_employees = Employee.objects.filter(retailer=order.retailer)

    serializer = EmployeeSerializer(list(company_employees) + list(retailer_employees), many=True)
    return Response({"employees": serializer.data}, status=200)

@api_view(["POST"])
@permission_classes([IsAuthenticated])  
def allocate_order(request):
    """
    Manually allocate a single order to a selected employee.
    Request: { "order_id": <int>, "employee_id": <int> }
    """
    try:
        order_id = request.data.get("order_id")
        employee_id = request.data.get("employee_id")
        if not order_id or not employee_id:
            return Response({"error": "order_id and employee_id are required"}, status=400)

        try:
            order = Order.objects.get(order_id=order_id)
        except Order.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)

        try:
            employee = Employee.objects.get(employee_id=employee_id)
        except Employee.DoesNotExist:
            return Response({"error": "Employee not found"}, status=404)

        # Find the existing shipment
        try:
            shipment = order.shipment
        except Shipment.DoesNotExist:
            return Response({"error": "Shipment does not exist for this order. Approve the order first."}, status=400)

        if shipment.employee is not None:
            return Response({"error": "Order already allocated"}, status=400)

        # Assign employee and update order status
        shipment.employee = employee
        shipment.save()
        order.status = "allocated"
        order.save(update_fields=["status"])

        return Response({"message": "Order allocated to employee successfully"}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    
# ✅ Get Category Stock Data (Accessible by Anyone)
@api_view(["GET"])
def category_stock_data(request):
    """
    Returns category names and product count for visualization.
    """
    try:
        categories = Category.objects.annotate(product_count=Count('products'))  # ✅ Count products per category

        # Serialize the data
        serialized_data = CategorySerializer(categories, many=True).data

        # Attach product_count to each category in serialized data
        for category in serialized_data:
            category["value"] = next(
                (cat["product_count"] for cat in categories.values("name", "product_count") if cat["name"] == category["name"]),
                0
            )

        return Response({"success": True, "data": serialized_data})
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAdminUser])  # Restrict access to admin only
def store_qr_code(request):
    """API to process and store QR code data into the Product model (Admin Only)"""
    try:
        if not request.user.is_staff:  # Double-check admin access
            return Response({"error": "Permission denied. Admins only."}, status=403)

        qr_data = request.data.get("qr_text", "")  # Get the QR code text

        # Example QR Code Data Format: "name=Camera|category=Electronics|quantity=10"
        data_dict = dict(item.split("=") for item in qr_data.split("|"))

        product_name = data_dict.get("name")
        category_name = data_dict.get("category")
        quantity = int(data_dict.get("quantity", 0))

        if not product_name or not category_name or quantity <= 0:
            return Response({"error": "Invalid QR Code data"}, status=400)

        # Fetch or create the category
        category, _ = Category.objects.get_or_create(name=category_name)

        # Fetch existing product or create a new one
        product, created = Product.objects.get_or_create(
            name=product_name, category=category,
            defaults={"available_quantity": 0}  # Ensure no NULL values
        )

        if created:
            product.available_quantity = quantity  # Set quantity for new product
        else:
            # Update quantity safely using F() expression
            Product.objects.filter(product_id=product.product_id).update(
                available_quantity=F('available_quantity') + quantity
            )
            product.refresh_from_db()  # Fetch updated values from DB

        product.save()  # Save to trigger signals

        return Response({"message": "Product updated successfully"}, status=201)

    except Exception as e:
        return Response({"error": str(e)}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_counts(request):
    try:
        company_id = request.query_params.get("company")
        if not company_id:
            return Response({"error": "company_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        order_count = Order.objects.filter(company_id=company_id).count()
        pending_order_count = Order.objects.filter(company_id=company_id, status="pending").count()
        employee_count = Employee.objects.filter(company_id=company_id).count()
        retailer_count = Retailer.objects.filter(company_id=company_id).count()

        return Response(
            {
                "orders_placed": order_count,
                "pending_orders": pending_order_count,
                "employees_available": employee_count,
                "retailers_available": retailer_count,
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response({"error": "Something went wrong"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
@permission_classes([IsAdminUser])
def get_users(request):
    """Fetch all users along with their assigned group(s) and return as JSON."""
    users = User.objects.prefetch_related('groups').values('id', 'username', 'email', 'is_staff', 'groups__name')

    # Organize users with their groups
    user_dict = {}
    for user in users:
        user_id = user["id"]
        if user_id not in user_dict:
            user_dict[user_id] = {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "is_staff": user["is_staff"],
                "groups": []
            }
        if user["groups__name"]:
            user_dict[user_id]["groups"].append(user["groups__name"])

    return Response(list(user_dict.values()))

@api_view(['GET'])
@permission_classes([IsAuthenticated])  # Ensure user is authenticated
def get_logged_in_user(request):
    """Fetch details of the currently authenticated user."""
    user = request.user  # Get the logged-in user

    # Get user details along with group(s)
    user_data = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_staff": user.is_staff,
        "groups": list(user.groups.values_list("name", flat=True))
    }
    
    return Response(user_data)

@api_view(['GET'])
@permission_classes([IsAuthenticated,IsEmployeeUser])
def get_employee_shipments(request):
    """Fetch shipments assigned to the logged-in employee."""
    
    # Get the logged-in user's username
    username = request.user.username  

    # Fetch shipments where the employee's user has the same username
    shipments = Shipment.objects.filter(employee__user__username=username)  

    # Serialize the data
    serializer = ShipmentSerializer(shipments, many=True)  

    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated,IsEmployeeUser])
def update_shipment_status(request):
    """Allow an employee to update the status of their assigned shipment."""

    # Get the logged-in user's username
    username = request.user.username  

    # Extract data from the request
    shipment_id = request.data.get('shipment_id')
    new_status = request.data.get('status')

    # Validate request data
    if not shipment_id or not new_status:
        return Response({"error": "shipment_id and status are required"}, status=status.HTTP_400_BAD_REQUEST)

    # Validate status choices
    valid_statuses = ['in_transit', 'delivered', 'failed']
    if new_status not in valid_statuses:
        return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)

    # Find the shipment assigned to this employee
    try:
        shipment = Shipment.objects.get(shipment_id=shipment_id, employee__user__username=username)
    except Shipment.DoesNotExist:
        return Response({"error": "Shipment not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)

    # Update shipment status
    shipment.status = new_status
    shipment.save()

    return Response({"message": "Shipment status updated successfully"}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated,IsEmployeeUser])
def get_employee_orders(request):
    """
    Fetch order details for shipments assigned to the logged-in employee.
    """

    # Get the logged-in user
    user = request.user  

    # Find shipments assigned to this employee
    shipments = Shipment.objects.filter(employee__user=user)

    # Extract order details for those shipments
    orders = [shipment.order for shipment in shipments]  

    # Serialize the data
    serializer = OrderSerializer(orders, many=True)  

    return Response(serializer.data)

def redirect_view(request):
    return redirect('/admin/')

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def recent_actions(request):
    # Fetch the last 10 actions performed in the admin panel
    actions = LogEntry.objects.select_related('content_type', 'user').order_by('-action_time')[:10]

    # Prepare JSON response
    recent_actions_list = [
        {
            'time': action.action_time,
            'user': action.user.username,
            'content_type': action.content_type.model,
            'object_id': action.object_id,
            'object_repr': action.object_repr,
            'action_flag': action.get_action_flag_display(),
        }
        for action in actions
    ]

    return Response({'recent_actions': recent_actions_list})


@api_view(['GET'])
@permission_classes([IsAuthenticated,IsEmployeeUser])
def get_employee_id(request):
    user = request.user  

    try:
        employee = Employee.objects.get(user=user)  # Get employee linked to logged-in user
        return Response({"employee_id": employee.employee_id})  # ✅ Use employee_id instead of id
    except Employee.DoesNotExist:
        return Response({"error": "Employee not found"}, status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def recent_actions(request):
    # Fetch the last 10 actions performed in the admin panel
    actions = LogEntry.objects.select_related('content_type', 'user').order_by('-action_time')[:10]

    # Prepare JSON response
    recent_actions_list = [
        {
            'time': action.action_time,
            'user': action.user.username,
            'content_type': action.content_type.model,
            'object_id': action.object_id,
            'object_repr': action.object_repr,
            'action_flag': action.get_action_flag_display(),
        }
        for action in actions
    ]

    return Response({'recent_actions': recent_actions_list})



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_odoo_credentials(request):
    """
    API to save Odoo credentials for the authenticated user.
    Expects 'db', 'username', and 'password' in the request data.
    """
    user = request.user
    db = request.data.get('db')
    username = request.data.get('username')
    password = request.data.get('password')

    if not all([db, username, password]):
        return Response({"error": "All fields are required."}, status=status.HTTP_400_BAD_REQUEST)

    # Save or update the credentials
    credentials, created = OdooCredentials.objects.update_or_create(
        user=user,
        defaults={"db": db, "username": username, "password": password}
    )

    return Response({"message": "Odoo credentials saved successfully."}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow anyone to access this endpoint
def get_available_groups(request):
    """
    API to fetch all available groups.
    """
    groups = Group.objects.all().values_list('name', flat=True)
    return Response({"groups": list(groups)}, status=status.HTTP_200_OK)


# Password Reset Views
@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password(request):
    """
    API to initiate password reset process.
    Sends OTP to user's email if username and email match.
    """
    serializer = ForgotPasswordSerializer(data=request.data)
    
    if serializer.is_valid():
        user = serializer.validated_data['user']
        
        # Delete any existing unverified OTPs for this user
        PasswordResetOTP.objects.filter(user=user, is_verified=False).delete()
        
        # Create new OTP
        otp_instance = PasswordResetOTP.objects.create(user=user)
        
        # Send OTP via email
        email_sent = send_otp_email(user, otp_instance.otp)
        
        if email_sent:
            return Response({
                'message': 'OTP sent successfully to your email address.',
                'username': user.username
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': 'Failed to send OTP email. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    """
    API to verify the OTP sent to user's email.
    """
    serializer = VerifyOTPSerializer(data=request.data)
    
    if serializer.is_valid():
        otp_instance = serializer.validated_data['otp_instance']
        
        # Mark OTP as verified
        otp_instance.is_verified = True
        otp_instance.save()
        
        return Response({
            'message': 'OTP verified successfully. You can now reset your password.',
            'username': otp_instance.user.username,
            'otp': otp_instance.otp  # Include OTP for password reset step
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """
    API to reset user's password after OTP verification.
    """
    serializer = ResetPasswordSerializer(data=request.data)
    
    if serializer.is_valid():
        user = serializer.validated_data['user']
        otp_instance = serializer.validated_data['otp_instance']
        new_password = serializer.validated_data['new_password']
        
        # Reset the password
        user.set_password(new_password)
        user.save()
        
        # Delete the used OTP
        otp_instance.delete()
        
        # Send confirmation email
        send_password_reset_confirmation(user)
        
        return Response({
            'message': 'Password reset successfully. You can now login with your new password.'
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def resend_otp(request):
    """
    API to resend OTP if the previous one expired or was not received.
    """
    username = request.data.get('username')
    
    if not username:
        return Response({
            'error': 'Username is required.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(username=username)
        
        # Delete any existing OTPs for this user
        PasswordResetOTP.objects.filter(user=user).delete()
        
        # Create new OTP
        otp_instance = PasswordResetOTP.objects.create(user=user)
        
        # Send OTP via email
        email_sent = send_otp_email(user, otp_instance.otp)
        
        if email_sent:
            return Response({
                'message': 'New OTP sent successfully to your email address.'
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': 'Failed to send OTP email. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except User.DoesNotExist:
        return Response({
            'error': 'User does not exist.'
        }, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_product_quantities(request):
    """
    API to update product quantities when invoice is created.
    Expects: {
        "product_updates": [
            {
                "product_id": 1,
                "shipped_quantity": 50,
                "reduce_available": true  // optional, default false
            }
        ]
    }
    """
    try:
        product_updates = request.data.get('product_updates', [])
        
        if not product_updates:
            return Response({
                'error': 'product_updates field is required with product data'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        updated_products = []
        
        with transaction.atomic():  # Ensure all updates succeed or none do
            for update_data in product_updates:
                product_id = update_data.get('product_id')
                shipped_quantity = update_data.get('shipped_quantity', 0)
                reduce_available = update_data.get('reduce_available', False)
                
                if not product_id:
                    return Response({
                        'error': 'product_id is required for each product update'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                try:
                    product = Product.objects.get(product_id=product_id)
                    
                    # Update total shipped quantity
                    product.total_shipped += shipped_quantity
                    
                    # Optionally reduce available quantity
                    if reduce_available:
                        if product.available_quantity >= shipped_quantity:
                            product.available_quantity -= shipped_quantity
                        else:
                            return Response({
                                'error': f'Insufficient available quantity for product {product.name}. Available: {product.available_quantity}, Requested: {shipped_quantity}'
                            }, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Save the product (this will trigger the update_status method)
                    product.save()
                    
                    updated_products.append({
                        'product_id': product.product_id,
                        'product_name': product.name,
                        'total_shipped': product.total_shipped,
                        'available_quantity': product.available_quantity,
                        'status': product.status
                    })
                    
                except Product.DoesNotExist:
                    return Response({
                        'error': f'Product with ID {product_id} does not exist'
                    }, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            'message': 'Product quantities updated successfully',
            'updated_products': updated_products
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


