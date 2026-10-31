import axios from 'axios';

const API_BASE = '/api';

// Attach JWT token from localStorage to outgoing requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('brightloop_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Authentication (Problem Statement Page 2)
  login: async (email, password) => {
    const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
    return res.data;
  },
  register: async (payload) => {
    const res = await axios.post(`${API_BASE}/auth/register`, payload);
    return res.data;
  },
  getMe: async () => {
    const res = await axios.get(`${API_BASE}/auth/me`);
    return res.data;
  },
  forgotPassword: async (email) => {
    const res = await axios.post(`${API_BASE}/auth/forgot-password`, { email });
    return res.data;
  },
  addStaff: async (payload) => {
    const res = await axios.post(`${API_BASE}/auth/add-staff`, payload);
    return res.data;
  },

  // Dashboard & Metrics
  getDashboardMetrics: async () => {
    const res = await axios.get(`${API_BASE}/dashboard/metrics`);
    return res.data;
  },

  // Subscriptions & Lifecycle
  getSubscriptions: async (params = {}) => {
    const res = await axios.get(`${API_BASE}/subscriptions`, { params });
    return res.data;
  },
  getSubscriptionById: async (id) => {
    const res = await axios.get(`${API_BASE}/subscriptions/${id}`);
    return res.data;
  },
  transitionSubscription: async (id, targetStatus, reason = '') => {
    const res = await axios.post(`${API_BASE}/subscriptions/transition`, { id, targetStatus, reason });
    return res.data;
  },
  createSubscription: async (payload) => {
    const res = await axios.post(`${API_BASE}/subscriptions`, payload);
    return res.data;
  },

  // Billing & Invoices
  runBillingBatch: async (forceAllActive = false) => {
    const res = await axios.post(`${API_BASE}/billing/run-batch`, { forceAllActive });
    return res.data;
  },
  getInvoices: async (params = {}) => {
    const res = await axios.get(`${API_BASE}/invoices`, { params });
    return res.data;
  },

  // Payments
  recordPayment: async (payload) => {
    const res = await axios.post(`${API_BASE}/payments`, payload);
    return res.data;
  },

  // Discounts
  getDiscounts: async () => {
    const res = await axios.get(`${API_BASE}/discounts`);
    return res.data;
  },
  createDiscount: async (payload) => {
    const res = await axios.post(`${API_BASE}/discounts`, payload);
    return res.data;
  },
  validateCoupon: async (payload) => {
    const res = await axios.post(`${API_BASE}/discounts/validate`, payload);
    return res.data;
  },

  // Products & Plans
  getProducts: async () => {
    const res = await axios.get(`${API_BASE}/products`);
    return res.data;
  },
  getPlans: async () => {
    const res = await axios.get(`${API_BASE}/plans`);
    return res.data;
  },

  // Seed
  seedDatabase: async () => {
    const res = await axios.post(`${API_BASE}/seed`);
    return res.data;
  }
};
