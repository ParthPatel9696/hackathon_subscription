const mongoose = require('mongoose');
const Discount = require('../models/Discount');
const Product = require('../models/Product');
const { toMinor, fromMinor } = require('../utils/money');
const { assertDiscountAvailable, calculateDiscountMinor } = require('../services/discountService');
const { sortFromQuery, applyNumericRange, applyDateRange } = require('../utils/listQuery');

exports.getDiscounts = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const query = {}; const search = String(req.query.search || '').trim().slice(0, 100);
    if (search) { const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); query.$or = ['code', 'name'].map((field) => ({ [field]: { $regex: escaped, $options: 'i' } })); }
    if (['Active', 'Inactive'].includes(req.query.status)) query.isActive = req.query.status === 'Active';
    applyNumericRange(query, 'value', req.query.minAmount, req.query.maxAmount);
    if (!applyDateRange(query, 'startDate', req.query.startDate, req.query.endDate)) return res.status(400).json({ success: false, error: 'Enter valid date filters.' });
    const [discounts, total] = await Promise.all([Discount.find(query).sort(sortFromQuery(req.query.sort, { record: 'name', amount: 'value', status: 'isActive', startDate: 'startDate' }, { createdAt: -1 })).skip((page - 1) * pageSize).limit(pageSize), Discount.countDocuments(query)]);
    res.json({ success: true, count: discounts.length, total, page, pageSize, data: discounts });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to load discounts.' });
  }
};

exports.createDiscount = async (req, res) => {
  try {
    const { code, name, discountType, value, minPurchaseAmount = 0, minQuantity = 0, startDate, endDate, usageLimit = 100, appliesTo = 'all', targetProduct, isActive = true } = req.body;
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!normalizedCode || !name || value === undefined) return res.status(400).json({ success: false, error: 'Code, name, and discount value are required.' });
    if (!/^[A-Z0-9_-]{2,40}$/.test(normalizedCode)) return res.status(400).json({ success: false, error: 'Use 2 to 40 letters, numbers, hyphens, or underscores for the code.' });
    if (!['percentage', 'fixed'].includes(discountType)) return res.status(400).json({ success: false, error: 'Discount type must be percentage or fixed.' });
    const numericValue = Number(value);
    const minPurchaseMinor = toMinor(minPurchaseAmount);
    const numericQuantity = Number(minQuantity);
    const numericLimit = Number(usageLimit);
    if (!Number.isFinite(numericValue) || numericValue <= 0 || (discountType === 'percentage' && numericValue > 100)) return res.status(400).json({ success: false, error: 'Discount value is invalid.' });
    if (discountType === 'fixed' && toMinor(numericValue) < 1) return res.status(400).json({ success: false, error: 'Fixed discounts must be at least one paise.' });
    if (!Number.isSafeInteger(numericQuantity) || numericQuantity < 0 || !Number.isSafeInteger(numericLimit) || numericLimit < 1) return res.status(400).json({ success: false, error: 'Minimum quantity and usage limit must be valid whole numbers.' });
    if (!['all', 'specific_product', 'seats'].includes(appliesTo)) return res.status(400).json({ success: false, error: 'Discount applicability is invalid.' });
    if (typeof isActive !== 'boolean') return res.status(400).json({ success: false, error: 'isActive must be true or false.' });
    let target = null;
    if (appliesTo === 'specific_product') {
      if (!mongoose.isValidObjectId(targetProduct)) return res.status(400).json({ success: false, error: 'Choose a valid target product.' });
      target = await Product.findById(targetProduct).select('_id');
      if (!target) return res.status(400).json({ success: false, error: 'Target product was not found.' });
    }
    const starts = startDate ? new Date(startDate) : new Date();
    const ends = endDate ? new Date(endDate) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || starts > ends) return res.status(400).json({ success: false, error: 'Discount start and end dates must be valid and ordered.' });
    const discount = await Discount.create({
      code: normalizedCode, name: String(name).trim(), discountType, value: numericValue,
      minPurchaseAmount: fromMinor(minPurchaseMinor), minQuantity: numericQuantity,
      startDate: starts, endDate: ends, usageLimit: numericLimit, appliesTo,
      targetProduct: target?._id || null, isActive: Boolean(isActive)
    });
    res.status(201).json({ success: true, data: discount });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, error: 'Discount code already exists.' });
    res.status(400).json({ success: false, error: err instanceof TypeError ? err.message : 'Unable to create discount.' });
  }
};

exports.setDiscountStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid discount id.' });
    if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ success: false, error: 'isActive must be true or false.' });
    const discount = await Discount.findByIdAndUpdate(req.params.id, { $set: { isActive: req.body.isActive } }, { new: true, runValidators: true });
    if (!discount) return res.status(404).json({ success: false, error: 'Discount not found.' });
    res.json({ success: true, data: discount });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to update discount status.' });
  }
};

exports.validateCoupon = async (req, res) => {
  try {
    const { code, cartAmount, quantity, productIds = [] } = req.body;
    const numericCartAmount = Number(cartAmount);
    const numericQuantity = Number(quantity || 0);
    if (typeof code !== 'string' || !Number.isFinite(numericCartAmount) || numericCartAmount < 0 || !Number.isSafeInteger(numericQuantity) || numericQuantity < 0) {
      return res.status(400).json({ success: false, error: 'A valid coupon code, cart amount, and quantity are required.' });
    }
    const discount = await Discount.findOne({ code: code.trim().toUpperCase() });
    assertDiscountAvailable(discount);
    const normalizedProductIds = Array.isArray(productIds) && productIds.length <= 100
      ? productIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => id.toString())
      : [];
    if (discount.appliesTo === 'specific_product') {
      if (!discount.targetProduct || !normalizedProductIds.includes(discount.targetProduct.toString())) {
        return res.status(400).json({ success: false, error: 'This discount requires its target product in the quotation.' });
      }
    }
    if (discount.appliesTo === 'seats') {
      const seatProduct = await Product.exists({ _id: { $in: normalizedProductIds }, type: 'seat' });
      if (!seatProduct) return res.status(400).json({ success: false, error: 'This discount applies to seat products only.' });
    }
    if (numericQuantity < discount.minQuantity) return res.status(400).json({ success: false, error: `Minimum quantity of ${discount.minQuantity} required for this discount.` });
    const calculatedDiscountMinor = calculateDiscountMinor(discount, toMinor(numericCartAmount));
    res.json({ success: true, data: { code: discount.code, discountType: discount.discountType, value: discount.value, calculatedDiscount: fromMinor(calculatedDiscountMinor), calculatedDiscountMinor, appliesTo: discount.appliesTo } });
  } catch (err) {
    const status = err.statusCode || (err instanceof TypeError ? 400 : 500);
    res.status(status).json({ success: false, error: status === 500 ? 'Unable to validate discount.' : err.message });
  }
};
