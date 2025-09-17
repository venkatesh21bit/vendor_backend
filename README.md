# Vendor Management Platform - Backend API

A comprehensive Express.js backend service for a vendor management platform with MongoDB integration, supporting manufacturers, retailers, and employees with complete order, invoice, and connection management.

## 🚀 Features

- **User Management**: Registration, authentication, and role-based access control
- **Company Management**: Multi-company support with owner and employee roles
- **Product Catalog**: Product and category management with inventory tracking
- **Order Processing**: Complete order lifecycle management
- **Invoice Management**: Automated invoice generation and payment tracking
- **Connection Management**: Company-retailer relationship handling
- **Dashboard Analytics**: Revenue charts and business statistics
- **Security**: JWT authentication, input validation, rate limiting

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn package manager

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vendor-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=8000
   NODE_ENV=development

   # Database Configuration
   MONGODB_URI=mongodb+srv://venkateshk:venkat*2005@cluster0.mujtrmk.mongodb.net/vendor_management

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=24h
   JWT_REFRESH_SECRET=your-refresh-secret-key-here
   JWT_REFRESH_EXPIRES_IN=7d

   # Security Configuration
   BCRYPT_ROUNDS=12
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100

   # CORS Configuration
   CORS_ORIGIN=http://localhost:3000

   # Email Configuration (optional)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-email-password
   ```

4. **Test the setup**
   ```bash
   node test-setup.js
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## 📖 API Documentation

### Base URL
```
http://localhost:8000/api
```

### Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### User Roles
- **manufacturer**: Company owners who manage products and orders
- **retailer**: Customers who place orders from manufacturers
- **employee**: Staff members who fulfill orders
- **staff**: System administrators with full access

## 🔗 API Endpoints

### Authentication
```http
POST   /api/register           # User registration
POST   /api/login              # User login
POST   /api/refresh-token      # Refresh JWT token
POST   /api/logout             # User logout
POST   /api/forgot-password    # Password reset request
POST   /api/reset-password     # Password reset confirmation
```

### User Management
```http
GET    /api/users              # Get all users (admin only)
GET    /api/users/profile      # Get current user profile
PUT    /api/users/profile      # Update user profile
POST   /api/users/verify-otp   # Verify OTP
```

### Company Management
```http
GET    /api/companies          # Get companies
POST   /api/companies          # Create company
GET    /api/companies/:id      # Get company details
PUT    /api/companies/:id      # Update company
DELETE /api/companies/:id      # Delete company
GET    /api/companies/:id/employees    # Get company employees
POST   /api/companies/:id/employees    # Add employee
DELETE /api/companies/:id/employees/:userId  # Remove employee
```

### Product Management
```http
GET    /api/products           # Get products
POST   /api/products           # Create product
GET    /api/products/:id       # Get product details
PUT    /api/products/:id       # Update product
DELETE /api/products/:id       # Delete product
```

### Category Management
```http
GET    /api/categories         # Get categories
POST   /api/categories         # Create category
GET    /api/categories/:id     # Get category details
PUT    /api/categories/:id     # Update category
DELETE /api/categories/:id     # Delete category
```

### Order Management
```http
GET    /api/orders             # Get orders
POST   /api/orders             # Create order
GET    /api/orders/:id         # Get order details
PUT    /api/orders/:id         # Update order
DELETE /api/orders/:id         # Cancel order
```

### Invoice Management
```http
GET    /api/invoices           # Get invoices
POST   /api/invoices           # Create invoice
GET    /api/invoices/:id       # Get invoice details
PUT    /api/invoices/:id       # Update invoice
POST   /api/invoices/:id/send  # Send invoice to retailer
DELETE /api/invoices/:id       # Delete invoice (draft only)
```

### Connection Management
```http
GET    /api/connections               # Get connections
POST   /api/connections/invite        # Generate invite code
POST   /api/connections/join          # Join by invite code
POST   /api/connections/request       # Request connection approval
PUT    /api/connections/handle-request # Handle connection request
PUT    /api/connections/update        # Update connection status
```

### Retailer Operations
```http
GET    /api/retailer/profile          # Get retailer profile
PUT    /api/retailer/profile          # Update retailer profile
GET    /api/retailer/companies        # Get connected companies
GET    /api/retailer/products         # Get available products
```

### Employee Operations
```http
GET    /api/employee/orders           # Get assigned orders
PUT    /api/employee/orders/:id/assign # Assign order to self
PUT    /api/employee/orders/:id/update-status # Update order status
POST   /api/employee/orders/:id/proof # Upload delivery proof
```

### Dashboard & Analytics
```http
GET    /api/dashboard/stats                    # Get dashboard statistics
GET    /api/dashboard/recent-orders           # Get recent orders
GET    /api/dashboard/top-products            # Get top selling products
GET    /api/dashboard/revenue-chart           # Get revenue chart data
GET    /api/dashboard/order-status-distribution # Get order status distribution
```

## 📊 Database Models

### User
- Authentication and profile information
- Role-based access control
- OTP verification support

### Company
- Business information and settings
- Owner and employee management
- Multi-company support

### Product
- Product catalog with inventory
- Category associations
- Tax configuration
- Stock level management

### Order
- Complete order lifecycle
- Item details and pricing
- Status tracking and delivery management
- Employee assignment

### Invoice
- Automated invoice generation
- Payment tracking
- Due date management
- Email notifications

### Connection Models
- Company-retailer relationships
- Invite code system
- Request approval workflow

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with configurable rounds
- **Input Validation**: Joi schema validation for all endpoints
- **Rate Limiting**: Configurable request rate limiting
- **CORS Protection**: Cross-origin resource sharing configuration
- **Helmet Security**: Security headers and protection
- **Role-based Access**: Granular permission system

## 🧪 Testing

Run the setup test to verify everything is working:
```bash
node test-setup.js
```

Test individual endpoints using curl or Postman:
```bash
# Health check
curl http://localhost:8000/health

# Register user
curl -X POST http://localhost:8000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "first_name": "Test",
    "last_name": "User",
    "role": "manufacturer"
  }'
```

## 📁 Project Structure

```
vendor-backend/
├── models/           # MongoDB schemas
│   ├── User.js
│   ├── Company.js
│   ├── Product.js
│   ├── ProductCategory.js
│   ├── Order.js
│   ├── Invoice.js
│   ├── RetailerProfile.js
│   └── Connection.js
├── routes/           # API route handlers
│   ├── auth.js
│   ├── user.js
│   ├── company.js
│   ├── product.js
│   ├── category.js
│   ├── order.js
│   ├── invoice.js
│   ├── connection.js
│   ├── retailer.js
│   ├── employee.js
│   └── dashboard.js
├── middleware/       # Custom middleware
│   ├── auth.js
│   ├── errorHandler.js
│   └── validation.js
├── server.js         # Main application file
├── test-setup.js     # Setup verification script
├── package.json      # Dependencies and scripts
├── .env.example      # Environment variables template
└── README.md         # Project documentation
```

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=8000
MONGODB_URI=your-production-mongodb-uri
JWT_SECRET=your-production-jwt-secret
CORS_ORIGIN=https://your-frontend-domain.com
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation
- Verify environment configuration
- Run the test setup script for debugging