# Retailer API Documentation

## Overview
Comprehensive API endpoints for retailer functionality, including company connections, invitations, requests, and data access.

## Authentication
All retailer APIs require authentication with JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## API Endpoints

### 1. Retailer Profile Management

#### Get/Update Retailer Profile
- **GET/PUT** `/retailer/profile/`
- **Description**: Get or update the current user's retailer profile
- **Authentication**: Required

**GET Response:**
```json
{
    "id": 1,
    "username": "retailer1",
    "business_name": "ABC Retail Store",
    "contact_person": "John Doe",
    "phone": "+1234567890",
    "email": "contact@abcretail.com",
    "address_line1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "pincode": "10001",
    "gstin": "GST123456789",
    "is_verified": false
}
```

**PUT Request:**
```json
{
    "business_name": "ABC Retail Store Updated",
    "contact_person": "John Doe",
    "phone": "+1234567890",
    "email": "contact@abcretail.com",
    "address_line1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "pincode": "10001"
}
```

### 2. Company Discovery & Connection

#### Get Public Companies
- **GET** `/companies/public/`
- **Description**: Get list of companies that allow retailers to discover and join
- **Authentication**: Not required

**Response:**
```json
[
    {
        "id": 1,
        "name": "TechCorp Industries",
        "description": "Leading technology solutions provider",
        "city": "San Francisco",
        "state": "CA",
        "created_at": "2025-01-01T00:00:00Z"
    }
]
```

#### Get Connected Companies
- **GET** `/retailer/companies/`
- **Description**: Get companies connected to the current retailer
- **Authentication**: Required

**Response:**
```json
[
    {
        "id": 1,
        "company": 1,
        "company_name": "TechCorp Industries",
        "retailer": 1,
        "retailer_name": "ABC Retail Store",
        "status": "approved",
        "connected_at": "2025-01-15T10:00:00Z",
        "credit_limit": "50000.00"
    }
]
```

### 3. Joining Companies

#### Join by Invite Code
- **POST** `/retailer/join-by-code/`
- **Description**: Join a company using an invitation code
- **Authentication**: Required

**Request:**
```json
{
    "invite_code": "ABC123XYZ789"
}
```

**Response:**
```json
{
    "message": "Successfully joined company.",
    "connection": {
        "id": 1,
        "company": 1,
        "company_name": "TechCorp Industries",
        "status": "approved"
    }
}
```

#### Request Company Approval
- **POST** `/retailer/request-approval/`
- **Description**: Send request to join a company
- **Authentication**: Required

**Request:**
```json
{
    "company_id": 1,
    "message": "We would like to partner with your company to sell your products."
}
```

**Response:**
```json
{
    "message": "Request sent successfully.",
    "request": {
        "id": 1,
        "company": 1,
        "company_name": "TechCorp Industries",
        "status": "pending",
        "requested_at": "2025-01-15T10:00:00Z"
    }
}
```

### 4. Company Invitations (For Company Users)

#### Send Invitation
- **POST** `/retailer/join-by-invite/`
- **Description**: Send invitation to a retailer (for company users)
- **Authentication**: Required (Company user)

**Request:**
```json
{
    "email": "retailer@example.com",
    "message": "We invite you to join our platform as a retailer partner."
}
```

**Response:**
```json
{
    "message": "Invitation sent successfully.",
    "invite": {
        "id": 1,
        "invite_code": "ABC123XYZ789",
        "email": "retailer@example.com",
        "expires_at": "2025-01-22T10:00:00Z"
    }
}
```

### 5. Data Access APIs

#### Get Retailer Orders
- **GET** `/retailer/orders/`
- **Description**: Get orders from all connected companies
- **Authentication**: Required

**Response:**
```json
[
    {
        "order_id": 1,
        "company": 1,
        "company_name": "TechCorp Industries",
        "order_date": "2025-01-15T10:00:00Z",
        "status": "pending",
        "items": [
            {
                "id": 1,
                "product": 1,
                "product_name": "Smartphone X1",
                "quantity": 10
            }
        ]
    }
]
```

#### Get Available Products
- **GET** `/retailer/products/`
- **Description**: Get products from all connected companies
- **Authentication**: Required

**Response:**
```json
[
    {
        "product_id": 1,
        "name": "Smartphone X1",
        "category_name": "Electronics",
        "company_name": "TechCorp Industries",
        "available_quantity": 100,
        "unit": "PCS",
        "price": "25000.00",
        "status": "sufficient"
    }
]
```

### 6. Dashboard Counts

#### Get Retailer Counts
- **GET** `/retailer/count/`
- **Description**: Get summary counts for retailer dashboard
- **Authentication**: Required

**Response:**
```json
{
    "total_orders": 25,
    "connected_companies": 3,
    "pending_requests": 1
}
```

#### Get Connected Companies Count
- **GET** `/retailer/companies/count/`
- **Description**: Get count of connected companies
- **Authentication**: Required

**Response:**
```json
{
    "count": 3
}
```

## Error Handling

### Common Error Responses

#### Profile Not Found
```json
{
    "error": "Retailer profile not found. Please create a retailer profile first."
}
```

#### Invalid Invite Code
```json
{
    "error": "Invalid or expired invite code."
}
```

#### Already Connected
```json
{
    "error": "You are already connected to this company."
}
```

#### Pending Request Exists
```json
{
    "error": "You already have a pending request to this company."
}
```

## Frontend Integration Examples

### Creating Retailer Profile
```javascript
const createRetailerProfile = async (profileData) => {
    const response = await fetch('/retailer/profile/', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
    });
    return response.json();
};
```

### Joining by Invite Code
```javascript
const joinByCode = async (inviteCode) => {
    const response = await fetch('/retailer/join-by-code/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ invite_code: inviteCode })
    });
    return response.json();
};
```

### Getting Dashboard Data
```javascript
const getDashboardData = async () => {
    const [counts, companies, orders] = await Promise.all([
        fetch('/retailer/count/', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/retailer/companies/', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/retailer/orders/', { headers: { 'Authorization': `Bearer ${token}` } })
    ]);
    
    return {
        counts: await counts.json(),
        companies: await companies.json(),
        orders: await orders.json()
    };
};
```

## Database Models

### RetailerProfile
- Extended profile for retailer users
- Stores business information and verification status
- One-to-one relationship with User model

### CompanyRetailerConnection
- Many-to-many relationship between companies and retailers
- Tracks connection status and business terms
- Supports approval workflow

### CompanyInvite
- Invitation system with unique codes
- Time-based expiration
- Tracks usage and prevents reuse

### RetailerRequest
- Request system for retailers to join companies
- Approval workflow with status tracking
- Prevents duplicate requests

## Business Logic

### Connection Flow
1. **Invitation**: Company sends invite to retailer email
2. **Join by Code**: Retailer uses invite code to auto-connect
3. **Request**: Retailer requests to join public company
4. **Approval**: Company approves/rejects retailer requests

### Status Management
- **pending**: Initial state for requests
- **approved**: Active connection
- **rejected**: Denied request
- **suspended**: Temporarily disabled connection

### Security Features
- JWT authentication required for all operations
- Profile ownership validation
- Invite code expiration and single-use
- Duplicate connection prevention
