# Entity-Relationship Diagram (ERD) - Vendor Management System

## Database Schema Overview

This ERD represents the complete database structure for the Vendor Management System built with Django.

```mermaid
erDiagram
    User {
        int id PK
        string username
        string email
        string first_name
        string last_name
        datetime date_joined
        boolean is_active
    }

    Company {
        int id PK
        int user_id FK
        string name
        string gstin UK "Unique GSTIN"
        text address
        string state
        string city
        string pincode
        string phone
        string email
        datetime created_at
    }

    Category {
        int category_id PK
        int company_id FK
        string name UK "Unique category name"
    }

    Product {
        int product_id PK
        int company_id FK
        int category_id FK "Nullable"
        int created_by_id FK "Nullable"
        string name
        int available_quantity
        string unit "UQC choices"
        int total_shipped
        int total_required_quantity
        decimal price
        string hsn_code
        decimal cgst_rate
        decimal sgst_rate
        decimal igst_rate
        decimal cess_rate
        string status "on_demand/sufficient"
    }

    Retailer {
        int retailer_id PK
        int company_id FK
        string name
        string contact_person "Nullable"
        string email "Nullable"
        string contact
        string address_line1
        string address_line2 "Nullable"
        string city
        string state
        string pincode
        string country
        string gstin
        float distance_from_warehouse
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    Order {
        int order_id PK
        int company_id FK
        int retailer_id FK
        datetime order_date
        string status "pending/allocated/delivered/cancelled"
    }

    OrderItem {
        int id PK
        int order_id FK
        int product_id FK
        int quantity
    }

    Invoice {
        int id PK
        string invoice_number
        int company_id FK
        int retailer_id FK
        datetime invoice_date
        date due_date "Nullable"
        boolean is_einvoice_generated
        string irn
        image qr_code "Nullable"
        decimal total_taxable_value
        decimal total_cgst
        decimal total_sgst
        decimal total_igst
        decimal grand_total
        string payment_mode "cash/upi/card/bank"
        string payment_status "paid/unpaid/partial"
    }

    InvoiceItem {
        int id PK
        int invoice_id FK
        int product_id FK
        int quantity
        decimal price
        decimal taxable_value
        decimal gst_rate
        decimal cgst
        decimal sgst
        decimal igst
        string hsn_code "Nullable"
    }

    Truck {
        int truck_id PK
        int company_id FK
        string license_plate UK "Unique license plate"
        int capacity
        boolean is_available
    }

    Employee {
        int employee_id PK
        int company_id FK
        int retailer_id FK "Nullable"
        int user_id FK "OneToOne, Nullable"
        int truck_id FK "OneToOne, Nullable"
        string contact
    }

    Shipment {
        int shipment_id PK
        int order_id FK "OneToOne"
        int employee_id FK "Nullable"
        datetime shipment_date
        string status "in_transit/delivered/failed"
    }

    OdooCredentials {
        int id PK
        int user_id FK "OneToOne"
        string db
        string username
        string password
    }

    %% Relationships
    User ||--o{ Company : "owns"
    User ||--o| Employee : "has profile"
    User ||--o| OdooCredentials : "has credentials"
    User ||--o{ Product : "creates"

    Company ||--o{ Category : "has"
    Company ||--o{ Product : "manages"
    Company ||--o{ Retailer : "serves"
    Company ||--o{ Order : "receives"
    Company ||--o{ Invoice : "generates"
    Company ||--o{ Truck : "owns"
    Company ||--o{ Employee : "employs"

    Category ||--o{ Product : "categorizes"
    
    Product ||--o{ OrderItem : "ordered in"
    Product ||--o{ InvoiceItem : "invoiced in"

    Retailer ||--o{ Order : "places"
    Retailer ||--o{ Invoice : "receives"
    Retailer ||--o{ Employee : "associated with"

    Order ||--o{ OrderItem : "contains"
    Order ||--o| Shipment : "shipped as"

    Invoice ||--o{ InvoiceItem : "contains"

    Truck ||--o| Employee : "assigned to"
    
    Employee ||--o{ Shipment : "handles"
```

## Key Relationships & Business Logic

### 1. **User Management**
- **User** → **Company**: One user can own multiple companies
- **User** → **Employee**: One-to-one relationship for employee profiles
- **User** → **OdooCredentials**: One-to-one for Odoo integration
- **User** → **Product**: Tracks who created each product

### 2. **Company Structure**
- **Company** is the central entity that owns:
  - Categories and Products
  - Retailers and Orders
  - Trucks and Employees
  - Invoices

### 3. **Product Management**
- **Category** → **Product**: Optional categorization
- **Product** has inventory tracking fields:
  - `available_quantity`: Current stock
  - `total_required_quantity`: Total demand
  - `total_shipped`: Total delivered
  - `status`: Auto-calculated (sufficient/on_demand)

### 4. **Order Processing Flow**
- **Retailer** → **Order** → **OrderItem** → **Product**
- **Order** → **Shipment** (One-to-one)
- **Employee** → **Shipment** (Employee handles delivery)
- **Truck** → **Employee** (One-to-one assignment)

### 5. **Invoicing System**
- **Invoice** → **InvoiceItem** → **Product**
- Invoice has comprehensive tax calculations (CGST, SGST, IGST)
- Unique constraint on (`invoice_number`, `company`)

### 6. **Shipment & Delivery**
- **Shipment** automatically updates:
  - Order status to 'delivered'
  - Product quantities (reduces required, increases shipped)
  - This is handled in the `Shipment.save()` method

## Database Constraints

### Unique Constraints
- `Company.gstin`: Unique GST identification
- `Category.name`: Unique category names
- `Truck.license_plate`: Unique truck identification
- `Invoice`: Unique (`invoice_number`, `company`) combination

### Foreign Key Relationships
- Most entities are company-scoped for multi-tenancy
- Soft relationships with nullable foreign keys where appropriate
- Cascade deletions configured to maintain data integrity

## Business Rules Implemented

1. **Inventory Management**: Product status auto-updates based on available vs required quantity
2. **Order Fulfillment**: Shipment delivery automatically updates order status and product quantities
3. **Multi-tenancy**: Company-based data isolation
4. **Tax Compliance**: Comprehensive GST tax structure support
5. **Resource Assignment**: One-to-one truck-employee assignment

This ERD represents a comprehensive vendor management system with inventory tracking, order processing, invoicing, and delivery management capabilities.
