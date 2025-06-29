from django.db import models
from django.contrib.auth.models import User
from django.db.models import Count
from decimal import Decimal

class Company(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='companies')
    name = models.CharField(max_length=255)
    gstin = models.CharField(max_length=15, unique=True)
    address = models.TextField()
    state = models.CharField(max_length=100)
    city = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)
    phone = models.CharField(max_length=15, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Category(models.Model):
    category_id = models.AutoField(primary_key=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.name

    @classmethod
    def get_category_counts(cls):
        """
        Returns a queryset with categories and their respective product counts.
        """
        return cls.objects.annotate(product_count=Count('products'))

class Product(models.Model):
    product_id = models.AutoField(primary_key=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=255)
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name="products",
        null=True,           # Allow null in DB
        blank=True           # Allow blank in forms/admin
    )
    available_quantity = models.PositiveIntegerField()
    UQC_CHOICES = [
        ('BAG', 'Bags'),
    ('BAL', 'Bale'),
    ('BDL', 'Bundles'),
    ('BKL', 'Buckles'),
    ('BOU', 'Billions of Units'),
    ('BOX', 'Box'),
    ('BTL', 'Bottles'),
    ('BUN', 'Bunches'),
    ('CAN', 'Cans'),
    ('CBM', 'Cubic Meter'),
    ('CCM', 'Cubic Centimeter'),
    ('CMS', 'Centimeters'),
    ('CTN', 'Cartons'),
    ('DOZ', 'Dozens'),
    ('DRM', 'Drums'),
    ('GGK', 'Great Gross'),
    ('GMS', 'Grams'),
    ('GRS', 'Gross'),
    ('GYD', 'Gross Yards'),
    ('KGS', 'Kilograms'),
    ('KLR', 'Kilolitre'),
    ('KME', 'Kilometre'),
    ('LTR', 'Litre'),
    ('MTR', 'Meters'),
    ('MLT', 'Millilitre'),
    ('MTS', 'Metric Ton'),
    ('NOS', 'Numbers'),
    ('PAC', 'Packs'),
    ('PCS', 'Pieces'),
    ('PRS', 'Pairs'),
    ('QTL', 'Quintal'),
    ('ROL', 'Rolls'),
    ('SET', 'Sets'),
    ('SQF', 'Square Feet'),
    ('SQM', 'Square Meter'),
    ('SQY', 'Square Yards'),
    ('TBS', 'Tablets'),
    ('TGM', 'Ten Grams'),
    ('THD', 'Thousands'),
    ('TON', 'Tonne'),
    ('TUB', 'Tubes'),
    ('UGS', 'US Gallons'),
    ('UNT', 'Units'),
    ('YDS', 'Yards'),
    # Add more as per official UQC list if needed
    ]
    unit = models.CharField(max_length=10, choices=UQC_CHOICES, default='KGS')
    total_shipped = models.PositiveIntegerField(default=0)
    total_required_quantity = models.PositiveIntegerField(default=0)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    hsn_code = models.CharField(max_length=10,default='0000')
    cgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    sgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    igst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    cess_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00')) 
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="products")  # New field

    STATUS_CHOICES = [
        ('on_demand', 'On Demand'),
        ('sufficient', 'Sufficient')
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='sufficient')

    def update_status(self):
        """Update the status based on available and required quantity."""
        available = self.available_quantity if isinstance(self.available_quantity, int) else 0
        required = self.total_required_quantity if isinstance(self.total_required_quantity, int) else 0
        self.status = 'sufficient' if available > required else 'on_demand'

    def save(self, *args, **kwargs):
        self.update_status()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Retailer(models.Model):
    retailer_id = models.AutoField(primary_key=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="retailers")

    # Basic Info
    name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=255, blank=True, null=True)  # Optional
    email = models.EmailField(blank=True, null=True)
    contact = models.CharField(max_length=20)

    # Address
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100, default='Tamil Nadu')
    pincode = models.CharField(max_length=10)
    country = models.CharField(max_length=100, default='India')

    # Tax Info
    gstin = models.CharField(max_length=15, blank=True)

    # Business logic
    distance_from_warehouse = models.FloatField(help_text="Distance in kilometers")
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.city}, {self.state}"


