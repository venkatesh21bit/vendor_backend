# Generated manually to rename fields from capitalized to lowercase

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0003_remove_order_company'),
    ]

    operations = [
        migrations.RenameField(
            model_name='invoice',
            old_name='Retailer',
            new_name='retailer',
        ),
        migrations.RenameField(
            model_name='invoiceitem',
            old_name='Product',
            new_name='product',
        ),
    ]
