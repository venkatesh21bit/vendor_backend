const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { validate, schemas } = require('../middleware/validation');
const router = express.Router();

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
  
  return { accessToken, refreshToken };
};

// POST /api/register
router.post('/register', validate(schemas.registerUser), async (req, res) => {
  try {
    const { username, email, password, group_name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email or username already exists'
      });
    }

    // Map group_name to role for backward compatibility
    const roleMapping = {
      'Manufacturers': 'manufacturer',
      'Retailers': 'retailer', 
      'Suppliers': 'supplier',
      'Delivery Agents': 'delivery_agent',
      'Distributors': 'distributor'
    };

    // Create new user
    const user = new User({
      username,
      email,
      password,
      first_name: username, // Use username as first_name temporarily
      last_name: '', // Empty last_name for now
      role: roleMapping[group_name] || 'retailer', // Default to retailer if mapping fails
      groups: [group_name], // Store the original group name
      email_verification_token: crypto.randomBytes(32).toString('hex')
    });

    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Save refresh token
    user.refresh_token = refreshToken;
    await user.save();

    res.status(201).json({
      message: 'User registered successfully',
      access: accessToken,
      refresh: refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        groups: user.groups,
        is_staff: user.is_staff
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// POST /api/token/ (Login)
router.post('/token', validate(schemas.loginUser), async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
      is_active: true
    });

    if (!user) {
      return res.status(401).json({
        detail: 'Invalid username or password'
      });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        detail: 'Invalid username or password'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Update user
    user.refresh_token = refreshToken;
    user.last_login = new Date();
    await user.save();

    res.json({
      access: accessToken,
      refresh: refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_staff: user.is_staff,
        groups: user.groups
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// POST /api/token/refresh/
router.post('/token/refresh', async (req, res) => {
  try {
    const { refresh } = req.body;

    if (!refresh) {
      return res.status(400).json({
        error: 'Refresh token is required'
      });
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
      
      // Find user and check if refresh token matches
      const user = await User.findOne({
        _id: decoded.userId,
        refresh_token: refresh,
        is_active: true
      });

      if (!user) {
        return res.status(401).json({
          error: 'Invalid refresh token'
        });
      }

      // Generate new access token
      const accessToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      res.json({
        access: accessToken
      });
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid or expired refresh token'
      });
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Server error during token refresh' });
  }
});

// POST /api/forgot-password/
router.post('/forgot-password', validate(schemas.forgotPassword), async (req, res) => {
  try {
    const { username } = req.body;

    const user = await User.findOne({
      $or: [{ username }, { email: username }],
      is_active: true
    });

    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        message: 'If a user with that username exists, a password reset OTP has been sent.'
      });
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP token (hash of OTP)
    const otpToken = crypto.createHash('sha256').update(otp).digest('hex');
    user.password_reset_token = otpToken;
    user.password_reset_expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // TODO: Send OTP via email/SMS
    console.log(`Password reset OTP for ${user.username}: ${otp}`);

    res.json({
      message: 'Password reset OTP has been sent to your registered email.',
      // For development only - remove in production
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error during password reset request' });
  }
});

// POST /api/verify-otp/
router.post('/verify-otp', validate(schemas.verifyOTP), async (req, res) => {
  try {
    const { username, otp } = req.body;

    const user = await User.findOne({
      $or: [{ username }, { email: username }],
      is_active: true
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid username or OTP'
      });
    }

    // Check if OTP is valid and not expired
    const otpToken = crypto.createHash('sha256').update(otp).digest('hex');
    
    if (user.password_reset_token !== otpToken || 
        !user.password_reset_expires || 
        user.password_reset_expires < new Date()) {
      return res.status(400).json({
        error: 'Invalid or expired OTP'
      });
    }

    // Generate temporary token for password reset
    const resetToken = jwt.sign(
      { userId: user._id, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      message: 'OTP verified successfully',
      reset_token: resetToken
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: 'Server error during OTP verification' });
  }
});

// POST /api/reset-password/
router.post('/reset-password', validate(schemas.resetPassword), async (req, res) => {
  try {
    const { token, new_password } = req.body;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.type !== 'password_reset') {
        return res.status(400).json({
          error: 'Invalid reset token'
        });
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(400).json({
          error: 'User not found'
        });
      }

      // Update password
      user.password = new_password;
      user.password_reset_token = undefined;
      user.password_reset_expires = undefined;
      user.refresh_token = undefined; // Invalidate existing sessions
      await user.save();

      res.json({
        message: 'Password reset successfully'
      });
    } catch (jwtError) {
      return res.status(400).json({
        error: 'Invalid or expired reset token'
      });
    }
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Server error during password reset' });
  }
});

// POST /api/resend-otp/
router.post('/resend-otp', validate(schemas.forgotPassword), async (req, res) => {
  try {
    const { username } = req.body;

    const user = await User.findOne({
      $or: [{ username }, { email: username }],
      is_active: true
    });

    if (!user) {
      return res.json({
        message: 'If a user with that username exists, a new OTP has been sent.'
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpToken = crypto.createHash('sha256').update(otp).digest('hex');
    
    user.password_reset_token = otpToken;
    user.password_reset_expires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // TODO: Send OTP via email/SMS
    console.log(`New password reset OTP for ${user.username}: ${otp}`);

    res.json({
      message: 'New OTP has been sent to your registered email.',
      // For development only - remove in production
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Server error during OTP resend' });
  }
});

// POST /api/logout/
router.post('/logout', async (req, res) => {
  try {
    const { refresh } = req.body;

    if (refresh) {
      // Invalidate refresh token
      await User.updateOne(
        { refresh_token: refresh },
        { $unset: { refresh_token: "" } }
      );
    }

    res.json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error during logout' });
  }
});

module.exports = router;