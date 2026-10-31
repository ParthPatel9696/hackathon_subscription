const User = require('../models/User');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Discount = require('../models/Discount');

exports.seedDatabase = async (req, res) => {
  try {
    // Clear collections
    await User.deleteMany({});
    await Product.deleteMany({});
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await Invoice.deleteMany({});
    await Payment.deleteMany({});
    await Discount.deleteMany({});

    // 1. Seed Users
    const adminUser = await User.create({
      email: 'admin@brightloop.com',
      password: 'Admin@Secure2024!', // > 8 chars, uppercase, lowercase, special char
      role: 'admin',
      name: 'Alex Morgan',
      companyName: 'Brightloop Admin Team'
    });

    const staffUser = await User.create({
      email: 'jordan.lee@brightloop.com',
      password: 'Staff@Secure2024!',
      role: 'staff',
      name: 'Jordan Lee',
      companyName: 'Brightloop Sales & Ops'
    });

    const customerUser = await User.create({
      email: 'finance@acmeretail.com',
      password: 'Acme@Customer2024!',
      role: 'customer',
      name: 'Sarah Jenkins',
      companyName: 'Acme Retail Corp'
    });

    const customer2 = await User.create({
      email: 'billing@apexcorp.com',
      password: 'Apex@Customer2024!',
      role: 'customer',
      name: 'David Apex',
      companyName: 'Apex Global Corp'
    });

    // 2. Seed Products with Variants (Brand: Odoo adds $60)
    const erpProduct = await Product.create({
      name: 'Brightloop Core ERP Suite',
      type: 'software',
      salesPrice: 1500,
      costPrice: 400,
      notes: 'Full-featured enterprise resource planning software.',
      variants: [
        {
          name: 'Brand Edition',
          options: [
            { name: 'Standard Edition', priceExtra: 0, sku: 'ERP-STD' },
            { name: 'Odoo Brand Edition', priceExtra: 60, sku: 'ERP-ODOO' }
          ]
        }
      ],
      taxRate: 0.10
    });

    const seatProduct = await Product.create({
      name: 'Additional User Seats',
      type: 'seat',
      salesPrice: 25,
      costPrice: 5,
      notes: 'Monthly license per active user seat.',
      taxRate: 0.10
    });

    const analyticsProduct = await Product.create({
      name: 'Advanced Financial Analytics',
      type: 'addon',
      salesPrice: 15,
      costPrice: 2,
      notes: 'Real-time forecasts and executive reports.',
      taxRate: 0.10
    });

    const supportProduct = await Product.create({
      name: '24/7 Priority Support SLA',
      type: 'service',
      salesPrice: 25,
      costPrice: 10,
      notes: '1-hour guaranteed SLA and dedicated account manager.',
      taxRate: 0.10
    });

    // 3. Seed Plans
    const enterprisePlan = await Plan.create({
      name: 'Enterprise Cloud Suite',
      code: 'ENT-MONTHLY',
      product: erpProduct._id,
      billingFrequency: 'monthly',
      basePrice: 1500,
      minQuantity: 1,
      allowPause: true,
      allowEarlyClose: true
    });

    const businessYearlyPlan = await Plan.create({
      name: 'Standard Business Yearly',
      code: 'BUS-YEARLY',
      product: erpProduct._id,
      billingFrequency: 'yearly',
      basePrice: 5400,
      minQuantity: 1,
      allowPause: true
    });

    const starterPlan = await Plan.create({
      name: 'Starter Cloud Package',
      code: 'STARTER-MO',
      product: erpProduct._id,
      billingFrequency: 'monthly',
      basePrice: 89,
      minQuantity: 1,
      autoCloseAtEnd: false
    });

    // 4. Seed Discounts
    const discount1 = await Discount.create({
      code: 'ODOOPARTNER15',
      name: '15% Off Odoo Brand Bundles',
      discountType: 'percentage',
      value: 15,
      minPurchaseAmount: 1000,
      usageLimit: 100,
      timesUsed: 42,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31')
    });

    await Discount.create({
      code: 'SCALEUP500',
      name: '$500 Fixed Annual Rebate',
      discountType: 'fixed',
      value: 500,
      minPurchaseAmount: 3000,
      usageLimit: 50,
      timesUsed: 18,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31')
    });

    await Discount.create({
      code: 'SUMMER2024',
      name: '10% Early Bird Off',
      discountType: 'percentage',
      value: 10,
      minPurchaseAmount: 500,
      usageLimit: 100,
      timesUsed: 100,
      isActive: false,
      startDate: new Date('2024-05-01'),
      endDate: new Date('2024-08-31')
    });

    // 5. Seed Subscriptions across all lifecycle states
    // Active subscription (Apex Global Corp)
    const activeSub = await Subscription.create({
      subscriptionNumber: 'SUB-2024-0089',
      customer: customer2._id,
      customerName: 'Apex Global Corp',
      customerEmail: 'billing@apexcorp.com',
      plan: enterprisePlan._id,
      planName: 'Enterprise Cloud Suite',
      billingFrequency: 'monthly',
      startDate: new Date('2024-01-15'),
      expiryDate: new Date('2025-01-14'),
      nextBillingDate: new Date('2024-11-15'),
      paymentTerms: 'Net 30 Days',
      lines: [
        {
          product: erpProduct._id,
          productName: 'Brightloop Core ERP Suite',
          variantName: 'Odoo Brand Edition (+ $60.00)',
          variantPriceExtra: 60,
          quantity: 1,
          unitPrice: 1500,
          taxRate: 0.10,
          taxAmount: 156,
          discountAmount: 234, // 15% discount
          lineTotal: 1482
        },
        {
          product: seatProduct._id,
          productName: 'Additional User Seats',
          variantName: 'Standard',
          quantity: 10,
          unitPrice: 25,
          taxRate: 0.10,
          taxAmount: 25,
          discountAmount: 0,
          lineTotal: 275
        }
      ],
      subtotal: 1810,
      taxTotal: 181,
      discountTotal: 234,
      recurringTotal: 1757,
      status: 'Active'
    });

    // Quotation subscription (Plait Company)
    await Subscription.create({
      subscriptionNumber: 'SUB-2024-0102',
      customer: customerUser._id,
      customerName: 'Plait Company Inc',
      customerEmail: 'finance@acmeretail.com',
      plan: businessYearlyPlan._id,
      planName: 'Standard Business Yearly',
      billingFrequency: 'yearly',
      startDate: new Date('2024-12-01'),
      expiryDate: new Date('2025-11-30'),
      nextBillingDate: new Date('2024-12-01'),
      paymentTerms: 'Net 30 Days',
      lines: [
        {
          product: erpProduct._id,
          productName: 'Brightloop Core ERP Suite',
          variantName: 'Standard Edition',
          quantity: 1,
          unitPrice: 5400,
          taxRate: 0.10,
          taxAmount: 540,
          discountAmount: 500,
          lineTotal: 5440
        }
      ],
      subtotal: 5400,
      taxTotal: 540,
      discountTotal: 500,
      recurringTotal: 5440,
      status: 'Quotation',
      quotationValidUntil: new Date('2024-11-20')
    });

    // Confirmed subscription (Nexus Retail)
    await Subscription.create({
      subscriptionNumber: 'SUB-2024-0077',
      customer: customerUser._id,
      customerName: 'Nexus Retail India',
      customerEmail: 'accounts@nexusretail.in',
      plan: starterPlan._id,
      planName: 'Starter Cloud Package',
      billingFrequency: 'monthly',
      startDate: new Date('2024-10-01'),
      expiryDate: new Date('2025-09-30'),
      nextBillingDate: new Date('2024-11-01'),
      paymentTerms: 'Due on Receipt',
      lines: [
        {
          product: starterPlan._id,
          productName: 'Starter Cloud Package',
          quantity: 1,
          unitPrice: 89,
          taxRate: 0.10,
          taxAmount: 8.9,
          discountAmount: 0,
          lineTotal: 97.9
        }
      ],
      subtotal: 89,
      taxTotal: 8.9,
      discountTotal: 0,
      recurringTotal: 97.9,
      status: 'Confirmed'
    });

    // Closed subscription
    await Subscription.create({
      subscriptionNumber: 'SUB-2023-0941',
      customer: customerUser._id,
      customerName: 'Old Town Bakery',
      customerEmail: 'baker@oldtown.org',
      plan: starterPlan._id,
      planName: 'Starter Cloud Package',
      billingFrequency: 'monthly',
      startDate: new Date('2023-01-01'),
      expiryDate: new Date('2023-12-31'),
      lines: [],
      subtotal: 89,
      taxTotal: 8.9,
      recurringTotal: 97.9,
      status: 'Closed',
      notes: 'Closed at end of contract period automatically.'
    });

    // 6. Seed Invoices
    const paidInv = await Invoice.create({
      invoiceNumber: 'INV-2024-001',
      subscription: activeSub._id,
      subscriptionNumber: 'SUB-2024-0089',
      customer: customer2._id,
      customerName: 'Apex Global Corp',
      customerEmail: 'billing@apexcorp.com',
      invoiceDate: new Date('2024-10-15'),
      dueDate: new Date('2024-11-14'),
      lines: [
        {
          productName: 'Brightloop Core ERP Suite (Odoo Brand)',
          quantity: 1,
          unitPrice: 1560,
          taxRate: 0.10,
          taxAmount: 156,
          discountAmount: 234,
          total: 1482
        },
        {
          productName: 'Additional User Seats (x10)',
          quantity: 10,
          unitPrice: 25,
          taxRate: 0.10,
          taxAmount: 25,
          discountAmount: 0,
          total: 275
        }
      ],
      subtotal: 1810,
      taxTotal: 181,
      discountTotal: 234,
      grandTotal: 1757,
      paidAmount: 1757,
      status: 'Paid',
      paymentTerms: 'Net 30 Days'
    });

    await Payment.create({
      invoice: paidInv._id,
      invoiceNumber: 'INV-2024-001',
      amount: 1757,
      method: 'Bank Transfer',
      paymentDate: new Date('2024-10-16'),
      referenceNote: 'Bank Wire Txn #WIRE-98218-NY'
    });

    // Overdue Invoice
    await Invoice.create({
      invoiceNumber: 'INV-2024-098',
      subscription: activeSub._id,
      subscriptionNumber: 'SUB-2024-0044',
      customer: customerUser._id,
      customerName: 'Eanon Germany Ltd',
      customerEmail: 'eanon@germany-biz.de',
      invoiceDate: new Date('2024-09-01'),
      dueDate: new Date('2024-10-01'), // past due!
      lines: [
        {
          productName: 'Enterprise Cloud Suite',
          quantity: 1,
          unitPrice: 2227,
          taxRate: 0.10,
          taxAmount: 223,
          discountAmount: 0,
          total: 2450
        }
      ],
      subtotal: 2227,
      taxTotal: 223,
      discountTotal: 0,
      grandTotal: 2450,
      paidAmount: 0,
      status: 'Overdue',
      paymentTerms: 'Net 30 Days'
    });

    // Confirmed Invoice (due soon)
    await Invoice.create({
      invoiceNumber: 'INV-2024-115',
      subscription: activeSub._id,
      subscriptionNumber: 'SUB-2024-0105',
      customer: customerUser._id,
      customerName: 'Horizon Tech Labs',
      customerEmail: 'ops@horizontech.io',
      invoiceDate: new Date('2024-10-28'),
      dueDate: new Date('2024-11-27'),
      lines: [
        {
          productName: 'Starter Cloud Package + Support',
          quantity: 1,
          unitPrice: 450,
          taxRate: 0.10,
          taxAmount: 45,
          discountAmount: 0,
          total: 495
        }
      ],
      subtotal: 450,
      taxTotal: 45,
      discountTotal: 0,
      grandTotal: 495,
      paidAmount: 0,
      status: 'Confirmed',
      paymentTerms: 'Net 30 Days'
    });

    res.json({
      success: true,
      message: 'Brightloop database seeded successfully with realistic hackathon scenario data!'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
