const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided or invalid format.' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. Token not found.' 
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return res.status(401).json({ 
          error: 'Token is valid but user not found.' 
        });
      }

      if (!user.is_active) {
        return res.status(401).json({ 
          error: 'User account is deactivated.' 
        });
      }

      req.user = user;
      req.userId = user._id;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired. Please refresh your token.' 
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Invalid token.' 
        });
      } else {
        throw jwtError;
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Server error during authentication.' 
    });
  }
};

// Middleware to check if user is a manufacturer
const requireManufacturer = (req, res, next) => {
  if (req.user.role !== 'manufacturer') {
    return res.status(403).json({ 
      error: 'Access denied. Manufacturer role required.' 
    });
  }
  next();
};

// Middleware to check if user is a retailer
const requireRetailer = (req, res, next) => {
  if (req.user.role !== 'retailer') {
    return res.status(403).json({ 
      error: 'Access denied. Retailer role required.' 
    });
  }
  next();
};

// Middleware to check if user is an employee
const requireEmployee = (req, res, next) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ 
      error: 'Access denied. Employee role required.' 
    });
  }
  next();
};

// Middleware to check if user is staff
const requireStaff = (req, res, next) => {
  if (!req.user.is_staff && req.user.role !== 'manufacturer') {
    return res.status(403).json({ 
      error: 'Access denied. Staff privileges required.' 
    });
  }
  next();
};

// Optional auth middleware - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user && user.is_active) {
      req.user = user;
      req.userId = user._id;
    }
    
    next();
  } catch (error) {
    // Ignore token errors in optional auth
    next();
  }
};

module.exports = {
  authMiddleware,
  requireManufacturer,
  requireRetailer,
  requireEmployee,
  requireStaff,
  optionalAuth
};