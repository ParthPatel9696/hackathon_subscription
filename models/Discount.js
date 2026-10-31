const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: { type: String, required: true },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  value: { type: Number, required: true, min: 0 }, // e.g. 15 (for 15%) or 500 (for $500)
  minPurchaseAmount: { type: Number, default: 0 },
  minQuantity: { type: Number, default: 0 },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  usageLimit: { type: Number, default: 100 },
  timesUsed: { type: Number, default: 0 },
  appliesTo: {
    type: String,
    enum: ['all', 'specific_product', 'seats'],
    default: 'all'
  },
  targetProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Discount', discountSchema);
