const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  billingFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: 'monthly'
  },
  basePrice: { type: Number, required: true, min: 0 },
  minQuantity: { type: Number, default: 1, min: 1 },
  availableFrom: { type: Date, default: Date.now },
  availableTo: { type: Date },
  autoCloseAtEnd: { type: Boolean, default: false },
  allowPause: { type: Boolean, default: true },
  allowEarlyClose: { type: Boolean, default: true },
  allowRenew: { type: Boolean, default: true },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Plan', planSchema);
