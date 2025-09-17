# Vendor Management Backend API Documentation

## Overview
This is a comprehensive Express.js backend API for the Vendor Management Platform that supports manufacturer, retailer, and employee workflows with MongoDB as the database.

## Base URL
`http://localhost:8000/api`

## Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Database Models

### User Model
- **username**: String (unique)
- **email**: String (unique)
- **password**: String (hashed)
- **first_name**: String
- **last_name**: String
- **role**: ['manufacturer', 'retailer', 'employee']
- **is_staff**: Boolean
- **is_active**: Boolean

### Company Model
- **name**: String
- **description**: String
- **address**: String
- **city**, **state**, **pincode**: String
- **owner**: ObjectId (User)
- **employees**: [ObjectId] (Users)
- **is_public**: Boolean
- **settings**: Object

### RetailerProfile Model
- **user**: ObjectId (User)
- **business_name**: String
- **contact_person**: String
- **phone**: String
- **address details**: String
- **gstin**: String
- **is_verified**: Boolean

### Product Model
- **name**: String
- **company**: ObjectId (Company)
- **category**: ObjectId (ProductCategory)
- **price**: Number
- **available_quantity**: Number
- **unit**: String
- **hsn_code**: String
- **tax rates**: Numbers (cgst, sgst, igst, cess)
- **status**: ['sufficient', 'low_stock', 'out_of_stock']

### Order Model
- **order_number**: String (unique)
- **company**: ObjectId (Company)
- **retailer**: ObjectId (User)
- **items**: Array of order items
- **total_amount**: Number
- **status**: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
- **payment_status**: ['unpaid', 'partially_paid', 'paid']
- **assigned_employee**: ObjectId (User)

### Invoice Model
- **invoice_number**: String (unique)
- **company**: ObjectId (Company)
- **retailer**: ObjectId (User)
- **order**: ObjectId (Order)
- **items**: Array with tax calculations
- **grand_total**: Number
- **payment_status**: ['unpaid', 'partially_paid', 'paid', 'overdue']
- **is_einvoice_generated**: Boolean

## API Endpoints

### Authentication Endpoints