class Order(models.Model):
    order_id = models.AutoField(primary_key=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="orders")
    retailer = models.ForeignKey(Retailer, on_delete=models.CASCADE)
    order_date = models.DateTimeField(auto_now_add=True)
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('allocated', 'Allocated'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled')
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    def __str__(self):
        return f"Order {self.order_id} - {self.retailer.name}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.product.name} x {self.quantity} (Order {self.order.order_id})"
    
class Invoice(models.Model):
    invoice_number = models.CharField(max_length=20, unique=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="invoices")
    Retailer = models.ForeignKey(Retailer, on_delete=models.CASCADE)
    invoice_date = models.DateTimeField()
    due_date = models.DateTimeField(blank=True, null=True)
    is_einvoice_generated = models.BooleanField(default=False)
    irn = models.CharField(max_length=100, blank=True)
    qr_code = models.ImageField(upload_to='qr_codes/', blank=True, null=True)
    total_taxable_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_cgst = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_sgst = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_igst = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_mode = models.CharField(max_length=20, choices=[('cash', 'Cash'), ('upi', 'UPI'), ('card', 'Card'), ('bank', 'Bank')], default='cash')
    payment_status = models.CharField(max_length=20, choices=[('paid', 'Paid'), ('unpaid', 'Unpaid'), ('partial', 'Partial')], default='unpaid')

    class Meta:
        unique_together = ('invoice_number', 'company') 

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.Retailer.name}"

class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, related_name='items', on_delete=models.CASCADE)
    Product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2) 
    taxable_value = models.DecimalField(max_digits=10, decimal_places=2)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    cgst = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sgst = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    igst = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    hsn_code = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return f"{self.Product.name} x {self.quantity} (Invoice {self.invoice.invoice_number})"

class Truck(models.Model):
    truck_id = models.AutoField(primary_key=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="trucks")
    license_plate = models.CharField(max_length=20, unique=True)
    capacity = models.PositiveIntegerField(help_text="Maximum shipment capacity")
    is_available = models.BooleanField(default=True)

    def __str__(self):
        return self.license_plate


class Employee(models.Model):
    employee_id = models.AutoField(primary_key=True)  # ✅ Ensuring ID is auto-generated
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="employees")
    retailer = models.ForeignKey(Retailer, on_delete=models.CASCADE, related_name="employees", null=True, blank=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="employee_profile", null=True)
    contact = models.CharField(max_length=20, default="Not Provided")
    truck = models.OneToOneField(Truck, on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} (Truck: {self.truck.license_plate if self.truck else 'No Truck Assigned'})"


class Shipment(models.Model):
    shipment_id = models.AutoField(primary_key=True)
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="shipment")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="shipments", null=True, blank=True)
    shipment_date = models.DateTimeField(auto_now_add=True)

    STATUS_CHOICES = [
        ('in_transit', 'In Transit'),
        ('delivered', 'Delivered'),
        ('failed', 'Failed')
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_transit')

    def save(self, *args, **kwargs):
        """
        If shipment is marked as 'delivered', update:
        - The corresponding order's status to 'delivered'.
        - Reduce the product's total_required_quantity.
        - Increase the product's total_shipped.
        """
        if self.status == "delivered":
            order = self.order

            # Update order status
            order.status = "delivered"
            order.save(update_fields=["status"])

            # Update all product details
            for item in order.items.all():
                product = item.product
                product.total_required_quantity = max(0, product.total_required_quantity - item.quantity)
                product.total_shipped += item.quantity
                product.save(update_fields=["total_required_quantity", "total_shipped"])

        super().save(*args, **kwargs)

    def __str__(self):
        if self.employee is not None and self.employee.truck is not None:
            truck_license_plate = self.employee.truck.license_plate
        else:
            truck_license_plate = 'No Truck Assigned'
        return f"Shipment {self.shipment_id} - {truck_license_plate}"


class OdooCredentials(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="odoo_credentials")
    db = models.CharField(max_length=255)
    username = models.CharField(max_length=255)
    password = models.CharField(max_length=255)

    def __str__(self):
        return f"Odoo Credentials for {self.user.username}"