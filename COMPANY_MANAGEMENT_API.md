# Company Management API Documentation

This document provides comprehensive documentation for the company-side APIs that allow manufacturers to manage retailer relationships, including invites, requests, connections, and more.

## Overview

The Company Management APIs provide functionality for:
- Generating invite codes for retailers
- Managing company invitations
- Handling retailer join requests
- Managing retailer connections
- Updating connection status (suspend/reactivate)

## Authentication

All endpoints require authentication using JWT tokens in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Base URL

All endpoints are relative to your Django backend base URL, typically:
```
http://localhost:8000/
```

---

## 1. Generate Invite Code

### Endpoint
```
POST /company/generate-invite-code/
```

### Description
Generates a new invite code that can be shared manually with retailers. This creates an invitation without sending an email.

### Request Body
```json
{
    "message": "Welcome to our platform! Join us to access our products.",
    "expires_in_days": 7
}
```

### Parameters
- `message` (string, optional): Custom message for the invitation
- `expires_in_days` (integer, optional): Number of days until expiration (1-30, default: 7)

### Response (Success - 201)
```json
{
    "message": "Invite code generated successfully.",
    "invite_code": "ABC123DEF",
    "expires_at": "2024-01-15T10:30:00Z",
    "invite": {
        "id": 1,
        "invite_code": "ABC123DEF",
        "company": {
            "id": 1,
            "name": "ABC Manufacturing",
            "address": "123 Industrial Ave"
        },
        "invited_by": {
            "id": 1,
            "username": "admin",
            "email": "admin@abc.com"
        },
        "email": "",
        "message": "Welcome to our platform! Join us to access our products.",
        "created_at": "2024-01-08T10:30:00Z",
        "expires_at": "2024-01-15T10:30:00Z",
        "is_used": false,
        "used_at": null,
        "used_by": null
    }
}
```

### Error Responses
```json
// User not associated with company (403)
{
    "error": "You must be associated with a company to generate invite codes."
}

// Invalid expiration period (400)
{
    "error": "Expiration must be between 1 and 30 days."
}
```

---

## 2. Get Company Invitations

### Endpoint
```
GET /company/invites/
```

### Description
Retrieves all invitations sent by the company, both email and code-based.

### Response (Success - 200)
```json
[
    {
        "id": 1,
        "invite_code": "ABC123DEF",
        "company": {
            "id": 1,
            "name": "ABC Manufacturing",
            "address": "123 Industrial Ave"
        },
        "invited_by": {
            "id": 1,
            "username": "admin",
            "email": "admin@abc.com"
        },
        "email": "retailer@example.com",
        "message": "Join our network to access exclusive products.",
        "created_at": "2024-01-08T10:30:00Z",
        "expires_at": "2024-01-15T10:30:00Z",
        "is_used": true,
        "used_at": "2024-01-09T14:20:00Z",
        "used_by": {
            "id": 2,
            "username": "retailer1",
            "email": "retailer@example.com"
        }
    },
    {
        "id": 2,
        "invite_code": "XYZ789GHI",
        "company": {
            "id": 1,
            "name": "ABC Manufacturing",
            "address": "123 Industrial Ave"
        },
        "invited_by": {
            "id": 1,
            "username": "admin",
            "email": "admin@abc.com"
        },
        "email": "",
        "message": "General invitation code",
        "created_at": "2024-01-08T11:00:00Z",
        "expires_at": "2024-01-15T11:00:00Z",
        "is_used": false,
        "used_at": null,
        "used_by": null
    }
]
```

---

## 3. Get Retailer Requests

### Endpoint
```
GET /company/retailer-requests/
```

### Description
Retrieves all join requests submitted by retailers to the company.

