const mongoose = require('mongoose');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const { toMinor, fromMinor } = require('../utils/money');
const { sortFromQuery, applyDateRange } = require('../utils/listQuery');

const strongPassword = (value) => typeof value === 'string' && value.length > 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[!@#$%^&*(),.?":{}|<>]/.test(value);
const emailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const publicFields = 'name email companyName phone billingAddress tags role accountStatus createdAt';

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
  const billableInvoices = invoices.filter((invoice) => invoice.status !== 'Cancelled');
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
      User.find(query).select(publicFields).sort(sortFromQuery(req.query.sort, { record: 'name', status: 'accountStatus', details: 'companyName', createdAt: 'createdAt' }, { createdAt: -1 })).skip((safePage - 1) * safeLimit).limit(safeLimit),
      User.countDocuments(query)
    ]);
    res.json({ success: true, count: customers.length, total, page: safePage, pageSize: safeLimit, data: customers });
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
    if (!strongPassword(req.body.password)) return res.status(400).json({ success: false, error: 'Password must be more than 8 characters, with an uppercase letter, a lowercase letter and a special character.' });
    const customer = await User.create({
      name, email, password: req.body.password, role: 'customer',
      companyName: String(req.body.companyName || '').trim(),
      phone: String(req.body.phone || '').trim(),
      billingAddress: String(req.body.billingAddress || '').trim()
    });
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
    const fields = ['name', 'companyName', 'phone', 'billingAddress'];
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
    if (req.body.accountStatus !== undefined) {
      if (!['Active', 'Archived'].includes(req.body.accountStatus)) return res.status(400).json({ success: false, error: 'Account status must be Active or Archived.' });
      if (req.body.accountStatus === 'Archived' && customer.accountStatus !== 'Archived' && await hasOpenObligations(customer._id)) {
        return res.status(409).json({ success: false, error: 'This account has an active subscription or unpaid invoice. Resolve those records before archiving it.' });
      }
      customer.accountStatus = req.body.accountStatus;
    }
    await customer.save();
    await syncCurrentSubscriptionIdentity(customer);
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
    for (const key of ['name', 'companyName', 'phone', 'billingAddress']) {
      if (req.body[key] === undefined) continue;
      if (typeof req.body[key] !== 'string' || (key === 'name' && !req.body[key].trim())) return res.status(400).json({ success: false, error: `${key} must be a non-empty text value.` });
      customer[key] = req.body[key].trim();
    }
    await customer.save();
    await syncCurrentSubscriptionIdentity(customer);
    const data = { id: customer._id, name: customer.name, email: customer.email, companyName: customer.companyName, phone: customer.phone, billingAddress: customer.billingAddress, role: customer.role };
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
