const express = require('express');
const Company = require('../models/Company');
const User = require('../models/User');
const { authMiddleware, requireManufacturer } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const router = express.Router();

// GET /api/company/ - Get companies for current user
router.get('/company', authMiddleware, async (req, res) => {
  try {
    let companies;
    
    if (req.user.role === 'manufacturer') {
      // Manufacturers get companies they own
      companies = await Company.find({ owner: req.userId })
        .select('id name description address city state is_public is_verified')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'employee') {
      // Employees get companies they're associated with
      companies = await Company.find({ employees: req.userId })
        .select('id name description address city state')
        .sort({ createdAt: -1 });
    } else {
      // Other roles (like retailers) get empty array
      companies = [];
    }

    res.json(companies);
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Server error while fetching companies' });
  }
});

// GET /api/company/:id - Get specific company details
router.get('/company/:id', authMiddleware, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate('owner', 'username email first_name last_name')
      .populate('employees', 'username email first_name last_name');

    if (!company) {
      return res.status(404).json({
        error: 'Company not found'
      });
    }

    // Check permissions
    const isOwner = company.owner._id.toString() === req.userId.toString();
    const isEmployee = company.employees.some(emp => emp._id.toString() === req.userId.toString());
    
    if (!isOwner && !isEmployee && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. You are not associated with this company.'
      });
    }

    res.json(company);
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Server error while fetching company' });
  }
});

// POST /api/company/ - Create new company
router.post('/company', authMiddleware, requireManufacturer, validate(schemas.createCompany), async (req, res) => {
  try {
    // Check if user already has a company
    const existingCompany = await Company.findOne({ owner: req.userId });
    if (existingCompany) {
      return res.status(400).json({
        error: 'You already have a company. Each manufacturer can have only one company.'
      });
    }

    const company = new Company({
      ...req.body,
      owner: req.userId
    });

    await company.save();
    
    // Populate owner details
    await company.populate('owner', 'username email first_name last_name');

    res.status(201).json({
      message: 'Company created successfully',
      company
    });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Server error while creating company' });
  }
});

// PUT /api/company/:id - Update company
router.put('/company/:id', authMiddleware, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        error: 'Company not found'
      });
    }

    // Check permissions
    if (company.owner.toString() !== req.userId.toString() && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. Only company owner can update company details.'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'name', 'description', 'address', 'address_line1', 'city', 'state', 
      'pincode', 'phone', 'email', 'website', 'gstin', 'pan', 'industry', 
      'is_public', 'logo'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        company[field] = req.body[field];
      }
    });

    // Update settings if provided
    if (req.body.settings) {
      company.settings = {
        ...company.settings,
        ...req.body.settings
      };
    }

    await company.save();

    res.json({
      message: 'Company updated successfully',
      company
    });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Server error while updating company' });
  }
});

// GET /api/companies/public/ - Get public companies (for retailer discovery)
router.get('/companies/public', async (req, res) => {
  try {
    const { search, city, state, page = 1, limit = 20 } = req.query;

    // Build query
    const query = { 
      is_public: true,
      is_verified: true 
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { industry: { $regex: search, $options: 'i' } }
      ];
    }

    if (city) {
      query.city = { $regex: city, $options: 'i' };
    }

    if (state) {
      query.state = { $regex: state, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const companies = await Company.find(query)
      .select('id name description city state industry createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Company.countDocuments(query);

    res.json({
      results: companies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get public companies error:', error);
    res.status(500).json({ error: 'Server error while fetching public companies' });
  }
});

// POST /api/company/:id/employees - Add employee to company
router.post('/company/:id/employees', authMiddleware, async (req, res) => {
  try {
    const { employee_id } = req.body;

    if (!employee_id) {
      return res.status(400).json({
        error: 'Employee ID is required'
      });
    }

    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        error: 'Company not found'
      });
    }

    // Check permissions
    if (company.owner.toString() !== req.userId.toString() && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. Only company owner can add employees.'
      });
    }

    // Check if employee exists and has correct role
    const employee = await User.findById(employee_id);
    if (!employee) {
      return res.status(404).json({
        error: 'Employee not found'
      });
    }

    if (employee.role !== 'employee') {
      return res.status(400).json({
        error: 'User must have employee role'
      });
    }

    // Check if employee is already added
    if (company.employees.includes(employee_id)) {
      return res.status(400).json({
        error: 'Employee is already associated with this company'
      });
    }

    // Add employee
    company.employees.push(employee_id);
    await company.save();

    await company.populate('employees', 'username email first_name last_name');

    res.json({
      message: 'Employee added successfully',
      employees: company.employees
    });
  } catch (error) {
    console.error('Add employee error:', error);
    res.status(500).json({ error: 'Server error while adding employee' });
  }
});

// DELETE /api/company/:id/employees/:employeeId - Remove employee from company
router.delete('/company/:id/employees/:employeeId', authMiddleware, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        error: 'Company not found'
      });
    }

    // Check permissions
    if (company.owner.toString() !== req.userId.toString() && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. Only company owner can remove employees.'
      });
    }

    // Remove employee
    company.employees = company.employees.filter(
      emp => emp.toString() !== req.params.employeeId
    );
    await company.save();

    res.json({
      message: 'Employee removed successfully'
    });
  } catch (error) {
    console.error('Remove employee error:', error);
    res.status(500).json({ error: 'Server error while removing employee' });
  }
});

// GET /api/company/:id/employees - Get company employees
router.get('/company/:id/employees', authMiddleware, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate('employees', 'username email first_name last_name role createdAt');

    if (!company) {
      return res.status(404).json({
        error: 'Company not found'
      });
    }

    // Check permissions
    const isOwner = company.owner.toString() === req.userId.toString();
    const isEmployee = company.employees.some(emp => emp._id.toString() === req.userId.toString());
    
    if (!isOwner && !isEmployee && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. You are not associated with this company.'
      });
    }

    res.json(company.employees);
  } catch (error) {
    console.error('Get company employees error:', error);
    res.status(500).json({ error: 'Server error while fetching company employees' });
  }
});

// DELETE /api/company/:id - Delete company (soft delete)
router.delete('/company/:id', authMiddleware, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        error: 'Company not found'
      });
    }

    // Check permissions
    if (company.owner.toString() !== req.userId.toString() && !req.user.is_staff) {
      return res.status(403).json({
        error: 'Access denied. Only company owner can delete the company.'
      });
    }

    // For now, just mark as inactive instead of hard delete
    company.is_public = false;
    await company.save();

    res.json({
      message: 'Company deactivated successfully'
    });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Server error while deleting company' });
  }
});

module.exports = router;