### Response (Success - 200)
```json
[
    {
        "id": 1,
        "retailer": {
            "id": 2,
            "username": "retailer1",
            "email": "retailer@example.com",
            "first_name": "John",
            "last_name": "Retailer"
        },
        "company": {
            "id": 1,
            "name": "ABC Manufacturing",
            "address": "123 Industrial Ave"
        },
        "status": "pending",
        "message": "We would like to join your network to purchase products for our retail chain.",
        "requested_at": "2024-01-08T09:15:00Z",
        "reviewed_at": null,
        "reviewed_by": null
    },
    {
        "id": 2,
        "retailer": {
            "id": 3,
            "username": "retailer2",
            "email": "shop@example.com",
            "first_name": "Jane",
            "last_name": "Shop"
        },
        "company": {
            "id": 1,
            "name": "ABC Manufacturing",
            "address": "123 Industrial Ave"
        },
        "status": "approved",
        "message": "Looking to establish a partnership.",
        "requested_at": "2024-01-07T15:30:00Z",
        "reviewed_at": "2024-01-08T10:00:00Z",
        "reviewed_by": {
            "id": 1,
            "username": "admin",
            "email": "admin@abc.com"
        }
    }
]
```

---

## 4. Accept/Reject Retailer Request

### Endpoint
```
POST /company/accept-request/
```

### Description
Approves or rejects a retailer's join request. On approval, creates a connection and sends notification email.

### Request Body
```json
{
    "request_id": 1,
    "action": "approve",
    "credit_limit": 50000,
    "payment_terms": "Net 30 days"
}
```

### Parameters
- `request_id` (integer, required): ID of the retailer request
- `action` (string, required): Either "approve" or "reject"
- `credit_limit` (number, optional): Credit limit for approved retailer (only for approval)
- `payment_terms` (string, optional): Payment terms for approved retailer (only for approval)

### Response (Success - 200)

#### Approval Response
```json
{
    "message": "Retailer request approved successfully.",
    "connection_id": 5
}
```

#### Rejection Response
```json
{
    "message": "Retailer request rejected."
}
```

### Error Responses
```json
// Missing required fields (400)
{
    "error": "request_id and action are required."
}

// Invalid action (400)
{
    "error": "action must be either \"approve\" or \"reject\"."
}

// Request not found (404)
{
    "error": "Request not found or already processed."
}
```

---

## 5. Get Company Connections

### Endpoint
```
GET /company/connections/
```

### Description
Retrieves all retailer connections for the company.

### Query Parameters
- `status` (string, optional): Filter by connection status ("approved", "suspended"). Default: "approved"

### Example Request
```
GET /company/connections/?status=approved
```

### Response (Success - 200)
```json
[
    {
        "id": 1,
        "company": {
            "id": 1,
            "name": "ABC Manufacturing",
            "address": "123 Industrial Ave"
        },
        "retailer": {
            "id": 2,
            "username": "retailer1",
            "email": "retailer@example.com",
            "first_name": "John",
            "last_name": "Retailer"
        },
        "status": "approved",
        "connected_at": "2024-01-08T10:00:00Z",
        "approved_by": {
            "id": 1,
            "username": "admin",
            "email": "admin@abc.com"
        },
        "approved_at": "2024-01-08T10:00:00Z",
        "credit_limit": 50000,
        "payment_terms": "Net 30 days"
    },
    {
        "id": 2,
        "company": {
            "id": 1,
            "name": "ABC Manufacturing",
            "address": "123 Industrial Ave"
        },
        "retailer": {
            "id": 3,
            "username": "retailer2",
            "email": "shop@example.com",
            "first_name": "Jane",
            "last_name": "Shop"
        },
        "status": "approved",
        "connected_at": "2024-01-07T16:00:00Z",
        "approved_by": {
            "id": 1,
            "username": "admin",
            "email": "admin@abc.com"
        },
        "approved_at": "2024-01-07T16:00:00Z",
        "credit_limit": 25000,
        "payment_terms": "Net 15 days"
    }
]
```

---

## 6. Update Connection Status

