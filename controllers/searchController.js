const User = require('../models/User');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.search = async (req, res) => {
  try {
    const raw = String(req.query.q || '').trim().slice(0, 80);
    if (raw.length < 2) return res.json({ success: true, data: [] });
    const term = escapeRegex(raw);
    const regex = { $regex: term, $options: 'i' };
    const isInternal = ['admin', 'staff'].includes(req.user.role);
    const canViewProducts = isInternal;
    const customerId = req.user._id;
    const now = new Date();
    const eligibleProductIds = isInternal ? null : await Product.find({ isActive: { $ne: false }, billingEligible: { $ne: false } }).distinct('_id');
    const planFilter = { $or: [{ name: regex }, { code: regex }] };
    if (!isInternal) {
      planFilter.isVisible = { $ne: false };
      planFilter.isActive = { $ne: false };
      planFilter.product = { $in: eligibleProductIds };
      planFilter.$and = [
        { $or: [{ availableFrom: { $exists: false } }, { availableFrom: null }, { availableFrom: { $lte: now } }] },
        { $or: [{ availableTo: { $exists: false } }, { availableTo: null }, { availableTo: { $gte: now } }] }
      ];
    }
    const [users, products, plans, subscriptions, invoices] = await Promise.all([
      isInternal ? User.find({ role: 'customer', $or: [{ name: regex }, { email: regex }, { companyName: regex }] }).select('name email companyName').limit(5) : [],
      canViewProducts ? Product.find({ name: regex, ...(isInternal ? {} : { isActive: { $ne: false }, billingEligible: { $ne: false } }) }).select('name type salesPrice').limit(5) : [],
      Plan.find(planFilter).select('name code billingFrequency basePrice').limit(5),
      Subscription.find({ ...(isInternal ? {} : { customer: customerId }), $or: [{ subscriptionNumber: regex }, { customerName: regex }, { planName: regex }] }).select('subscriptionNumber customerName planName status').limit(5),
      Invoice.find({ ...(isInternal ? {} : { customer: customerId }), $or: [{ invoiceNumber: regex }, { customerName: regex }, { customerEmail: regex }] }).select('invoiceNumber customerName grandTotal status').limit(5)
    ]);
    const paymentMatch = { $or: [{ invoiceNumber: regex }, { method: regex }, { referenceNote: regex }] };
    const payments = isInternal
      ? await Payment.find(paymentMatch).select('invoiceNumber method referenceNote').limit(5)
      : await Payment.aggregate([
        { $match: paymentMatch },
        { $lookup: { from: Invoice.collection.name, localField: 'invoice', foreignField: '_id', as: 'invoiceRecord' } },
        { $match: { 'invoiceRecord.customer': customerId } },
        { $project: { invoiceNumber: 1, method: 1, referenceNote: 1 } },
        { $limit: 5 }
      ]);
    const results = [
      ...users.map((item) => ({ type: 'Customer', id: item._id, title: item.companyName || item.name, subtitle: item.email, href: `/app/customers/${item._id}` })),
      ...products.map((item) => ({ type: 'Product', id: item._id, title: item.name, subtitle: item.type, href: `/app/products/${item._id}` })),
      ...plans.map((item) => ({ type: 'Plan', id: item._id, title: item.name, subtitle: `${item.code} · ${item.billingFrequency}`, href: `/app/plans/${item._id}` })),
      ...subscriptions.map((item) => ({ type: item.status === 'Quotation' ? 'Quotation' : 'Subscription', id: item._id, title: item.subscriptionNumber, subtitle: `${item.customerName} · ${item.planName} · ${item.status}`, href: `/app/subscriptions/${item._id}` })),
      ...invoices.map((item) => ({ type: 'Invoice', id: item._id, title: item.invoiceNumber, subtitle: `${item.customerName} · ${item.status}`, href: `/app/invoices/${item._id}` })),
      ...payments.map((item) => ({ type: 'Payment', id: item._id, title: item.invoiceNumber, subtitle: `${item.method} · ${item.referenceNote || 'Payment record'}`, href: `/app/payments/${item._id}` }))
    ].slice(0, 20);
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Search is temporarily unavailable.' });
  }
};

exports.escapeRegex = escapeRegex;
