const mongoose = require('mongoose');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const { toMinor, fromMinor } = require('../utils/money');
const { sortFromQuery, applyDateRange } = require('../utils/listQuery');
const { recordAudit } = require('../services/auditService');

const strongPassword = (value) => typeof value === 'string' && value.length > 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[!@#$%^&*(),.?":{}|<>]/.test(value);
const emailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const publicFields = 'name email alternateEmail companyName customerType phone alternatePhone website taxId billingContactName billingContactEmail billingContactPhone billingAddress billingAddressLine2 billingCity billingState billingPostalCode billingCountry shippingAddress preferredPaymentMethod paymentTerms assignedStaff tags role accountStatus createdAt';

async function hasOpenObligations(customerId) {
  const [activeSubscription, openInvoice] = await Promise.all([
    Subscription.exists({ customer: customerId, status: { $in: ['Confirmed', 'Active', 'Paused'] } }),
    Invoice.exists({ customer: customerId, status: { $in: ['Confirmed', 'Overdue'] }, $expr: { $lt: ['$paidAmount', '$grandTotal'] } })
  ]);
  return Boolean(activeSubscription || openInvoice);
}

async function syncCurrentSubscriptionIdentity(customer) {
  await Subscription.updateMany({ customer: customer._id }, {
    $set: { customerName: customer.companyName || customer.name, customerEmail: customer.email }
  });
  // Invoice customer fields are historical billing snapshots and deliberately stay unchanged.
}

async function customerPortfolio(customer) {
  const [subscriptions, invoices] = await Promise.all([
    Subscription.find({ customer: customer._id }).sort({ createdAt: -1 }),
    Invoice.find({ customer: customer._id }).sort({ invoiceDate: -1 })
  ]);
  const payments = await Payment.find({ invoice: { $in: invoices.map((invoice) => invoice._id) }, $or: [{ status: 'posted' }, { status: { $exists: false } }] }).sort({ paymentDate: -1 });
  const billableInvoices = invoices.filter((invoice) => !['Draft', 'Cancelled'].includes(invoice.status));
  const invoicedMinor = billableInvoices.reduce((sum, invoice) => sum + (invoice.grandTotalMinor ?? toMinor(invoice.grandTotal)), 0);
  const outstandingMinor = billableInvoices.reduce((sum, invoice) => sum + Math.max(0, (invoice.grandTotalMinor ?? toMinor(invoice.grandTotal)) - (invoice.paidAmountMinor ?? toMinor(invoice.paidAmount || 0))), 0);
  const activeSubscriptions = subscriptions.filter((item) => item.status === 'Active');
  const activeRecurringMinor = activeSubscriptions.reduce((sum, item) => sum + (item.recurringTotalMinor ?? toMinor(item.recurringTotal || 0)), 0);
  return {
    customer,
    summary: {
      subscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter((item) => item.status === 'Active').length,
      activeRecurring: fromMinor(activeRecurringMinor),
      lifetimeRevenue: fromMinor(payments.reduce((sum, payment) => sum + (payment.amountMinor ?? toMinor(payment.amount)), 0)),
      invoiced: fromMinor(invoicedMinor),
      paid: fromMinor(payments.reduce((sum, payment) => sum + (payment.amountMinor ?? toMinor(payment.amount)), 0)),
      outstanding: fromMinor(outstandingMinor)
    },
    subscriptions,
    invoices,
    payments
  };
}

exports.listCustomers = async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const safePage = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const query = { role: 'customer' };
    if (['Active', 'Archived'].includes(req.query.status)) query.accountStatus = req.query.status;
    else if (!req.query.status) query.accountStatus = 'Active';
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = ['name', 'email', 'companyName', 'phone'].map((field) => ({ [field]: { $regex: escaped, $options: 'i' } }));
    }
    if (!applyDateRange(query, 'createdAt', req.query.startDate, req.query.endDate)) return res.status(400).json({ success: false, error: 'Enter valid date filters.' });
    const [customers, total] = await Promise.all([
      User.find(query).select(publicFields).populate('assignedStaff', 'name email').sort(sortFromQuery(req.query.sort, { record: 'name', status: 'accountStatus', details: 'companyName', createdAt: 'createdAt' }, { createdAt: -1 })).skip((safePage - 1) * safeLimit).limit(safeLimit),
      User.countDocuments(query)
    ]);
    const ids = customers.map((customer) => customer._id);
    const [subscriptionTotals, invoiceTotals, lastPayments] = await Promise.all([
      Subscription.aggregate([{ $match: { customer: { $in: ids } } }, { $group: { _id: '$customer', active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } }, recurringMinor: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, { $ifNull: ['$recurringTotalMinor', { $multiply: [{ $ifNull: ['$recurringTotal', 0] }, 100] }] }, 0] } } } }]),
      Invoice.aggregate([{ $match: { customer: { $in: ids }, status: { $nin: ['Draft', 'Cancelled'] } } }, { $group: { _id: '$customer', invoicedMinor: { $sum: { $ifNull: ['$grandTotalMinor', { $multiply: [{ $ifNull: ['$grandTotal', 0] }, 100] }] } }, paidMinor: { $sum: { $ifNull: ['$paidAmountMinor', { $multiply: [{ $ifNull: ['$paidAmount', 0] }, 100] }] } }, outstandingMinor: { $sum: { $max: [0, { $subtract: [{ $ifNull: ['$grandTotalMinor', { $multiply: [{ $ifNull: ['$grandTotal', 0] }, 100] }] }, { $ifNull: ['$paidAmountMinor', { $multiply: [{ $ifNull: ['$paidAmount', 0] }, 100] }] }] }] } } } }]),
      Payment.aggregate([{ $match: { $or: [{ status: 'posted' }, { status: { $exists: false } }] } }, { $lookup: { from: Invoice.collection.name, localField: 'invoice', foreignField: '_id', as: 'parent' } }, { $unwind: '$parent' }, { $match: { 'parent.customer': { $in: ids } } }, { $group: { _id: '$parent.customer', lastPaymentDate: { $max: '$paymentDate' } } }])
    ]);
    const subscriptionsById = new Map(subscriptionTotals.map((item) => [String(item._id), item])); const invoicesById = new Map(invoiceTotals.map((item) => [String(item._id), item])); const paymentsById = new Map(lastPayments.map((item) => [String(item._id), item]));
    const data = customers.map((customer) => { const sub = subscriptionsById.get(String(customer._id)) || {}; const inv = invoicesById.get(String(customer._id)) || {}; return { ...customer.toObject(), activeSubscriptionCount: sub.active || 0, activeRecurring: fromMinor(sub.recurringMinor || 0), totalInvoiced: fromMinor(inv.invoicedMinor || 0), totalPaid: fromMinor(inv.paidMinor || 0), outstanding: fromMinor(inv.outstandingMinor || 0), lastPaymentDate: paymentsById.get(String(customer._id))?.lastPaymentDate || null }; });
    res.json({ success: true, count: data.length, total, page: safePage, pageSize: safeLimit, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to load customers.' });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!name || !email || !req.body.password) return res.status(400).json({ success: false, error: 'Name, email, and an initial password are required.' });
    if (!emailValid(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    if (req.body.billingContactEmail && !emailValid(String(req.body.billingContactEmail).trim())) return res.status(400).json({ success: false, error: 'Enter a valid billing contact email.' });
    if (req.body.alternateEmail && !emailValid(String(req.body.alternateEmail).trim())) return res.status(400).json({ success: false, error: 'Enter a valid alternate email address.' });
    if (req.body.assignedStaff && !await User.exists({ _id: req.body.assignedStaff, role: 'staff', accountStatus: { $ne: 'Archived' } })) return res.status(400).json({ success: false, error: 'Choose an active staff member.' });
    if (!strongPassword(req.body.password)) return res.status(400).json({ success: false, error: 'Password must be more than 8 characters, with an uppercase letter, a lowercase letter and a special character.' });
    const customer = await User.create({
      name, email, password: req.body.password, role: 'customer',
      companyName: String(req.body.companyName || '').trim(),
      phone: String(req.body.phone || '').trim(),
      ...Object.fromEntries(['alternateEmail','alternatePhone','website','taxId','billingContactName','billingContactEmail','billingContactPhone','billingAddress','billingAddressLine2','billingCity','billingState','billingPostalCode','billingCountry','shippingAddress','preferredPaymentMethod','paymentTerms','customerType','assignedStaff','tags'].filter((key) => req.body[key] !== undefined).map((key) => [key, typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key]])),
      billingAddress: String(req.body.billingAddress || '').trim()
    });
    recordAudit({ actor: req.user, action: 'customer_created', resourceType: 'Customer', resourceId: customer._id, customer: customer._id, newValue: { name: customer.name, email: customer.email } }).catch(() => {});
    res.status(201).json({ success: true, data: await User.findById(customer._id).select(publicFields) });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 400).json({ success: false, error: err.code === 11000 ? 'An account already uses that email address.' : err.message || 'Unable to create customer.' });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid customer id.' });
    const customer = await User.findOne({ _id: req.params.id, role: 'customer' });
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found.' });
    const fields = ['name', 'companyName', 'phone', 'alternatePhone', 'website', 'taxId', 'billingContactName', 'billingContactPhone', 'billingAddress', 'billingAddressLine2', 'billingCity', 'billingState', 'billingPostalCode', 'billingCountry', 'shippingAddress', 'preferredPaymentMethod', 'paymentTerms', 'customerType'];
    for (const key of fields) {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] !== 'string' || (key === 'name' && !req.body[key].trim())) return res.status(400).json({ success: false, error: `${key} must be a non-empty text value.` });
        customer[key] = req.body[key].trim();
      }
    }
    if (req.body.email !== undefined) {
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!emailValid(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
      customer.email = email;
    }
    for (const key of ['billingContactEmail', 'alternateEmail']) if (req.body[key] !== undefined) {
      const email = typeof req.body[key] === 'string' ? req.body[key].trim().toLowerCase() : '';
      if (email && !emailValid(email)) return res.status(400).json({ success: false, error: `Enter a valid ${key === 'alternateEmail' ? 'alternate' : 'billing contact'} email address.` });
      customer[key] = email;
    }
    if (req.body.assignedStaff !== undefined) {
      if (req.body.assignedStaff && !await User.exists({ _id: req.body.assignedStaff, role: 'staff', accountStatus: { $ne: 'Archived' } })) return res.status(400).json({ success: false, error: 'Choose an active staff member.' });
      customer.assignedStaff = req.body.assignedStaff || null;
    }
    if (req.body.accountStatus !== undefined) {
      if (!['Active', 'Archived'].includes(req.body.accountStatus)) return res.status(400).json({ success: false, error: 'Account status must be Active or Archived.' });
      if (req.body.accountStatus === 'Archived' && customer.accountStatus !== 'Archived' && await hasOpenObligations(customer._id)) {
        return res.status(409).json({ success: false, error: 'This account has an active subscription or unpaid invoice. Resolve those records before archiving it.' });
      }
      customer.accountStatus = req.body.accountStatus;
    }
    await customer.save();
    await syncCurrentSubscriptionIdentity(customer);
    recordAudit({ actor: req.user, action: 'customer_updated', resourceType: 'Customer', resourceId: customer._id, customer: customer._id, newValue: { name: customer.name, companyName: customer.companyName, accountStatus: customer.accountStatus } }).catch(() => {});
    res.json({ success: true, data: await User.findById(customer._id).select(publicFields) });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 400).json({ success: false, error: err.code === 11000 ? 'An account already uses that email address.' : err.message || 'Unable to update customer.' });
  }
};

