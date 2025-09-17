# Vendor Backend - Render Deployment Guide

## Overview
This Express.js backend is configured for deployment on Render.com with MongoDB database integration.

## Prerequisites
- Render.com account
- GitHub repository connected to Render
- MongoDB Atlas account (or use Render's MongoDB service)

## Deployment Steps

### 1. Repository Setup
Ensure your repository contains:
- `package.json` with proper scripts
- `server.js` as the main entry point
- `render.yaml` for service configuration
- All route files in `/routes` directory
- All model files in `/models` directory

### 2. Render Service Configuration

#### Option A: Using render.yaml (Recommended)
The `render.yaml` file is already configured with:
- Web service configuration
- Environment variables
- MongoDB database setup

#### Option B: Manual Configuration
If not using render.yaml, create a new Web Service in Render with:
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: 18+ (specified in package.json engines)

### 3. Environment Variables
Configure the following environment variables in Render:

#### Required Variables:
- `NODE_ENV`: `production`
- `PORT`: `10000` (Render default)
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Generate a secure random string
- `JWT_REFRESH_SECRET`: Generate another secure random string

#### Optional Variables:
- `JWT_EXPIRES_IN`: `24h` (default)
- `JWT_REFRESH_EXPIRES_IN`: `30d` (default)
- `CORS_ORIGIN`: Your frontend URL (comma-separated if multiple)
- `RATE_LIMIT_WINDOW_MS`: `900000` (15 minutes)
- `RATE_LIMIT_MAX_REQUESTS`: `100`

### 4. Database Setup

#### Using Render's MongoDB:
The `render.yaml` includes a MongoDB database configuration. Render will automatically:
- Create a MongoDB instance
- Set up the connection string in `MONGODB_URI`

#### Using MongoDB Atlas:
1. Create a MongoDB Atlas account
2. Create a new cluster
3. Get the connection string
4. Add it as `MONGODB_URI` environment variable
5. Whitelist Render's IP addresses (or use 0.0.0.0/0 for simplicity)

### 5. CORS Configuration
Update the `CORS_ORIGIN` environment variable with your frontend URL:
- Development: `http://localhost:3000`
- Production: `https://your-frontend-app.onrender.com`

### 6. Deployment Process
1. Push your code to GitHub
2. Connect the repository to Render
3. Render will automatically:
   - Install dependencies (`npm install`)
   - Start the server (`npm start`)
   - Make the service available at the provided URL

## API Endpoints

### Base URL
- Production: `https://vendor-backend.onrender.com`
- Health Check: `https://vendor-backend.onrender.com/health`

### Authentication Endpoints
- `POST /api/register` - User registration
- `POST /api/token` - User login
- `POST /api/token/refresh` - Refresh access token
- `POST /api/forgot-password` - Request password reset
- `POST /api/verify-otp` - Verify OTP
- `POST /api/reset-password` - Reset password
- `POST /api/logout` - User logout

### Other API Routes
- `/api/users` - User management
- `/api/companies` - Company management
- `/api/retailers` - Retailer management
- `/api/products` - Product management
- `/api/orders` - Order management
- `/api/invoices` - Invoice management
- And more...

## Monitoring and Logs
- Check deployment logs in Render dashboard
- Monitor service health via `/health` endpoint
- Set up alerts for service downtime

## Security Considerations
1. Use strong, unique JWT secrets
2. Configure proper CORS origins
3. Set up rate limiting
4. Use HTTPS in production (automatic with Render)
5. Keep dependencies updated
6. Monitor for security vulnerabilities

## Troubleshooting

### Common Issues:
1. **503 Service Unavailable**: Check if MongoDB connection string is correct
2. **CORS Errors**: Verify CORS_ORIGIN environment variable
3. **JWT Errors**: Ensure JWT_SECRET is set and consistent
4. **Port Issues**: Render uses PORT environment variable (automatically set to 10000)

### Debug Commands:
```bash
# Check environment variables
npm run dev

# Test MongoDB connection
node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('Connected')).catch(console.error)"
```

## Performance Optimization
1. Enable compression middleware
2. Use connection pooling for MongoDB
3. Implement caching where appropriate
4. Monitor response times and optimize slow queries

## Backup and Recovery
1. Regular database backups (MongoDB Atlas has automatic backups)
2. Keep environment variables documented
3. Version control for all configuration files

## Support
For deployment issues:
- Check Render documentation: https://render.com/docs
- Review application logs in Render dashboard
- Contact support if needed

---

**Last Updated**: September 2025
**Version**: 1.0.0