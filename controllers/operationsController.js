const mongoose = require('mongoose');
const CustomerNote = require('../models/CustomerNote');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const AuditEvent = require('../models/AuditEvent');
const { toMinor, fromMinor, normalizeMonthlyMinor } = require('../utils/money');
const { applyDateRange } = require('../utils/listQuery');

const pageArgs = (query) => ({
  page: Math.max(1, Number.parseInt(query.page, 10) || 1),
  limit: Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25))
});
const inRange = (value, start, end) => value && (!start || value >= start) && (!end || value <= end);
const invoiceTotal = (x) => x.grandTotalMinor ?? toMinor(x.grandTotal || 0);
const invoicePaid = (x) => x.paidAmountMinor ?? toMinor(x.paidAmount || 0);
const recurring = (x) => x.recurringTotalMinor ?? toMinor(x.recurringTotal || 0);

exports.listNotes = async (req, res) => {
  const notes = await CustomerNote.find({ customer: req.params.id }).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, data: notes });
};
exports.createNote = async (req, res) => {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 5000) return res.status(400).json({ success: false, error: 'A note of 1 to 5000 characters is required.' });
  const note = await CustomerNote.create({ customer: req.params.id, body, author: req.user._id, authorName: req.user.name });
  res.status(201).json({ success: true, data: note });
};
exports.updateNote = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.noteId)) return res.status(400).json({ success: false, error: 'Invalid note id.' });
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 5000) return res.status(400).json({ success: false, error: 'A note of 1 to 5000 characters is required.' });
  const note = await CustomerNote.findOneAndUpdate({ _id: req.params.noteId, customer: req.params.id }, { $set: { body, editedAt: new Date() } }, { new: true, runValidators: true });
  if (!note) return res.status(404).json({ success: false, error: 'Note not found.' });
  res.json({ success: true, data: note });
};
exports.deleteNote = async (req, res) => {
  const result = await CustomerNote.deleteOne({ _id: req.params.noteId, customer: req.params.id });
  if (!result.deletedCount) return res.status(404).json({ success: false, error: 'Note not found.' });
  res.json({ success: true });
};
exports.updateTags = async (req, res) => {
  const tags = Array.isArray(req.body.tags) ? [...new Set(req.body.tags.map((x) => String(x).trim()).filter(Boolean))].slice(0, 20) : null;
  if (!tags || tags.some((tag) => tag.length > 40)) return res.status(400).json({ success: false, error: 'Tags must be an array of up to 20 labels, each 40 characters or fewer.' });
  const customer = await User.findOneAndUpdate({ _id: req.params.id, role: 'customer' }, { $set: { tags } }, { new: true }).select('name email companyName tags');
  if (!customer) return res.status(404).json({ success: false, error: 'Customer not found.' });
  res.json({ success: true, data: customer });
};
exports.activity = async (req, res) => {
  try {
    const customer = req.params.id;
    const [customerRecord, subscriptions, invoices, payments, notes] = await Promise.all([
      User.findOne({ _id: customer, role: 'customer' }).select('name createdAt').lean(),
      Subscription.find({ customer }).select('subscriptionNumber planName status createdAt planChangeHistory').lean(),
      Invoice.find({ customer }).select('invoiceNumber grandTotal status invoiceDate createdAt').lean(),
      Payment.aggregate([{ $match: { $or: [{ status: 'posted' }, { status: { $exists: false } }] } }, { $lookup: { from: Invoice.collection.name, localField: 'invoice', foreignField: '_id', as: 'parent' } }, { $unwind: '$parent' }, { $match: { 'parent.customer': new mongoose.Types.ObjectId(customer) } }, { $project: { invoiceNumber: 1, amount: 1, method: 1, paymentDate: 1, createdAt: 1 } }]),
      CustomerNote.find({ customer }).select('body authorName createdAt updatedAt').lean()
    ]);
    const events = [
      ...(customerRecord ? [{ id: `customer:${customerRecord._id}`, type: 'customer', title: 'Customer account created', detail: customerRecord.name, at: customerRecord.createdAt }] : []),
      ...subscriptions.map((x) => ({ id: `subscription:${x._id}`, type: 'subscription', title: `Subscription ${x.subscriptionNumber} created`, detail: `${x.planName} · ${x.status}`, at: x.createdAt })),
      ...subscriptions.flatMap((x) => (x.planChangeHistory || []).map((change) => ({ id: `plan_change:${x._id}:${change.operationKey}`, type: 'plan_change', title: `Plan changed · ${x.subscriptionNumber}`, detail: `${change.previousPlan} → ${change.newPlan}; ${change.reason || 'No reason recorded'}`, at: change.createdAt || change.effectiveAt }))),
      ...invoices.map((x) => ({ id: `invoice:${x._id}`, type: 'invoice', title: `Invoice ${x.invoiceNumber}`, detail: `${x.status} · ${x.grandTotal}`, at: x.invoiceDate || x.createdAt })),
      ...payments.map((x) => ({ id: `payment:${x._id}`, type: 'payment', title: `Payment for ${x.invoiceNumber}`, detail: `${x.method} · ${x.amount}`, at: x.paymentDate || x.createdAt })),
      ...notes.map((x) => ({ id: `note:${x._id}`, type: 'note', title: 'Internal note added', detail: `${x.authorName}: ${x.body}`, at: x.createdAt }))
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 200);
    res.json({ success: true, data: events });
  } catch (error) { res.status(500).json({ success: false, error: 'Unable to load customer activity.' }); }
};

