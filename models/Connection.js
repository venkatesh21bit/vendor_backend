const mongoose = require('mongoose');

// Company invitations (for invite codes)
const companyInviteSchema = new mongoose.Schema({
  invite_code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  invited_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  message: {
    type: String,
    trim: true
  },
  expires_at: {
    type: Date,
    required: true
  },
  is_used: {
    type: Boolean,
    default: false
  },
  used_at: Date,
  used_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  max_uses: {
    type: Number,
    default: 1
  },
  current_uses: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Retailer requests to join companies
const retailerRequestSchema = new mongoose.Schema({
  retailer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  requested_at: {
    type: Date,
    default: Date.now
  },
  reviewed_at: Date,
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejection_reason: String
}, {
  timestamps: true
});

// Company-Retailer connections
const companyRetailerConnectionSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  retailer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['approved', 'suspended', 'terminated'],
    default: 'approved'
  },
  connected_at: {
    type: Date,
    default: Date.now
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approved_at: {
    type: Date,
    default: Date.now
  },
  credit_limit: {
    type: Number,
    default: 0,
    min: 0
  },
  payment_terms: {
    type: String,
    default: 'Net 30 days'
  },
  outstanding_amount: {
    type: Number,
    default: 0
  },
  total_orders: {
    type: Number,
    default: 0
  },
  total_order_value: {
    type: Number,
    default: 0
  },
  last_order_date: Date,
  notes: String,
  suspended_at: Date,
  suspended_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  suspension_reason: String
}, {
  timestamps: true
});

// Indexes
companyInviteSchema.index({ company: 1, createdAt: -1 });
companyInviteSchema.index({ expires_at: 1 });

retailerRequestSchema.index({ retailer: 1, company: 1 }, { unique: true });
retailerRequestSchema.index({ company: 1, status: 1 });
retailerRequestSchema.index({ status: 1, requested_at: -1 });

companyRetailerConnectionSchema.index({ company: 1, retailer: 1 }, { unique: true });
companyRetailerConnectionSchema.index({ company: 1, status: 1 });
companyRetailerConnectionSchema.index({ retailer: 1, status: 1 });

// Generate random invite code
companyInviteSchema.pre('save', function(next) {
  if (this.isNew && !this.invite_code) {
    this.invite_code = generateInviteCode();
  }
  next();
});

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const CompanyInvite = mongoose.model('CompanyInvite', companyInviteSchema);
const RetailerRequest = mongoose.model('RetailerRequest', retailerRequestSchema);
const CompanyRetailerConnection = mongoose.model('CompanyRetailerConnection', companyRetailerConnectionSchema);

module.exports = {
  CompanyInvite,
  RetailerRequest,
  CompanyRetailerConnection
};