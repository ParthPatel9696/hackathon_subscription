const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const { nextBusinessIdentifier } = require('./identifierService');
const { fromMinor, toMinor } = require('../utils/money');

const advanceBillingDate = (date, frequency) => {
  const nextDate = new Date(date);
  if (!Number.isFinite(nextDate.getTime())) throw new TypeError('Billing date must be valid.');
  if (frequency === 'daily') nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  else if (frequency === 'weekly') nextDate.setUTCDate(nextDate.getUTCDate() + 7);
  else if (frequency === 'monthly' || frequency === 'yearly') {
    const day = nextDate.getUTCDate();
    nextDate.setUTCDate(1);
    if (frequency === 'yearly') nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1);
    else nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)).getUTCDate();
    nextDate.setUTCDate(Math.min(day, lastDay));
  } else throw new TypeError(`Unsupported billing frequency: ${frequency}`);
  return nextDate;
};

const isTransactionUnsupported = (error) => [20, 303].includes(error.code) ||
  /transaction numbers are only allowed|does not support transactions|replica set member or mongos/i.test(error.message || '');

function periodFor(subscription, now) {
  return {
    start: subscription.lastInvoicedDate || subscription.startDate || now,
    end: subscription.nextBillingDate || now
  };
}

async function applyDueScheduledPlanChange(subscription, now, session) {
  const change = subscription.scheduledPlanChange;
  if (!change || new Date(change.effectiveAt) > now) return subscription;
  const changedLine = change.line;
  const lines = subscription.lines.map((line) => String(line.product) === String(changedLine.product) ? changedLine : line);
  const previousLine = subscription.lines.find((line) => String(line.product) === String(changedLine.product));
  const previousRecurringMinor = subscription.recurringTotalMinor ?? toMinor(subscription.recurringTotal);
  const previousNetRecurringMinor = Math.max(0, (subscription.subtotalMinor ?? toMinor(subscription.subtotal || 0)) - (subscription.discountTotalMinor ?? toMinor(subscription.discountTotal || 0)));
  const newNetRecurringMinor = Math.max(0, change.subtotalMinor - change.discountTotalMinor);
  const update = {
    $set: {
      plan: change.plan, planName: change.planName, billingFrequency: change.billingFrequency,
      lines, subtotalMinor: change.subtotalMinor, taxTotalMinor: change.taxTotalMinor, discountTotalMinor: change.discountTotalMinor,
      subtotal: fromMinor(change.subtotalMinor), taxTotal: fromMinor(change.taxTotalMinor), discountTotal: fromMinor(change.discountTotalMinor),
      recurringTotalMinor: change.recurringTotalMinor, recurringTotal: fromMinor(change.recurringTotalMinor), scheduledPlanChange: null
    },
    $push: {
      planChangeHistory: {
        previousPlan: subscription.planName, newPlan: change.planName, previousRecurringMinor,
        newRecurringMinor: change.recurringTotalMinor, previousNetRecurringMinor, newNetRecurringMinor, previousQuantity: previousLine?.quantity || 1,
        newQuantity: change.quantity, prorationMinor: change.prorationMinor, effectiveAt: change.effectiveAt,
        changedBy: change.requestedBy, reason: change.reason, operationKey: change.operationKey, createdAt: now
      },
      statusHistory: { eventType: 'plan_change', previousStatus: 'Active', status: 'Active', previousNetRecurringMinor, netRecurringMinor: newNetRecurringMinor, previousBillingFrequency: subscription.billingFrequency, billingFrequency: change.billingFrequency, effectiveAt: change.effectiveAt, actor: change.requestedBy, reason: change.reason }
    }
  };
  const result = await Subscription.updateOne({ _id: subscription._id, 'scheduledPlanChange.operationKey': change.operationKey }, update, { session });
  if (result.modifiedCount !== 1) return Subscription.findById(subscription._id).session(session || null);
  return Subscription.findById(subscription._id).session(session || null);
}

async function makeInvoiceDocument(subscription, period, now) {
  const lines = subscription.lines.map((line) => ({
    productName: line.productName,
    variantName: line.variantName,
    quantity: line.quantity,
    unitPrice: line.unitPrice + (line.variantPriceExtra || 0),
    unitPriceMinor: (line.unitPriceMinor ?? Math.round(line.unitPrice * 100)) + (line.variantPriceExtraMinor ?? Math.round((line.variantPriceExtra || 0) * 100)),
    taxRate: line.taxRate,
    taxLabel: line.taxLabel,
    taxComponents: line.taxComponents,
    taxAmount: line.taxAmount,
    taxMinor: line.taxMinor ?? Math.round((line.taxAmount || 0) * 100),
    discountAmount: line.discountAmount,
    discountMinor: line.discountMinor ?? Math.round((line.discountAmount || 0) * 100),
    total: line.lineTotal,
    totalMinor: line.lineTotalMinor ?? Math.round(line.lineTotal * 100)
  }));
  const invoiceNumber = await nextBusinessIdentifier({ prefix: 'INV', Model: Invoice, field: 'invoiceNumber', year: now.getUTCFullYear() });
  const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const subtotalMinor = subscription.subtotalMinor ?? Math.round(subscription.subtotal * 100);
  const taxTotalMinor = subscription.taxTotalMinor ?? Math.round(subscription.taxTotal * 100);
  const discountTotalMinor = subscription.discountTotalMinor ?? Math.round(subscription.discountTotal * 100);
  const grandTotalMinor = subscription.recurringTotalMinor ?? Math.round(subscription.recurringTotal * 100);
  return {
    invoiceNumber,
    subscription: subscription._id,
    subscriptionNumber: subscription.subscriptionNumber,
    customer: subscription.customer,
    customerName: subscription.customerName,
    customerEmail: subscription.customerEmail,
    invoiceDate: now,
    dueDate,
    billingPeriodStart: period.start,
    billingPeriodEnd: period.end,
    lines,
    subtotal: subscription.subtotal,
    taxTotal: subscription.taxTotal,
    discountTotal: subscription.discountTotal,
    subtotalMinor,
    taxTotalMinor,
    discountTotalMinor,
    grandTotal: subscription.recurringTotal,
    grandTotalMinor,
    status: 'Confirmed',
    paymentTerms: subscription.paymentTerms
  };
}

