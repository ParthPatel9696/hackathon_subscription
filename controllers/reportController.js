const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const { applyDateRange } = require('../utils/listQuery');
const { fromMinor, toMinor } = require('../utils/money');

// Legacy rupee fields remain unchanged. Aggregation normalizes only at read time.
const minor = (field, legacy) => ({ $ifNull: [`$${field}`, { $round: [{ $multiply: [{ $ifNull: [`$${legacy}`, 0] }, 100] }, 0] }] });
const outstanding = { $max: [0, { $subtract: [minor('grandTotalMinor', 'grandTotal'), minor('paidAmountMinor', 'paidAmount')] }] };
const month = (field) => ({ $dateToString: { date: `$${field}`, format: '%Y-%m', timezone: 'Asia/Kolkata' } });
const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

function filters(query) {
  const invoice = {}; const payment = {}; const subscription = {};
  for (const [input, field] of [['customerId', 'customer'], ['planId', 'plan']]) {
    if (!query[input]) continue;
    if (!mongoose.isValidObjectId(query[input])) throw badRequest(`Invalid ${input}.`);
    subscription[field] = new mongoose.Types.ObjectId(query[input]);
    if (field === 'customer') invoice.customer = subscription[field];
  }
  if (query.status && query.status !== 'ALL') {
    if (!['Draft', 'Confirmed', 'Paid', 'Overdue', 'Cancelled'].includes(query.status)) throw badRequest('Invalid invoice status.');
    invoice.status = query.status;
  }
  if (!applyDateRange(invoice, 'invoiceDate', query.startDate, query.endDate) || !applyDateRange(payment, 'paymentDate', query.startDate, query.endDate)) throw badRequest('Enter an ordered, valid date range.');
  return { invoice, payment, subscription };
}

async function invoiceFilter(query) {
  const matches = filters(query);
  if (query.planId) matches.invoice.subscription = { $in: await Subscription.find(matches.subscription).distinct('_id') };
  return matches;
}

exports.finance = async (req, res) => {
  try {
    const matches = await invoiceFilter(req.query);
    const now = new Date();
    const invoiceStages = [{ $match: matches.invoice }];
    // Payment dates govern cash reporting; invoice issue dates govern invoiced value.
    const paymentInvoiceFilter = { ...matches.invoice };
    delete paymentInvoiceFilter.invoiceDate;
    const [invoiceResult, paymentResult, subscriptionCount] = await Promise.all([
      Invoice.aggregate([...invoiceStages, { $facet: {
        totals: [{ $group: { _id: null, count: { $sum: 1 }, outstandingMinor: { $sum: { $cond: [{ $in: ['$status', ['Confirmed', 'Overdue']] }, outstanding, 0] } }, overdueCount: { $sum: { $cond: [{ $and: [{ $in: ['$status', ['Confirmed', 'Overdue']] }, { $lt: ['$dueDate', now] }, { $gt: [outstanding, 0] }] }, 1, 0] } } } }],
        byMonth: [{ $match: { status: { $in: ['Confirmed', 'Overdue', 'Paid'] } } }, { $group: { _id: month('invoiceDate'), invoicedMinor: { $sum: minor('grandTotalMinor', 'grandTotal') } } }, { $sort: { _id: -1 } }, { $limit: 120 }],
        overdue: [{ $match: { status: { $in: ['Confirmed', 'Overdue'] }, dueDate: { $lt: now }, $expr: { $gt: [outstanding, 0] } } }, { $sort: { dueDate: 1 } }, { $limit: 10 }, { $project: { invoiceNumber: 1, customerName: 1, dueDate: 1, outstandingMinor: outstanding } }]
      } }]),
      Payment.aggregate([
        { $match: { ...matches.payment, $or: [{ status: 'posted' }, { status: { $exists: false } }] } },
        { $lookup: { from: Invoice.collection.name, localField: 'invoice', foreignField: '_id', as: 'parent' } },
        { $unwind: '$parent' },
        { $match: Object.fromEntries(Object.entries(paymentInvoiceFilter).map(([key, value]) => [`parent.${key}`, value])) },
        { $facet: {
          totals: [{ $group: { _id: null, count: { $sum: 1 }, collectedMinor: { $sum: minor('amountMinor', 'amount') } } }],
          byMonth: [{ $group: { _id: month('paymentDate'), collectedMinor: { $sum: minor('amountMinor', 'amount') } } }, { $sort: { _id: -1 } }, { $limit: 120 }]
        } }
      ]),
      Subscription.countDocuments({ ...matches.subscription, status: 'Active' })
    ]);
    const invoices = invoiceResult[0]; const payments = paymentResult[0];
    const months = new Map();
    for (const row of invoices.byMonth) months.set(row._id, { month: row._id, invoiced: fromMinor(row.invoicedMinor), collected: 0 });
    for (const row of payments.byMonth) months.set(row._id, { month: row._id, invoiced: 0, ...months.get(row._id), collected: fromMinor(row.collectedMinor) });
    res.json({ success: true, summary: { invoices: invoices.totals[0]?.count || 0, payments: payments.totals[0]?.count || 0, activeSubscriptions: subscriptionCount, outstanding: fromMinor(invoices.totals[0]?.outstandingMinor || 0), collected: fromMinor(payments.totals[0]?.collectedMinor || 0), overdueCount: invoices.totals[0]?.overdueCount || 0 }, monthly: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-120), overdue: invoices.overdue.map((row) => ({ ...row, outstanding: fromMinor(row.outstandingMinor), daysLate: Math.max(1, Math.floor((now - row.dueDate) / 86400000)) })), definitions: { activeSubscriptions: 'Current active portfolio, independent of the reporting dates.', collected: 'Posted payments dated within the selected range.', outstanding: 'Current open balances on invoices issued within the selected range.', monthly: 'Up to the latest 120 observed months; totals include every matching record.' } });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Unable to load the finance report.' }); }
};

exports.exportInvoices = async (req, res, next) => {
  try {
    const { invoice } = await invoiceFilter(req.query);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="brightloop-invoices-INR.csv"', 'Cache-Control': 'private, no-store' });
    const cell = (value) => `"${String(value ?? '').replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""')}"`;
    res.write('\uFEFFInvoice,Customer,Currency,Issue date,Due date,Status,Total INR,Paid INR,Outstanding INR\r\n');
    const cursor = Invoice.find(invoice).sort({ invoiceDate: 1, _id: 1 }).lean().cursor();
    try {
      for await (const row of cursor) {
        if (res.destroyed) break;
        const total = row.grandTotalMinor ?? toMinor(row.grandTotal);
        const paid = row.paidAmountMinor ?? toMinor(row.paidAmount || 0);
        const values = [row.invoiceNumber, row.customerName, 'INR', row.invoiceDate?.toISOString(), row.dueDate?.toISOString(), row.status, fromMinor(total).toFixed(2), fromMinor(paid).toFixed(2), fromMinor(['Draft', 'Cancelled'].includes(row.status) ? 0 : Math.max(0, total - paid)).toFixed(2)];
        if (!res.write(values.map(cell).join(',') + '\r\n')) await new Promise((resolve) => {
          const done = () => { res.off('drain', done); res.off('close', done); resolve(); };
          res.once('drain', done); res.once('close', done);
        });
      }
    } finally { await cursor.close(); }
    res.end();
  } catch (error) {
    if (res.headersSent) return next(error);
    res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Unable to export invoices.' });
  }
};
