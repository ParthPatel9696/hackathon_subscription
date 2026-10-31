const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  currency: { type: String, enum: ['INR'], default: 'INR' },
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
  value: { type: Number, required: true, min: 0 }, // e.g. 15 percent or INR 500 fixed amount
  minPurchaseAmount: { type: Number, default: 0, min: 0 },
  minQuantity: { type: Number, default: 0, min: 0 },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  usageLimit: { type: Number, default: 100, min: 1 },
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
