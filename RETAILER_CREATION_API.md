# Retailer Creation API Documentation

This document explains the different ways to create retailer profiles in the system, supporting both manufacturer-initiated and self-service retailer registration.

## Overview

The system supports two main flows for retailer creation:

1. **Manufacturer-Initiated**: Companies create retailer profiles for their partners
2. **Self-Service**: Retailers create their own profiles and then join companies

## Authentication

Both endpoints require authentication using JWT tokens:
```
Authorization: Bearer <your_jwt_token>
```

---

## 1. Manufacturer-Initiated Retailer Creation

### Endpoint
```
POST /retailers/add/
```

### Description
Allows companies/manufacturers to create retailer profiles that are immediately associated with their company. This is useful for onboarding known business partners.

### Request Body
```json
{
    "company_id": 1,
    "business_name": "ABC Retail Store",
    "contact_person": "John Smith",
    "phone": "+91-9876543210",
    "email": "john@abcretail.com",
    "address_line1": "123 Market Street",
    "city": "Chennai",
    "state": "Tamil Nadu",
    "pincode": "600001",
    "gstin": "33ABCDE1234F1Z5",
    "business_type": "Retail Store",
    "established_year": 2020,
    "username": "johnsmith",
    "password": "securepassword123",
    "first_name": "John",
    "last_name": "Smith"
}
```

### Parameters
- `company_id` (integer, required): ID of the company creating the retailer
- `business_name` (string, required): Name of the retail business
- `contact_person` (string, required): Primary contact person name
- `phone` (string, required): Contact phone number
- `email` (string, required): Contact email address
- `address_line1` (string, required): Primary address
- `city` (string, required): City
- `state` (string, optional): State (defaults to "Tamil Nadu")
- `pincode` (string, required): PIN code
- `gstin` (string, optional): GST identification number
- `business_type` (string, optional): Type of business
- `established_year` (integer, optional): Year business was established
- `username` (string, optional): Username for new user account
- `password` (string, optional): Password for new user account
- `first_name` (string, optional): First name for user account
- `last_name` (string, optional): Last name for user account

### Response (Success - 201)
```json
{
    "retailer_id": 1,
    "user": 5,
    "user_details": {
        "id": 5,
        "username": "johnsmith",
        "email": "john@abcretail.com",
        "first_name": "John",
        "last_name": "Smith"
    },
    "business_name": "ABC Retail Store",
    "contact_person": "John Smith",
    "phone": "+91-9876543210",
    "email": "john@abcretail.com",
    "address_line1": "123 Market Street",
    "address_line2": null,
    "city": "Chennai",
    "state": "Tamil Nadu",
    "pincode": "600001",
    "country": "India",
    "gstin": "33ABCDE1234F1Z5",
    "business_type": "Retail Store",
    "established_year": 2020,
    "is_active": true,
    "is_verified": false,
    "created_at": "2024-01-08T10:30:00Z",
    "updated_at": "2024-01-08T10:30:00Z",
    "company": 1,
    "company_name": "XYZ Manufacturing",
    "message": "Retailer created successfully for company XYZ Manufacturing"
}
```

### Error Responses
```json
// Permission denied (403)
{
    "error": "You don't have permission to add retailers to this company"
}

// Company not found (404)
{
    "error": "Company not found"
}

// User already exists (400)
{
    "error": "User with username 'johnsmith' already exists"
}

// Validation error (400)
{
    "business_name": ["This field is required."],
    "email": ["This field is required."]
}
```

---

## 2. Self-Service Retailer Registration

### Endpoint
```
POST /retailers/create-profile/
```

### Description
Allows retailers to create their own profiles without being associated with any company initially. They can later join companies through invite codes or by sending join requests.

### Request Body
```json
{
    "business_name": "ABC Retail Store",
    "contact_person": "John Smith",
    "phone": "+91-9876543210",
    "email": "john@abcretail.com",
    "address_line1": "123 Market Street",
    "city": "Chennai",
    "state": "Tamil Nadu",
    "pincode": "600001",
    "gstin": "33ABCDE1234F1Z5",
    "business_type": "Retail Store",
    "established_year": 2020
}
```

### Parameters
- `business_name` (string, required): Name of the retail business
- `contact_person` (string, required): Primary contact person name
- `phone` (string, required): Contact phone number
- `email` (string, required): Contact email address
- `address_line1` (string, required): Primary address
- `city` (string, required): City
- `state` (string, optional): State (defaults to "Tamil Nadu")
- `pincode` (string, required): PIN code
- `gstin` (string, optional): GST identification number
- `business_type` (string, optional): Type of business
- `established_year` (integer, optional): Year business was established

