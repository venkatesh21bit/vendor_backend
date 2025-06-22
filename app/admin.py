from django.contrib import admin
from django.contrib.auth.models import User
from .models import Company,Category, Product, Retailer, Order, Employee, Truck, Shipment,OdooCredentials,Invoice, InvoiceItem, OrderItem

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
    search_fields = ('retailer__name',)
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
    list_display = ('retailer_id', 'name', 'address_line1', 'city', 'state', 'contact', 'is_active')
    search_fields = ('name', 'city', 'state')


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
    list_display = ('invoice_number', 'Retailer', 'invoice_date', 'grand_total',  'is_einvoice_generated')

@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'Product', 'quantity', 'taxable_value')