const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const companyRoutes = require('./routes/company');
const retailerRoutes = require('./routes/retailer');
const employeeRoutes = require('./routes/employee');
const productRoutes = require('./routes/product');
const orderRoutes = require('./routes/order');
const invoiceRoutes = require('./routes/invoice');
const categoryRoutes = require('./routes/category');
const connectionRoutes = require('./routes/connection');
const dashboardRoutes = require('./routes/dashboard');
const groupsRoutes = require('./routes/groups');

// Import middleware
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

// Trust proxy setting for production deployment (Render, Heroku, etc.)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000',
      'https://vendor-frontend-phi.vercel.app'
    ];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('combined'));
}

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vendor_database';

mongoose.connect(mongoUri)
.then(() => {
  console.log('✅ Connected to MongoDB');
  console.log('📊 Database:', mongoose.connection.name);
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', companyRoutes);
app.use('/api', retailerRoutes);
app.use('/api', employeeRoutes);
app.use('/api', productRoutes);
app.use('/api', orderRoutes);
app.use('/api', invoiceRoutes);
app.use('/api', categoryRoutes);
app.use('/api', connectionRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', groupsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8000;

// Check critical environment variables
const checkEnvVars = () => {
  const requiredVars = ['MONGODB_URI', 'JWT_SECRET'];
  const missingVars = [];
  
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    console.warn('⚠️  Missing environment variables:', missingVars.join(', '));
    console.warn('🔧 Using fallback values for development');
  } else {
    console.log('✅ All required environment variables are set');
  }
  
  console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
  console.log('🔑 JWT Secret:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing (using fallback)');
  console.log('🍃 MongoDB:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
};

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  checkEnvVars();
});

module.exports = app;