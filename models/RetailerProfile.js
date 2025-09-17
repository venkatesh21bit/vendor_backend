const mongoose = require('mongoose');

const retailerProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  business_name: {
    type: String,
    required: true,
    trim: true
  },
  contact_person: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  address_line1: {
    type: String,
    required: true,
    trim: true
  },
  address_line2: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  pincode: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    default: 'India',
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
  business_type: {
    type: String,
    enum: ['sole_proprietorship', 'partnership', 'private_limited', 'public_limited', 'llp'],
    default: 'sole_proprietorship'
  },
  license_number: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  is_verified: {
    type: Boolean,
    default: false
  },
  verification_documents: [{
    document_type: {
      type: String,
      enum: ['gstin', 'pan', 'business_license', 'address_proof']
    },
    document_url: String,
    verification_status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    uploaded_at: {
      type: Date,
      default: Date.now
    }
  }],
  bank_details: {
    account_holder_name: String,
    account_number: String,
    bank_name: String,
    branch: String,
    ifsc_code: String,
    account_type: {
      type: String,
      enum: ['savings', 'current'],
      default: 'current'
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('RetailerProfile', retailerProfileSchema);