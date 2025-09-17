const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Company = require('../models/Company');
const { CompanyRetailerConnection } = require('../models/Connection');
const { authMiddleware, requireEmployee } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const router = express.Router();

// GET /api/employee_orders/ - Get orders for employee delivery management
router.get('/employee_orders', authMiddleware, requireEmployee, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    // Find companies where user is an employee
    const companies = await Company.find({ employees: req.userId });
    const companyIds = companies.map(c => c._id);

    if (companyIds.length === 0) {
      return res.json([]);
    }

    // Build query
    const query = { company: { $in: companyIds } };

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find(query)
      .populate('company', 'name address city state')
      .populate('retailer', 'username email first_name last_name')
      .populate('items.product', 'name unit')
      .populate('assigned_employee', 'username first_name last_name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      results: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get employee orders error:', error);
    res.status(500).json({ error: 'Server error while fetching employee orders' });
  }
});

// PUT /api/employee_orders/:id/assign - Assign order to employee
router.put('/employee_orders/:id/assign', authMiddleware, async (req, res) => {
  try {
    const { employee_id } = req.body;

    const order = await Order.findById(req.params.id)
      .populate('company');

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    // Check if user has access to this order's company
    const isOwner = order.company.owner.toString() === req.userId.toString();
    const isEmployee = order.company.employees.includes(req.userId);

    if (!isOwner && !isEmployee && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. You are not associated with this company.'
      });
    }

    // Validate employee if provided
    if (employee_id) {
      const isValidEmployee = order.company.employees.includes(employee_id);
      if (!isValidEmployee) {
        return res.status(400).json({
          error: 'Employee is not associated with this company'
        });
      }
    }

    order.assigned_employee = employee_id || null;
    order.updated_by = req.userId;
    await order.save();

    await order.populate('assigned_employee', 'username first_name last_name');

    res.json({
      message: employee_id ? 'Order assigned successfully' : 'Order unassigned successfully',
      order: {
        id: order._id,
        order_number: order.order_number,
        assigned_employee: order.assigned_employee
      }
    });
  } catch (error) {
    console.error('Assign order error:', error);
    res.status(500).json({ error: 'Server error while assigning order' });
  }
});

// PUT /api/employee_orders/:id/status - Update order status
router.put('/employee_orders/:id/status', authMiddleware, requireEmployee, async (req, res) => {
  try {
    const { status, delivery_notes, tracking_number } = req.body;

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const order = await Order.findById(req.params.id)
      .populate('company');

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    // Check if user is employee of this company or assigned to this order
    const isCompanyEmployee = order.company.employees.includes(req.userId);
    const isAssignedEmployee = order.assigned_employee?.toString() === req.userId.toString();

    if (!isCompanyEmployee && !isAssignedEmployee) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to update this order.'
      });
    }

    const oldStatus = order.status;
    order.status = status;
    order.updated_by = req.userId;

    if (delivery_notes) {
      order.delivery_notes = delivery_notes;
    }

    if (tracking_number) {
      order.tracking_number = tracking_number;
    }

    if (status === 'delivered') {
      order.delivery_date = new Date();
    }

    await order.save();

    res.json({
      message: `Order status updated from ${oldStatus} to ${status}`,
      order: {
        id: order._id,
        order_number: order.order_number,
        status: order.status,
        delivery_date: order.delivery_date,
        tracking_number: order.tracking_number
      }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Server error while updating order status' });
  }
});

// POST /api/employee_orders/:id/delivery-proof - Upload delivery proof
router.post('/employee_orders/:id/delivery-proof', authMiddleware, requireEmployee, async (req, res) => {
  try {
    const { proof_url } = req.body;

    if (!proof_url) {
      return res.status(400).json({
        error: 'Delivery proof URL is required'
      });
    }

    const order = await Order.findById(req.params.id)
      .populate('company');

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    // Check if user is employee of this company or assigned to this order
    const isCompanyEmployee = order.company.employees.includes(req.userId);
    const isAssignedEmployee = order.assigned_employee?.toString() === req.userId.toString();

    if (!isCompanyEmployee && !isAssignedEmployee) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to update this order.'
      });
    }

    order.delivery_proof = proof_url;
    order.status = 'delivered';
    order.delivery_date = new Date();
    order.updated_by = req.userId;
    await order.save();

    res.json({
      message: 'Delivery proof uploaded successfully',
      order: {
        id: order._id,
        order_number: order.order_number,
        status: order.status,
        delivery_date: order.delivery_date,
        delivery_proof: order.delivery_proof
      }
    });
  } catch (error) {
    console.error('Upload delivery proof error:', error);
    res.status(500).json({ error: 'Server error while uploading delivery proof' });
  }
});

// GET /api/employee_orders/my-assignments - Get orders assigned to current employee
router.get('/employee_orders/my-assignments', authMiddleware, requireEmployee, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { 
      assigned_employee: req.userId 
    };

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find(query)
      .populate('company', 'name address city state')
      .populate('retailer', 'username email first_name last_name')
      .populate('items.product', 'name unit')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      results: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ error: 'Server error while fetching assigned orders' });
  }
});

// GET /api/employee_orders/stats - Get employee delivery statistics
router.get('/employee_orders/stats', authMiddleware, requireEmployee, async (req, res) => {
  try {
    // Find companies where user is an employee
    const companies = await Company.find({ employees: req.userId });
    const companyIds = companies.map(c => c._id);

    const [
      totalOrders,
      assignedOrders,
      deliveredOrders,
      pendingOrders
    ] = await Promise.all([
      Order.countDocuments({ company: { $in: companyIds } }),
      Order.countDocuments({ assigned_employee: req.userId }),
      Order.countDocuments({ 
        assigned_employee: req.userId, 
        status: 'delivered' 
      }),
      Order.countDocuments({ 
        assigned_employee: req.userId, 
        status: { $in: ['pending', 'confirmed', 'processing', 'shipped'] }
      })
    ]);

    res.json({
      total_orders: totalOrders,
      assigned_orders: assignedOrders,
      delivered_orders: deliveredOrders,
      pending_orders: pendingOrders,
      delivery_success_rate: assignedOrders > 0 ? 
        Math.round((deliveredOrders / assignedOrders) * 100) : 0
    });
  } catch (error) {
    console.error('Get employee stats error:', error);
    res.status(500).json({ error: 'Server error while fetching employee statistics' });
  }
});

module.exports = router;