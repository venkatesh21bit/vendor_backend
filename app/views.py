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
from django.utils import timezone
from datetime import timedelta
from .models import (
    Employee, Retailer, Order, Truck, Shipment, Product, Category, OdooCredentials, Invoice, Company, 
    PasswordResetOTP, RetailerProfile, CompanyRetailerConnection, CompanyInvite, RetailerRequest
)
from .serializers import (
    EmployeeSerializer, CompanySerializer,
    OrderSerializer,InvoiceSerializer, ProductSerializer, TruckSerializer, ShipmentSerializer, CategorySerializer,UserRegistrationSerializer,
    ForgotPasswordSerializer, VerifyOTPSerializer, ResetPasswordSerializer,
    RetailerProfileSerializer, CompanyRetailerConnectionSerializer, PublicCompanySerializer, 
    CompanyInviteSerializer, RetailerRequestSerializer, JoinByCodeSerializer, RetailerOrderSerializer, RetailerProductSerializer
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

    # Create retailer directly since we removed RetailerSerializer
    try:
        company = Company.objects.get(id=company_id)
        retailer = Retailer.objects.create(
            company=company,
            name=data.get('name', ''),
            contact_person=data.get('contact_person', ''),
            email=data.get('email', ''),
            contact=data.get('contact', ''),
            address_line1=data.get('address_line1', ''),
            address_line2=data.get('address_line2', ''),
            city=data.get('city', ''),
            state=data.get('state', 'Tamil Nadu'),
            pincode=data.get('pincode', ''),
            country=data.get('country', 'India'),
            gstin=data.get('gstin', ''),
            distance_from_warehouse=data.get('distance_from_warehouse', 0.0),
            is_active=data.get('is_active', True)
        )
        return Response({
            "message": "Retailer created successfully",
            "retailer_id": retailer.retailer_id,
            "name": retailer.name
        }, status=status.HTTP_201_CREATED)
    except Company.DoesNotExist:
        return Response({"error": "Company not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
        
        # Manual serialization since RetailerSerializer was removed
        retailer_data = []
        for retailer in paginated_retailers:
            retailer_data.append({
                'retailer_id': retailer.retailer_id,
                'name': retailer.name,
                'contact_person': retailer.contact_person,
                'email': retailer.email,
                'contact': retailer.contact,
                'city': retailer.city,
                'state': retailer.state,
                'is_active': retailer.is_active,
                'company_name': retailer.company.name if retailer.company else None
            })
        
        return paginator.get_paginated_response(retailer_data)
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
        
        # Get retailers for this company
        retailer_ids = Retailer.objects.filter(company_id=company_id).values_list('retailer_id', flat=True)
        
        # Filter shipments by orders from these retailers
        shipments = Shipment.objects.filter(order__retailer__in=retailer_ids).order_by("-shipment_date")
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

    company_employees = Employee.objects.filter(company=order.retailer.company)
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

        # Get retailers for this company
        retailer_ids = Retailer.objects.filter(company_id=company_id).values_list('retailer_id', flat=True)
        
        # Count orders through retailers
        order_count = Order.objects.filter(retailer__in=retailer_ids).count()
        pending_order_count = Order.objects.filter(retailer__in=retailer_ids, status="pending").count()
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
    API to verify OTP for password reset.
    """
    serializer = VerifyOTPSerializer(data=request.data)
    
    if serializer.is_valid():
        otp_instance = serializer.validated_data['otp_instance']
        
        # Mark OTP as verified
        otp_instance.is_verified = True
        otp_instance.save()
        
        return Response({
            'message': 'OTP verified successfully. You can now reset your password.',
            'username': otp_instance.user.username
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """
    API to reset password after OTP verification.
    """
    serializer = ResetPasswordSerializer(data=request.data)
    
    if serializer.is_valid():
        user = serializer.validated_data['user']
        new_password = serializer.validated_data['new_password']
        
        # Set new password
        user.set_password(new_password)
        user.save()
        
        # Delete the used OTP
        PasswordResetOTP.objects.filter(user=user).delete()
        
        # Send confirmation email
        send_password_reset_confirmation(user)
        
        return Response({
            'message': 'Password reset successfully.'
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def resend_otp(request):
    """
    API to resend OTP for password reset.
    """
    username = request.data.get('username')
    
    if not username:
        return Response({
            'error': 'Username is required.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({
            'error': 'User not found.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Check if there's an existing unverified OTP
    existing_otp = PasswordResetOTP.objects.filter(user=user, is_verified=False).first()
    
    if not existing_otp:
        return Response({
            'error': 'No pending OTP found. Please initiate password reset first.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if enough time has passed since last OTP (prevent spam)
    if existing_otp.created_at > timezone.now() - timedelta(minutes=1):
        return Response({
            'error': 'Please wait at least 1 minute before requesting a new OTP.'
        }, status=status.HTTP_429_TOO_MANY_REQUESTS)
    
    # Delete old OTP and create new one
    existing_otp.delete()
    otp_instance = PasswordResetOTP.objects.create(user=user)
    
    # Send new OTP via email
    email_sent = send_otp_email(user, otp_instance.otp)
    
    if email_sent:
        return Response({
            'message': 'New OTP sent successfully to your email address.'
        }, status=status.HTTP_200_OK)
    else:
        return Response({
            'error': 'Failed to send OTP email. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Retailer API Views
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def retailer_companies(request):
    """
    Get companies connected to the current retailer
    """
    try:
        retailer_profile = request.user.retailer_profile
        connections = CompanyRetailerConnection.objects.filter(
            retailer=retailer_profile,
            status='approved'
        )
        serializer = CompanyRetailerConnectionSerializer(connections, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except RetailerProfile.DoesNotExist:
        return Response({
            'error': 'Retailer profile not found. Please create a retailer profile first.'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_companies(request):
    """
    Get list of public companies that retailers can join
    """
    companies = Company.objects.filter(is_public=True)
    serializer = PublicCompanySerializer(companies, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_company_invite(request):
    """
    Send invitation to retailer (for company users)
    """
    try:
        # Check if user has a company
        company = request.user.companies.first()
        if not company:
            return Response({
                'error': 'You must be associated with a company to send invites.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        email = request.data.get('email')
        message = request.data.get('message', '')
        
        if not email:
            return Response({
                'error': 'Email is required.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if invite already exists for this email and company
        existing_invite = CompanyInvite.objects.filter(
            company=company,
            email=email,
            is_used=False
        ).first()
        
        if existing_invite and not existing_invite.is_expired():
            return Response({
                'error': 'An active invitation already exists for this email.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create invite
        invite = CompanyInvite.objects.create(
            company=company,
            invited_by=request.user,
            email=email,
            message=message
        )
        
        # Send email with invite link
        from .utils import send_company_invite_email
        email_sent = send_company_invite_email(invite)
        
        serializer = CompanyInviteSerializer(invite)
        
        if email_sent:
            return Response({
                'message': 'Invitation sent successfully.',
                'invite': serializer.data
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({
                'message': 'Invitation created but email sending failed.',
                'invite': serializer.data
            }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_invite_code(request):
    """
    Generate a new invite code for company (without sending email)
    """
    try:
        # Check if user has a company
        company = request.user.companies.first()
        if not company:
            return Response({
                'error': 'You must be associated with a company to generate invite codes.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        message = request.data.get('message', '')
        expires_in_days = request.data.get('expires_in_days', 7)  # Default 7 days
        
        # Validate expires_in_days
        if expires_in_days < 1 or expires_in_days > 30:
            return Response({
                'error': 'Expiration must be between 1 and 30 days.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create invite without email (for sharing manually)
        invite = CompanyInvite.objects.create(
            company=company,
            invited_by=request.user,
            email='',  # Empty email for manual sharing
            message=message
        )
        
        # Update expiration based on provided days
        invite.expires_at = timezone.now() + timedelta(days=expires_in_days)
        invite.save()
        
        serializer = CompanyInviteSerializer(invite)
        return Response({
            'message': 'Invite code generated successfully.',
            'invite_code': invite.invite_code,
            'expires_at': invite.expires_at,
            'invite': serializer.data
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_company_invites(request):
    """
    Get all invites sent by the company
    """
    try:
        # Check if user has a company
        company = request.user.companies.first()
        if not company:
            return Response({
                'error': 'You must be associated with a company.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        invites = CompanyInvite.objects.filter(company=company).order_by('-created_at')
        serializer = CompanyInviteSerializer(invites, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_retailer_requests(request):
    """
    Get all retailer requests for the company
    """
    try:
        # Check if user has a company
        company = request.user.companies.first()
        if not company:
            return Response({
                'error': 'You must be associated with a company.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        requests = RetailerRequest.objects.filter(company=company).order_by('-requested_at')
        serializer = RetailerRequestSerializer(requests, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_retailer_request(request):
    """
    Accept or reject a retailer request
    """
    try:
        # Check if user has a company
        company = request.user.companies.first()
        if not company:
            return Response({
                'error': 'You must be associated with a company.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        request_id = request.data.get('request_id')
        action = request.data.get('action')  # 'approve' or 'reject'
        credit_limit = request.data.get('credit_limit', 0)
        payment_terms = request.data.get('payment_terms', '')
        
        if not request_id or not action:
            return Response({
                'error': 'request_id and action are required.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if action not in ['approve', 'reject']:
            return Response({
                'error': 'action must be either "approve" or "reject".'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            retailer_request = RetailerRequest.objects.get(
                id=request_id,
                company=company,
                status='pending'
            )
        except RetailerRequest.DoesNotExist:
            return Response({
                'error': 'Request not found or already processed.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        with transaction.atomic():
            if action == 'approve':
                # Update request status
                retailer_request.status = 'approved'
                retailer_request.reviewed_at = timezone.now()
                retailer_request.reviewed_by = request.user
                retailer_request.save()
                
                # Create connection
                connection = CompanyRetailerConnection.objects.create(
                    company=company,
                    retailer=retailer_request.retailer,
                    status='approved',
                    approved_by=request.user,
                    approved_at=timezone.now(),
                    credit_limit=credit_limit,
                    payment_terms=payment_terms
                )
                
                # Send approval email
                from .utils import send_request_status_email
                send_request_status_email(retailer_request, approved=True)
                
                return Response({
                    'message': 'Retailer request approved successfully.',
                    'connection_id': connection.id
                }, status=status.HTTP_200_OK)
                
            else:  # reject
                # Update request status
                retailer_request.status = 'rejected'
                retailer_request.reviewed_at = timezone.now()
                retailer_request.reviewed_by = request.user
                retailer_request.save()
                
                # Send rejection email
                from .utils import send_request_status_email
                send_request_status_email(retailer_request, approved=False)
                
                return Response({
                    'message': 'Retailer request rejected.'
                }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_company_connections(request):
    """
    Get all retailer connections for the company
    """
    try:
        # Check if user has a company
        company = request.user.companies.first()
        if not company:
            return Response({
                'error': 'You must be associated with a company.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        status_filter = request.query_params.get('status', 'approved')
        
        connections = CompanyRetailerConnection.objects.filter(
            company=company,
            status=status_filter
        ).order_by('-connected_at')
        
        serializer = CompanyRetailerConnectionSerializer(connections, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_connection_status(request):
    """
    Update retailer connection status (suspend/reactivate)
    """
    try:
        # Check if user has a company
        company = request.user.companies.first()
        if not company:
            return Response({
                'error': 'You must be associated with a company.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        connection_id = request.data.get('connection_id')
        new_status = request.data.get('status')  # 'approved' or 'suspended'
        
        if not connection_id or not new_status:
            return Response({
                'error': 'connection_id and status are required.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if new_status not in ['approved', 'suspended']:
            return Response({
                'error': 'status must be either "approved" or "suspended".'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            connection = CompanyRetailerConnection.objects.get(
                id=connection_id,
                company=company
            )
        except CompanyRetailerConnection.DoesNotExist:
            return Response({
                'error': 'Connection not found.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        connection.status = new_status
        connection.save()
        
        action_text = "suspended" if new_status == 'suspended' else "reactivated"
        
        return Response({
            'message': f'Connection {action_text} successfully.'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_by_code(request):
    """
    Join a company using an invite code
    """
    try:
        serializer = JoinByCodeSerializer(data=request.data)
        
        if serializer.is_valid():
            invite_code = serializer.validated_data['invite_code']
            
            try:
                invite = CompanyInvite.objects.get(
                    invite_code=invite_code,
                    is_used=False
                )
            except CompanyInvite.DoesNotExist:
                return Response({
                    'error': 'Invalid or expired invite code.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if invite.is_expired():
                return Response({
                    'error': 'Invite code has expired.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get or create retailer profile
            retailer_profile, created = RetailerProfile.objects.get_or_create(
                user=request.user,
                defaults={
                    'business_name': request.data.get('business_name', ''),
                    'business_address': request.data.get('business_address', ''),
                    'phone_number': request.data.get('phone_number', ''),
                    'business_type': request.data.get('business_type', 'retail')
                }
            )
            
            # Check if connection already exists
            existing_connection = CompanyRetailerConnection.objects.filter(
                company=invite.company,
                retailer=retailer_profile
            ).first()
            
            if existing_connection:
                return Response({
                    'error': 'You are already connected to this company.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            with transaction.atomic():
                # Mark invite as used
                invite.is_used = True
                invite.used_at = timezone.now()
                invite.used_by = request.user
                invite.save()
                
                # Create connection
                connection = CompanyRetailerConnection.objects.create(
                    company=invite.company,
                    retailer=retailer_profile,
                    status='approved',
                    approved_by=invite.invited_by,
                    approved_at=timezone.now()
                )
                
                return Response({
                    'message': 'Successfully joined the company.',
                    'company': {
                        'id': invite.company.id,
                        'name': invite.company.name,
                        'address': invite.company.address
                    }
                }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_company_approval(request):
    """
    Request to join a company (retailer sends request to company)
    """
    try:
        company_id = request.data.get('company_id')
        message = request.data.get('message', '')
        
        if not company_id:
            return Response({
                'error': 'company_id is required.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            company = Company.objects.get(id=company_id)
        except Company.DoesNotExist:
            return Response({
                'error': 'Company not found.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get or create retailer profile
        retailer_profile, created = RetailerProfile.objects.get_or_create(
            user=request.user,
            defaults={
                'business_name': request.data.get('business_name', ''),
                'business_address': request.data.get('business_address', ''),
                'phone_number': request.data.get('phone_number', ''),
                'business_type': request.data.get('business_type', 'retail')
            }
        )
        
        # Check if request already exists
        existing_request = RetailerRequest.objects.filter(
            company=company,
            retailer=retailer_profile,
            status='pending'
        ).first()
        
        if existing_request:
            return Response({
                'error': 'A pending request already exists for this company.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if connection already exists
        existing_connection = CompanyRetailerConnection.objects.filter(
            company=company,
            retailer=retailer_profile
        ).first()
        
        if existing_connection:
            return Response({
                'error': 'You are already connected to this company.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create request
        retailer_request = RetailerRequest.objects.create(
            company=company,
            retailer=retailer_profile,
            message=message
        )
        
        serializer = RetailerRequestSerializer(retailer_request)
        
        return Response({
            'message': 'Request sent successfully. Please wait for company approval.',
            'request': serializer.data
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def retailer_counts(request):
    """
    Get dashboard counts for retailer
    """
    try:
        retailer_profile = request.user.retailer_profile
        
        # Count connected companies
        connected_companies = CompanyRetailerConnection.objects.filter(
            retailer=retailer_profile,
            status='approved'
        ).count()
        
        # Count orders placed by this retailer
        orders_count = Order.objects.filter(retailer__user=request.user).count()
        
        # Count pending requests
        pending_requests = RetailerRequest.objects.filter(
            retailer=retailer_profile,
            status='pending'
        ).count()
        
        return Response({
            'connected_companies': connected_companies,
            'total_orders': orders_count,
            'pending_requests': pending_requests
        }, status=status.HTTP_200_OK)
        
    except RetailerProfile.DoesNotExist:
        return Response({
            'error': 'Retailer profile not found. Please create a retailer profile first.'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def retailer_companies_count(request):
    """
    Get count of connected companies for retailer
    """
    try:
        retailer_profile = request.user.retailer_profile
        count = CompanyRetailerConnection.objects.filter(
            retailer=retailer_profile,
            status='approved'
        ).count()
        
        return Response({'count': count}, status=status.HTTP_200_OK)
        
    except RetailerProfile.DoesNotExist:
        return Response({
            'error': 'Retailer profile not found.'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def retailer_orders(request):
    """
    Get orders for the current retailer
    """
    try:
        # Get orders where the retailer's user matches the current user
        orders = Order.objects.filter(retailer__user=request.user).order_by('-order_date')
        serializer = RetailerOrderSerializer(orders, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def retailer_products(request):
    """
    Get products from companies connected to the retailer
    """
    try:
        retailer_profile = request.user.retailer_profile
        
        # Get companies connected to this retailer
        connected_companies = CompanyRetailerConnection.objects.filter(
            retailer=retailer_profile,
            status='approved'
        ).values_list('company_id', flat=True)
        
        # Get products from connected companies
        products = Product.objects.filter(company_id__in=connected_companies)
        serializer = RetailerProductSerializer(products, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except RetailerProfile.DoesNotExist:
        return Response({
            'error': 'Retailer profile not found. Please create a retailer profile first.'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def retailer_profile(request):
    """
    Get or update retailer profile for the current user
    """
    try:
        if request.method == 'GET':
            try:
                profile = request.user.retailer_profile
                serializer = RetailerProfileSerializer(profile)
                return Response(serializer.data, status=status.HTTP_200_OK)
            except RetailerProfile.DoesNotExist:
                return Response({
                    'error': 'Retailer profile not found. Please create a profile first.',
                    'has_profile': False
                }, status=status.HTTP_404_NOT_FOUND)
        
        elif request.method == 'PUT':
            try:
                profile = request.user.retailer_profile
                # Update existing profile
                serializer = RetailerProfileSerializer(profile, data=request.data, partial=True)
                if serializer.is_valid():
                    serializer.save()
                    return Response({
                        'message': 'Profile updated successfully.',
                        'profile': serializer.data
                    }, status=status.HTTP_200_OK)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
            except RetailerProfile.DoesNotExist:
                # Create new profile if it doesn't exist
                data = request.data.copy()
                data['user'] = request.user.id
                
                serializer = RetailerProfileSerializer(data=data)
                if serializer.is_valid():
                    profile = serializer.save(user=request.user)
                    return Response({
                        'message': 'Profile created successfully.',
                        'profile': serializer.data
                    }, status=status.HTTP_201_CREATED)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_product_quantities(request):
    """
    Manual API to update product quantities based on invoices or other operations
    """
    try:
        company_id = request.data.get('company_id')
        if not company_id:
            return Response({
                'error': 'company_id is required.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        updated_products = []
        
        # Get all products for the company
        products = Product.objects.filter(company_id=company_id)
        
        for product in products:
            # Calculate total shipped from all invoice items
            from .models import InvoiceItem
            total_shipped = InvoiceItem.objects.filter(
                Product=product,
                invoice__company_id=company_id
            ).aggregate(total=Sum('quantity'))['total'] or 0
            
            # Update product quantities
            old_shipped = product.total_shipped
            old_available = product.available_quantity
            
            product.total_shipped = total_shipped
            
            # Recalculate available quantity (assuming we have total_quantity)
            if hasattr(product, 'total_quantity') and product.total_quantity:
                product.available_quantity = max(0, product.total_quantity - total_shipped)
            
            product.save()
            
            updated_products.append({
                'product_id': product.product_id,
                'name': product.name,
                'old_shipped': old_shipped,
                'new_shipped': product.total_shipped,
                'old_available': old_available,
                'new_available': product.available_quantity
            })
        
        return Response({
            'message': f'Updated quantities for {len(updated_products)} products.',
            'updated_products': updated_products
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_retailer_profile(request):
    """
    API for retailers to create their own profile (self-registration)
    No company association - they can join companies later via invites/requests
    """
    try:
        # Check if user already has a retailer profile
        if hasattr(request.user, 'retailer_profile'):
            return Response({
                "error": "Retailer profile already exists for this user"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        data = request.data.copy()
        data['user'] = request.user.id
        
        # Remove company field if present (not needed for self-registration)
        data.pop('company', None)
        data.pop('company_id', None)
        
        serializer = RetailerProfileSerializer(data=data)
        if serializer.is_valid():
            retailer = serializer.save()
            
            response_data = serializer.data
            response_data['message'] = "Retailer profile created successfully! You can now browse public companies or wait for invitations."
            
            return Response(response_data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            "error": f"An error occurred: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_retailer_profile(request):
    """
    Check if the current user has a retailer profile
    """
    try:
        has_profile = hasattr(request.user, 'retailer_profile')
        
        response_data = {
            'has_profile': has_profile,
            'user_id': request.user.id,
            'username': request.user.username,
            'email': request.user.email
        }
        
        if has_profile:
            profile = request.user.retailer_profile
            response_data['profile_id'] = profile.id
            response_data['business_name'] = profile.business_name
            response_data['is_verified'] = profile.is_verified
            response_data['is_active'] = profile.is_active
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


