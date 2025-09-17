const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  address_line1: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  pincode: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    default: 'India',
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  gstin: {
    type: String,
    trim: true,
    uppercase: true
  },
  pan: {
    type: String,
    trim: true,
    uppercase: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  industry: {
    type: String,
    trim: true
  },
  is_public: {
    type: Boolean,
    default: true
  },
  is_verified: {
    type: Boolean,
    default: false
  },
  logo: {
    type: String
  },
  employees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  settings: {
    allow_retailer_discovery: {
      type: Boolean,
      default: true
    },
    auto_approve_requests: {
      type: Boolean,
      default: false
    },
    default_credit_limit: {
      type: Number,
      default: 0
    },
    default_payment_terms: {
      type: String,
      default: 'Net 30 days'
    }
  }
}, {
  timestamps: true
});

// Index for search
companySchema.index({ name: 'text', description: 'text' });
companySchema.index({ city: 1, state: 1 });

module.exports = mongoose.model('Company', companySchema);