const express = require('express');
const router = express.Router();

const authCtrl = require('../controllers/authController');
const subscriptionCtrl = require('../controllers/subscriptionController');
const billingCtrl = require('../controllers/billingController');
const paymentCtrl = require('../controllers/paymentController');
const dashboardCtrl = require('../controllers/dashboardController');
const discountCtrl = require('../controllers/discountController');
const seedCtrl = require('../controllers/seedController');
const { verifyToken, requireRole } = require('../middleware/auth');
const Product = require('../models/Product');
const Plan = require('../models/Plan');

// Seeding
router.get('/seed', seedCtrl.seedDatabase);
router.post('/seed', seedCtrl.seedDatabase);

// ==========================================
// Authentication Routes (Problem Statement Page 2)
// ==========================================
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', verifyToken, authCtrl.getMe);
router.post('/auth/forgot-password', authCtrl.forgotPassword);

// Only the admin can add a new member of staff (Page 2 Spec)
router.post('/auth/add-staff', verifyToken, requireRole('admin'), authCtrl.addStaff);

// ==========================================
// Public / Semi-Public Catalogs
// ==========================================
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/plans', async (req, res) => {
  try {
    const plans = await Plan.find();
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Dashboard Finance Metrics (< 2s)
// ==========================================
router.get('/dashboard/metrics', dashboardCtrl.getFinanceMetrics);

// ==========================================
// Subscriptions & Lifecycle State Machine
// ==========================================
router.get('/subscriptions', subscriptionCtrl.getSubscriptions);
router.get('/subscriptions/:id', subscriptionCtrl.getSubscriptionById);
router.post('/subscriptions', subscriptionCtrl.createSubscription);
router.post('/subscriptions/transition', subscriptionCtrl.transitionState);

// ==========================================
// Billing & Invoices
// ==========================================
router.post('/billing/run-batch', billingCtrl.runRecurringBillingBatch);
router.get('/invoices', billingCtrl.getInvoices);
router.patch('/invoices/:id/status', billingCtrl.updateInvoiceStatus);

// ==========================================
// Payments
// ==========================================
router.get('/payments', paymentCtrl.getPayments);
router.post('/payments', paymentCtrl.recordPayment);

// ==========================================
// Discounts (Page 4 Spec: Only admin can create)
// ==========================================
router.get('/discounts', discountCtrl.getDiscounts);
router.post('/discounts', discountCtrl.createDiscount);
router.post('/discounts/validate', discountCtrl.validateCoupon);

module.exports = router;
