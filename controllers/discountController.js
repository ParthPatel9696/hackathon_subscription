const Discount = require('../models/Discount');

// GET /api/discounts
exports.getDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find().sort({ createdAt: -1 });
    res.json({ success: true, count: discounts.length, data: discounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/discounts
exports.createDiscount = async (req, res) => {
  try {
    const {
      code,
      name,
      discountType,
      value,
      minPurchaseAmount,
      minQuantity,
      startDate,
      endDate,
      usageLimit,
      appliesTo,
      targetProduct
    } = req.body;

    const existing = await Discount.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Discount code already exists' });
    }

    const discount = new Discount({
      code: code.toUpperCase(),
      name,
      discountType,
      value: parseFloat(value),
      minPurchaseAmount: parseFloat(minPurchaseAmount || 0),
      minQuantity: parseInt(minQuantity || 0),
      startDate: startDate || new Date(),
      endDate: endDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      usageLimit: parseInt(usageLimit || 100),
      appliesTo: appliesTo || 'all',
      targetProduct: targetProduct || null
    });

    await discount.save();
    res.status(201).json({ success: true, data: discount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/discounts/validate
exports.validateCoupon = async (req, res) => {
  try {
    const { code, cartAmount, quantity } = req.body;
    const discount = await Discount.findOne({ code: code.toUpperCase(), isActive: true });

    if (!discount) {
      return res.status(404).json({ success: false, error: 'Invalid or inactive promo code.' });
    }

    const today = new Date();
    if (discount.startDate > today || discount.endDate < today) {
      return res.status(400).json({ success: false, error: 'Promo code is expired or not yet valid.' });
    }

    if (discount.timesUsed >= discount.usageLimit) {
      return res.status(400).json({ success: false, error: 'Promo code usage limit has been exhausted.' });
    }

    if (cartAmount < discount.minPurchaseAmount) {
      return res.status(400).json({
        success: false,
        error: `Minimum purchase of $${discount.minPurchaseAmount} required for this discount.`
      });
    }

    let calculatedDiscount = 0;
    if (discount.discountType === 'percentage') {
      calculatedDiscount = (cartAmount * discount.value) / 100;
    } else {
      calculatedDiscount = Math.min(discount.value, cartAmount);
    }

    res.json({
      success: true,
      data: {
        code: discount.code,
        discountType: discount.discountType,
        value: discount.value,
        calculatedDiscount,
        appliesTo: discount.appliesTo
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
