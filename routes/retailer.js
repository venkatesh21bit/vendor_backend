const express = require('express');
const RetailerProfile = require('../models/RetailerProfile');
const { CompanyRetailerConnection } = require('../models/Connection');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Company = require('../models/Company');
const { authMiddleware, requireRetailer } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const router = express.Router();

// GET /api/retailer/profile/ - Get retailer profile
router.get('/retailer/profile', authMiddleware, requireRetailer, async (req, res) => {
  try {
    const profile = await RetailerProfile.findOne({ user: req.userId })
      .populate('user', 'username email first_name last_name');

    if (!profile) {
      return res.status(404).json({
        error: 'Retailer profile not found. Please create a retailer profile first.'
      });
    }

    res.json({
      id: profile._id,
      username: profile.user.username,
      business_name: profile.business_name,
      contact_person: profile.contact_person,
      phone: profile.phone,
      email: profile.email,
      address_line1: profile.address_line1,
      address_line2: profile.address_line2,
      city: profile.city,
      state: profile.state,
      pincode: profile.pincode,
      gstin: profile.gstin,
      is_verified: profile.is_verified
    });
  } catch (error) {
    console.error('Get retailer profile error:', error);
    res.status(500).json({ error: 'Server error while fetching retailer profile' });
  }
});

// PUT /api/retailer/profile/ - Create or update retailer profile
router.put('/retailer/profile', authMiddleware, requireRetailer, validate(schemas.retailerProfile), async (req, res) => {
  try {
    let profile = await RetailerProfile.findOne({ user: req.userId });

    if (profile) {
      // Update existing profile
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          profile[key] = req.body[key];
        }
      });
      await profile.save();
    } else {
      // Create new profile
      profile = new RetailerProfile({
        user: req.userId,
        ...req.body
      });
      await profile.save();
    }

    await profile.populate('user', 'username email first_name last_name');

    res.json({
      message: profile.isNew ? 'Retailer profile created successfully' : 'Retailer profile updated successfully',
      profile: {
        id: profile._id,
        username: profile.user.username,
        business_name: profile.business_name,
        contact_person: profile.contact_person,
        phone: profile.phone,
        email: profile.email,
        address_line1: profile.address_line1,
        address_line2: profile.address_line2,
        city: profile.city,
        state: profile.state,
        pincode: profile.pincode,
        gstin: profile.gstin,
        is_verified: profile.is_verified
      }
    });
  } catch (error) {
    console.error('Update retailer profile error:', error);
    res.status(500).json({ error: 'Server error while updating retailer profile' });
  }
});

// GET /api/retailer/products/ - Get products from connected companies
router.get('/retailer/products', authMiddleware, requireRetailer, async (req, res) => {
  try {
    // Get connected companies
    const connections = await CompanyRetailerConnection.find({
      retailer: req.userId,
      status: 'approved'
    });

    if (connections.length === 0) {
      return res.json([]);
    }

    const companyIds = connections.map(conn => conn.company);

    const { search, category, page = 1, limit = 50 } = req.query;

    // Build query
    const query = {
      company: { $in: companyIds },
      is_active: true,
      available_quantity: { $gt: 0 } // Only show products in stock
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (category) {
      query.category = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('company', 'name')
      .select('name category company available_quantity unit price status')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Format products for frontend
    const formattedProducts = products.map(product => ({
      product_id: product._id,
      name: product.name,
      category_name: product.category?.name || 'Uncategorized',
      company_name: product.company.name,
      available_quantity: product.available_quantity,
      unit: product.unit,
      price: product.price.toString(),
      status: product.status
    }));

    res.json(formattedProducts);
  } catch (error) {
    console.error('Get retailer products error:', error);
    res.status(500).json({ error: 'Server error while fetching products' });
  }
});

// GET /api/retailer/orders/ - Get retailer orders
router.get('/retailer/orders', authMiddleware, requireRetailer, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { retailer: req.userId };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find(query)
      .populate('company', 'name')
      .populate('items.product', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Format orders for frontend
    const formattedOrders = orders.map(order => ({
      order_id: order._id,
      company: order.company._id,
      company_name: order.company.name,
      order_date: order.createdAt,
      status: order.status,
      items: order.items.map(item => ({
        id: item._id,
        product: item.product._id,
        product_name: item.product_name || item.product.name,
        quantity: item.quantity
      }))
    }));

    res.json(formattedOrders);
  } catch (error) {
    console.error('Get retailer orders error:', error);
    res.status(500).json({ error: 'Server error while fetching orders' });
  }
});

// GET /api/retailer/count/ - Get retailer dashboard counts
router.get('/retailer/count', authMiddleware, requireRetailer, async (req, res) => {
  try {
    const [totalOrders, connectedCompanies, pendingRequests] = await Promise.all([
      Order.countDocuments({ retailer: req.userId }),
      CompanyRetailerConnection.countDocuments({ 
        retailer: req.userId, 
        status: 'approved' 
      }),
      // For pending requests, we would need to track retailer requests
      // For now, returning 0 as the model structure focuses on company-side requests
      Promise.resolve(0)
    ]);

    res.json({
      total_orders: totalOrders,
      connected_companies: connectedCompanies,
      pending_requests: pendingRequests
    });
  } catch (error) {
    console.error('Get retailer counts error:', error);
    res.status(500).json({ error: 'Server error while fetching retailer counts' });
  }
});

// GET /api/retailers/ - Get retailers for a company (manufacturer use)
router.get('/retailers', authMiddleware, async (req, res) => {
  try {
    const { company } = req.query;

    if (!company) {
      return res.status(400).json({
        error: 'Company ID is required'
      });
    }

    // Check if user has access to this company
    const companyDoc = await Company.findById(company);
    if (!companyDoc) {
      return res.status(404).json({
        error: 'Company not found'
      });
    }

    const isOwner = companyDoc.owner.toString() === req.userId.toString();
    const isEmployee = companyDoc.employees.includes(req.userId);

    if (!isOwner && !isEmployee && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. You are not associated with this company.'
      });
    }

    // Get connected retailers
    const connections = await CompanyRetailerConnection.find({
      company: company,
      status: 'approved'
    })
      .populate('retailer', 'username email first_name last_name')
      .populate({
        path: 'retailer',
        populate: {
          path: 'retailer_profile',
          model: 'RetailerProfile',
          select: 'business_name contact_person phone'
        }
      })
      .sort({ connected_at: -1 });

    // Format retailers
    const retailers = await Promise.all(
      connections.map(async (conn) => {
        const profile = await RetailerProfile.findOne({ user: conn.retailer._id });
        
        return {
          id: conn.retailer._id,
          username: conn.retailer.username,
          email: conn.retailer.email,
          first_name: conn.retailer.first_name,
          last_name: conn.retailer.last_name,
          business_name: profile?.business_name || '',
          contact_person: profile?.contact_person || '',
          phone: profile?.phone || '',
          connection_id: conn._id,
          credit_limit: conn.credit_limit,
          payment_terms: conn.payment_terms,
          connected_at: conn.connected_at
        };
      })
    );

    res.json(retailers);
  } catch (error) {
    console.error('Get retailers error:', error);
    res.status(500).json({ error: 'Server error while fetching retailers' });
  }
});

module.exports = router;