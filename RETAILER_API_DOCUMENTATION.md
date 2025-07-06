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

#### Check Profile Status
- **GET** `/retailer/check-profile/`
- **Description**: Check if the current user has a retailer profile
- **Authentication**: Required

**Response:**
```json
{
    "has_profile": true,
    "user_id": 5,
    "username": "retailer1",
    "email": "retailer@example.com",
    "profile_id": 1,
    "business_name": "ABC Retail Store",
    "is_verified": false,
    "is_active": true
}
```

#### Get/Update Retailer Profile
- **GET/PUT** `/retailer/profile/`
- **Description**: Get or update the current user's retailer profile
- **Authentication**: Required

**GET Response:**
```json
{
    "id": 1,
    "username": "retailer1",
    "user_email": "retailer@example.com",
    "user_first_name": "John",
    "user_last_name": "Doe",
    "business_name": "ABC Retail Store",
    "contact_person": "John Doe",
    "phone": "+1234567890",
    "email": "contact@abcretail.com",
    "address_line1": "123 Main St",
    "address_line2": null,
    "city": "New York",
    "state": "NY",
    "pincode": "10001",
    "country": "India",
    "gstin": "GST123456789",
    "business_type": "Retail Store",
    "established_year": 2020,
    "is_active": true,
    "is_verified": false,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "connected_companies_count": 3,
    "pending_requests_count": 1,
    "total_orders_count": 25
}
```

**PUT Request (Update Profile):**
```json
{
    "business_name": "ABC Retail Store Updated",
    "contact_person": "John Doe",
    "phone": "+1234567890",
    "email": "contact@abcretail.com",
    "address_line1": "123 Main St Updated",
    "city": "New York",
    "state": "NY",
    "pincode": "10001",
    "business_type": "Retail Chain",
    "established_year": 2020
}
```

**PUT Response (Update):**
```json
{
    "message": "Profile updated successfully.",
    "profile": {
        "id": 1,
        "username": "retailer1",
        "business_name": "ABC Retail Store Updated",
        // ... other profile fields
    }
}
```

