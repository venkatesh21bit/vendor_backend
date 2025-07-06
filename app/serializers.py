from rest_framework import serializers
from .models import Product, Category, Retailer, Order, OrderItem, Employee, Truck, Shipment,Invoice, InvoiceItem,Company, PasswordResetOTP, RetailerProfile, CompanyRetailerConnection, CompanyInvite, RetailerRequest
from django.contrib.auth.models import User, Group
from django.contrib.auth import authenticate


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'
        extra_kwargs = {
            'user': {'read_only': True}
        }
   

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):

    class Meta:
        model = Product
        fields = '__all__'  # Keep all fields from the Product model, but override 'category'
        extra_kwargs = {
            'company': {'required': True},
            'category': {'required': False, 'allow_null': True},
            'created_by': {'read_only': True},
        }


class RetailerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Retailer
        fields = '__all__'

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'quantity']

class OrderSerializer(serializers.ModelSerializer):
    retailer_name = serializers.CharField(source='retailer.name', read_only=True)
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = ['order_id', 'company', 'retailer', 'retailer_name', 'order_date', 'status', 'items']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        order = Order.objects.create(**validated_data)
        for item_data in items_data:
            OrderItem.objects.create(order=order, **item_data)
        return order

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        instance = super().update(instance, validated_data)
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                OrderItem.objects.create(order=instance, **item_data)
        return instance


class TruckSerializer(serializers.ModelSerializer):
    class Meta:
        model = Truck
        fields = '__all__'

class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = '__all__'

class ShipmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    class Meta:
        model = Shipment
        fields = '__all__'
    
    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            return obj.employee.user.username
        return None

    def update(self, instance, validated_data):
        """
        When status is updated to 'delivered', update:
        - The order's status
        - The product's total_required_quantity and total_shipped
        """
        if "status" in validated_data and validated_data["status"] == "delivered":
            order = instance.order

            # Update order status
            order.status = "delivered"
            order.save(update_fields=["status"])

            # Update all products in the order
        for item in order.items.all():
            product = item.product
            product.total_required_quantity = max(0, product.total_required_quantity - item.quantity)
            product.total_shipped += item.quantity
            product.save(update_fields=["total_required_quantity", "total_shipped"])

        return super().update(instance, validated_data)
    
class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ['category_id', 'name', 'product_count']


class UserRegistrationSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(write_only=True)  # Accept group name during registration

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'group_name']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        group_name = validated_data.pop('group_name', None)
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # Assign the user to the specified group
        if group_name:
            try:
                group = Group.objects.get(name=group_name)
                user.groups.add(group)
                # Assign all permissions of the group to the user
                permissions = group.permissions.all()
                user.user_permissions.add(*permissions)
            except Group.DoesNotExist:
                raise serializers.ValidationError({"group_name": "Group does not exist."})

        return user
    
# accounting
class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = [
            'Product', 'quantity','price', 'taxable_value', 'gst_rate',
            'cgst', 'sgst', 'igst', 'hsn_code'
        ]

class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True)
    retailer_name = serializers.CharField(source='Retailer.name', read_only=True)  

    class Meta:
        model = Invoice
        fields = [
            'invoice_number', 'company', 'Retailer','retailer_name', 'invoice_date','due_date',
            'is_einvoice_generated', 'irn', 'qr_code',
            'total_taxable_value', 'total_cgst', 'total_sgst', 'total_igst',
            'grand_total', 'payment_mode', 'payment_status', 'items'
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        invoice = Invoice.objects.create(**validated_data)
        for item_data in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item_data)
        return invoice


# Password Reset Serializers
class ForgotPasswordSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    
    def validate(self, attrs):
        username = attrs.get('username')
        email = attrs.get('email')
        
        try:
            user = User.objects.get(username=username, email=email)
            attrs['user'] = user
        except User.DoesNotExist:
            raise serializers.ValidationError("User with this username and email does not exist.")
        
        return attrs


class VerifyOTPSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    otp = serializers.CharField(max_length=6)
    
    def validate(self, attrs):
        username = attrs.get('username')
        otp = attrs.get('otp')
        
        try:
            user = User.objects.get(username=username)
            otp_instance = PasswordResetOTP.objects.filter(
                user=user, 
                otp=otp, 
                is_verified=False
            ).first()
            
            if not otp_instance:
                raise serializers.ValidationError("Invalid OTP.")
            
            if otp_instance.is_expired():
                raise serializers.ValidationError("OTP has expired.")
            
            attrs['user'] = user
            attrs['otp_instance'] = otp_instance
        except User.DoesNotExist:
            raise serializers.ValidationError("User does not exist.")
        
        return attrs


class ResetPasswordSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    otp = serializers.CharField(max_length=6)
    new_password = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(min_length=8, write_only=True)
    
    def validate(self, attrs):
        username = attrs.get('username')
        otp = attrs.get('otp')
        new_password = attrs.get('new_password')
        confirm_password = attrs.get('confirm_password')
        
        if new_password != confirm_password:
            raise serializers.ValidationError("Passwords do not match.")
        
        try:
            user = User.objects.get(username=username)
            otp_instance = PasswordResetOTP.objects.filter(
                user=user, 
                otp=otp, 
                is_verified=True
            ).first()
            
            if not otp_instance:
                raise serializers.ValidationError("Invalid or unverified OTP.")
            
            if otp_instance.is_expired():
                raise serializers.ValidationError("OTP has expired.")
            
            attrs['user'] = user
            attrs['otp_instance'] = otp_instance
        except User.DoesNotExist:
            raise serializers.ValidationError("User does not exist.")
        
        return attrs


# Retailer-specific Serializers
class RetailerProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = RetailerProfile
        fields = '__all__'
        extra_kwargs = {
            'user': {'read_only': True}
        }


class CompanyRetailerConnectionSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    retailer_name = serializers.CharField(source='retailer.business_name', read_only=True)
    
    class Meta:
        model = CompanyRetailerConnection
        fields = '__all__'


class PublicCompanySerializer(serializers.ModelSerializer):
    """Serializer for public companies that retailers can discover"""
    
    class Meta:
        model = Company
        fields = ['id', 'name', 'description', 'city', 'state', 'created_at']


class CompanyInviteSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    invited_by_name = serializers.CharField(source='invited_by.username', read_only=True)
    
    class Meta:
        model = CompanyInvite
        fields = '__all__'
        extra_kwargs = {
            'invite_code': {'read_only': True},
            'invited_by': {'read_only': True}
        }


class RetailerRequestSerializer(serializers.ModelSerializer):
    retailer_name = serializers.CharField(source='retailer.business_name', read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)
    
    class Meta:
        model = RetailerRequest
        fields = '__all__'
        extra_kwargs = {
            'retailer': {'read_only': True}
        }


class JoinByCodeSerializer(serializers.Serializer):
    invite_code = serializers.CharField(max_length=20)
    
    def validate_invite_code(self, value):
        try:
            invite = CompanyInvite.objects.get(invite_code=value, is_used=False)
            if invite.is_expired():
                raise serializers.ValidationError("Invite code has expired.")
            return value
        except CompanyInvite.DoesNotExist:
            raise serializers.ValidationError("Invalid or already used invite code.")


# Update existing serializers to use new models
class RetailerOrderSerializer(serializers.ModelSerializer):
    """Serializer for orders from retailer perspective"""
    company_name = serializers.CharField(source='company.name', read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Order
        fields = ['order_id', 'company', 'company_name', 'order_date', 'status', 'items']


class RetailerProductSerializer(serializers.ModelSerializer):
    """Serializer for products from retailer perspective"""
    company_name = serializers.CharField(source='company.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = Product
        fields = [
            'product_id', 'name', 'category_name', 'company_name', 
            'available_quantity', 'unit', 'price', 'hsn_code', 
            'cgst_rate', 'sgst_rate', 'igst_rate', 'status'
        ]
