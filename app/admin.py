from django.contrib import admin
from django.contrib.auth.models import User
from .models import (
    Company, Category, Product, RetailerProfile, Order, Employee, Truck, Shipment,
    OdooCredentials, Invoice, InvoiceItem, OrderItem, CompanyRetailerConnection,
    CompanyInvite, RetailerRequest, PasswordResetOTP
)

# For backward compatibility, since we're using Retailer = RetailerProfile
Retailer = RetailerProfile

admin.site.register(Company)
# ✅ Category Admin
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('category_id', 'name')  # Changed 'id' to 'category_id'
    search_fields = ('name',)


# ✅ Product Admin
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('product_id', 'name', 'category', 'available_quantity', 'unit','total_required_quantity', 'status')  # Changed 'id' to 'product_id'
    search_fields = ('name',)
    list_filter = ('status',)


# ✅ Order Admin
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1  # Number of empty forms to display
    fields = ('product', 'quantity')
    readonly_fields = ()
    show_change_link = True

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'retailer', 'items_summary', 'status', 'order_date')
    search_fields = ('retailer__business_name',)
    list_filter = ('status', 'order_date')
    inlines = [OrderItemInline]  # <-- Show OrderItems inline

    def items_summary(self, obj):
        return ", ".join(
            f"{item.product.name} x {item.quantity}" for item in obj.items.all()
        )
    items_summary.short_description = "Items"

# ✅ Employee Admin (Filtered Dropdown to Show Only "Employee" Users)
@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('employee_id','user', 'contact', 'truck')  
    search_fields = ('user__username', 'contact')

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "user":
            kwargs["queryset"] = User.objects.filter(
                is_superuser=False,
                groups__name="Employee"
            ).exclude(employee_profile__isnull=False)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


# ✅ Retailer Admin
@admin.register(Retailer)
class RetailerAdmin(admin.ModelAdmin):
    list_display = ('id', 'business_name', 'address_line1', 'city', 'state', 'phone', 'is_active')
    search_fields = ('business_name', 'city', 'state', 'contact_person')
    list_filter = ('is_active', 'is_verified', 'state')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Business Information', {
            'fields': ('business_name', 'contact_person', 'phone', 'email')
        }),
        ('Address', {
            'fields': ('address_line1', 'address_line2', 'city', 'state', 'pincode', 'country')
        }),
        ('Business Details', {
            'fields': ('gstin', 'business_type', 'established_year')
        }),
        ('Status', {
            'fields': ('is_active', 'is_verified')
        }),
        ('System Information', {
            'fields': ('user', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


# ✅ Truck Admin
@admin.register(Truck)
class TruckAdmin(admin.ModelAdmin):
    list_display = ('truck_id', 'license_plate', 'capacity', 'is_available')  # Changed 'id' to 'truck_id'
    search_fields = ('license_plate',)


# ✅ Shipment Admin
@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ('shipment_id', 'order', 'employee', 'status', 'shipment_date')  # Changed 'id' to 'shipment_id'
    search_fields = ('order__order_id', 'employee__user__username')  # Fetch employee name properly
    list_filter = ('status', 'shipment_date')

@admin.register(OdooCredentials)
class OdooCredentialsAdmin(admin.ModelAdmin):
    list_display = ('user', 'db', 'username')  # Fields to display in the admin list view
    search_fields = ('user__username', 'db', 'username')  

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'retailer', 'invoice_date', 'grand_total', 'is_einvoice_generated')
    search_fields = ('invoice_number', 'retailer__business_name')
    list_filter = ('is_einvoice_generated', 'payment_status', 'invoice_date')

@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'Product', 'quantity', 'taxable_value')


# ✅ Company-Retailer Relationship Admin
@admin.register(CompanyRetailerConnection)
class CompanyRetailerConnectionAdmin(admin.ModelAdmin):
    list_display = ('company', 'retailer', 'status', 'connected_at', 'approved_by')
    search_fields = ('company__name', 'retailer__business_name')
    list_filter = ('status', 'connected_at', 'approved_at')
    readonly_fields = ('connected_at',)
    
    fieldsets = (
        ('Connection Information', {
            'fields': ('company', 'retailer', 'status')
        }),
        ('Approval Details', {
            'fields': ('approved_by', 'approved_at')
        }),
        ('Business Terms', {
            'fields': ('credit_limit', 'payment_terms')
        }),
        ('Timestamps', {
            'fields': ('connected_at',),
            'classes': ('collapse',)
        }),
    )


@admin.register(CompanyInvite)
class CompanyInviteAdmin(admin.ModelAdmin):
    list_display = ('invite_code', 'company', 'email', 'invited_by', 'is_used', 'created_at', 'expires_at')
    search_fields = ('invite_code', 'email', 'company__name')
    list_filter = ('is_used', 'created_at', 'expires_at')
    readonly_fields = ('invite_code', 'created_at', 'used_at')
    
    fieldsets = (
        ('Invite Information', {
            'fields': ('company', 'invited_by', 'email', 'message')
        }),
        ('Status', {
            'fields': ('invite_code', 'is_used', 'used_by', 'used_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'expires_at')
        }),
    )


@admin.register(RetailerRequest)
class RetailerRequestAdmin(admin.ModelAdmin):
    list_display = ('retailer', 'company', 'status', 'requested_at', 'reviewed_by')
    search_fields = ('retailer__business_name', 'company__name')
    list_filter = ('status', 'requested_at', 'reviewed_at')
    readonly_fields = ('requested_at',)
    
    fieldsets = (
        ('Request Information', {
            'fields': ('retailer', 'company', 'message')
        }),
        ('Status', {
            'fields': ('status', 'reviewed_by', 'reviewed_at')
        }),
        ('Timestamps', {
            'fields': ('requested_at',),
            'classes': ('collapse',)
        }),
    )


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = ('user', 'otp', 'is_verified', 'created_at', 'expires_at')
    search_fields = ('user__username', 'user__email')
    list_filter = ('is_verified', 'created_at', 'expires_at')
    readonly_fields = ('otp', 'created_at', 'expires_at')
    
    def has_add_permission(self, request):
        # Prevent manual creation of OTPs
        return False