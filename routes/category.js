const express = require('express');
const mongoose = require('mongoose');
const ProductCategory = require('../models/ProductCategory');
const Company = require('../models/Company');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Helper function to validate ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
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

// GET /api/categories/list - Simple list of categories for current user (for dropdowns)
router.get('/categories/list', authMiddleware, async (req, res) => {
  try {
    console.log('GET /api/categories/list - User:', { userId: req.userId, role: req.user.role });

    const query = { is_active: true };

    // Find user's companies
    if (req.user.role === 'manufacturer') {
      const userCompany = await Company.findOne({ owner: req.userId });
      if (userCompany) {
        query.company = userCompany._id;
      } else {
        // No company found, return empty list
        return res.json([]);
      }
    } else if (req.user.role === 'employee') {
      const companies = await Company.find({ employees: req.userId });
      if (companies.length > 0) {
        query.company = { $in: companies.map(c => c._id) };
      } else {
        // No companies found, return empty list
        return res.json([]);
      }
    } else if (req.user.role === 'retailer') {
      // Retailers can see all categories
      // Remove company filter for retailers
    }

    console.log('Categories list query:', query);

    const categories = await ProductCategory.find(query)
      .select('_id name description')
      .sort({ sort_order: 1, name: 1 });

    console.log('Found categories for list:', categories.length);

    // Transform to frontend format
    const transformedCategories = categories.map(cat => ({
      category_id: cat._id,
      name: cat.name,
      description: cat.description
    }));

    res.json(transformedCategories);
  } catch (error) {
    console.error('Get categories list error:', error);
    res.status(500).json({ error: 'Server error while fetching categories' });
  }
});

// GET /api/categories/ - Get categories
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const { company, page = 1, limit = 50, format } = req.query;

    console.log('GET /api/categories - Query params:', { company, page, limit, format });
    console.log('User:', { userId: req.userId, role: req.user.role });

    const query = {};

    // Handle company parameter more gracefully
    if (company && company !== 'undefined' && isValidObjectId(company)) {
      await checkCompanyAccess(company, req.userId, req.user.role);
      query.company = company;
    } else if (!company || company === 'undefined') {
      // No company specified or undefined - find user's company
      if (req.user.role === 'manufacturer') {
        const userCompany = await Company.findOne({ owner: req.userId });
        if (userCompany) {
          query.company = userCompany._id;
        }
      } else if (req.user.role === 'employee') {
        const companies = await Company.find({ employees: req.userId });
        query.company = { $in: companies.map(c => c._id) };
      }
    } else if (company && company !== 'undefined' && !isValidObjectId(company)) {
      console.log('Invalid company ObjectId:', company);
      return res.status(400).json({ error: 'Invalid company ID format' });
    }

    query.is_active = true;

    console.log('Category query:', query);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const categories = await ProductCategory.find(query)
      .populate('parent_category', 'name')
      .populate('company', 'name')
      .sort({ sort_order: 1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ProductCategory.countDocuments(query);

    console.log('Found categories:', categories.length, 'total:', total);

    // For simple list format (used by frontend dropdowns)
    if (format === 'simple' || page === '1' && limit === '50' && !company) {
      const transformedCategories = categories.map(cat => ({
        category_id: cat._id,
        name: cat.name,
        description: cat.description
      }));
      return res.json(transformedCategories);
    }

    // Default paginated format
    res.json({
      results: categories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching categories' });
  }
});

// GET /api/categories/:id - Get specific category
router.get('/categories/:id', authMiddleware, async (req, res) => {
  try {
    const category = await ProductCategory.findById(req.params.id)
      .populate('parent_category', 'name')
      .populate('company', 'name');

    if (!category) {
      return res.status(404).json({
        error: 'Category not found'
      });
    }

    // Check company access
    await checkCompanyAccess(category.company._id, req.userId, req.user.role);

    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching category' });
  }
});

// POST /api/categories/ - Create new category
router.post('/categories', authMiddleware, async (req, res) => {
  try {
    const { name, description, company: companyId, parent_category, sort_order } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Category name is required'
      });
    }

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

    // Validate parent category if provided
    if (parent_category) {
      const parentCat = await ProductCategory.findOne({
        _id: parent_category,
        company: targetCompanyId
      });
      if (!parentCat) {
        return res.status(400).json({
          error: 'Invalid parent category for this company'
        });
      }
    }

    // Check for duplicate category name in the same company
    const existingCategory = await ProductCategory.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      company: targetCompanyId
    });

    if (existingCategory) {
      return res.status(400).json({
        error: 'Category with this name already exists in your company'
      });
    }

    const category = new ProductCategory({
      name,
      description,
      company: targetCompanyId,
      parent_category,
      sort_order: sort_order || 0
    });

    await category.save();

    await category.populate([
      { path: 'parent_category', select: 'name' },
      { path: 'company', select: 'name' }
    ]);

    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    console.error('Create category error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while creating category' });
  }
});

