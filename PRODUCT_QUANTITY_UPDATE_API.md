# Product Quantity Update API Documentation

## Overview
This functionality allows updating product quantities when invoices are created, ensuring inventory tracking is accurate.

## Two Ways to Update Product Quantities

### 1. Automatic Updates (Recommended)
When you create or update an invoice through the Invoice API, product quantities are **automatically updated**:

**POST** `/invoices/` or **PUT** `/invoices/{id}/`

The system will:
- ✅ Increase `total_shipped` by invoice item quantities
- ✅ Decrease `available_quantity` by invoice item quantities  
- ✅ Update product `status` (sufficient/on_demand) automatically
- ✅ Handle insufficient stock gracefully (sets available_quantity to 0)

### 2. Manual Updates (For Custom Cases)
**POST** `/update-product-quantities/`

Use this for custom quantity updates outside of invoice creation.

## API Details

### Automatic Invoice Updates
```json
POST /invoices/
{
    "invoice_number": "INV-001",
    "company": 1,
    "Retailer": 1,
    "invoice_date": "2025-07-06T10:00:00Z",
    "items": [
        {
            "Product": 1,
            "quantity": 50,
            "price": 100.00,
            "taxable_value": 5000.00,
            "gst_rate": 18.00
        }
    ]
}
```

**What happens automatically:**
- Product ID 1: `total_shipped += 50`, `available_quantity -= 50`
- Product status recalculated based on new quantities

### Manual Quantity Updates
```json
POST /update-product-quantities/
{
    "product_updates": [
        {
            "product_id": 1,
            "shipped_quantity": 50,
            "reduce_available": true
        },
        {
            "product_id": 2,
            "shipped_quantity": 30,
            "reduce_available": false
        }
    ]
}
```

**Parameters:**
- `product_id`: ID of the product to update
- `shipped_quantity`: Amount to add to total_shipped
- `reduce_available`: (optional, default: false) Whether to reduce available_quantity

**Response:**
```json
{
    "message": "Product quantities updated successfully",
    "updated_products": [
        {
            "product_id": 1,
            "product_name": "Sample Product",
            "total_shipped": 150,
            "available_quantity": 850,
            "status": "sufficient"
        }
    ]
}
```

## Product Status Logic

The product status is automatically calculated when quantities are updated:

```python
def update_status(self):
    available = self.available_quantity
    required = self.total_required_quantity
    self.status = 'sufficient' if available > required else 'on_demand'
```

- **sufficient**: Available quantity > Required quantity
- **on_demand**: Available quantity ≤ Required quantity

## Error Handling

### Insufficient Stock (Manual Updates)
```json
{
    "error": "Insufficient available quantity for product Sample Product. Available: 10, Requested: 50"
}
```

### Product Not Found
```json
{
    "error": "Product with ID 999 does not exist"
}
```

### Missing Data
```json
{
    "error": "product_id is required for each product update"
}
```

## Frontend Integration Examples

### Creating Invoice with Automatic Updates
```javascript
const createInvoice = async (invoiceData) => {
    const response = await fetch('/invoices/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(invoiceData)
    });
    
    if (response.ok) {
        console.log('Invoice created and product quantities updated automatically');
    }
    
    return response.json();
};
```

### Manual Quantity Update
```javascript
const updateProductQuantities = async (productUpdates) => {
    const response = await fetch('/update-product-quantities/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ product_updates: productUpdates })
    });
    
    return response.json();
};

// Usage
const updates = [
    {
        product_id: 1,
        shipped_quantity: 25,
        reduce_available: true
    }
];

updateProductQuantities(updates);
```

## Transaction Safety

Both automatic and manual updates use database transactions to ensure:
- ✅ All quantity updates succeed or none do
- ✅ Data consistency is maintained
- ✅ No partial updates in case of errors

## Best Practices

1. **Use Automatic Updates**: Prefer creating invoices to automatically update quantities
2. **Manual Updates**: Use only for special cases (returns, adjustments, etc.)
3. **Validation**: Always validate sufficient stock before creating invoices
4. **Monitoring**: Check product status regularly to identify on-demand items

## Database Impact

When quantities are updated:
1. `Product.total_shipped` is increased
2. `Product.available_quantity` is decreased (if specified)
3. `Product.status` is recalculated and updated
4. `Product.save()` is called, triggering any additional business logic
