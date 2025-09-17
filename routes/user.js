const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// GET /api/user_detail/ - Get current user details
router.get('/user_detail', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -refresh_token');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_staff: user.is_staff,
      is_active: user.is_active,
      groups: user.groups,
      last_login: user.last_login,
      email_verified: user.email_verified,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Server error while fetching user details' });
  }
});

// PUT /api/user_detail/ - Update current user details
router.put('/user_detail', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;
    
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.userId } });
      if (existingUser) {
        return res.status(400).json({
          error: 'Email already taken by another user'
        });
      }
      user.email = email;
      user.email_verified = false; // Reset email verification if email changed
    }

    if (first_name) user.first_name = first_name;
    if (last_name) user.last_name = last_name;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_staff: user.is_staff,
        email_verified: user.email_verified
      }
    });
  } catch (error) {
    console.error('Update user details error:', error);
    res.status(500).json({ error: 'Server error while updating user details' });
  }
});

// POST /api/change-password/ - Change user password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await user.comparePassword(current_password);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = new_password;
    user.refresh_token = undefined; // Invalidate existing sessions
    await user.save();

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error while changing password' });
  }
});

// GET /api/users/ - Get all users (admin only)
router.get('/users', authMiddleware, async (req, res) => {
  try {
    if (!req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. Admin privileges required.'
      });
    }

    const { role, page = 1, limit = 10, search } = req.query;
    
    // Build query
    const query = { is_active: true };
    
    if (role) {
      query.role = role;
    }
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .select('-password -refresh_token')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error while fetching users' });
  }
});

// GET /api/users/:id - Get specific user details (admin only)
router.get('/users/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. Admin privileges required.'
      });
    }

    const user = await User.findById(req.params.id).select('-password -refresh_token');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Server error while fetching user' });
  }
});

// PUT /api/users/:id/status - Update user status (admin only)
router.put('/users/:id/status', authMiddleware, async (req, res) => {
  try {
    if (!req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. Admin privileges required.'
      });
    }

    const { is_active } = req.body;
    
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        error: 'is_active must be a boolean value'
      });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    user.is_active = is_active;
    await user.save();

    res.json({
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user._id,
        username: user.username,
        is_active: user.is_active
      }
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Server error while updating user status' });
  }
});

module.exports = router;