const Discount = require('../models/Discount');
const { toMinor } = require('../utils/money');

class DiscountError extends Error {
  constructor(message) { super(message); this.name = 'DiscountError'; this.statusCode = 400; }
}

function assertDiscountAvailable(discount, now = new Date()) {
  if (!discount || !discount.isActive) throw new DiscountError('Invalid or inactive promo code.');
  if (new Date(discount.startDate) > now || new Date(discount.endDate) < now) throw new DiscountError('Promo code is expired or not yet valid.');
  if (discount.timesUsed >= discount.usageLimit) throw new DiscountError('Promo code usage limit has been exhausted.');
}

function calculateDiscountMinor(discount, eligibleSubtotalMinor) {
  if (!Number.isSafeInteger(eligibleSubtotalMinor) || eligibleSubtotalMinor < 0) throw new DiscountError('Discount base amount is invalid.');
  const minimumMinor = toMinor(discount.minPurchaseAmount || 0);
  if (eligibleSubtotalMinor < minimumMinor) throw new DiscountError(`Minimum purchase of ₹${discount.minPurchaseAmount} required for this discount.`);
  const value = Number(discount.value);
  if (!Number.isFinite(value) || value <= 0 || (discount.discountType === 'percentage' && value > 100)) throw new DiscountError('Discount configuration is invalid.');
  if (discount.discountType === 'percentage') {
    const scale = 1_000_000;
    const percentageScaled = BigInt(Math.round(value * scale));
    if (percentageScaled === 0n) throw new DiscountError('Discount configuration is invalid.');
    const result = Number((BigInt(eligibleSubtotalMinor) * percentageScaled + BigInt(scale * 50)) / BigInt(scale * 100));
    return Math.min(eligibleSubtotalMinor, result);
  }
  if (discount.discountType === 'fixed') {
    const fixedMinor = toMinor(value);
    if (fixedMinor < 1) throw new DiscountError('Discount configuration is invalid.');
    return Math.min(eligibleSubtotalMinor, fixedMinor);
  }
  throw new DiscountError('Discount type is not supported.');
}

async function reserveDiscountUsage(discountId, now = new Date()) {
  const discount = await Discount.findOneAndUpdate({
    _id: discountId,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $expr: { $lt: ['$timesUsed', '$usageLimit'] }
  }, { $inc: { timesUsed: 1 } }, { new: true });
  if (!discount) throw new DiscountError('Promo code is no longer available. Remove it or use another code.');
  return discount;
}

async function releaseDiscountUsage(discountId) {
  await Discount.updateOne({ _id: discountId, timesUsed: { $gt: 0 } }, { $inc: { timesUsed: -1 } });
}

module.exports = { DiscountError, assertDiscountAvailable, calculateDiscountMinor, reserveDiscountUsage, releaseDiscountUsage };