exports.auditLog = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const filter = {};
    if (req.query.resourceType) filter.resourceType = String(req.query.resourceType).slice(0, 80);
    if (req.query.action) filter.action = String(req.query.action).slice(0, 100);
    if (req.query.startDate || req.query.endDate) {
      if (!applyDateRange(filter, 'createdAt', req.query.startDate, req.query.endDate)) return res.status(400).json({ success: false, error: 'Enter valid date filters.' });
    }
    const [data, total] = await Promise.all([AuditEvent.find(filter).populate('actor', 'name email role').populate('customer', 'name companyName').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), AuditEvent.countDocuments(filter)]);
    res.json({ success: true, data, total, page, pageSize: limit });
  } catch (error) { res.status(500).json({ success: false, error: 'Unable to load the activity log.' }); }
};

exports.calendar = async (req, res) => {
  try {
    const { page, limit } = pageArgs(req.query);
    const start = req.query.start ? new Date(req.query.start) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = req.query.end ? new Date(req.query.end) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) return res.status(400).json({ success: false, error: 'Provide a valid start and end date range.' });
    const [subs, scheduled, invoices] = await Promise.all([
      Subscription.find({ status: 'Active', nextBillingDate: { $gte: start, $lt: end } }).select('subscriptionNumber customer customerName planName lines recurringTotal recurringTotalMinor billingFrequency nextBillingDate status scheduledPlanChange').lean(),
      Subscription.find({ 'scheduledPlanChange.effectiveAt': { $gte: start, $lt: end } }).select('subscriptionNumber customer customerName lines scheduledPlanChange').lean(),
      Invoice.find({ status: { $in: ['Confirmed', 'Overdue'] }, dueDate: { $gte: start, $lt: end } }).select('invoiceNumber subscription subscriptionNumber customer customerName lines grandTotal grandTotalMinor paidAmount paidAmountMinor dueDate status').lean()
    ]);
    let events = [
      ...subs.map((s) => ({ id: `renewal:${s._id}`, type: 'renewal', title: `Renewal · ${s.subscriptionNumber}`, date: s.nextBillingDate, customerId: s.customer, customer: s.customerName, subscriptionId: s._id, subscription: s.subscriptionNumber, product: (s.lines || []).map((line) => line.productName).join(', '), plan: s.scheduledPlanChange && new Date(s.scheduledPlanChange.effectiveAt) <= new Date(s.nextBillingDate) ? s.scheduledPlanChange.planName : s.planName, amountMinor: s.scheduledPlanChange && new Date(s.scheduledPlanChange.effectiveAt) <= new Date(s.nextBillingDate) ? s.scheduledPlanChange.recurringTotalMinor : recurring(s), status: s.status })),
      ...scheduled.map((s) => ({ id: `plan_change:${s._id}:${s.scheduledPlanChange.operationKey}`, type: 'plan_change', title: `Scheduled plan change · ${s.subscriptionNumber}`, date: s.scheduledPlanChange.effectiveAt, customerId: s.customer, customer: s.customerName, subscriptionId: s._id, subscription: s.subscriptionNumber, product: (s.lines || []).map((line) => line.productName).join(', '), plan: s.scheduledPlanChange.planName, amountMinor: s.scheduledPlanChange.recurringTotalMinor, status: 'Scheduled' })),
      ...invoices.map((i) => ({ id: `invoice:${i._id}`, type: i.status === 'Overdue' || i.dueDate < new Date() ? 'overdue' : 'invoice_due', title: `${i.status === 'Overdue' || i.dueDate < new Date() ? 'Overdue' : 'Due'} · ${i.invoiceNumber}`, date: i.dueDate, customerId: i.customer, customer: i.customerName, subscriptionId: i.subscription, subscription: i.subscriptionNumber, invoiceId: i._id, invoice: i.invoiceNumber, product: (i.lines || []).map((line) => line.productName).join(', '), amountMinor: Math.max(0, invoiceTotal(i) - invoicePaid(i)), status: i.status }))
    ];
    if (req.query.type) events = events.filter((e) => e.type === req.query.type);
    if (req.query.search) events = events.filter((e) => `${e.customer} ${e.title} ${e.plan || ''} ${e.product || ''}`.toLowerCase().includes(String(req.query.search).toLowerCase()));
    if (req.query.status) events = events.filter((e) => e.status === req.query.status);
    if (req.query.customer) events = events.filter((e) => String(e.customerId) === String(req.query.customer));
    if (req.query.plan) { const term = String(req.query.plan).trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); events = events.filter((e) => new RegExp(term, 'i').test(e.plan || '')); }
    if (req.query.product) { const term = String(req.query.product).trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); events = events.filter((e) => new RegExp(term, 'i').test(e.product || '')); }
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    const total = events.length;
    const expected = events.filter((e) => e.type === 'renewal').reduce((sum, e) => sum + e.amountMinor, 0);
    const dueSoon = events.filter((e) => e.type === 'invoice_due').length;
    const overdue = events.filter((e) => e.type === 'overdue').length;
    res.json({ success: true, summary: { events: total, expectedRecurringMinor: expected, dueSoon, overdue, renewals: events.filter((e) => e.type === 'renewal').length }, page, pageSize: limit, total, data: events.slice((page - 1) * limit, page * limit).map((e) => ({ ...e, amount: fromMinor(e.amountMinor) })) });
  } catch (error) { res.status(500).json({ success: false, error: 'Unable to load billing calendar.' }); }
};