// PUT /api/categories/:id - Update category
router.put('/categories/:id', authMiddleware, async (req, res) => {
  try {
    const category = await ProductCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        error: 'Category not found'
      });
    }

    // Check company access
    await checkCompanyAccess(category.company, req.userId, req.user.role);

    const { name, description, parent_category, sort_order, is_active } = req.body;

    // Validate parent category if provided and changed
    if (parent_category && parent_category !== category.parent_category?.toString()) {
      if (parent_category === category._id.toString()) {
        return res.status(400).json({
          error: 'Category cannot be its own parent'
        });
      }

      const parentCat = await ProductCategory.findOne({
        _id: parent_category,
        company: category.company
      });
      if (!parentCat) {
        return res.status(400).json({
          error: 'Invalid parent category for this company'
        });
      }
    }

    // Check for duplicate name if name is being changed
    if (name && name !== category.name) {
      const existingCategory = await ProductCategory.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        company: category.company,
        _id: { $ne: category._id }
      });

      if (existingCategory) {
        return res.status(400).json({
          error: 'Category with this name already exists in your company'
        });
      }
    }

    // Update fields
    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (parent_category !== undefined) category.parent_category = parent_category || null;
    if (sort_order !== undefined) category.sort_order = sort_order;
    if (is_active !== undefined) category.is_active = is_active;

    await category.save();

    await category.populate([
      { path: 'parent_category', select: 'name' },
      { path: 'company', select: 'name' }
    ]);

    res.json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    console.error('Update category error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while updating category' });
  }
});

// DELETE /api/categories/:id - Delete category (soft delete)
router.delete('/categories/:id', authMiddleware, async (req, res) => {
  try {
    const category = await ProductCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        error: 'Category not found'
      });
    }

    // Check company access
    await checkCompanyAccess(category.company, req.userId, req.user.role);

    // Check if category has products
    const Product = require('../models/Product');
    const productCount = await Product.countDocuments({
      category: category._id,
      is_active: true
    });

    if (productCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete category with associated products. Please move or delete products first.'
      });
    }

    // Check if category has child categories
    const childCount = await ProductCategory.countDocuments({
      parent_category: category._id,
      is_active: true
    });

    if (childCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete category with child categories. Please delete or move child categories first.'
      });
    }

    category.is_active = false;
    await category.save();

    res.json({
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while deleting category' });
  }
});

// GET /api/categories/:id/products - Get products in a category
router.get('/categories/:id/products', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const category = await ProductCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        error: 'Category not found'
      });
    }

    // Check company access
    await checkCompanyAccess(category.company, req.userId, req.user.role);

    const Product = require('../models/Product');
    
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find({
      category: category._id,
      is_active: true
    })
      .populate('company', 'name')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments({
      category: category._id,
      is_active: true
    });

    res.json({
      category: {
        id: category._id,
        name: category.name,
        description: category.description
      },
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get category products error:', error);
    if (error.message.includes('Access denied') || error.message.includes('Company not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error while fetching category products' });
  }
});

// GET /api/category-stock/ - Get category statistics with product counts
router.get('/category-stock', authMiddleware, async (req, res) => {
  try {
    console.log('GET /api/category-stock - User:', { userId: req.userId, role: req.user.role });

    // Find user's companies
    let companyFilter = {};
    if (req.user.role === 'manufacturer') {
      const userCompany = await Company.findOne({ owner: req.userId });
      if (userCompany) {
        companyFilter = { company: userCompany._id };
      } else {
        return res.json({ data: [] });
      }
    } else if (req.user.role === 'employee') {
      const companies = await Company.find({ employees: req.userId });
      if (companies.length > 0) {
        companyFilter = { company: { $in: companies.map(c => c._id) } };
      } else {
        return res.json({ data: [] });
      }
    }

    // Get categories with product counts using aggregation
    const Product = require('../models/Product');
    
    const categoryStats = await ProductCategory.aggregate([
      {
        $match: {
          is_active: true,
          ...companyFilter
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category',
          as: 'products'
        }
      },
      {
        $addFields: {
          product_count: {
            $size: {
              $filter: {
                input: '$products',
                cond: { $eq: ['$$this.is_active', true] }
              }
            }
          }
        }
      },
      {
        $project: {
          category_id: '$_id',
          name: 1,
          description: 1,
          product_count: 1
        }
      },
      {
        $sort: { name: 1 }
      }
    ]);

    console.log('Found category stats:', categoryStats.length);

    res.json({
      data: categoryStats
    });
  } catch (error) {
    console.error('Get category stock error:', error);
    res.status(500).json({ error: 'Server error while fetching category statistics' });
  }
});

module.exports = router;