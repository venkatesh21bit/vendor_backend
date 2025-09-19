const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');
const Company = require('../models/Company');
const { authMiddleware, requireManufacturer } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const router = express.Router();

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
  if (!id) return false;
  
  // Handle ObjectId objects
  if (mongoose.Types.ObjectId.isValid(id)) {
    return true;
  }
  
  // Handle string representations
  if (typeof id === 'string' && id !== 'undefined' && id !== 'null' && id.match(/^[0-9a-fA-F]{24}$/)) {
    return true;
  }
  
  return false;
};

// Helper function to check company access
const checkCompanyAccess = async (companyId, userId, userRole) => {
  console.log('=== checkCompanyAccess DEBUG ===');
  console.log('checkCompanyAccess called with:', { companyId, userId, userRole, type: typeof companyId });
  
  const company = await Company.findById(companyId);
  if (!company) {
    console.log('Company not found for ID:', companyId);
    throw new Error('Company not found');
  }

  console.log('Company found:', {
    companyId: company._id,
    owner: company.owner,
    ownerType: typeof company.owner,
    employees: company.employees,
    userId: userId,
    userIdType: typeof userId
  });

  const isOwner = company.owner.toString() === userId.toString();
  const isEmployee = company.employees.includes(userId);

  console.log('Access check results:', { isOwner, isEmployee, userRole });

  if (!isOwner && !isEmployee && userRole !== 'staff') {
    console.log('ACCESS DENIED - User is not owner, employee, or staff');
    throw new Error('Access denied. You are not associated with this company.');
  }

  console.log('ACCESS GRANTED');
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

// GET /api/products/:id/invoice-details - Get product details for invoice creation
router.get('/products/:id/invoice-details', authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name')
      .populate('company', 'name');

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    // Check company access
    await checkCompanyAccess(product.company._id, req.userId, req.user.role);

    // Return product details formatted for invoice creation
    const invoiceDetails = {
      product_id: product._id,
      product_name: product.name,
      description: product.description,
      unit: product.unit,
      unit_price: product.price,
      available_quantity: product.available_quantity,
      hsn_code: product.hsn_code,
      cgst_rate: product.cgst_rate || 0,
      sgst_rate: product.sgst_rate || 0,
      igst_rate: product.igst_rate || 0,
      category_name: product.category?.name || '',
      company_name: product.company?.name || '',
      // Calculate suggested tax amount (for 1 unit)
      tax_amount: ((product.cgst_rate || 0) + (product.sgst_rate || 0) + (product.igst_rate || 0)) * product.price / 100,
      // Calculate total price including tax (for 1 unit)
      total_price_with_tax: product.price + (((product.cgst_rate || 0) + (product.sgst_rate || 0) + (product.igst_rate || 0)) * product.price / 100)
    };

    res.json(invoiceDetails);
  } catch (error) {
    console.error('Get product invoice details error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching product invoice details' });
  }
});

// GET /api/products/invoice-list/ - Get all products formatted for invoice creation
router.get('/products/invoice-list', authMiddleware, async (req, res) => {
  try {
    const { company, search, category, page = 1, limit = 50 } = req.query;

    console.log('Get products for invoice request:', { 
      company, 
      companyType: typeof company,
      search,
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

    // Check company access
    await checkCompanyAccess(targetCompanyId, req.userId, req.user.role);

    // Build query
    const query = {
      company: targetCompanyId,
      is_active: true,
      available_quantity: { $gt: 0 } // Only show products in stock
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { hsn_code: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(query)
      .populate('category', 'name')
      .select('name description unit price available_quantity hsn_code cgst_rate sgst_rate igst_rate category')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Format products for invoice creation
    const invoiceProducts = products.map(product => {
      const tax_rate = (product.cgst_rate || 0) + (product.sgst_rate || 0) + (product.igst_rate || 0);
      const tax_amount = (product.price * tax_rate) / 100;
      
      return {
        product_id: product._id,
        product_name: product.name,
        description: product.description,
        unit: product.unit,
        unit_price: product.price,
        available_quantity: product.available_quantity,
        hsn_code: product.hsn_code,
        cgst_rate: product.cgst_rate || 0,
        sgst_rate: product.sgst_rate || 0,
        igst_rate: product.igst_rate || 0,
        total_tax_rate: tax_rate,
        tax_amount_per_unit: tax_amount,
        total_price_with_tax: product.price + tax_amount,
        category_name: product.category?.name || 'Uncategorized'
      };
    });

    const total = await Product.countDocuments(query);

    console.log('Found products for invoice:', invoiceProducts.length);

    res.json({
      products: invoiceProducts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get products for invoice error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching products for invoice' });
  }
});

// POST /api/products/ - Create new product
router.post('/products', authMiddleware, validate(schemas.createProduct), async (req, res) => {
  try {
    console.log('=== PRODUCT CREATION DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Company value:', req.body.company, 'Type:', typeof req.body.company);
    console.log('Category value:', req.body.category, 'Type:', typeof req.body.category);
    
    const { company: companyId, category: categoryId, ...productData } = req.body;

    // Handle company ID conversion
    let targetCompanyId = companyId;
    if (typeof companyId === 'number') {
      // If it's a number, try to find the company by ID
      const company = await Company.findOne({ 
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(companyId.toString()) ? companyId.toString() : null },
          { id: companyId }
        ]
      });
      if (company) {
        targetCompanyId = company._id;
      }
    }

    // If no company specified, use user's company (for manufacturers)
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

    // Handle category ID conversion
    let targetCategoryId = null;
    if (categoryId) {
      if (typeof categoryId === 'number') {
        // If it's a number, try to find the category by ID
        const category = await ProductCategory.findOne({ 
          $or: [
            { _id: mongoose.Types.ObjectId.isValid(categoryId.toString()) ? categoryId.toString() : null },
            { id: categoryId }
          ],
          company: targetCompanyId
        });
        if (category) {
          targetCategoryId = category._id;
        }
      } else if (mongoose.Types.ObjectId.isValid(categoryId)) {
        // Validate category if provided as ObjectId
        const category = await ProductCategory.findOne({
          _id: categoryId,
          company: targetCompanyId
        });
        if (category) {
          targetCategoryId = category._id;
        }
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
      category: targetCategoryId,
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
    console.log('=== DELETE PRODUCT DEBUG ===');
    console.log('Product ID:', req.params.id);
    console.log('User ID:', req.userId);
    console.log('User Role:', req.user.role);
    
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    console.log('Product found:', {
      productId: product._id,
      productName: product.name,
      companyId: product.company,
      companyType: typeof product.company
    });

    // Check company access
    await checkCompanyAccess(product.company, req.userId, req.user.role);

    product.is_active = false;
    product.updated_by = req.userId;
    await product.save();

    console.log('Product deleted successfully');
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