exports.health = async (req, res) => {
  try {
    const { page, limit } = pageArgs(req.query);
    const match = {};
    if (req.query.status && req.query.status !== 'ALL') match.status = req.query.status;
    const all = await Subscription.find(match).select('subscriptionNumber customer customerName planName recurringTotal recurringTotalMinor status nextBillingDate createdAt scheduledPlanChange').sort({ nextBillingDate: 1 }).lean();
    const allInvoices = all.length ? await Invoice.find({ subscription: { $in: all.map((x) => x._id) }, status: { $in: ['Confirmed', 'Overdue'] } }).select('subscription invoiceNumber grandTotal grandTotalMinor paidAmount paidAmountMinor dueDate status').lean() : [];
    const invoicesBySubscription = new Map();
    for (const invoice of allInvoices) invoicesBySubscription.set(String(invoice.subscription), [...(invoicesBySubscription.get(String(invoice.subscription)) || []), invoice]);
    const counts = { Healthy: 0, 'Attention Required': 0, 'At Risk': 0, Inactive: 0 };
    const indicators = { upcomingRenewals: 0, overdueSubscriptions: 0, pendingActivations: 0, scheduledPlanChanges: 0 };
    const list = [];
    const today = new Date(); const soon = new Date(Date.now() + 14 * 86400000);
    for (const s of all) {
      const invoices = invoicesBySubscription.get(String(s._id)) || [];
      const open = invoices.filter((i) => invoiceTotal(i) > invoicePaid(i));
      const outstandingMinor = open.reduce((sum, i) => sum + invoiceTotal(i) - invoicePaid(i), 0);
      let health = 'Healthy'; const reasons = [];
      if (['Paused', 'Closed', 'Cancelled'].includes(s.status)) { health = 'Inactive'; reasons.push(`Subscription is ${s.status.toLowerCase()}.`); }
      else if (open.some((i) => i.status === 'Overdue' || i.dueDate < today)) { health = 'At Risk'; reasons.push('One or more invoices are overdue.'); }
      else if (open.length) { health = 'Attention Required'; reasons.push('An invoice balance remains open.'); }
      if (s.status === 'Active' && s.nextBillingDate && s.nextBillingDate >= today && s.nextBillingDate <= soon && health === 'Healthy') { health = 'Attention Required'; reasons.push('Renewal is due within 14 days.'); }
      if (s.scheduledPlanChange && health === 'Healthy') { health = 'Attention Required'; reasons.push(`Plan change to ${s.scheduledPlanChange.planName} is scheduled.`); }
      if (s.status === 'Active' && s.nextBillingDate && s.nextBillingDate >= today && s.nextBillingDate <= soon) indicators.upcomingRenewals++;
      if (health === 'At Risk') indicators.overdueSubscriptions++;
      if (s.status === 'Confirmed') indicators.pendingActivations++;
      if (s.scheduledPlanChange) indicators.scheduledPlanChanges++;
      counts[health]++;
      list.push({ ...s, health, reasons, outstandingMinor, outstanding: fromMinor(outstandingMinor), invoiceCount: invoices.length, relatedInvoices: invoices.filter((i) => invoiceTotal(i) > invoicePaid(i)).map((i) => ({ _id: i._id, invoiceNumber: i.invoiceNumber, dueDate: i.dueDate, status: i.status, amount: fromMinor(invoiceTotal(i) - invoicePaid(i)) })) });
    }
    let filtered = list;
    if (req.query.health && req.query.health !== 'ALL') filtered = filtered.filter((item) => item.health === req.query.health);
    if (req.query.search) { const term = String(req.query.search).toLowerCase().slice(0, 80); filtered = filtered.filter((item) => `${item.subscriptionNumber} ${item.customerName} ${item.planName} ${item.reasons.join(' ')}`.toLowerCase().includes(term)); }
    const total = filtered.length;
    const selected = filtered.slice((page - 1) * limit, page * limit);
    const invoiceIds = allInvoices.filter((item) => selected.some((sub) => String(sub._id) === String(item.subscription))).map((item) => item._id);
    const latestPayments = invoiceIds.length ? await Payment.find({ invoice: { $in: invoiceIds }, $or: [{ status: 'posted' }, { status: { $exists: false } }] }).sort({ paymentDate: -1 }).select('invoice paymentDate').lean() : [];
    const paymentDateByInvoice = new Map(); for (const payment of latestPayments) if (!paymentDateByInvoice.has(String(payment.invoice))) paymentDateByInvoice.set(String(payment.invoice), payment.paymentDate);
    for (const item of selected) { const related = allInvoices.filter((invoice) => String(invoice.subscription) === String(item._id)); item.lastPaymentDate = related.map((invoice) => paymentDateByInvoice.get(String(invoice._id))).filter(Boolean).sort((a, b) => b - a)[0] || null; }
    res.json({ success: true, summary: counts, indicators, page, pageSize: limit, total, data: selected });
  } catch (error) { res.status(500).json({ success: false, error: 'Unable to load subscription health.' }); }
};

