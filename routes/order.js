const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Company = require('../models/Company');
const RetailerProfile = require('../models/RetailerProfile');
const { CompanyRetailerConnection } = require('../models/Connection');
const { authMiddleware } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const router = express.Router();

// Helper function to check company access
const checkCompanyAccess = async (companyId, userId, userRole) => {
  const company = await Company.findById(companyId);
  if (!company) {
    throw new Error('Company not found');
  }

  const isOwner = company.owner.toString() === userId.toString();
  const isEmployee = company.employees.includes(userId);

  if (!isOwner && !isEmployee && userRole !== 'staff') {
    throw new Error('Access denied. You are not associated with this company.');
  }

  return company;
};

// GET /api/orders/ - Get orders
router.get('/orders', authMiddleware, async (req, res) => {
  try {
    const { 
      company, 
      retailer, 
      status, 
      page = 1, 
      limit = 20,
      sort_by = 'createdAt',
      sort_order = 'desc'
    } = req.query;

    // Build query
    const query = {};

    if (company) {
      await checkCompanyAccess(company, req.userId, req.user.role);
      query.company = company;
    } else if (req.user.role === 'manufacturer') {
      const userCompany = await Company.findOne({ owner: req.userId });
      if (userCompany) {
        query.company = userCompany._id;
      }
    } else if (req.user.role === 'employee') {
      const companies = await Company.find({ employees: req.userId });
      query.company = { $in: companies.map(c => c._id) };
    } else if (req.user.role === 'retailer') {
      query.retailer = req.userId;
    }

    if (retailer && req.user.role !== 'retailer') {
      query.retailer = retailer;
    }

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sort_by] = sort_order === 'desc' ? -1 : 1;

    const orders = await Order.find(query)
      .populate('company', 'name address city state')
      .populate('retailer', 'username email first_name last_name')
      .populate('items.product', 'name unit')
      .populate('assigned_employee', 'username first_name last_name')
      .sort(sortObj)
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
    console.error('Get orders error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching orders' });
  }
});

// GET /api/orders/:id - Get specific order
router.get('/orders/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('company', 'name address city state phone email')
      .populate('retailer', 'username email first_name last_name')
      .populate('retailer_profile')
      .populate('items.product', 'name unit price')
      .populate('assigned_employee', 'username first_name last_name')
      .populate('created_by', 'username first_name last_name')
      .populate('updated_by', 'username first_name last_name');

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    // Check access rights
    const isCompanyOwner = order.company.owner?.toString() === req.userId.toString();
    const isCompanyEmployee = order.company.employees?.includes(req.userId);
    const isOrderRetailer = order.retailer._id.toString() === req.userId.toString();

    if (!isCompanyOwner && !isCompanyEmployee && !isOrderRetailer && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to view this order.'
      });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Server error while fetching order' });
  }
});

