const express = require('express');
const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');
const Company = require('../models/Company');
const { authMiddleware, requireManufacturer } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const router = express.Router();

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
  return id && typeof id === 'string' && id !== 'undefined' && id !== 'null' && id.match(/^[0-9a-fA-F]{24}$/);
};

// Helper function to check company access
const checkCompanyAccess = async (companyId, userId, userRole) => {
  if (!isValidObjectId(companyId)) {
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

// GET /api/products/ - Get products with filters
router.get('/products', authMiddleware, async (req, res) => {
  try {
    const { 
      company, 
      category, 
      status, 
      search, 
      page = 1, 
      limit = 50,
      sort_by = 'createdAt',
      sort_order = 'desc'
    } = req.query;

    console.log('Products request:', { company, category, status, search, userRole: req.user.role });

    // Build query
    const query = {};

    // Validate and handle company parameter
    if (isValidObjectId(company)) {
      try {
        // Check company access
        await checkCompanyAccess(company, req.userId, req.user.role);
        query.company = company;
        console.log('Using company filter:', company);
      } catch (error) {
        console.warn('Company access check failed:', error.message);
        // Continue without company filter instead of failing
      }
    } else if (req.user.role === 'manufacturer') {
      // If no valid company specified and user is manufacturer, get their company's products
      const userCompany = await Company.findOne({ owner: req.userId });
      if (userCompany) {
        query.company = userCompany._id;
        console.log('Using manufacturer company:', userCompany._id);
      } else {
        console.log('No company found for manufacturer');
      }
    } else if (req.user.role === 'employee') {
      // If employee, get products from companies they're associated with
      const companies = await Company.find({ employees: req.userId });
      if (companies.length > 0) {
        query.company = { $in: companies.map(c => c._id) };
        console.log('Using employee companies:', companies.map(c => c._id));
      } else {
        console.log('No companies found for employee');
      }
    } else {
      console.log('No company filter applied for role:', req.user.role);
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    query.is_active = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sort_by] = sort_order === 'desc' ? -1 : 1;

    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('company', 'name')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    res.json({
      results: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching products' });
  }
});

// GET /api/products/:id - Get specific product
router.get('/products/:id', authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name description')
      .populate('company', 'name address city state')
      .populate('created_by', 'username first_name last_name')
      .populate('updated_by', 'username first_name last_name');

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    // Check company access
    await checkCompanyAccess(product.company._id, req.userId, req.user.role);

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching product' });
  }
});

// POST /api/products/ - Create new product
router.post('/products', authMiddleware, validate(schemas.createProduct), async (req, res) => {
  try {
    const { company: companyId, ...productData } = req.body;

    // If no company specified, use user's company (for manufacturers)
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

    // Validate category if provided
    if (productData.category) {
      const category = await ProductCategory.findOne({
        _id: productData.category,
        company: targetCompanyId
      });
      if (!category) {
        return res.status(400).json({
          error: 'Invalid category for this company'
        });
      }
    }

    // Generate SKU if not provided
    if (!productData.sku) {
      const count = await Product.countDocuments({ company: targetCompanyId });
      productData.sku = `PRD-${count + 1}`.padStart(10, '0');
    }

    const product = new Product({
      ...productData,
      company: targetCompanyId,
      created_by: req.userId,
      updated_by: req.userId
    });

    await product.save();

    // Populate references
    await product.populate([
      { path: 'category', select: 'name' },
      { path: 'company', select: 'name' }
    ]);

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while creating product' });
  }
});

// PUT /api/products/:id - Update product
router.put('/products/:id', authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    // Check company access
    await checkCompanyAccess(product.company, req.userId, req.user.role);

    // Validate category if provided
    if (req.body.category) {
      const category = await ProductCategory.findOne({
        _id: req.body.category,
        company: product.company
      });
      if (!category) {
        return res.status(400).json({
          error: 'Invalid category for this company'
        });
      }
    }

    // Update allowed fields
    const allowedUpdates = [
      'name', 'description', 'sku', 'category', 'price', 'cost_price',
      'available_quantity', 'total_shipped', 'total_required_quantity',
      'reorder_level', 'unit', 'dimensions', 'images', 'hsn_code',
      'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'tags',
      'manufacturer_part_number', 'barcode', 'warranty_period'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    product.updated_by = req.userId;
    await product.save();

    await product.populate([
      { path: 'category', select: 'name' },
      { path: 'company', select: 'name' }
    ]);

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while updating product' });
  }
});

// DELETE /api/products/:id - Delete product (soft delete)
router.delete('/products/:id', authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    // Check company access
    await checkCompanyAccess(product.company, req.userId, req.user.role);

    product.is_active = false;
    product.updated_by = req.userId;
    await product.save();

    res.json({
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while deleting product' });
  }
});

// POST /api/products/:id/adjust-stock - Adjust product stock
router.post('/products/:id/adjust-stock', authMiddleware, async (req, res) => {
  try {
    const { adjustment, reason } = req.body;

    if (typeof adjustment !== 'number') {
      return res.status(400).json({
        error: 'Adjustment must be a number'
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    // Check company access
    await checkCompanyAccess(product.company, req.userId, req.user.role);

    const oldQuantity = product.available_quantity;
    product.available_quantity = Math.max(0, oldQuantity + adjustment);
    product.updated_by = req.userId;
    await product.save();

    res.json({
      message: 'Stock adjusted successfully',
      old_quantity: oldQuantity,
      new_quantity: product.available_quantity,
      adjustment: adjustment,
      reason: reason || 'Manual adjustment'
    });
  } catch (error) {
    console.error('Adjust stock error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while adjusting stock' });
  }
});

// GET /api/products/low-stock/ - Get low stock products
router.get('/products/low-stock', authMiddleware, async (req, res) => {
  try {
    const { company } = req.query;

    // Build query for low stock products
    const query = {
      is_active: true,
      $expr: { $lte: ['$available_quantity', '$reorder_level'] }
    };

    // Validate and handle company parameter
    if (isValidObjectId(company)) {
      try {
        await checkCompanyAccess(company, req.userId, req.user.role);
        query.company = company;
      } catch (error) {
        console.warn('Company access check failed for low-stock:', error.message);
        // Continue without company filter
      }
    } else if (req.user.role === 'manufacturer') {
      const userCompany = await Company.findOne({ owner: req.userId });
      if (userCompany) {
        query.company = userCompany._id;
      }
    } else if (req.user.role === 'employee') {
      const companies = await Company.find({ employees: req.userId });
      if (companies.length > 0) {
        query.company = { $in: companies.map(c => c._id) };
      }
    }

    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('company', 'name')
      .sort({ available_quantity: 1 });

    res.json(products);
  } catch (error) {
    console.error('Get low stock products error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching low stock products' });
  }
});

module.exports = router;