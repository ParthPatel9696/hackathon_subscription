require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { runRecurringBilling } = require('../services/billingService');
const Invoice = require('../models/Invoice');
const Subscription = require('../models/Subscription');
const { releaseDiscountUsage } = require('../services/discountService');

const intervalMinutes = Number.parseInt(process.env.BILLING_WORKER_INTERVAL_MINUTES, 10) || 15;
if (intervalMinutes < 1 || intervalMinutes > 1440) {
  throw new Error('BILLING_WORKER_INTERVAL_MINUTES must be between 1 and 1440.');
}

let running = false;
let stopping = false;

async function runCycle() {
  if (running || stopping) return;
  running = true;
  try {
    const result = await runRecurringBilling({ actorRole: 'admin' });
    console.log(`[Billing worker] created=${result.createdInvoices.length} recovered=${result.recoveredSubscriptions.length} skipped=${result.skippedSubscriptions.length} failed=${result.failedSubscriptions.length} catchUpPending=${result.catchUpPending.length}`);
    for (const failure of result.failedSubscriptions) {
      console.error(`[Billing worker] ${failure.subNumber}: ${failure.error}`);
    }
    const now = new Date();
    const overdue = await Invoice.updateMany({
      status: 'Confirmed', dueDate: { $lt: now },
      $expr: { $lt: [
        { $ifNull: ['$paidAmountMinor', { $multiply: [{ $ifNull: ['$paidAmount', 0] }, 100] }] },
        { $ifNull: ['$grandTotalMinor', { $multiply: ['$grandTotal', 100] }] }
      ] }
    }, { $set: { status: 'Overdue' } });
    const expiring = await Subscription.find({ status: 'Active', expiryDate: { $lte: now } })
      .select('_id subscriptionNumber planName expiryDate plan').populate('plan', 'autoCloseAtEnd');
    let autoClosedCount = 0;
    for (const subscription of expiring) {
      if (!subscription.plan?.autoCloseAtEnd) continue;
      const result = await Subscription.updateOne({ _id: subscription._id, status: 'Active', expiryDate: { $lte: now } }, {
        $set: { status: 'Closed', closedAt: now },
        $push: { statusHistory: { eventType: 'status_change', previousStatus: 'Active', status: 'Closed', effectiveAt: now, reason: 'Automatically closed at the subscription end date.' } }
      });
      autoClosedCount += result.modifiedCount;
    }
    if (overdue.modifiedCount || autoClosedCount) {
      console.log(`[Billing worker] markedOverdue=${overdue.modifiedCount} autoClosed=${autoClosedCount}`);
    }
    const expiredQuotes = await Subscription.find({ status: 'Quotation', quotationValidUntil: { $lte: now } }).select('_id subscriptionNumber discount');
    let expiredQuoteCount = 0;
    for (const quote of expiredQuotes) {
      const result = await Subscription.updateOne({ _id: quote._id, status: 'Quotation', quotationValidUntil: { $lte: now } }, {
        $set: { status: 'Expired', closedAt: now },
        $push: { statusHistory: { eventType: 'status_change', previousStatus: 'Quotation', status: 'Expired', effectiveAt: now, reason: 'Quotation validity period ended.' } }
      });
      if (result.modifiedCount) {
        expiredQuoteCount += 1;
        if (quote.discount) await releaseDiscountUsage(quote.discount);
      }
    }
    if (expiredQuoteCount) console.log(`[Billing worker] expiredQuotations=${expiredQuoteCount}`);
  } catch (error) {
    console.error(`[Billing worker] Cycle failed: ${error.message}`);
  } finally {
    running = false;
  }
}

async function start() {
  await connectDB();
  console.log(`[Billing worker] Checking due subscriptions every ${intervalMinutes} minute(s).`);
  await runCycle();
  const timer = setInterval(runCycle, intervalMinutes * 60 * 1000);
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    while (running) await new Promise((resolve) => setTimeout(resolve, 100));
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

start().catch(async (error) => {
  console.error(`[Billing worker] Startup failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