exports.revenue = async (req, res) => {
  if (!['admin', 'staff'].includes(req.user.role)) return res.status(403).json({ success: false, error: 'Access denied.' });
  try {
    const [subscriptions, invoices, payments] = await Promise.all([
      Subscription.find().select('customer customerName planName lines recurringTotal recurringTotalMinor subtotal subtotalMinor taxTotal taxTotalMinor discountTotal discountTotalMinor billingFrequency status createdAt nextBillingDate scheduledPlanChange statusHistory').lean(),
      Invoice.find({ status: { $nin: ['Draft', 'Cancelled'] } }).select('grandTotal grandTotalMinor paidAmount paidAmountMinor invoiceDate customer customerName planName status').lean(),
      Payment.find({ status: { $ne: 'pending' } }).select('amount amountMinor paymentDate invoiceNumber invoice').populate('invoice', 'customer customerName').lean()
    ]);
    const netRecurring = (s) => Math.max(0, (s.subtotalMinor ?? (s.subtotal !== undefined ? toMinor(s.subtotal) : (s.recurringTotalMinor ?? toMinor(s.recurringTotal || 0)) - (s.taxTotalMinor ?? toMinor(s.taxTotal || 0)))) - (s.discountTotalMinor ?? toMinor(s.discountTotal || 0)));
    const monthly = (minor, frequency) => normalizeMonthlyMinor({ billingFrequency: frequency, subtotalMinor: minor });
    const active = subscriptions.filter((s) => s.status === 'Active');
    const mrrMinor = active.reduce((sum, s) => sum + monthly(netRecurring(s), s.billingFrequency), 0);
    const collectedMinor = payments.reduce((sum, p) => sum + (p.amountMinor ?? toMinor(p.amount || 0)), 0);
    const rangeDays = Math.min(365, Math.max(7, Number(req.query.days) || 30));
    const businessDate = (value, endOfDay = false) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
      const [year, month, day] = value.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day + (endOfDay ? 1 : 0)) - 330 * 60000 - (endOfDay ? 1 : 0));
    };
    const customStart = req.query.startDate ? businessDate(req.query.startDate) : null;
    const customEnd = req.query.endDate ? businessDate(req.query.endDate, true) : null;
    if (req.query.startDate && !customStart || req.query.endDate && !customEnd || Boolean(customStart) !== Boolean(customEnd) || customStart && (customStart >= customEnd || customEnd - customStart > 366 * 86400000)) return res.status(400).json({ success: false, error: 'Provide a valid custom date range of no more than 366 days.' });
    const since = customStart || new Date(Date.now() - rangeDays * 86400000);
    const byDay = new Map();
    const dateKey = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
    for (const payment of payments) if (payment.paymentDate >= since) { const key = dateKey(payment.paymentDate); byDay.set(key, (byDay.get(key) || 0) + (payment.amountMinor ?? toMinor(payment.amount || 0))); }
    const customers = new Map();
    for (const s of active) { const key = String(s.customer); const cur = customers.get(key) || { customer: key, name: s.customerName, mrrMinor: 0 }; cur.mrrMinor += monthly(netRecurring(s), s.billingFrequency); customers.set(key, cur); }
    const topCustomers = [...customers.values()].sort((a, b) => b.mrrMinor - a.mrrMinor).slice(0, 10).map((c) => ({ ...c, mrr: fromMinor(c.mrrMinor) }));
    const revenueByProduct = {};
    const revenueByPlan = {};
    const byInterval = {};
    for (const s of active) { const amount = monthly(netRecurring(s), s.billingFrequency); revenueByPlan[s.planName || 'Unassigned'] = (revenueByPlan[s.planName || 'Unassigned'] || 0) + amount; byInterval[s.billingFrequency] = (byInterval[s.billingFrequency] || 0) + amount; for (const line of s.lines || []) revenueByProduct[line.productName || 'Unassigned'] = (revenueByProduct[line.productName || 'Unassigned'] || 0) + monthly(Math.max(0, (line.unitPriceMinor ?? toMinor(line.unitPrice || 0)) * Number(line.quantity || 1) + (line.variantPriceExtraMinor ?? toMinor(line.variantPriceExtra || 0)) * Number(line.quantity || 1) - (line.discountMinor ?? toMinor(line.discountAmount || 0))), s.billingFrequency); }
    const trends = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, minor]) => ({ date, collectedMinor: minor, collected: fromMinor(minor) }));
    const historyComplete = subscriptions.every((s) => s.createdAt >= since || (s.statusHistory || []).some((event) => new Date(event.effectiveAt) <= since));
    const events = subscriptions.flatMap((s) => (s.statusHistory || []).map((event) => ({ ...event, subscription: s, effectiveAt: new Date(event.effectiveAt) }))).filter((event) => event.effectiveAt >= since && event.effectiveAt <= new Date()).sort((a, b) => a.effectiveAt - b.effectiveAt);
    const subscriptionMovement = new Map();
    for (const event of events) {
      const key = dateKey(event.effectiveAt); const movement = subscriptionMovement.get(key) || { date: key, newSubscriptions: 0, cancelledSubscriptions: 0 };
      if (event.eventType === 'status_change' && event.status === 'Active' && event.previousStatus !== 'Active') movement.newSubscriptions += 1;
      if (event.eventType === 'status_change' && ['Closed', 'Cancelled'].includes(event.status) && event.previousStatus === 'Active') movement.cancelledSubscriptions += 1;
      subscriptionMovement.set(key, movement);
    }
    let newMrrMinor = 0; let churnedMrrMinor = 0; let expansionMinor = 0; let contractionMinor = 0;
    for (const event of events) {
      if (event.eventType === 'status_change' && event.status === 'Active' && event.previousStatus !== 'Active') newMrrMinor += monthly(event.netRecurringMinor || 0, event.billingFrequency || event.subscription.billingFrequency);
      if (event.eventType === 'status_change' && event.status === 'Closed' && event.previousStatus === 'Active') churnedMrrMinor += monthly(event.previousNetRecurringMinor || 0, event.billingFrequency || event.subscription.billingFrequency);
      if (event.eventType === 'plan_change') { const delta = monthly(event.netRecurringMinor || 0, event.billingFrequency || event.subscription.billingFrequency) - monthly(event.previousNetRecurringMinor || 0, event.previousBillingFrequency || event.billingFrequency || event.subscription.billingFrequency); if (delta > 0) expansionMinor += delta; else contractionMinor += -delta; }
    }
    const forecastEnd = new Date(Date.now() + 90 * 86400000);
    const forecastByDate = new Map();
    for (const s of active) if (s.nextBillingDate >= new Date() && s.nextBillingDate <= forecastEnd) { const key = dateKey(s.nextBillingDate); const amount = s.scheduledPlanChange && new Date(s.scheduledPlanChange.effectiveAt) <= new Date(s.nextBillingDate) ? s.scheduledPlanChange.recurringTotalMinor : s.recurringTotalMinor ?? toMinor(s.recurringTotal || 0); forecastByDate.set(key, (forecastByDate.get(key) || 0) + amount); }
    const forecast = [...forecastByDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, minor]) => ({ date, amountMinor: minor, amount: fromMinor(minor), estimate: true }));
    const collectedByCustomer = new Map();
    for (const payment of payments) if (payment.invoice?.customer) { const key = String(payment.invoice.customer); collectedByCustomer.set(key, (collectedByCustomer.get(key) || 0) + (payment.amountMinor ?? toMinor(payment.amount || 0))); }
    const outstandingByCustomer = new Map();
    for (const invoice of invoices) if (invoice.customer && !['Paid', 'Cancelled', 'Draft'].includes(invoice.status)) { const key = String(invoice.customer); outstandingByCustomer.set(key, (outstandingByCustomer.get(key) || 0) + Math.max(0, invoiceTotal(invoice) - invoicePaid(invoice))); }
    const customerNames = new Map(subscriptions.map((s) => [String(s.customer), s.customerName]));
    for (const invoice of invoices) if (invoice.customer) customerNames.set(String(invoice.customer), invoice.customerName);
    const topCollectedCustomers = [...collectedByCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([customer, amountMinor]) => ({ customer, name: customerNames.get(customer) || 'Customer', amountMinor, amount: fromMinor(amountMinor) }));
    const highOutstandingCustomers = [...outstandingByCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([customer, amountMinor]) => ({ customer, name: customerNames.get(customer) || 'Customer', amountMinor, amount: fromMinor(amountMinor) }));
    const startingCustomers = new Map(); let startingMrrMinor = 0;
    const baselineStates = new Map(); const dailyEvents = new Map();
    for (const s of subscriptions) {
      const allHistory = [...(s.statusHistory || [])].sort((a, b) => new Date(a.effectiveAt) - new Date(b.effectiveAt));
      const prior = allHistory.filter((event) => new Date(event.effectiveAt) < since).at(-1);
      const state = prior ? { status: prior.status, minor: prior.netRecurringMinor || 0, frequency: prior.billingFrequency || s.billingFrequency } : { status: null, minor: 0, frequency: s.billingFrequency };
      baselineStates.set(String(s._id), { ...state, customer: String(s.customer), customerName: s.customerName });
      if (state.status === 'Active') { const amount = monthly(state.minor, state.frequency); startingMrrMinor += amount; const item = startingCustomers.get(String(s.customer)) || { name: s.customerName, mrrMinor: 0 }; item.mrrMinor += amount; startingCustomers.set(String(s.customer), item); }
      for (const event of allHistory) if (new Date(event.effectiveAt) >= since && new Date(event.effectiveAt) <= new Date()) { const key = dateKey(event.effectiveAt); dailyEvents.set(key, [...(dailyEvents.get(key) || []), { subscription: String(s._id), event }]); }
    }
    let nrr = null; let customerChurnRate = null;
    if (historyComplete && startingMrrMinor > 0 && startingCustomers.size > 0) {
      const endCohortMrr = [...startingCustomers.keys()].reduce((sum, id) => sum + (customers.get(id)?.mrrMinor || 0), 0);
      const retainedCustomers = [...startingCustomers.keys()].filter((id) => (customers.get(id)?.mrrMinor || 0) > 0).length;
      nrr = Math.round(endCohortMrr * 10000 / startingMrrMinor) / 100;
      customerChurnRate = Math.round((startingCustomers.size - retainedCustomers) * 10000 / startingCustomers.size) / 100;
    }
    let runningMrr = startingMrrMinor; const mrrTrend = [];
    const startDay = new Date(`${dateKey(since)}T00:00:00.000Z`);
    const currentDay = new Date(`${dateKey(new Date())}T00:00:00.000Z`);
    const dayCount = Math.min(366, Math.max(1, Math.ceil((currentDay - startDay) / 86400000)));
    for (let day = 0; day <= dayCount; day++) {
      const date = new Date(startDay.getTime() + day * 86400000); const key = date.toISOString().slice(0, 10);
      for (const { subscription: id, event } of (dailyEvents.get(key) || []).sort((a, b) => new Date(a.event.effectiveAt) - new Date(b.event.effectiveAt))) {
        const state = baselineStates.get(id);
        if (state.status === 'Active') runningMrr -= monthly(state.minor, state.frequency);
        state.status = event.status; state.minor = event.netRecurringMinor || 0; state.frequency = event.billingFrequency || state.frequency;
        if (state.status === 'Active') runningMrr += monthly(state.minor, state.frequency);
      }
      mrrTrend.push({ date: key, mrrMinor: runningMrr, mrr: fromMinor(Math.max(0, runningMrr)), arr: fromMinor(Math.max(0, runningMrr) * 12) });
    }
    res.json({ success: true, definitions: { mrr: 'Current active subscription subtotal less discounts, excluding tax, normalized to a month.', arr: '12 times current MRR.', newMrr: 'Observed activation events during the selected range, net of tax and discounts.', expansionMrr: 'Observed active plan-change increases during the selected range.', contractionMrr: 'Observed active plan-change decreases during the selected range.', churnedMrr: 'Observed active-to-closed events during the selected range.', nrr: 'Ending recurring value of customers active at range start divided by their starting recurring value; null when historical snapshots are incomplete.', customerChurnRate: 'Starting active customer cohort members without an active subscription at range end divided by starting active customers; null when history is incomplete.', historicalLimitation: historyComplete ? null : 'Pre-existing subscriptions without a status snapshot at the selected range start make reconstructed MRR trend, NRR, and customer churn incomplete. Observed new, expansion, contraction, and closed events are reported from stored event history.' }, summary: { mrrMinor, mrr: fromMinor(mrrMinor), arrMinor: mrrMinor * 12, arr: fromMinor(mrrMinor * 12), collectedMinor, collected: fromMinor(collectedMinor), newMrrMinor, newMrr: fromMinor(newMrrMinor), expansionMrrMinor: expansionMinor, expansionMrr: fromMinor(expansionMinor), contractionMrrMinor: contractionMinor, contractionMrr: fromMinor(contractionMinor), churnedMrrMinor, churnedMrr: fromMinor(churnedMrrMinor), nrr, customerChurnRate, activeSubscriptions: active.length, invoices: invoices.length }, trends, subscriptionTrend: [...subscriptionMovement.values()].sort((a, b) => a.date.localeCompare(b.date)), mrrTrend: historyComplete ? mrrTrend : [], topCustomers, topCollectedCustomers, highOutstandingCustomers, revenueByProduct: Object.entries(revenueByProduct).map(([name, minor]) => ({ name, minor, amount: fromMinor(minor) })), revenueByPlan: Object.entries(revenueByPlan).map(([name, minor]) => ({ name, minor, amount: fromMinor(minor) })), revenueByInterval: Object.entries(byInterval).map(([name, minor]) => ({ name, minor, amount: fromMinor(minor) })), forecast });
  } catch (error) { res.status(500).json({ success: false, error: 'Unable to calculate revenue intelligence.' }); }
};
