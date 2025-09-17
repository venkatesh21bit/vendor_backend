const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  sku: {
    type: String,
    trim: true,
    uppercase: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductCategory'
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  cost_price: {
    type: Number,
    min: 0
  },
  available_quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  total_shipped: {
    type: Number,
    default: 0,
    min: 0
  },
  total_required_quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  reorder_level: {
    type: Number,
    default: 10,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['PCS', 'KG', 'LITER', 'METER', 'GRAM', 'BOX', 'PACK', 'SET'],
    default: 'PCS'
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    weight: Number,
    unit: {
      type: String,
      enum: ['cm', 'inch', 'mm'],
      default: 'cm'
    }
  },
  images: [{
    url: String,
    alt_text: String,
    is_primary: {
      type: Boolean,
      default: false
    }
  }],
  // Tax Information
  hsn_code: {
    type: String,
    trim: true
  },
  cgst_rate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  sgst_rate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  igst_rate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  cess_rate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['sufficient', 'low_stock', 'out_of_stock', 'discontinued'],
    default: 'sufficient'
  },
  is_active: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  manufacturer_part_number: {
    type: String,
    trim: true
  },
  barcode: {
    type: String,
    trim: true
  },
  warranty_period: {
    type: Number,
    default: 0 // in months
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
productSchema.index({ company: 1, name: 1 });
productSchema.index({ company: 1, category: 1 });
productSchema.index({ company: 1, status: 1 });
productSchema.index({ sku: 1 }, { sparse: true });
productSchema.index({ barcode: 1 }, { sparse: true });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Update status based on available quantity
productSchema.pre('save', function(next) {
  if (this.available_quantity === 0) {
    this.status = 'out_of_stock';
  } else if (this.available_quantity <= this.reorder_level) {
    this.status = 'low_stock';
  } else {
    this.status = 'sufficient';
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);