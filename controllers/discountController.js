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

    if (!code || !name || !discountType || value === undefined) {
      return res.status(400).json({ success: false, error: 'Code, name, discount type, and value are required.' });
    }
    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ success: false, error: 'Discount type must be percentage or fixed.' });
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0 || (discountType === 'percentage' && numericValue > 100)) {
      return res.status(400).json({ success: false, error: 'Discount value is invalid.' });
    }

    const existing = await Discount.findOne({ code: code.trim().toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Discount code already exists' });
    }

    const discount = new Discount({
      code: code.toUpperCase(),
      name,
      discountType,
      value: numericValue,
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
    const numericCartAmount = Number(cartAmount);
    const numericQuantity = Number(quantity || 0);
    if (!code || !Number.isFinite(numericCartAmount) || numericCartAmount < 0) {
      return res.status(400).json({ success: false, error: 'A valid coupon code and cart amount are required.' });
    }
    const discount = await Discount.findOne({ code: code.trim().toUpperCase(), isActive: true });

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

    if (numericCartAmount < discount.minPurchaseAmount) {
      return res.status(400).json({
        success: false,
        error: `Minimum purchase of $${discount.minPurchaseAmount} required for this discount.`
      });
    }
    if (numericQuantity < discount.minQuantity) {
      return res.status(400).json({
        success: false,
        error: `Minimum quantity of ${discount.minQuantity} required for this discount.`
      });
    }

    let calculatedDiscount = 0;
    if (discount.discountType === 'percentage') {
      calculatedDiscount = (numericCartAmount * discount.value) / 100;
    } else {
      calculatedDiscount = Math.min(discount.value, numericCartAmount);
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
