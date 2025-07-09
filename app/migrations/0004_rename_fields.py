# Generated manually to rename fields from capitalized to lowercase

from django.db import migrations, models
import django.db.models.deletion


def copy_retailer_data(apps, schema_editor):
    Invoice = apps.get_model('app', 'Invoice')
    for invoice in Invoice.objects.all():
        invoice.retailer = invoice.Retailer
        invoice.save()

def copy_product_data(apps, schema_editor):
    InvoiceItem = apps.get_model('app', 'InvoiceItem')
    for item in InvoiceItem.objects.all():
        item.product = item.Product
        item.save()

def reverse_retailer_data(apps, schema_editor):
    Invoice = apps.get_model('app', 'Invoice')
    for invoice in Invoice.objects.all():
        invoice.Retailer = invoice.retailer
        invoice.save()

def reverse_product_data(apps, schema_editor):
    InvoiceItem = apps.get_model('app', 'InvoiceItem')
    for item in InvoiceItem.objects.all():
        item.Product = item.product
        item.save()


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0003_remove_order_company'),
    ]

    operations = [
        # Add new fields with correct names
        migrations.AddField(
            model_name='invoice',
            name='retailer',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='retailer_invoices', to='app.retailer'),
        ),
        migrations.AddField(
            model_name='invoiceitem',
            name='product',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='invoice_items', to='app.product'),
        ),
        # Copy data from old fields to new fields
        migrations.RunPython(copy_retailer_data, reverse_retailer_data),
        migrations.RunPython(copy_product_data, reverse_product_data),
        # Remove old fields
        migrations.RemoveField(
            model_name='invoice',
            name='Retailer',
        ),
        migrations.RemoveField(
            model_name='invoiceitem',
            name='Product',
        ),
        # Make the new fields non-nullable
        migrations.AlterField(
            model_name='invoice',
            name='retailer',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='retailer_invoices', to='app.retailer'),
        ),
        migrations.AlterField(
            model_name='invoiceitem',
            name='product',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invoice_items', to='app.product'),
        ),
    ]