**PUT Response (Create New):**
```json
{
    "message": "Profile created successfully.",
    "profile": {
        "id": 1,
        "username": "retailer1",
        "business_name": "ABC Retail Store",
        // ... other profile fields
    }
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

### Checking Profile Status
```javascript
const checkProfileStatus = async () => {
    const response = await fetch('/retailer/check-profile/', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.json();
};

// Usage
checkProfileStatus().then(data => {
    if (data.has_profile) {
        console.log('User has profile:', data.business_name);
        // Redirect to dashboard
    } else {
        console.log('User needs to create profile');
        // Redirect to profile creation form
    }
});
```

### Getting Profile Details
```javascript
const getRetailerProfile = async () => {
    const response = await fetch('/retailer/profile/', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    if (response.status === 404) {
        // Profile not found
        return { hasProfile: false };
    }
    
    return { hasProfile: true, profile: await response.json() };
};
```

### Creating/Updating Profile
```javascript
const updateRetailerProfile = async (profileData) => {
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

// Usage for creating new profile
const createProfile = async () => {
    const profileData = {
        business_name: 'My Retail Store',
        contact_person: 'John Doe',
        phone: '+1234567890',
        email: 'contact@store.com',
        address_line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        pincode: '10001'
    };
    
    const result = await updateRetailerProfile(profileData);
    if (result.message) {
        console.log(result.message); // "Profile created successfully." or "Profile updated successfully."
    }
};
```

### Complete Profile Management Component
```jsx
import React, { useState, useEffect } from 'react';

const RetailerProfileManager = ({ authToken }) => {
    const [profileStatus, setProfileStatus] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({});

    useEffect(() => {
        loadProfileStatus();
    }, []);

    const loadProfileStatus = async () => {
        try {
            setLoading(true);
            const response = await fetch('/retailer/check-profile/', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await response.json();
            setProfileStatus(data);
            
            if (data.has_profile) {
                await loadProfile();
            }
        } catch (error) {
            console.error('Error loading profile status:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadProfile = async () => {
        try {
            const response = await fetch('/retailer/profile/', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (response.ok) {
                const profileData = await response.json();
                setProfile(profileData);
                setFormData(profileData);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };

    const handleSaveProfile = async () => {
        try {
            const response = await fetch('/retailer/profile/', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            if (response.ok) {
                setProfile(result.profile);
                setEditing(false);
                alert(result.message);
                // Refresh profile status
                await loadProfileStatus();
            } else {
                console.error('Save failed:', result);
            }
        } catch (error) {
            console.error('Error saving profile:', error);
        }
    };

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    if (loading) {
        return <div>Loading profile...</div>;
    }

    if (!profileStatus?.has_profile && !editing) {
        return (
            <div className="no-profile">
                <h2>Create Your Retailer Profile</h2>
                <p>You need to create a retailer profile to access company features.</p>
                <button onClick={() => setEditing(true)}>Create Profile</button>
            </div>
        );
    }

    return (
        <div className="retailer-profile">
            <div className="profile-header">
                <h2>Retailer Profile</h2>
                {profile && (
                    <div className="profile-stats">
                        <span>Connected Companies: {profile.connected_companies_count}</span>
                        <span>Total Orders: {profile.total_orders_count}</span>
                        <span>Pending Requests: {profile.pending_requests_count}</span>
                    </div>
                )}
            </div>

            {editing ? (
                <form className="profile-form">
                    <h3>Business Information</h3>
                    <input
                        type="text"
                        name="business_name"
                        placeholder="Business Name"
                        value={formData.business_name || ''}
                        onChange={handleInputChange}
                        required
                    />
                    <input
                        type="text"
                        name="contact_person"
                        placeholder="Contact Person"
                        value={formData.contact_person || ''}
                        onChange={handleInputChange}
                        required
                    />
                    <input
                        type="tel"
                        name="phone"
                        placeholder="Phone Number"
                        value={formData.phone || ''}
                        onChange={handleInputChange}
                        required
                    />
                    <input
                        type="email"
                        name="email"
                        placeholder="Business Email"
                        value={formData.email || ''}
                        onChange={handleInputChange}
                        required
                    />
                    
                    <h3>Address Information</h3>
                    <input
                        type="text"
                        name="address_line1"
                        placeholder="Address Line 1"
                        value={formData.address_line1 || ''}
                        onChange={handleInputChange}
                        required
                    />
                    <input
                        type="text"
                        name="address_line2"
                        placeholder="Address Line 2 (Optional)"
                        value={formData.address_line2 || ''}
                        onChange={handleInputChange}
                    />
                    <input
                        type="text"
                        name="city"
                        placeholder="City"
                        value={formData.city || ''}
                        onChange={handleInputChange}
                        required
                    />
                    <input
                        type="text"
                        name="state"
                        placeholder="State"
                        value={formData.state || 'Tamil Nadu'}
                        onChange={handleInputChange}
                    />
                    <input
                        type="text"
                        name="pincode"
                        placeholder="PIN Code"
                        value={formData.pincode || ''}
                        onChange={handleInputChange}
                        required
                    />
                    
                    <h3>Additional Details</h3>
                    <input
                        type="text"
                        name="gstin"
                        placeholder="GSTIN (Optional)"
                        value={formData.gstin || ''}
                        onChange={handleInputChange}
                    />
                    <input
                        type="text"
                        name="business_type"
                        placeholder="Business Type"
                        value={formData.business_type || ''}
                        onChange={handleInputChange}
                    />
                    <input
                        type="number"
                        name="established_year"
                        placeholder="Established Year"
                        value={formData.established_year || ''}
                        onChange={handleInputChange}
                    />
                    
                    <div className="form-actions">
                        <button type="button" onClick={handleSaveProfile}>Save Profile</button>
                        <button type="button" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                </form>
            ) : (
                <div className="profile-display">
                    <div className="profile-section">
                        <h3>Business Information</h3>
                        <p><strong>Business Name:</strong> {profile?.business_name}</p>
                        <p><strong>Contact Person:</strong> {profile?.contact_person}</p>
                        <p><strong>Phone:</strong> {profile?.phone}</p>
                        <p><strong>Email:</strong> {profile?.email}</p>
                        <p><strong>Business Type:</strong> {profile?.business_type || 'Not specified'}</p>
                        <p><strong>Established:</strong> {profile?.established_year || 'Not specified'}</p>
                    </div>
                    
                    <div className="profile-section">
                        <h3>Address</h3>
                        <p>{profile?.address_line1}</p>
                        {profile?.address_line2 && <p>{profile.address_line2}</p>}
                        <p>{profile?.city}, {profile?.state} {profile?.pincode}</p>
                        <p>{profile?.country}</p>
                    </div>
                    
                    <div className="profile-section">
                        <h3>Status</h3>
                        <p><strong>Verified:</strong> {profile?.is_verified ? 'Yes' : 'No'}</p>
                        <p><strong>Active:</strong> {profile?.is_active ? 'Yes' : 'No'}</p>
                        {profile?.gstin && <p><strong>GSTIN:</strong> {profile.gstin}</p>}
                    </div>
                    
                    <button onClick={() => setEditing(true)}>Edit Profile</button>
                </div>
            )}
        </div>
    );
};

export default RetailerProfileManager;
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
