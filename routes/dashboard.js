const express = require('express');
const Company = require('../models/Company');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { CompanyRetailerConnection } = require('../models/Connection');
const { authMiddleware } = require('../middleware/auth');
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

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const { company } = req.query;
    let targetCompanyId = company;

    // For manufacturers, get their company if not specified
    if (!targetCompanyId && req.user.role === 'manufacturer') {
      const userCompany = await Company.findOne({ owner: req.userId });
      targetCompanyId = userCompany?._id;
    }

    let stats = {};

    if (req.user.role === 'manufacturer' || req.user.role === 'employee') {
      if (!targetCompanyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      await checkCompanyAccess(targetCompanyId, req.userId, req.user.role);

      // Company-specific stats
      const [
        totalProducts,
        totalOrders,
        pendingOrders,
        totalRevenue,
        totalConnections,
        activeConnections,
        lowStockProducts
      ] = await Promise.all([
        Product.countDocuments({ company: targetCompanyId, is_active: true }),
        Order.countDocuments({ company: targetCompanyId }),
        Order.countDocuments({ company: targetCompanyId, status: { $in: ['pending', 'confirmed'] } }),
        Order.aggregate([
          { $match: { company: targetCompanyId, status: { $in: ['shipped', 'delivered'] } } },
          { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ]),
        CompanyRetailerConnection.countDocuments({ company: targetCompanyId }),
        CompanyRetailerConnection.countDocuments({ company: targetCompanyId, status: 'approved' }),
        Product.countDocuments({ 
          company: targetCompanyId, 
          is_active: true,
          $expr: { $lte: ['$available_quantity', '$min_stock_level'] }
        })
      ]);

      stats = {
        products: {
          total: totalProducts,
          low_stock: lowStockProducts
        },
        orders: {
          total: totalOrders,
          pending: pendingOrders
        },
        revenue: {
          total: totalRevenue[0]?.total || 0
        },
        connections: {
          total: totalConnections,
          active: activeConnections
        }
      };

    } else if (req.user.role === 'retailer') {
      // Retailer-specific stats
      const [
        totalOrders,
        pendingOrders,
        totalSpent,
        totalConnections,
        activeConnections
      ] = await Promise.all([
        Order.countDocuments({ retailer: req.userId }),
        Order.countDocuments({ retailer: req.userId, status: { $in: ['pending', 'confirmed'] } }),
        Order.aggregate([
          { $match: { retailer: req.userId, status: { $in: ['shipped', 'delivered'] } } },
          { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ]),
        CompanyRetailerConnection.countDocuments({ retailer: req.userId }),
        CompanyRetailerConnection.countDocuments({ retailer: req.userId, status: 'approved' })
      ]);

      stats = {
        orders: {
          total: totalOrders,
          pending: pendingOrders
        },
        spending: {
          total: totalSpent[0]?.total || 0
        },
        connections: {
          total: totalConnections,
          active: activeConnections
        }
      };

    } else if (req.user.role === 'staff') {
      // Admin/staff global stats
      const [
        totalCompanies,
        totalUsers,
        totalOrders,
        totalRevenue
      ] = await Promise.all([
        Company.countDocuments(),
        User.countDocuments(),
        Order.countDocuments(),
        Order.aggregate([
          { $match: { status: { $in: ['shipped', 'delivered'] } } },
          { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ])
      ]);

      stats = {
        companies: {
          total: totalCompanies
        },
        users: {
          total: totalUsers
        },
        orders: {
          total: totalOrders
        },
        revenue: {
          total: totalRevenue[0]?.total || 0
        }
      };
    }

    res.json(stats);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching dashboard stats' });
  }
});

// GET /api/dashboard/recent-orders - Get recent orders
router.get('/dashboard/recent-orders', authMiddleware, async (req, res) => {
  try {
    const { company, limit = 5 } = req.query;
    let targetCompanyId = company;

    const query = {};

    if (req.user.role === 'manufacturer' || req.user.role === 'employee') {
      if (!targetCompanyId) {
        const userCompany = await Company.findOne({ owner: req.userId });
        targetCompanyId = userCompany?._id;
      }
      
      if (!targetCompanyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      await checkCompanyAccess(targetCompanyId, req.userId, req.user.role);
      query.company = targetCompanyId;

    } else if (req.user.role === 'retailer') {
      query.retailer = req.userId;
    }

    const orders = await Order.find(query)
      .populate('company', 'name')
      .populate('retailer', 'username first_name last_name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(orders);
  } catch (error) {
    console.error('Get recent orders error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching recent orders' });
  }
});

// GET /api/dashboard/top-products - Get top selling products
router.get('/dashboard/top-products', authMiddleware, async (req, res) => {
  try {
    const { company, limit = 5 } = req.query;
    let targetCompanyId = company;

    if (req.user.role === 'manufacturer' || req.user.role === 'employee') {
      if (!targetCompanyId) {
        const userCompany = await Company.findOne({ owner: req.userId });
        targetCompanyId = userCompany?._id;
      }
      
      if (!targetCompanyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      await checkCompanyAccess(targetCompanyId, req.userId, req.user.role);

      // Get top products by quantity sold
      const topProducts = await Order.aggregate([
        { $match: { company: targetCompanyId, status: { $in: ['shipped', 'delivered'] } } },
        { $unwind: '$items' },
        { 
          $group: {
            _id: '$items.product',
            product_name: { $first: '$items.product_name' },
            total_quantity: { $sum: '$items.quantity' },
            total_revenue: { $sum: '$items.total_price' }
          }
        },
        { $sort: { total_quantity: -1 } },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product_details'
          }
        },
        {
          $project: {
            _id: 1,
            product_name: 1,
            total_quantity: 1,
            total_revenue: 1,
            current_stock: { $arrayElemAt: ['$product_details.available_quantity', 0] }
          }
        }
      ]);

      res.json(topProducts);

    } else if (req.user.role === 'retailer') {
      // For retailers, show their most ordered products
      const topProducts = await Order.aggregate([
        { $match: { retailer: req.userId, status: { $in: ['shipped', 'delivered'] } } },
        { $unwind: '$items' },
        { 
          $group: {
            _id: '$items.product',
            product_name: { $first: '$items.product_name' },
            total_quantity: { $sum: '$items.quantity' },
            total_spent: { $sum: '$items.total_price' }
          }
        },
        { $sort: { total_quantity: -1 } },
        { $limit: parseInt(limit) }
      ]);

      res.json(topProducts);

    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

  } catch (error) {
    console.error('Get top products error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching top products' });
  }
});

// GET /api/dashboard/revenue-chart - Get revenue data for charts
router.get('/dashboard/revenue-chart', authMiddleware, async (req, res) => {
  try {
    const { company, period = 'monthly' } = req.query;
    let targetCompanyId = company;

    if (req.user.role === 'manufacturer' || req.user.role === 'employee') {
      if (!targetCompanyId) {
        const userCompany = await Company.findOne({ owner: req.userId });
        targetCompanyId = userCompany?._id;
      }
      
      if (!targetCompanyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      await checkCompanyAccess(targetCompanyId, req.userId, req.user.role);
    }

    // Calculate date range and grouping based on period
    let dateFormat, dateRange;
    const now = new Date();
    
    if (period === 'daily') {
      dateFormat = '%Y-%m-%d';
      dateRange = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    } else if (period === 'weekly') {
      dateFormat = '%Y-W%U';
      dateRange = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000); // Last 12 weeks
    } else { // monthly
      dateFormat = '%Y-%m';
      dateRange = new Date(now.getFullYear() - 1, now.getMonth(), 1); // Last 12 months
    }

    const matchQuery = {
      status: { $in: ['shipped', 'delivered'] },
      createdAt: { $gte: dateRange }
    };

    if (req.user.role === 'manufacturer' || req.user.role === 'employee') {
      matchQuery.company = targetCompanyId;
    } else if (req.user.role === 'retailer') {
      matchQuery.retailer = req.userId;
    }

    const revenueData = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          revenue: { $sum: '$total_amount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(revenueData);

  } catch (error) {
    console.error('Get revenue chart error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching revenue chart data' });
  }
});

// GET /api/dashboard/order-status-distribution - Get order status distribution
router.get('/dashboard/order-status-distribution', authMiddleware, async (req, res) => {
  try {
    const { company } = req.query;
    let targetCompanyId = company;

    const matchQuery = {};

    if (req.user.role === 'manufacturer' || req.user.role === 'employee') {
      if (!targetCompanyId) {
        const userCompany = await Company.findOne({ owner: req.userId });
        targetCompanyId = userCompany?._id;
      }
      
      if (!targetCompanyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      await checkCompanyAccess(targetCompanyId, req.userId, req.user.role);
      matchQuery.company = targetCompanyId;

    } else if (req.user.role === 'retailer') {
      matchQuery.retailer = req.userId;
    }

    const statusDistribution = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json(statusDistribution);

  } catch (error) {
    console.error('Get order status distribution error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching order status distribution' });
  }
});

// GET /api/count - Get simplified dashboard counts for manufacturer dashboard
router.get('/count', authMiddleware, async (req, res) => {
  try {
    const { company } = req.query;
    let targetCompanyId = company;

    // For manufacturers, get their company if not specified
    if (!targetCompanyId && req.user.role === 'manufacturer') {
      const userCompany = await Company.findOne({ owner: req.userId });
      targetCompanyId = userCompany?._id;
    }

    if ((req.user.role === 'manufacturer' || req.user.role === 'employee') && !targetCompanyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    if (req.user.role === 'manufacturer' || req.user.role === 'employee') {
      await checkCompanyAccess(targetCompanyId, req.userId, req.user.role);

      // Company-specific counts
      const [
        orders_placed,
        pending_orders,
        employees_available,
        retailers_available
      ] = await Promise.all([
        Order.countDocuments({ company: targetCompanyId }),
        Order.countDocuments({ company: targetCompanyId, status: { $in: ['pending', 'confirmed'] } }),
        User.countDocuments({ 
          role: 'employee',
          $or: [
            { _id: { $in: (await Company.findById(targetCompanyId))?.employees || [] } },
            { company: targetCompanyId }
          ]
        }),
        CompanyRetailerConnection.countDocuments({ company: targetCompanyId, status: 'approved' })
      ]);

      const counts = {
        orders_placed,
        pending_orders,
        employees_available,
        retailers_available
      };

      console.log('Dashboard counts for company', targetCompanyId, ':', counts);
      res.json(counts);

    } else {
      return res.status(403).json({ error: 'Access denied. This endpoint is for manufacturers and employees only.' });
    }

  } catch (error) {
    console.error('Get dashboard counts error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching dashboard counts' });
  }
});

module.exports = router;