### Endpoint
```
POST /company/update-connection/
```

### Description
Updates the status of a retailer connection (suspend or reactivate).

### Request Body
```json
{
    "connection_id": 1,
    "status": "suspended"
}
```

### Parameters
- `connection_id` (integer, required): ID of the connection to update
- `status` (string, required): New status ("approved" or "suspended")

### Response (Success - 200)

#### Suspension Response
```json
{
    "message": "Connection suspended successfully."
}
```

#### Reactivation Response
```json
{
    "message": "Connection reactivated successfully."
}
```

### Error Responses
```json
// Missing required fields (400)
{
    "error": "connection_id and status are required."
}

// Invalid status (400)
{
    "error": "status must be either \"approved\" or \"suspended\"."
}

// Connection not found (404)
{
    "error": "Connection not found."
}
```

---

## Frontend Integration Examples

### React.js Example

```javascript
import axios from 'axios';

class CompanyManagement {
    constructor(baseURL, authToken) {
        this.api = axios.create({
            baseURL: baseURL,
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
    }

    // Generate invite code
    async generateInviteCode(message, expiresInDays = 7) {
        try {
            const response = await this.api.post('/company/generate-invite-code/', {
                message,
                expires_in_days: expiresInDays
            });
            return response.data;
        } catch (error) {
            throw error.response.data;
        }
    }

    // Get all company invites
    async getCompanyInvites() {
        try {
            const response = await this.api.get('/company/invites/');
            return response.data;
        } catch (error) {
            throw error.response.data;
        }
    }

    // Get retailer requests
    async getRetailerRequests() {
        try {
            const response = await this.api.get('/company/retailer-requests/');
            return response.data;
        } catch (error) {
            throw error.response.data;
        }
    }

    // Accept or reject retailer request
    async handleRetailerRequest(requestId, action, creditLimit = 0, paymentTerms = '') {
        try {
            const response = await this.api.post('/company/accept-request/', {
                request_id: requestId,
                action,
                credit_limit: creditLimit,
                payment_terms: paymentTerms
            });
            return response.data;
        } catch (error) {
            throw error.response.data;
        }
    }

    // Get company connections
    async getCompanyConnections(status = 'approved') {
        try {
            const response = await this.api.get(`/company/connections/?status=${status}`);
            return response.data;
        } catch (error) {
            throw error.response.data;
        }
    }

    // Update connection status
    async updateConnectionStatus(connectionId, status) {
        try {
            const response = await this.api.post('/company/update-connection/', {
                connection_id: connectionId,
                status
            });
            return response.data;
        } catch (error) {
            throw error.response.data;
        }
    }
}

// Usage Example
const companyAPI = new CompanyManagement('http://localhost:8000', 'your_jwt_token');

// Generate invite code
companyAPI.generateInviteCode('Welcome to our platform!', 10)
    .then(data => {
        console.log('Invite code:', data.invite_code);
    })
    .catch(error => {
        console.error('Error:', error);
    });

// Handle retailer request approval
companyAPI.handleRetailerRequest(1, 'approve', 50000, 'Net 30 days')
    .then(data => {
        console.log('Request approved:', data);
    })
    .catch(error => {
        console.error('Error:', error);
    });
```

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';

