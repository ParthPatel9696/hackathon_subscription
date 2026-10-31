const express = require('express');
const router = express.Router();

const authCtrl = require('../controllers/authController');
const subscriptionCtrl = require('../controllers/subscriptionController');
const billingCtrl = require('../controllers/billingController');
const paymentCtrl = require('../controllers/paymentController');
const dashboardCtrl = require('../controllers/dashboardController');
const discountCtrl = require('../controllers/discountController');
const seedCtrl = require('../controllers/seedController');
const customerCtrl = require('../controllers/customerController');
const searchCtrl = require('../controllers/searchController');
const notificationCtrl = require('../controllers/notificationController');
const operationsCtrl = require('../controllers/operationsController');
const catalogCtrl = require('../controllers/catalogController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { validateBody, validateObjectIdParam } = require('../middleware/validate');
const { noteBody, tagsBody, planChangeBody } = require('../validation/operations');
const asyncHandler = require('../middleware/asyncHandler');

const loginLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const registerLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
const passwordResetLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

// Seeding is destructive, so it is available only as an authenticated POST.
router.post('/seed', verifyToken, requireRole('admin'), seedCtrl.seedDatabase);

// ==========================================
// Authentication Routes (Problem Statement Page 2)
// ==========================================
router.post('/auth/register', registerLimit, authCtrl.register);
router.post('/auth/login', loginLimit, authCtrl.login);
router.post('/auth/logout', verifyToken, authCtrl.logout);
router.get('/auth/me', verifyToken, authCtrl.getMe);
router.post('/auth/forgot-password', passwordResetLimit, authCtrl.forgotPassword);
router.post('/auth/reset-password', passwordResetLimit, authCtrl.resetPassword);

// Only the admin can add a new member of staff (Page 2 Spec)
router.post('/auth/add-staff', verifyToken, requireRole('admin'), authCtrl.addStaff);

// Customer directory and account summaries are restricted to internal users.
router.get('/customers/me', verifyToken, requireRole('customer'), customerCtrl.getMyCustomer);
router.patch('/customers/me', verifyToken, requireRole('customer'), customerCtrl.updateMyProfile);
router.delete('/customers/me', verifyToken, requireRole('customer'), customerCtrl.archiveMyAccount);
router.get('/customers', verifyToken, requireRole('admin', 'staff'), customerCtrl.listCustomers);
router.post('/customers', verifyToken, requireRole('admin'), customerCtrl.createCustomer);
router.patch('/customers/:id', verifyToken, requireRole('admin'), customerCtrl.updateCustomer);
router.delete('/customers/:id', verifyToken, requireRole('admin'), customerCtrl.archiveCustomer);
router.get('/customers/:id', verifyToken, requireRole('admin', 'staff'), customerCtrl.getCustomer);
router.get('/customers/:id/360', verifyToken, requireRole('admin', 'staff'), customerCtrl.getCustomer);
router.get('/customers/:id/activity', verifyToken, requireRole('admin', 'staff'), validateObjectIdParam('id'), asyncHandler(operationsCtrl.activity));
router.get('/customers/:id/notes', verifyToken, requireRole('admin', 'staff'), validateObjectIdParam('id'), asyncHandler(operationsCtrl.listNotes));
router.post('/customers/:id/notes', verifyToken, requireRole('admin', 'staff'), validateObjectIdParam('id'), validateBody(noteBody), asyncHandler(operationsCtrl.createNote));
router.patch('/customers/:id/notes/:noteId', verifyToken, requireRole('admin', 'staff'), validateObjectIdParam('id', 'noteId'), validateBody(noteBody), asyncHandler(operationsCtrl.updateNote));
router.delete('/customers/:id/notes/:noteId', verifyToken, requireRole('admin', 'staff'), validateObjectIdParam('id', 'noteId'), asyncHandler(operationsCtrl.deleteNote));
router.patch('/customers/:id/tags', verifyToken, requireRole('admin'), validateObjectIdParam('id'), validateBody(tagsBody), asyncHandler(operationsCtrl.updateTags));
router.get('/search', verifyToken, searchCtrl.search);
router.get('/notifications', verifyToken, notificationCtrl.listNotifications);

// ==========================================
// Public / Semi-Public Catalogs
// ==========================================
router.get('/products', verifyToken, catalogCtrl.listProducts);
router.post('/products', verifyToken, requireRole('admin'), catalogCtrl.createProduct);
router.patch('/products/:id', verifyToken, requireRole('admin'), catalogCtrl.updateProduct);
router.get('/plans', verifyToken, catalogCtrl.listPlans);
router.post('/plans', verifyToken, requireRole('admin'), catalogCtrl.createPlan);
router.patch('/plans/:id', verifyToken, requireRole('admin'), catalogCtrl.updatePlan);

// ==========================================
// Dashboard Finance Metrics (< 2s)
// ==========================================
router.get('/dashboard/metrics', verifyToken, requireRole('admin', 'staff'), dashboardCtrl.getFinanceMetrics);
router.get('/billing/calendar', verifyToken, requireRole('admin', 'staff'), operationsCtrl.calendar);
router.get('/subscriptions/health', verifyToken, requireRole('admin', 'staff'), operationsCtrl.health);
router.get('/analytics/revenue/summary', verifyToken, requireRole('admin', 'staff'), operationsCtrl.revenue);

// ==========================================
// Subscriptions & Lifecycle State Machine
// ==========================================
router.get('/subscriptions', verifyToken, subscriptionCtrl.getSubscriptions);
router.get('/subscriptions/:id', verifyToken, subscriptionCtrl.getSubscriptionById);
router.post('/subscriptions', verifyToken, requireRole('admin', 'staff', 'customer'), subscriptionCtrl.createSubscription);
router.post('/subscriptions/:id/plan-change/preview', verifyToken, requireRole('admin', 'staff', 'customer'), validateObjectIdParam('id'), validateBody(planChangeBody), subscriptionCtrl.previewPlanChange);
router.post('/subscriptions/:id/plan-change', verifyToken, requireRole('admin', 'staff', 'customer'), validateObjectIdParam('id'), validateBody(planChangeBody), subscriptionCtrl.changePlan);
router.post('/subscriptions/transition', verifyToken, requireRole('admin', 'staff'), subscriptionCtrl.transitionState);

// ==========================================
// Billing & Invoices
// ==========================================
router.post('/billing/run-batch', verifyToken, requireRole('admin', 'staff'), billingCtrl.runRecurringBillingBatch);
router.get('/invoices', verifyToken, billingCtrl.getInvoices);
router.patch('/invoices/:id/status', verifyToken, requireRole('admin', 'staff'), billingCtrl.updateInvoiceStatus);

// ==========================================
// Payments
// ==========================================
router.get('/payments', verifyToken, paymentCtrl.getPayments);
router.post('/payments', verifyToken, requireRole('admin', 'staff'), paymentCtrl.recordPayment);

// ==========================================
// Discounts (Page 4 Spec: Only admin can create)
// ==========================================
router.get('/discounts', verifyToken, requireRole('admin', 'staff'), discountCtrl.getDiscounts);
router.post('/discounts', verifyToken, requireRole('admin'), discountCtrl.createDiscount);
router.patch('/discounts/:id/status', verifyToken, requireRole('admin'), discountCtrl.setDiscountStatus);
router.post('/discounts/validate', verifyToken, discountCtrl.validateCoupon);

module.exports = router;