exports.archiveCustomer = async (req, res) => {
  req.body.accountStatus = 'Archived';
  return exports.updateCustomer(req, res);
};

exports.getCustomer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid customer id.' });
    const customer = await User.findOne({ _id: req.params.id, role: 'customer' }).select(publicFields);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found.' });
    res.json({ success: true, data: await customerPortfolio(customer) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to load customer details.' });
  }
};

exports.getMyCustomer = async (req, res) => {
  const customer = await User.findOne({ _id: req.user._id, role: 'customer' }).select(publicFields);
  if (!customer) return res.status(404).json({ success: false, error: 'Customer account not found.' });
  res.json({ success: true, data: await customerPortfolio(customer) });
};

exports.updateMyProfile = async (req, res) => {
  try {
    const customer = await User.findOne({ _id: req.user._id, role: 'customer' });
    if (!customer) return res.status(404).json({ success: false, error: 'Customer account not found.' });
    const allowedProfileFields = ['name', 'companyName', 'phone', 'alternatePhone', 'website', 'taxId', 'billingContactName', 'billingContactPhone', 'billingAddress', 'billingAddressLine2', 'billingCity', 'billingState', 'billingPostalCode', 'billingCountry', 'shippingAddress', 'preferredPaymentMethod'];
    for (const key of allowedProfileFields) {
      if (req.body[key] === undefined) continue;
      if (typeof req.body[key] !== 'string' || (key === 'name' && !req.body[key].trim())) return res.status(400).json({ success: false, error: `${key} must be a non-empty text value.` });
      customer[key] = req.body[key].trim();
    }
    if (req.body.billingContactEmail !== undefined) {
      const email = typeof req.body.billingContactEmail === 'string' ? req.body.billingContactEmail.trim().toLowerCase() : '';
      if (email && !emailValid(email)) return res.status(400).json({ success: false, error: 'Enter a valid billing contact email.' });
      customer.billingContactEmail = email;
    }
    await customer.save();
    await syncCurrentSubscriptionIdentity(customer);
    const data = { id: customer._id, name: customer.name, email: customer.email, companyName: customer.companyName, phone: customer.phone, alternatePhone: customer.alternatePhone, website: customer.website, taxId: customer.taxId, billingContactName: customer.billingContactName, billingContactEmail: customer.billingContactEmail, billingContactPhone: customer.billingContactPhone, billingAddress: customer.billingAddress, billingAddressLine2: customer.billingAddressLine2, billingCity: customer.billingCity, billingState: customer.billingState, billingPostalCode: customer.billingPostalCode, billingCountry: customer.billingCountry, shippingAddress: customer.shippingAddress, preferredPaymentMethod: customer.preferredPaymentMethod, role: customer.role };
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message || 'Unable to update profile.' });
  }
};

exports.archiveMyAccount = async (req, res) => {
  try {
    if (await hasOpenObligations(req.user._id)) {
      return res.status(409).json({ success: false, error: 'Your account has an active subscription or unpaid invoice. Resolve those records before closing it.' });
    }
    await User.updateOne({ _id: req.user._id, role: 'customer' }, { $set: { accountStatus: 'Archived' } });
    res.json({ success: true, message: 'Your account is closed. Your billing history remains retained for account records.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to close your account.' });
  }
};