### Response (Success - 201)
```json
{
    "retailer_id": 2,
    "user": 3,
    "user_details": {
        "id": 3,
        "username": "currentuser",
        "email": "user@example.com",
        "first_name": "Current",
        "last_name": "User"
    },
    "business_name": "ABC Retail Store",
    "contact_person": "John Smith",
    "phone": "+91-9876543210",
    "email": "john@abcretail.com",
    "address_line1": "123 Market Street",
    "address_line2": null,
    "city": "Chennai",
    "state": "Tamil Nadu",
    "pincode": "600001",
    "country": "India",
    "gstin": "33ABCDE1234F1Z5",
    "business_type": "Retail Store",
    "established_year": 2020,
    "is_active": true,
    "is_verified": false,
    "created_at": "2024-01-08T10:30:00Z",
    "updated_at": "2024-01-08T10:30:00Z",
    "company": null,
    "company_name": null,
    "message": "Retailer profile created successfully! You can now browse public companies or wait for invitations."
}
```

### Error Responses
```json
// Profile already exists (400)
{
    "error": "Retailer profile already exists for this user"
}

// Validation error (400)
{
    "business_name": ["This field is required."],
    "email": ["This field is required."],
    "phone": ["This field is required."]
}
```

---

## Use Case Flows

### Flow 1: Manufacturer Onboarding Known Partner

1. Manufacturer logs into their dashboard
2. Goes to "Add Retailer" section
3. Fills out retailer information including user account details
4. Submits form to `POST /retailers/add/`
5. Retailer is created and immediately associated with the manufacturer's company
6. Retailer receives login credentials and can start accessing the platform

### Flow 2: Retailer Self-Registration

1. Retailer creates a user account via `POST /register/`
2. After login, retailer creates their profile via `POST /retailers/create-profile/`
3. Retailer browses public companies via `GET /companies/public/`
4. Retailer either:
   - Uses invite code via `POST /retailer/join-by-code/`
   - Sends join request via `POST /retailer/request-approval/`
5. After approval, retailer gains access to company products and can place orders

### Flow 3: Manufacturer Inviting New Retailer

1. Manufacturer generates invite code via `POST /company/generate-invite-code/`
2. Manufacturer shares the code with potential retailer
3. Retailer creates account and profile (if needed)
4. Retailer uses invite code via `POST /retailer/join-by-code/`
5. Connection is automatically established

---

## Frontend Integration Examples

### React.js Example

```javascript
import axios from 'axios';

class RetailerManagement {
    constructor(baseURL, authToken) {
        this.api = axios.create({
            baseURL: baseURL,
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
    }

    // Manufacturer creating retailer
    async createRetailerForCompany(companyId, retailerData) {
        try {
            const data = { ...retailerData, company_id: companyId };
            const response = await this.api.post('/retailers/add/', data);
            return response.data;
        } catch (error) {
            throw error.response.data;
        }
    }

    // Retailer self-registration
    async createRetailerProfile(profileData) {
        try {
            const response = await this.api.post('/retailers/create-profile/', profileData);
            return response.data;
        } catch (error) {
            throw error.response.data;
        }
    }
}

// Usage Examples
const retailerAPI = new RetailerManagement('http://localhost:8000', 'your_jwt_token');

// Manufacturer adding retailer
retailerAPI.createRetailerForCompany(1, {
    business_name: 'New Retail Store',
    contact_person: 'Jane Doe',
    phone: '+91-9876543210',
    email: 'jane@newstore.com',
    address_line1: '456 Commerce St',
    city: 'Mumbai',
    pincode: '400001',
    username: 'janedoe',
    password: 'securepass123'
}).then(data => {
    console.log('Retailer created:', data);
}).catch(error => {
    console.error('Error:', error);
});

// Retailer self-registration
retailerAPI.createRetailerProfile({
    business_name: 'My Retail Business',
    contact_person: 'Current User',
    phone: '+91-9876543210',
    email: 'business@mystore.com',
    address_line1: '789 Main Street',
    city: 'Delhi',
    pincode: '110001'
}).then(data => {
    console.log('Profile created:', data);
    // Redirect to company discovery page
}).catch(error => {
    console.error('Error:', error);
});
```

### React Component Example

