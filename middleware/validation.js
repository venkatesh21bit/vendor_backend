const Joi = require('joi');

// Custom GSTIN validation function
const validateGSTIN = (value, helpers) => {
  if (!value || value === '') {
    return value; // Allow empty values
  }
  
  // If it's a valid GSTIN format (15 characters)
  const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (gstinPattern.test(value)) {
    return value; // Valid GSTIN format
  }
  
  // If it's just numbers or simple format, allow it
  if (value.length <= 15 && /^[0-9A-Za-z]+$/.test(value)) {
    return value; // Allow partial/simple format
  }
  
  return helpers.error('string.gstin');
};

// Custom PAN validation function  
const validatePAN = (value, helpers) => {
  if (!value || value === '') {
    return value; // Allow empty values
  }
  
  // If it's a valid PAN format
  const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (panPattern.test(value)) {
    return value; // Valid PAN format
  }
  
  // If it's just alphanumeric and reasonable length
  if (value.length <= 10 && /^[0-9A-Za-z]+$/.test(value)) {
    return value; // Allow partial/simple format
  }
  
  return helpers.error('string.pan');
};

// Validation schemas
const schemas = {
  // User registration
  registerUser: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    group_name: Joi.string().valid('Manufacturers', 'Retailers', 'Suppliers', 'Delivery Agents', 'Distributors').required()
  }),

  // User login
  loginUser: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
  }),

  // Company creation
  createCompany: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500),
    address: Joi.string().max(200),
    address_line1: Joi.string().max(100),
    city: Joi.string().max(50),
    state: Joi.string().max(50),
    pincode: Joi.string().pattern(/^\d{4,6}$/).allow(''),
    phone: Joi.string().pattern(/^[\+]?[0-9\s\-\(\)]{7,15}$/).allow(''),
    email: Joi.string().email().allow(''),
    website: Joi.string().uri().allow(''),
    gstin: Joi.string().custom(validateGSTIN).optional(),
    pan: Joi.string().custom(validatePAN).optional(),
    industry: Joi.string().max(50).allow(''),
    is_public: Joi.boolean()
  }),

  // Product creation
  createProduct: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(1000),
    sku: Joi.string().max(50),
    category: Joi.alternatives().try(
      Joi.string().pattern(/^[0-9a-fA-F]{24}$/), // MongoDB ObjectId
      Joi.number(), // Number from frontend
      Joi.string().allow(null, '') // Allow empty strings
    ).allow(null),
    company: Joi.alternatives().try(
      Joi.string().pattern(/^[0-9a-fA-F]{24}$/), // MongoDB ObjectId
      Joi.number() // Number from frontend
    ),
    price: Joi.number().min(0).required(),
    cost_price: Joi.number().min(0),
    available_quantity: Joi.number().min(0).required(),
    total_shipped: Joi.number().min(0),
    total_required_quantity: Joi.number().min(0),
    reorder_level: Joi.number().min(0),
    unit: Joi.string().valid('PCS', 'KG', 'LITER', 'METER', 'GRAM', 'BOX', 'PACK', 'SET').required(),
    hsn_code: Joi.string().max(20).allow(''),
    cgst_rate: Joi.number().min(0).max(100),
    sgst_rate: Joi.number().min(0).max(100),
    igst_rate: Joi.number().min(0).max(100),
    cess_rate: Joi.number().min(0).max(100),
    status: Joi.string().valid('sufficient', 'low_stock', 'out_of_stock', 'discontinued').default('sufficient'),
    tags: Joi.array().items(Joi.string().max(50)),
    manufacturer_part_number: Joi.string().max(50),
    barcode: Joi.string().max(50),
    warranty_period: Joi.number().min(0)
  }),

  // Order creation
  createOrder: Joi.object({
    retailer: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    items: Joi.array().items(
      Joi.object({
        product: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
        quantity: Joi.number().min(1).required(),
        unit_price: Joi.number().min(0).required()
      })
    ).min(1).required(),
    delivery_address: Joi.object({
      address_line1: Joi.string().required(),
      address_line2: Joi.string(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      pincode: Joi.string().pattern(/^\d{6}$/).required(),
      contact_person: Joi.string().required(),
      phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).required()
    }),
    delivery_date: Joi.date(),
    notes: Joi.string().max(500)
  }),

  // Retailer profile
  retailerProfile: Joi.object({
    business_name: Joi.string().min(1).max(100).required(),
    contact_person: Joi.string().min(1).max(50).required(),
    phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).required(),
    email: Joi.string().email().required(),
    address_line1: Joi.string().min(1).max(100).required(),
    address_line2: Joi.string().max(100),
    city: Joi.string().min(1).max(50).required(),
    state: Joi.string().min(1).max(50).required(),
    pincode: Joi.string().pattern(/^\d{6}$/).required(),
    gstin: Joi.string().custom(validateGSTIN).optional(),
    pan: Joi.string().custom(validatePAN).optional(),
    business_type: Joi.string().valid('sole_proprietorship', 'partnership', 'private_limited', 'public_limited', 'llp').allow(''),
    license_number: Joi.string().max(50).allow(''),
    website: Joi.string().uri().allow('')
  }),

  // Invoice creation
  createInvoice: Joi.object({
    retailer: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    order: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    invoice_date: Joi.date(),
    due_date: Joi.date().required(),
    items: Joi.array().items(
      Joi.object({
        product: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
        quantity: Joi.number().min(1).required(),
        unit_price: Joi.number().min(0).required()
      })
    ).min(1).required(),
    payment_terms: Joi.string().max(100),
    notes: Joi.string().max(500)
  }),

  // Company invite
  generateInvite: Joi.object({
    message: Joi.string().max(500),
    expires_in_days: Joi.number().min(1).max(30).default(7),
    email: Joi.string().email()
  }),

  // Join by invite code
  joinByCode: Joi.object({
    invite_code: Joi.string().required()
  }),

  // Request approval
  requestApproval: Joi.object({
    company_id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    message: Joi.string().min(10).max(500).required()
  }),

  // Accept/reject request
  handleRequest: Joi.object({
    request_id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    action: Joi.string().valid('approve', 'reject').required(),
    credit_limit: Joi.number().min(0),
    payment_terms: Joi.string().max(100)
  }),

  // Update connection
  updateConnection: Joi.object({
    connection_id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    status: Joi.string().valid('approved', 'suspended').required()
  }),

  // Password reset
  forgotPassword: Joi.object({
    username: Joi.string().required()
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    new_password: Joi.string().min(6).required()
  }),

  // OTP verification
  verifyOTP: Joi.object({
    username: Joi.string().required(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required()
  })
};

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false, // Show all validation errors
      messages: {
        'string.gstin': 'GSTIN should be either empty or in valid format (e.g., 22ABCDE1234F1Z1)',
        'string.pan': 'PAN should be either empty or in valid format (e.g., ABCDE1234F)',
        'string.email': 'Please provide a valid email address',
        'string.uri': 'Please provide a valid website URL',
        'string.pattern.base': 'Please check the format of this field'
      }
    });
    
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

module.exports = {
  schemas,
  validate
};