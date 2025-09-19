const express = require('express');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const Company = require('../models/Company');
const { authMiddleware } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const router = express.Router();

// Helper function to check company access
const checkCompanyAccess = async (companyId, userId, userRole) => {
  console.log('checkCompanyAccess called with:', { companyId, userId, userRole });
  
  // Validate companyId is provided and not undefined
  if (!companyId || companyId === 'undefined' || companyId === undefined) {
    throw new Error('Company ID is required and cannot be undefined');
  }

  // Validate ObjectId format
  if (!companyId.match(/^[0-9a-fA-F]{24}$/)) {
    throw new Error('Invalid company ID format');
  }

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

// GET /api/invoices/count/ - Get invoice counts for dashboard
router.get('/invoices/count', authMiddleware, async (req, res) => {
  try {
    const { company } = req.query;
    console.log('Invoice count request:', { 
      company, 
      companyType: typeof company,
      userId: req.userId,
      userRole: req.user.role,
      queryParams: req.query 
    });
    
    let targetCompanyId = company;

    // For manufacturers, get their company if not specified
    if (!targetCompanyId && req.user.role === 'manufacturer') {
      const userCompany = await Company.findOne({ owner: req.userId });
      console.log('Found user company:', userCompany?._id);
      targetCompanyId = userCompany?._id;
    }

    // Handle case where company parameter is explicitly "undefined" string
    if (targetCompanyId === 'undefined' || targetCompanyId === undefined) {
      if (req.user.role === 'manufacturer') {
        const userCompany = await Company.findOne({ owner: req.userId });
        console.log('Fallback to user company:', userCompany?._id);
        targetCompanyId = userCompany?._id;
      } else {
        targetCompanyId = null;
      }
    }

    console.log('Final targetCompanyId:', targetCompanyId);

    if ((req.user.role === 'manufacturer' || req.user.role === 'employee') && !targetCompanyId) {
      return res.status(400).json({ 
        error: 'Company ID is required. Please ensure you have a company associated with your account.' 
      });
    }

    // Build query based on user role
    const query = {};

    if (req.user.role === 'manufacturer' || req.user.role === 'employee') {
      await checkCompanyAccess(targetCompanyId, req.userId, req.user.role);
      query.company = targetCompanyId;
    } else if (req.user.role === 'retailer') {
      query.retailer = req.userId;
    }

    // Get invoice counts by status and payment status
    const [
      totalInvoices,
      draftInvoices,
      sentInvoices,
      paidInvoices,
      pendingPayment,
      overdueInvoices
    ] = await Promise.all([
      Invoice.countDocuments(query),
      Invoice.countDocuments({ ...query, status: 'draft' }),
      Invoice.countDocuments({ ...query, status: 'sent' }),
      Invoice.countDocuments({ ...query, payment_status: 'paid' }),
      Invoice.countDocuments({ ...query, payment_status: 'pending' }),
      Invoice.countDocuments({ 
        ...query, 
        payment_status: { $in: ['pending', 'partial'] },
        due_date: { $lt: new Date() }
      })
    ]);

    const counts = {
      total_invoices: totalInvoices,
      draft_invoices: draftInvoices,
      sent_invoices: sentInvoices,
      paid_invoices: paidInvoices,
      pending_payment: pendingPayment,
      overdue_invoices: overdueInvoices
    };

    console.log('Invoice counts for company', targetCompanyId, ':', counts);
    res.json(counts);

  } catch (error) {
    console.error('Get invoice counts error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching invoice counts' });
  }
});

// GET /api/invoices/ - Get invoices
router.get('/invoices', authMiddleware, async (req, res) => {
  try {
    const { 
      company, 
      retailer, 
      status, 
      payment_status,
      page = 1, 
      limit = 20,
      sort_by = 'created_at',
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

    if (payment_status) {
      query.payment_status = payment_status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sort_by] = sort_order === 'desc' ? -1 : 1;

    const invoices = await Invoice.find(query)
      .populate('company', 'name address city state phone email gst_number')
      .populate('retailer', 'username email first_name last_name')
      .populate('order', 'order_number status')
      .populate('created_by', 'username first_name last_name')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.json({
      results: invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching invoices' });
  }
});

// GET /api/invoices/:id - Get specific invoice
router.get('/invoices/:id', authMiddleware, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('company', 'name address city state pincode phone email gst_number')
      .populate('retailer', 'username email first_name last_name')
      .populate('retailer_profile', 'company_name address city state pincode phone gst_number')
      .populate('order', 'order_number delivery_address')
      .populate('created_by', 'username first_name last_name')
      .populate('updated_by', 'username first_name last_name');

    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found'
      });
    }

    // Check access rights
    const isCompanyOwner = invoice.company.owner?.toString() === req.userId.toString();
    const isCompanyEmployee = invoice.company.employees?.includes(req.userId);
    const isInvoiceRetailer = invoice.retailer._id.toString() === req.userId.toString();

    if (!isCompanyOwner && !isCompanyEmployee && !isInvoiceRetailer && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to view this invoice.'
      });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Server error while fetching invoice' });
  }
});

