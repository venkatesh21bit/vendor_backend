const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoice_number: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
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
  retailer_profile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RetailerProfile'
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  invoice_date: {
    type: Date,
    required: true,
    default: Date.now
  },
  due_date: {
    type: Date,
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    product_name: String,
    hsn_code: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unit: String,
    unit_price: {
      type: Number,
      required: true,
      min: 0
    },
    total_price: {
      type: Number,
      required: true,
      min: 0
    },
    discount_percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    discount_amount: {
      type: Number,
      default: 0
    },
    taxable_value: {
      type: Number,
      required: true
    },
    cgst_rate: {
      type: Number,
      default: 0
    },
    cgst_amount: {
      type: Number,
      default: 0
    },
    sgst_rate: {
      type: Number,
      default: 0
    },
    sgst_amount: {
      type: Number,
      default: 0
    },
    igst_rate: {
      type: Number,
      default: 0
    },
    igst_amount: {
      type: Number,
      default: 0
    },
    cess_rate: {
      type: Number,
      default: 0
    },
    cess_amount: {
      type: Number,
      default: 0
    }
  }],
  // Summary amounts
  total_taxable_value: {
    type: Number,
    required: true,
    default: 0
  },
  total_cgst: {
    type: Number,
    default: 0
  },
  total_sgst: {
    type: Number,
    default: 0
  },
  total_igst: {
    type: Number,
    default: 0
  },
  total_cess: {
    type: Number,
    default: 0
  },
  total_tax: {
    type: Number,
    default: 0
  },
  total_discount: {
    type: Number,
    default: 0
  },
  round_off: {
    type: Number,
    default: 0
  },
  grand_total: {
    type: Number,
    required: true
  },
  // Payment details
  payment_mode: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'credit', 'cheque'],
    default: 'credit'
  },
  payment_status: {
    type: String,
    enum: ['unpaid', 'partially_paid', 'paid', 'overdue'],
    default: 'unpaid'
  },
  paid_amount: {
    type: Number,
    default: 0
  },
  balance_amount: {
    type: Number,
    default: 0
  },
  payment_terms: {
    type: String,
    default: 'Net 30 days'
  },
  // E-invoice details
  is_einvoice_generated: {
    type: Boolean,
    default: false
  },
  einvoice_number: String,
  irn: String,
  qr_code: String,
  einvoice_date: Date,
  // Additional details
  notes: String,
  terms_and_conditions: String,
  delivery_address: {
    address_line1: String,
    address_line2: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  place_of_supply: String,
  reverse_charge: {
    type: Boolean,
    default: false
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
invoiceSchema.index({ company: 1, createdAt: -1 });
invoiceSchema.index({ retailer: 1, createdAt: -1 });
invoiceSchema.index({ payment_status: 1 });
invoiceSchema.index({ invoice_date: 1 });
invoiceSchema.index({ due_date: 1 });

// Calculate balance amount before saving
invoiceSchema.pre('save', function(next) {
  this.balance_amount = this.grand_total - this.paid_amount;
  
  // Update payment status
  if (this.paid_amount === 0) {
    this.payment_status = 'unpaid';
  } else if (this.paid_amount >= this.grand_total) {
    this.payment_status = 'paid';
  } else {
    this.payment_status = 'partially_paid';
  }
  
  // Check if overdue
  if (this.payment_status !== 'paid' && new Date() > this.due_date) {
    this.payment_status = 'overdue';
  }
  
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);