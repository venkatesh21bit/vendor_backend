const mongoose = require('mongoose');

const productCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  parent_category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductCategory'
  },
  is_active: {
    type: Boolean,
    default: true
  },
  sort_order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

productCategorySchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ProductCategory', productCategorySchema);