// POST /api/orders/ - Create new order
router.post('/orders', authMiddleware, validate(schemas.createOrder), async (req, res) => {
  try {
    const { retailer: retailerId, items, delivery_address, delivery_date, notes, company: companyId } = req.body;

    // Determine target company
    let targetCompanyId = companyId;
    if (!targetCompanyId && req.user.role === 'manufacturer') {
      const userCompany = await Company.findOne({ owner: req.userId });
      if (!userCompany) {
        return res.status(400).json({
          error: 'No company found. Please create a company first.'
        });
      }
      targetCompanyId = userCompany._id;
    }

    if (!targetCompanyId) {
      return res.status(400).json({
        error: 'Company ID is required'
      });
    }

    // Check company access
    await checkCompanyAccess(targetCompanyId, req.userId, req.user.role);

    // Validate retailer connection
    const connection = await CompanyRetailerConnection.findOne({
      company: targetCompanyId,
      retailer: retailerId,
      status: 'approved'
    });

    if (!connection) {
      return res.status(400).json({
        error: 'Retailer is not connected to this company or connection is not approved'
      });
    }

    // Validate and calculate order items
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findOne({
        _id: item.product,
        company: targetCompanyId,
        is_active: true
      });

      if (!product) {
        return res.status(400).json({
          error: `Product not found or not available: ${item.product}`
        });
      }

      if (product.available_quantity < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for product: ${product.name}. Available: ${product.available_quantity}, Requested: ${item.quantity}`
        });
      }

      const unitPrice = item.unit_price || product.price;
      const totalPrice = unitPrice * item.quantity;
      
      // Calculate tax
      const taxableValue = totalPrice;
      const cgstAmount = (taxableValue * product.cgst_rate) / 100;
      const sgstAmount = (taxableValue * product.sgst_rate) / 100;
      const igstAmount = (taxableValue * product.igst_rate) / 100;
      const taxAmount = cgstAmount + sgstAmount + igstAmount;

      orderItems.push({
        product: product._id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        tax_amount: taxAmount
      });

      subtotal += totalPrice;

      // Update product stock
      product.available_quantity -= item.quantity;
      product.total_shipped += item.quantity;
      await product.save();
    }

    const totalTax = orderItems.reduce((sum, item) => sum + item.tax_amount, 0);
    const totalAmount = subtotal + totalTax;

    // Create order
    const order = new Order({
      company: targetCompanyId,
      retailer: retailerId,
      items: orderItems,
      subtotal,
      tax_amount: totalTax,
      total_amount: totalAmount,
      delivery_address,
      delivery_date,
      notes,
      created_by: req.userId,
      updated_by: req.userId
    });

    await order.save();

    // Populate references
    await order.populate([
      { path: 'company', select: 'name' },
      { path: 'retailer', select: 'username email first_name last_name' },
      { path: 'items.product', select: 'name unit' }
    ]);

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while creating order' });
  }
});

// PUT /api/orders/:id - Update order
router.put('/orders/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('company');

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    // Check access rights
    const isCompanyOwner = order.company.owner?.toString() === req.userId.toString();
    const isCompanyEmployee = order.company.employees?.includes(req.userId);

    if (!isCompanyOwner && !isCompanyEmployee && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to update this order.'
      });
    }

    // Only allow updates if order is still pending or confirmed
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        error: 'Order cannot be updated in current status'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'status', 'delivery_address', 'delivery_date', 'notes', 
      'assigned_employee', 'tracking_number'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        order[field] = req.body[field];
      }
    });

    order.updated_by = req.userId;
    await order.save();

    await order.populate([
      { path: 'company', select: 'name' },
      { path: 'retailer', select: 'username email first_name last_name' },
      { path: 'assigned_employee', select: 'username first_name last_name' }
    ]);

    res.json({
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Server error while updating order' });
  }
});

// DELETE /api/orders/:id - Cancel order
router.delete('/orders/:id', authMiddleware, async (req, res) => {
  try {
    const { cancellation_reason } = req.body;

    const order = await Order.findById(req.params.id)
      .populate('company')
      .populate('items.product');

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    // Check access rights
    const isCompanyOwner = order.company.owner?.toString() === req.userId.toString();
    const isCompanyEmployee = order.company.employees?.includes(req.userId);
    const isOrderRetailer = order.retailer.toString() === req.userId.toString();

    if (!isCompanyOwner && !isCompanyEmployee && !isOrderRetailer && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to cancel this order.'
      });
    }

    // Only allow cancellation if order is not yet shipped or delivered
    if (['shipped', 'delivered'].includes(order.status)) {
      return res.status(400).json({
        error: 'Order cannot be cancelled after shipping'
      });
    }

    // Restore product stock
    for (const item of order.items) {
      const product = await Product.findById(item.product._id);
      if (product) {
        product.available_quantity += item.quantity;
        product.total_shipped -= item.quantity;
        await product.save();
      }
    }

    order.status = 'cancelled';
    order.cancellation_reason = cancellation_reason || 'Cancelled by user';
    order.cancelled_by = req.userId;
    order.cancelled_at = new Date();
    order.updated_by = req.userId;
    await order.save();

    res.json({
      message: 'Order cancelled successfully',
      order: {
        id: order._id,
        order_number: order.order_number,
        status: order.status,
        cancelled_at: order.cancelled_at
      }
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Server error while cancelling order' });
  }
});

module.exports = router;