async function advanceSubscriptionAfterInvoice(subscription, periodEnd, session) {
  if (subscription.lastInvoicedDate && new Date(subscription.lastInvoicedDate) >= new Date(periodEnd)) return;
  if (new Date(subscription.nextBillingDate || 0) > new Date(periodEnd)) return;
  const filter = { _id: subscription._id, nextBillingDate: subscription.nextBillingDate };
  if (subscription.lastInvoicedDate) filter.lastInvoicedDate = subscription.lastInvoicedDate;
  else filter.$or = [{ lastInvoicedDate: null }, { lastInvoicedDate: { $exists: false } }];
  const result = await Subscription.updateOne(filter, {
    $set: {
      lastInvoicedDate: periodEnd,
      nextBillingDate: advanceBillingDate(periodEnd, subscription.billingFrequency)
    }
  }, { session });
  if (result.modifiedCount === 1) return;
  const current = await Subscription.findById(subscription._id).session(session || null);
  if (current && ((current.lastInvoicedDate && new Date(current.lastInvoicedDate) >= new Date(periodEnd)) || new Date(current.nextBillingDate || 0) > new Date(periodEnd))) return;
  throw new Error(`Invoice exists for ${subscription.subscriptionNumber}, but its billing date could not be advanced. Retry billing to recover.`);
}

async function recoverableBilling(subscriptionId, now, forceAllActive) {
  let subscription = await Subscription.findById(subscriptionId);
  if (subscription) subscription = await applyDueScheduledPlanChange(subscription, now);
  if (!subscription || subscription.status !== 'Active' || (!forceAllActive && subscription.nextBillingDate && subscription.nextBillingDate > now)) return { skipped: true, reason: 'Subscription is no longer due.' };
  const period = periodFor(subscription, now);
  const periodQuery = { subscription: subscription._id, billingPeriodStart: period.start, billingPeriodEnd: period.end };
  let invoice = await Invoice.findOne(periodQuery);
  let created = false;
  if (!invoice) {
    const invoiceDocument = await makeInvoiceDocument(subscription, period, now);
    try {
      [invoice] = await Invoice.create([invoiceDocument]);
      created = true;
    } catch (error) {
      if (error.code !== 11000) throw error;
      invoice = await Invoice.findOne(periodQuery);
      if (!invoice) throw error;
    }
  }
  await advanceSubscriptionAfterInvoice(subscription, period.end);
  return { invoice, recovered: !created };
}

async function transactionalBilling(subscriptionId, now, forceAllActive) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      let subscription = await Subscription.findById(subscriptionId).session(session);
      if (subscription) subscription = await applyDueScheduledPlanChange(subscription, now, session);
      if (!subscription || subscription.status !== 'Active' || (!forceAllActive && subscription.nextBillingDate && subscription.nextBillingDate > now)) {
        result = { skipped: true, reason: 'Subscription is no longer due.' };
        return;
      }
      const period = periodFor(subscription, now);
      const existing = await Invoice.findOne({ subscription: subscription._id, billingPeriodStart: period.start, billingPeriodEnd: period.end }).session(session);
      let invoice = existing;
      if (!invoice) {
        const invoiceDocument = await makeInvoiceDocument(subscription, period, now);
        [invoice] = await Invoice.create([invoiceDocument], { session });
      }
      await advanceSubscriptionAfterInvoice(subscription, period.end, session);
      result = { invoice, recovered: Boolean(existing) };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function billOne(subscriptionId, now, forceAllActive, useTransactions) {
  if (!useTransactions) return recoverableBilling(subscriptionId, now, forceAllActive);
  try {
    return await transactionalBilling(subscriptionId, now, forceAllActive);
  } catch (error) {
    if (!isTransactionUnsupported(error)) {
      // The unique period index resolves concurrent duplicate invoice attempts.
      if (error.code === 11000) return recoverableBilling(subscriptionId, now, forceAllActive);
      throw error;
    }
    return recoverableBilling(subscriptionId, now, forceAllActive);
  }
}

const runRecurringBilling = async ({ forceAllActive = false, actorRole, now = new Date(), useTransactions = true }) => {
  if (forceAllActive && actorRole !== 'admin') {
    const error = new Error('Only administrators can force billing.');
    error.statusCode = 403;
    throw error;
  }
  const query = { status: 'Active' };
  if (!forceAllActive) query.nextBillingDate = { $lte: now };
  const subscriptions = await Subscription.find(query).select('_id subscriptionNumber');
  const createdInvoices = [];
  const skippedSubscriptions = [];
  const recoveredSubscriptions = [];
  for (const subscription of subscriptions) {
    const outcome = await billOne(subscription._id, now, forceAllActive, useTransactions);
    if (outcome.skipped) skippedSubscriptions.push({ subNumber: subscription.subscriptionNumber, reason: outcome.reason });
    else if (outcome.recovered) recoveredSubscriptions.push({ subNumber: subscription.subscriptionNumber, invoiceNumber: outcome.invoice.invoiceNumber });
    else createdInvoices.push(outcome.invoice);
  }
  return { createdInvoices, skippedSubscriptions, recoveredSubscriptions };
};

module.exports = { runRecurringBilling, advanceBillingDate, isTransactionUnsupported, applyDueScheduledPlanChange };