// POST /api/invoices/ - Create new invoice
router.post('/invoices', authMiddleware, validate(schemas.createInvoice), async (req, res) => {
  try {
    const { order_id, due_date, notes, company: companyId } = req.body;

    // Get the order
    const order = await Order.findById(order_id)
      .populate('company')
      .populate('retailer')
      .populate('retailer_profile')
      .populate('items.product');

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    // Determine target company
    let targetCompanyId = companyId || order.company._id;

    // Check company access
    await checkCompanyAccess(targetCompanyId, req.userId, req.user.role);

    // Check if invoice already exists for this order
    const existingInvoice = await Invoice.findOne({ order: order_id });
    if (existingInvoice) {
      return res.status(400).json({
        error: 'Invoice already exists for this order'
      });
    }

    // Generate invoice number
    const invoiceCount = await Invoice.countDocuments({ company: targetCompanyId });
    const invoice_number = `INV-${targetCompanyId.toString().slice(-6).toUpperCase()}-${String(invoiceCount + 1).padStart(6, '0')}`;

    // Create invoice items from order items
    const invoice_items = order.items.map(item => ({
      product: item.product._id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      tax_amount: item.tax_amount
    }));

    // Create invoice
    const invoice = new Invoice({
      invoice_number,
      company: targetCompanyId,
      retailer: order.retailer._id,
      retailer_profile: order.retailer_profile?._id,
      order: order._id,
      items: invoice_items,
      subtotal: order.subtotal,
      tax_amount: order.tax_amount,
      total_amount: order.total_amount,
      due_date: due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      notes,
      created_by: req.userId,
      updated_by: req.userId
    });

    await invoice.save();

    // Update order status
    order.invoice_generated = true;
    await order.save();

    // Populate references
    await invoice.populate([
      { path: 'company', select: 'name address city state' },
      { path: 'retailer', select: 'username email first_name last_name' },
      { path: 'order', select: 'order_number status' }
    ]);

    res.status(201).json({
      message: 'Invoice created successfully',
      invoice
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while creating invoice' });
  }
});

// POST /api/invoices/create/ - Create new invoice/bill directly with products
router.post('/invoices/create', authMiddleware, async (req, res) => {
  try {
    const { 
      company,
      retailer_id,
      items, // Array of { product_id, quantity, unit_price?, notes? }
      due_date,
      notes,
      discount_amount = 0,
      shipping_charges = 0
    } = req.body;

    console.log('Create invoice request:', { 
      company, 
      retailer_id, 
      items: items?.length,
      userId: req.userId,
      userRole: req.user.role
    });

    let targetCompanyId = company;

    // Handle case where company parameter is explicitly "undefined" string
    if (targetCompanyId === 'undefined' || targetCompanyId === undefined) {
      if (req.user.role === 'manufacturer') {
        const userCompany = await Company.findOne({ owner: req.userId });
        console.log('Fallback to user company:', userCompany?._id);
        targetCompanyId = userCompany?._id;
      } else {
        targetCompanyId = null;
      }
    }

    if (!targetCompanyId) {
      return res.status(400).json({
        error: 'Company ID is required. Please ensure you have a company associated with your account.'
      });
    }

    if (!retailer_id) {
      return res.status(400).json({
        error: 'Retailer ID is required. Please select a customer.'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Items are required. Please add at least one product.'
      });
    }

    console.log('Final targetCompanyId:', targetCompanyId);

    // Check company access
    await checkCompanyAccess(targetCompanyId, req.userId, req.user.role);

    // Generate invoice number
    const invoiceCount = await Invoice.countDocuments({ company: targetCompanyId });
    const invoice_number = `INV-${targetCompanyId.toString().slice(-6).toUpperCase()}-${String(invoiceCount + 1).padStart(6, '0')}`;

    // Process items and calculate totals
    const Product = require('../models/Product');
    let subtotal = 0;
    let total_tax_amount = 0;
    const processed_items = [];

    for (const item of items) {
      const product = await Product.findById(item.product_id);
      if (!product) {
        return res.status(404).json({
          error: `Product not found: ${item.product_id}`
        });
      }

      // Check if product belongs to the company
      if (product.company.toString() !== targetCompanyId.toString()) {
        return res.status(403).json({
          error: `Product ${product.name} does not belong to your company`
        });
      }

      // Check stock availability
      if (product.available_quantity < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}. Available: ${product.available_quantity}, Requested: ${item.quantity}`
        });
      }

      const unit_price = item.unit_price || product.price;
      const line_total = unit_price * item.quantity;
      
      // Calculate tax
      const cgst_amount = (line_total * (product.cgst_rate || 0)) / 100;
      const sgst_amount = (line_total * (product.sgst_rate || 0)) / 100;
      const igst_amount = (line_total * (product.igst_rate || 0)) / 100;
      const item_tax_amount = cgst_amount + sgst_amount + igst_amount;
      const total_price = line_total + item_tax_amount;

      processed_items.push({
        product: product._id,
        product_name: product.name,
        quantity: item.quantity,
        unit: product.unit,
        unit_price: unit_price,
        line_total: line_total,
        cgst_rate: product.cgst_rate || 0,
        sgst_rate: product.sgst_rate || 0,
        igst_rate: product.igst_rate || 0,
        cgst_amount: cgst_amount,
        sgst_amount: sgst_amount,
        igst_amount: igst_amount,
        tax_amount: item_tax_amount,
        total_price: total_price,
        hsn_code: product.hsn_code,
        notes: item.notes || ''
      });

      subtotal += line_total;
      total_tax_amount += item_tax_amount;
    }

    const total_amount = subtotal + total_tax_amount - discount_amount + shipping_charges;

    // Create invoice
    const invoice = new Invoice({
      invoice_number,
      company: targetCompanyId,
      retailer: retailer_id,
      items: processed_items,
      subtotal: subtotal,
      tax_amount: total_tax_amount,
      discount_amount: discount_amount,
      shipping_charges: shipping_charges,
      total_amount: total_amount,
      due_date: due_date ? new Date(due_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: notes || '',
      status: 'draft',
      payment_status: 'pending',
      created_by: req.userId,
      updated_by: req.userId
    });

    await invoice.save();

    // Update product quantities
    for (const item of processed_items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { available_quantity: -item.quantity } }
      );
    }

    // Populate references
    await invoice.populate([
      { path: 'company', select: 'name address city state phone email gstin' },
      { path: 'retailer', select: 'username email first_name last_name' },
      { path: 'items.product', select: 'name hsn_code unit' }
    ]);

    console.log('Created invoice:', invoice.invoice_number);

    res.status(201).json({
      message: 'Invoice created successfully',
      invoice: invoice
    });

  } catch (error) {
    console.error('Create invoice directly error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while creating invoice' });
  }
});

// PUT /api/invoices/:id - Update invoice
router.put('/invoices/:id', authMiddleware, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('company');

    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found'
      });
    }

    // Check access rights
    const isCompanyOwner = invoice.company.owner?.toString() === req.userId.toString();
    const isCompanyEmployee = invoice.company.employees?.includes(req.userId);

    if (!isCompanyOwner && !isCompanyEmployee && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to update this invoice.'
      });
    }

    // Only allow updates if invoice is draft or pending
    if (!['draft', 'pending'].includes(invoice.status)) {
      return res.status(400).json({
        error: 'Invoice cannot be updated in current status'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'status', 'payment_status', 'due_date', 'notes',
      'payment_amount', 'payment_date', 'payment_method', 'payment_reference'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        invoice[field] = req.body[field];
      }
    });

    // Auto-update payment status based on payment amount
    if (req.body.payment_amount !== undefined) {
      if (req.body.payment_amount >= invoice.total_amount) {
        invoice.payment_status = 'paid';
        invoice.payment_date = req.body.payment_date || new Date();
      } else if (req.body.payment_amount > 0) {
        invoice.payment_status = 'partial';
        invoice.payment_date = req.body.payment_date || new Date();
      }
    }

    invoice.updated_by = req.userId;
    await invoice.save();

    await invoice.populate([
      { path: 'company', select: 'name' },
      { path: 'retailer', select: 'username email first_name last_name' },
      { path: 'order', select: 'order_number status' }
    ]);

    res.json({
      message: 'Invoice updated successfully',
      invoice
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Server error while updating invoice' });
  }
});

// POST /api/invoices/:id/send - Send invoice to retailer
router.post('/invoices/:id/send', authMiddleware, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('company')
      .populate('retailer');

    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found'
      });
    }

    // Check access rights
    const isCompanyOwner = invoice.company.owner?.toString() === req.userId.toString();
    const isCompanyEmployee = invoice.company.employees?.includes(req.userId);

    if (!isCompanyOwner && !isCompanyEmployee && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to send this invoice.'
      });
    }

    // Update invoice status
    invoice.status = 'sent';
    invoice.sent_date = new Date();
    invoice.updated_by = req.userId;
    await invoice.save();

    // TODO: Implement email sending logic here
    // This would integrate with nodemailer or other email service

    res.json({
      message: 'Invoice sent successfully',
      invoice: {
        id: invoice._id,
        invoice_number: invoice.invoice_number,
        status: invoice.status,
        sent_date: invoice.sent_date
      }
    });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: 'Server error while sending invoice' });
  }
});

// DELETE /api/invoices/:id - Delete invoice (only if draft)
router.delete('/invoices/:id', authMiddleware, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('company');

    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found'
      });
    }

    // Check access rights
    const isCompanyOwner = invoice.company.owner?.toString() === req.userId.toString();
    const isCompanyEmployee = invoice.company.employees?.includes(req.userId);

    if (!isCompanyOwner && !isCompanyEmployee && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to delete this invoice.'
      });
    }

    // Only allow deletion if invoice is draft
    if (invoice.status !== 'draft') {
      return res.status(400).json({
        error: 'Only draft invoices can be deleted'
      });
    }

    await Invoice.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Server error while deleting invoice' });
  }
});

module.exports = router;