# Vendor Management Backend Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   cd vendor-backend
   npm install
   ```

2. **Environment Setup**
   - The `.env` file is already configured with your MongoDB connection
   - Update JWT secrets in production:
     ```
     JWT_SECRET=your_production_secret_key
     JWT_REFRESH_SECRET=your_production_refresh_secret
     ```

3. **Start the Server**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Test the Setup**
   ```bash
   node test-setup.js
   ```

## Server Information
- **Base URL**: http://localhost:8000
- **API Base**: http://localhost:8000/api  
- **Health Check**: http://localhost:8000/health
- **Database**: MongoDB Atlas (vendor_platform)

## Frontend Integration

Update your frontend API_URL to point to:
```javascript
const API_URL = 'http://localhost:8000/api';
```

## Key API Endpoints for Frontend

### Authentication
- `POST /api/token/` - Login (matches your frontend)
- `POST /api/token/refresh/` - Refresh token
- `GET /api/user_detail/` - User profile

### Dashboard Counts (Manufacturer)
- `GET /api/count?company=<company_id>` - Dashboard statistics

### Company Management
- `GET /api/company/` - Get user's companies
- `GET /api/companies/public/` - Public companies for retailers

### Products & Inventory
- `GET /api/products/?company=<company_id>` - Company products
- `POST /api/products/` - Add new product
- `GET /api/categories/` - Product categories

### Orders
- `GET /api/orders/?company=<company_id>` - Company orders
- `GET /api/retailer/orders/` - Retailer orders
- `GET /api/employee_orders/` - Employee order management

### Invoices
- `GET /api/invoices/?company=<company_id>` - Company invoices
- `GET /api/invoices/count/?company=<company_id>` - Invoice count

### Retailer Features
- `GET /api/retailer/products/` - Available products
- `GET /api/retailer/companies/` - Connected companies
- `POST /api/retailer/join-by-code/` - Join by invite code

### Company Connections
- `POST /api/company/generate-invite-code/` - Generate invite
- `GET /api/company/retailer-requests/` - Join requests
- `POST /api/company/accept-request/` - Accept/reject requests

## Database Models Automatically Created

The following collections will be created in MongoDB:
- `users` - User accounts with authentication
- `companies` - Company profiles
- `retailerprofiles` - Retailer business information
- `products` - Product catalog with inventory
- `productcategories` - Product categories
- `orders` - Order management
- `invoices` - Invoice & billing
- `companyinvites` - Invitation codes
- `retailerrequests` - Join requests
- `companyretailerconnections` - Company-retailer relationships

## Security Features

✅ JWT Authentication with refresh tokens  
✅ Password hashing with bcryptjs  
✅ Role-based access control  
✅ Input validation with Joi  
✅ CORS protection  
✅ Rate limiting (100 req/15min)  
✅ Security headers with Helmet  
✅ MongoDB injection protection  

## Production Deployment

1. Update environment variables for production
2. Set NODE_ENV=production
3. Use a reverse proxy (nginx) for SSL
4. Consider using PM2 for process management
5. Set up monitoring and logging

## Troubleshooting

**Connection Issues:**
- Verify MongoDB Atlas IP whitelist
- Check network connectivity
- Ensure correct connection string

**Authentication Issues:**
- Verify JWT_SECRET is set
- Check token expiration settings
- Confirm user role assignments

**CORS Issues:**
- Update CORS_ORIGIN in .env
- Check frontend URL matches

For more details, see `API_DOCUMENTATION.md`