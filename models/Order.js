const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  order_number: {
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
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    product_name: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
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
    tax_amount: {
      type: Number,
      default: 0
    },
    discount_amount: {
      type: Number,
      default: 0
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax_amount: {
    type: Number,
    default: 0
  },
  discount_amount: {
    type: Number,
    default: 0
  },
  shipping_charges: {
    type: Number,
    default: 0
  },
  total_amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'pending'
  },
  payment_status: {
    type: String,
    enum: ['unpaid', 'partially_paid', 'paid', 'refunded'],
    default: 'unpaid'
  },
  payment_method: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'credit'],
    default: 'credit'
  },
  delivery_address: {
    address_line1: String,
    address_line2: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    },
    contact_person: String,
    phone: String
  },
  delivery_date: Date,
  delivery_notes: String,
  assigned_employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tracking_number: String,
  delivery_proof: {
    type: String // URL to delivery proof image
  },
  notes: String,
  cancellation_reason: String,
  cancelled_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelled_at: Date,
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
orderSchema.index({ company: 1, createdAt: -1 });
orderSchema.index({ retailer: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ payment_status: 1 });
orderSchema.index({ assigned_employee: 1 });

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.order_number) {
    const count = await this.constructor.countDocuments({ company: this.company });
    this.order_number = `ORD-${Date.now()}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);