#### POST /api/register
Register a new user
**Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "first_name": "string",
  "last_name": "string",
  "role": "manufacturer|retailer|employee"
}
```

#### POST /api/token/
Login and get JWT tokens
**Body:**
```json
{
  "username": "string",
  "password": "string"
}
```
**Response:**
```json
{
  "access": "jwt_token",
  "refresh": "refresh_token"
}
```

#### POST /api/token/refresh/
Refresh JWT token
**Body:**
```json
{
  "refresh": "refresh_token"
}
```

#### POST /api/forgot-password/
Send password reset email
**Body:**
```json
{
  "username": "string"
}
```

### User Management

#### GET /api/user_detail/
Get current user details (requires auth)

### Company Management

#### GET /api/company/
Get companies for current user

#### POST /api/company/
Create a new company (manufacturer only)
**Body:**
```json
{
  "name": "string",
  "description": "string",
  "address": "string",
  "city": "string",
  "state": "string",
  "pincode": "string",
  "phone": "string",
  "email": "string",
  "gstin": "string"
}
```

#### GET /api/company/:id/
Get specific company details

#### PUT /api/company/:id/
Update company details

#### GET /api/companies/public/
Get public companies (no auth required)

### Connection Management (Company-Retailer)

#### POST /api/company/generate-invite-code/
Generate invite code for retailers
**Body:**
```json
{
  "message": "string",
  "expires_in_days": 7
}
```

#### GET /api/company/invites/
Get all company invitations

#### GET /api/company/retailer-requests/
Get retailer join requests

#### POST /api/company/accept-request/
Accept or reject retailer request
**Body:**
```json
{
  "request_id": 1,
  "action": "approve|reject",
  "credit_limit": 50000,
  "payment_terms": "Net 30 days"
}
```

#### GET /api/company/connections/
Get company-retailer connections

#### POST /api/company/update-connection/
Update connection status
**Body:**
```json
{
  "connection_id": 1,
  "status": "approved|suspended"
}
```

### Retailer Management

#### GET /api/retailer/profile/
Get retailer profile

#### PUT /api/retailer/profile/
Create/update retailer profile
**Body:**
```json
{
  "business_name": "string",
  "contact_person": "string",
  "phone": "string",
  "email": "string",
  "address_line1": "string",
  "city": "string",
  "state": "string",
  "pincode": "string"
}
```

#### POST /api/retailer/join-by-code/
Join company using invite code
**Body:**
```json
{
  "invite_code": "ABC12345"
}
```

#### POST /api/retailer/request-approval/
Request to join a company
**Body:**
```json
{
  "company_id": 1,
  "message": "string"
}
```

#### GET /api/retailer/companies/
Get connected companies for retailer

#### GET /api/retailer/products/
Get available products from connected companies

#### GET /api/retailer/orders/
Get orders for retailer

#### GET /api/retailer/count/
Get retailer dashboard counts

### Product Management

#### GET /api/products/
Get products (with filters: company, category, status)

#### POST /api/products/
Create a new product
**Body:**
```json
{
  "name": "string",
  "company": "company_id",
  "category": "category_id",
  "price": 100.00,
  "available_quantity": 50,
  "unit": "PCS",
  "hsn_code": "string",
  "cgst_rate": 9,
  "sgst_rate": 9,
  "igst_rate": 18
}
```

#### GET /api/products/:id/
Get specific product details

#### PUT /api/products/:id/
Update product

#### DELETE /api/products/:id/
Delete product

### Category Management

#### GET /api/categories/
Get product categories

#### POST /api/categories/
Create new category
**Body:**
```json
{
  "name": "string",
  "description": "string",
  "company": "company_id"
}
```

### Order Management

#### GET /api/orders/
Get orders (with filters: company, retailer, status)

#### POST /api/orders/
Create a new order
**Body:**
```json
{
  "company": "company_id",
  "retailer": "retailer_id",
  "items": [
    {
      "product": "product_id",
      "quantity": 10,
      "unit_price": 100.00
    }
  ],
  "delivery_address": {
    "address_line1": "string",
    "city": "string",
    "state": "string",
    "pincode": "string"
  }
}
```

#### GET /api/orders/:id/
Get specific order details

#### PUT /api/orders/:id/
Update order

#### DELETE /api/orders/:id/
Cancel order

### Invoice Management

#### GET /api/invoices/
Get invoices (with filters: company, retailer, payment_status)

#### POST /api/invoices/
Create a new invoice
**Body:**
```json
{
  "company": "company_id",
  "retailer": "retailer_id",
  "order": "order_id",
  "invoice_date": "2025-01-15",
  "due_date": "2025-02-14",
  "items": [
    {
      "product": "product_id",
      "quantity": 10,
      "unit_price": 100.00
    }
  ]
}
```

#### GET /api/invoices/:id/
Get specific invoice details

#### PUT /api/invoices/:id/
Update invoice

#### GET /api/invoices/count/
Get invoice count for company

### Employee Management

#### GET /api/employee_orders/
Get orders for employee management

#### PUT /api/employee_orders/:id/assign
Assign order to employee
**Body:**
```json
{
  "employee_id": "user_id"
}
```

#### PUT /api/employee_orders/:id/status
Update order status
**Body:**
```json
{
  "status": "delivered",
  "delivery_notes": "string",
  "tracking_number": "string"
}
```

#### POST /api/employee_orders/:id/delivery-proof
Upload delivery proof
**Body:**
```json
{
  "proof_url": "string"
}
```

#### GET /api/employee_orders/my-assignments
Get orders assigned to current employee

#### GET /api/employee_orders/stats
Get employee delivery statistics

### Dashboard & Analytics

#### GET /api/count
Get dashboard counts for manufacturer
**Query params:** company (required)

#### GET /api/retailers/
Get retailers for a company
**Query params:** company (required)

## Error Responses

All endpoints return consistent error responses:
```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- **200** - Success
- **201** - Created
- **400** - Bad Request (validation errors)
- **401** - Unauthorized (invalid token)
- **403** - Forbidden (permission denied)
- **404** - Not Found
- **500** - Internal Server Error

## Rate Limiting
- 100 requests per 15 minutes per IP address
- Applied to all /api/ endpoints

## Security Features
- JWT authentication with refresh tokens
- Password hashing with bcryptjs
- CORS configuration
- Helmet security headers
- Input validation with Joi
- Role-based access control
- MongoDB injection protection

## Environment Variables Required
```
PORT=8000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=30d
CORS_ORIGIN=http://localhost:3000
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env` file

3. Start the server:
   ```bash
   npm start
   ```

4. The API will be available at `http://localhost:8000/api`

5. Health check: `http://localhost:8000/health`

## Testing

The API has been tested with the MongoDB Atlas connection provided:
`mongodb+srv://venkateshk:venkat*2005@cluster0.mujtrmk.mongodb.net/vendor_platform`

All models, routes, and middleware have been implemented according to the frontend requirements analyzed from the React/Next.js application.