const CompanyDashboard = ({ authToken }) => {
    const [requests, setRequests] = useState([]);
    const [connections, setConnections] = useState([]);
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);

    const companyAPI = new CompanyManagement('http://localhost:8000', authToken);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [requestsData, connectionsData, invitesData] = await Promise.all([
                companyAPI.getRetailerRequests(),
                companyAPI.getCompanyConnections(),
                companyAPI.getCompanyInvites()
            ]);
            
            setRequests(requestsData);
            setConnections(connectionsData);
            setInvites(invitesData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRequest = async (requestId, action) => {
        try {
            await companyAPI.handleRetailerRequest(requestId, action, 50000, 'Net 30 days');
            loadData(); // Refresh data
            alert(`Request ${action}d successfully`);
        } catch (error) {
            alert(`Error: ${error.error}`);
        }
    };

    const generateInvite = async () => {
        try {
            const result = await companyAPI.generateInviteCode('Join our network!', 7);
            alert(`Invite code generated: ${result.invite_code}`);
            loadData(); // Refresh data
        } catch (error) {
            alert(`Error: ${error.error}`);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="company-dashboard">
            <h1>Company Management Dashboard</h1>
            
            {/* Generate Invite Section */}
            <section>
                <h2>Generate Invite Code</h2>
                <button onClick={generateInvite}>Generate New Invite Code</button>
            </section>

            {/* Pending Requests */}
            <section>
                <h2>Pending Retailer Requests ({requests.filter(r => r.status === 'pending').length})</h2>
                {requests.filter(r => r.status === 'pending').map(request => (
                    <div key={request.id} className="request-card">
                        <h3>{request.retailer.first_name} {request.retailer.last_name}</h3>
                        <p>Email: {request.retailer.email}</p>
                        <p>Message: {request.message}</p>
                        <p>Requested: {new Date(request.requested_at).toLocaleDateString()}</p>
                        <button onClick={() => handleRequest(request.id, 'approve')}>
                            Approve
                        </button>
                        <button onClick={() => handleRequest(request.id, 'reject')}>
                            Reject
                        </button>
                    </div>
                ))}
            </section>

            {/* Active Connections */}
            <section>
                <h2>Active Connections ({connections.length})</h2>
                {connections.map(connection => (
                    <div key={connection.id} className="connection-card">
                        <h3>{connection.retailer.first_name} {connection.retailer.last_name}</h3>
                        <p>Email: {connection.retailer.email}</p>
                        <p>Status: {connection.status}</p>
                        <p>Credit Limit: ${connection.credit_limit}</p>
                        <p>Payment Terms: {connection.payment_terms}</p>
                        <p>Connected: {new Date(connection.connected_at).toLocaleDateString()}</p>
                    </div>
                ))}
            </section>

            {/* Sent Invites */}
            <section>
                <h2>Sent Invites ({invites.length})</h2>
                {invites.map(invite => (
                    <div key={invite.id} className="invite-card">
                        <p>Code: {invite.invite_code}</p>
                        <p>Email: {invite.email || 'General Code'}</p>
                        <p>Status: {invite.is_used ? 'Used' : 'Pending'}</p>
                        <p>Expires: {new Date(invite.expires_at).toLocaleDateString()}</p>
                        {invite.used_by && (
                            <p>Used by: {invite.used_by.email}</p>
                        )}
                    </div>
                ))}
            </section>
        </div>
    );
};

export default CompanyDashboard;
```

## Error Handling

All endpoints return consistent error responses in the following format:

```json
{
    "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid token)
- `403` - Forbidden (permission denied)
- `404` - Not Found
- `500` - Internal Server Error

## Email Notifications

The system automatically sends email notifications for:
- **Request Approval**: When a retailer request is approved
- **Request Rejection**: When a retailer request is rejected
- **Company Invites**: When inviting retailers via email (using `send_company_invite` endpoint)

Email templates include:
- Company information
- Relevant details about the action
- Next steps for the recipient

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Authorization**: Users can only access data for their associated company
3. **Data Validation**: All input is validated before processing
4. **Rate Limiting**: Consider implementing rate limiting for invite generation
5. **Email Security**: Ensure SMTP credentials are properly secured in settings

## Next Steps

After implementing the frontend:
1. Test all endpoints in a development environment
2. Verify email delivery functionality
3. Test the complete retailer onboarding flow
4. Add monitoring and logging for production deployment
5. Consider adding admin interfaces for advanced management

For more information about retailer-side APIs, see `RETAILER_API_DOCUMENTATION.md`.