```jsx
import React, { useState } from 'react';

const RetailerRegistrationForm = ({ isManufacturer, companyId, onSuccess }) => {
    const [formData, setFormData] = useState({
        business_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address_line1: '',
        city: '',
        state: 'Tamil Nadu',
        pincode: '',
        gstin: '',
        business_type: '',
        established_year: '',
        // Additional fields for manufacturer-initiated creation
        username: '',
        password: '',
        first_name: '',
        last_name: ''
    });
    
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrors({});

        try {
            const retailerAPI = new RetailerManagement('http://localhost:8000', localStorage.getItem('authToken'));
            
            let result;
            if (isManufacturer) {
                result = await retailerAPI.createRetailerForCompany(companyId, formData);
            } else {
                // Remove user account fields for self-registration
                const { username, password, first_name, last_name, ...profileData } = formData;
                result = await retailerAPI.createRetailerProfile(profileData);
            }
            
            onSuccess(result);
        } catch (error) {
            setErrors(error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <form onSubmit={handleSubmit} className="retailer-form">
            <h2>
                {isManufacturer ? 'Add New Retailer Partner' : 'Create Your Retail Profile'}
            </h2>
            
            {/* Business Information */}
            <section>
                <h3>Business Information</h3>
                
                <input
                    type="text"
                    name="business_name"
                    placeholder="Business Name *"
                    value={formData.business_name}
                    onChange={handleChange}
                    required
                />
                {errors.business_name && <span className="error">{errors.business_name[0]}</span>}
                
                <input
                    type="text"
                    name="contact_person"
                    placeholder="Contact Person *"
                    value={formData.contact_person}
                    onChange={handleChange}
                    required
                />
                
                <input
                    type="tel"
                    name="phone"
                    placeholder="Phone Number *"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                />
                
                <input
                    type="email"
                    name="email"
                    placeholder="Business Email *"
                    value={formData.email}
                    onChange={handleChange}
                    required
                />
            </section>

            {/* Address Information */}
            <section>
                <h3>Address Information</h3>
                
                <input
                    type="text"
                    name="address_line1"
                    placeholder="Address Line 1 *"
                    value={formData.address_line1}
                    onChange={handleChange}
                    required
                />
                
                <input
                    type="text"
                    name="city"
                    placeholder="City *"
                    value={formData.city}
                    onChange={handleChange}
                    required
                />
                
                <input
                    type="text"
                    name="state"
                    placeholder="State"
                    value={formData.state}
                    onChange={handleChange}
                />
                
                <input
                    type="text"
                    name="pincode"
                    placeholder="PIN Code *"
                    value={formData.pincode}
                    onChange={handleChange}
                    required
                />
            </section>

            {/* Additional Business Details */}
            <section>
                <h3>Additional Details</h3>
                
                <input
                    type="text"
                    name="gstin"
                    placeholder="GSTIN (Optional)"
                    value={formData.gstin}
                    onChange={handleChange}
                />
                
                <input
                    type="text"
                    name="business_type"
                    placeholder="Business Type (e.g., Retail Store)"
                    value={formData.business_type}
                    onChange={handleChange}
                />
                
                <input
                    type="number"
                    name="established_year"
                    placeholder="Established Year"
                    value={formData.established_year}
                    onChange={handleChange}
                />
            </section>

            {/* User Account Creation (Manufacturer Only) */}
            {isManufacturer && (
                <section>
                    <h3>User Account (Optional)</h3>
                    <p>Create a user account for this retailer to access the platform</p>
                    
                    <input
                        type="text"
                        name="username"
                        placeholder="Username"
                        value={formData.username}
                        onChange={handleChange}
                    />
                    
                    <input
                        type="password"
                        name="password"
                        placeholder="Password"
                        value={formData.password}
                        onChange={handleChange}
                    />
                    
                    <input
                        type="text"
                        name="first_name"
                        placeholder="First Name"
                        value={formData.first_name}
                        onChange={handleChange}
                    />
                    
                    <input
                        type="text"
                        name="last_name"
                        placeholder="Last Name"
                        value={formData.last_name}
                        onChange={handleChange}
                    />
                </section>
            )}

            <button type="submit" disabled={loading}>
                {loading ? 'Creating...' : (isManufacturer ? 'Add Retailer' : 'Create Profile')}
            </button>
            
            {errors.error && <div className="error-message">{errors.error}</div>}
        </form>
    );
};

export default RetailerRegistrationForm;
```

## Security Considerations

1. **Permission Validation**: Manufacturers can only create retailers for companies they own/manage
2. **Duplicate Prevention**: System prevents duplicate retailer profiles for the same user
3. **Data Validation**: All required fields are validated on both client and server side
4. **User Account Security**: Strong password requirements should be enforced
5. **Email Verification**: Consider implementing email verification for new accounts

## Next Steps

After creating a retailer profile:

1. **For Manufacturer-Created Retailers**: 
   - Send welcome email with login credentials
   - Provide onboarding materials
   - Set up initial product access and credit limits

2. **For Self-Registered Retailers**:
   - Browse public companies
   - Use invite codes or send join requests
   - Wait for approval to access products

For more information about company joining processes, see `RETAILER_API_DOCUMENTATION.md` and `COMPANY_MANAGEMENT_API.md`.
