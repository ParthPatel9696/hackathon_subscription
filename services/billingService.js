const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');

const advanceBillingDate = (date, frequency) => {
  const nextDate = new Date(date);
  if (frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
  else if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
  else if (frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
  else nextDate.setMonth(nextDate.getMonth() + 1);
  return nextDate;
};

const runRecurringBilling = async ({ forceAllActive = false, actorRole }) => {
  if (forceAllActive && actorRole !== 'admin') {
    const error = new Error('Only administrators can force billing.');
    error.statusCode = 403;
    throw error;
  }

  const today = new Date();
  const query = { status: 'Active' };
  if (!forceAllActive) query.nextBillingDate = { $lte: today };

  const activeSubscriptions = await Subscription.find(query);
  const createdInvoices = [];
  const skippedSubscriptions = [];

  for (const subscription of activeSubscriptions) {
    const periodStart = subscription.lastInvoicedDate || subscription.startDate || today;
    const periodEnd = subscription.nextBillingDate || today;
    const existingInvoice = await Invoice.findOne({
      subscription: subscription._id,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd
    });

    if (existingInvoice) {
      skippedSubscriptions.push({
        subNumber: subscription.subscriptionNumber,
        reason: 'Already billed for this billing cycle.'
      });
      continue;
    }

    const invoiceLines = subscription.lines.map(line => ({
      productName: line.productName,
      variantName: line.variantName,
      quantity: line.quantity,
      unitPrice: line.unitPrice + (line.variantPriceExtra || 0),
      unitPriceMinor: line.unitPriceMinor ?? Math.round((line.unitPrice + (line.variantPriceExtra || 0)) * 100),
      taxRate: line.taxRate,
      taxAmount: line.taxAmount,
      taxMinor: line.taxMinor ?? Math.round((line.taxAmount || 0) * 100),
      discountAmount: line.discountAmount,
      discountMinor: line.discountMinor ?? Math.round((line.discountAmount || 0) * 100),
      total: line.lineTotal,
      totalMinor: line.lineTotalMinor ?? Math.round(line.lineTotal * 100)
    }));

    const count = await Invoice.countDocuments();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 201).padStart(4, '0')}`;
    const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const subtotalMinor = subscription.subtotalMinor ?? Math.round(subscription.subtotal * 100);
    const taxTotalMinor = subscription.taxTotalMinor ?? Math.round(subscription.taxTotal * 100);
    const discountTotalMinor = subscription.discountTotalMinor ?? Math.round(subscription.discountTotal * 100);
    const grandTotalMinor = subscription.recurringTotalMinor ?? Math.round(subscription.recurringTotal * 100);

    const invoice = await Invoice.create({
      invoiceNumber,
      subscription: subscription._id,
      subscriptionNumber: subscription.subscriptionNumber,
      customer: subscription.customer,
      customerName: subscription.customerName,
      customerEmail: subscription.customerEmail,
      invoiceDate: today,
      dueDate,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      lines: invoiceLines,
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
    });

    createdInvoices.push(invoice);
    subscription.lastInvoicedDate = today;
    subscription.nextBillingDate = advanceBillingDate(subscription.nextBillingDate || today, subscription.billingFrequency);
    await subscription.save();
  }

  return {
    createdInvoices,
    skippedSubscriptions
  };
};

module.exports = {
  runRecurringBilling,
  advanceBillingDate
};
