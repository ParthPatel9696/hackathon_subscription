import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import FinanceDashboardView from './views/FinanceDashboardView';
import SubscriptionsView from './views/SubscriptionsView';
import InvoicesView from './views/InvoicesView';
import CustomerPortalView from './views/CustomerPortalView';
import DiscountsView from './views/DiscountsView';
import AuthView from './views/AuthView';
import PaymentModal from './components/PaymentModal';
import SubscriptionDetailModal from './components/SubscriptionDetailModal';
import NewQuotationModal from './components/NewQuotationModal';
import AddStaffModal from './components/AddStaffModal';
import { api } from './services/api';
import { useAuth } from './context/AuthContext';
import { CheckCircle2, AlertCircle, Info, RotateCw } from 'lucide-react';

export default function App() {
  const { user, role, isAuthenticated, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data states
  const [metrics, setMetrics] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [urgentOverdue, setUrgentOverdue] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  
  // Modals
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [loadingSeed, setLoadingSeed] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3500);
  };

  // Adjust active tab when role changes
  useEffect(() => {
    if (role === 'customer') {
      setActiveTab('portal');
    } else if (role === 'staff') {
      setActiveTab('subscriptions');
    } else if (role === 'admin') {
      setActiveTab('dashboard');
    }
  }, [role]);

  // Initial Data Fetching
  const loadAllData = async () => {
    try {
      const [dashRes, subsRes, invsRes, discRes] = await Promise.all([
        api.getDashboardMetrics(),
        api.getSubscriptions(),
        api.getInvoices(),
        api.getDiscounts()
      ]);

      if (dashRes.success) {
        setMetrics(dashRes.metrics);
        setPerformance(dashRes.performance);
        setUrgentOverdue(dashRes.urgentOverdueList || []);
      }
      if (subsRes.success) setSubscriptions(subsRes.data || []);
      if (invsRes.success) setInvoices(invsRes.data || []);
      if (discRes.success) setDiscounts(discRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadAllData();
    }
  }, [isAuthenticated]);

  // State Machine transition handler
  const handleTransitionSubscription = async (id, targetStatus, reason) => {
    const res = await api.transitionSubscription(id, targetStatus, reason);
    if (res.success) {
      showToast(res.message);
      setSelectedSubscription(res.data);
      loadAllData();
    }
  };

  // Fast quote confirmation from table
  const handleFastConfirmQuote = async (id) => {
    try {
      const res = await api.transitionSubscription(id, 'Confirmed', 'Sales rep approved quote');
      if (res.success) {
        showToast('Quotation converted to Confirmed subscription!', 'success');
        loadAllData();
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to confirm quote', 'error');
    }
  };

  // Payment Recording
  const handlePaymentSuccess = async (payload) => {
    const res = await api.recordPayment(payload);
    if (res.success) {
      showToast(res.message, 'success');
      loadAllData();
    }
  };

  // Recurring Billing Batch Execution
  const handleRunBillingBatch = async () => {
    try {
      const res = await api.runBillingBatch(true);
      if (res.success) {
        showToast(`Billing Batch Finished: ${res.generatedCount} invoices generated automatically!`, 'success');
        loadAllData();
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Billing run failed', 'error');
    }
  };

  // Invoice Now for a specific subscription
  const handleInvoiceNow = async (sub) => {
    try {
      const res = await api.runBillingBatch(true);
      if (res.success) {
        showToast(`Generated invoice for ${sub.subscriptionNumber}!`, 'success');
        loadAllData();
        setSelectedSubscription(null);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to generate invoice', 'error');
    }
  };

  // Seed Data Handler
  const handleSeedData = async () => {
    setLoadingSeed(true);
    try {
      const res = await api.seedDatabase();
      if (res.success) {
        showToast('Database reset with fresh test scenarios!', 'success');
        loadAllData();
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Seeding failed', 'error');
    } finally {
      setLoadingSeed(false);
    }
  };

  // PDF download mock
  const handleDownloadPDF = (invNumber) => {
    showToast(`Downloading official invoice receipt: ${invNumber}.pdf`, 'info');
  };

  // Auth Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <RotateCw className="w-8 h-8 animate-spin mx-auto text-brand-500" />
          <p className="text-xs text-slate-400">Loading Brightloop Workspace...</p>
        </div>
      </div>
    );
  }

  // Not Logged In -> Show Auth View (Login / Register / Forgot Password)
  if (!isAuthenticated) {
    return (
      <>
        <AuthView onShowToast={showToast} />
        {toast.show && (
          <div className="fixed bottom-6 right-6 px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2.5 text-xs font-bold z-50 bg-slate-900 text-white border border-slate-700 animate-in slide-in-from-bottom-5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toast.message}</span>
          </div>
        )}
      </>
    );
  }

  // Logged In -> Show Full Workspace
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      
      {/* Navigation & Header */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSeedData={handleSeedData}
        loadingSeed={loadingSeed}
        onOpenAddStaff={() => setShowAddStaffModal(true)}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {activeTab === 'dashboard' && role === 'admin' && (
          <FinanceDashboardView
            metrics={metrics}
            performance={performance}
            urgentOverdueList={urgentOverdue}
            onRunBilling={handleRunBillingBatch}
            onOpenNewQuote={() => setShowNewQuoteModal(true)}
            onRecordPayment={(inv) => setSelectedInvoiceForPayment(inv)}
            onViewSubscription={(sub) => setSelectedSubscription(sub)}
          />
        )}

        {activeTab === 'subscriptions' && role !== 'customer' && (
          <SubscriptionsView
            subscriptions={subscriptions}
            onSelectSubscription={(sub) => setSelectedSubscription(sub)}
            onOpenNewQuote={() => setShowNewQuoteModal(true)}
            onFastConfirm={handleFastConfirmQuote}
          />
        )}

        {activeTab === 'invoices' && role !== 'customer' && (
          <InvoicesView
            invoices={invoices}
            onRunBillingBatch={handleRunBillingBatch}
            onRecordPayment={(inv) => setSelectedInvoiceForPayment(inv)}
            onDownloadPDF={handleDownloadPDF}
          />
        )}

        {activeTab === 'discounts' && role === 'admin' && (
          <DiscountsView
            discounts={discounts}
            onRefresh={loadAllData}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'portal' && (
          <CustomerPortalView
            onDownloadPDF={handleDownloadPDF}
            onShowToast={showToast}
          />
        )}

      </main>

      {/* Modals */}
      {selectedSubscription && (
        <SubscriptionDetailModal
          subscription={selectedSubscription}
          onClose={() => setSelectedSubscription(null)}
          onTransition={handleTransitionSubscription}
          onInvoiceNow={handleInvoiceNow}
        />
      )}

      {selectedInvoiceForPayment && (
        <PaymentModal
          invoice={selectedInvoiceForPayment}
          onClose={() => setSelectedInvoiceForPayment(null)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      {showNewQuoteModal && (
        <NewQuotationModal
          onClose={() => setShowNewQuoteModal(false)}
          onCreated={(newSub) => {
            showToast(`Quotation ${newSub.subscriptionNumber} created successfully!`);
            loadAllData();
          }}
        />
      )}

      {showAddStaffModal && (
        <AddStaffModal
          onClose={() => setShowAddStaffModal(false)}
          onStaffAdded={(msg) => {
            showToast(msg, 'success');
          }}
        />
      )}

      {/* Toast Alert */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2.5 text-xs font-bold z-50 animate-in slide-in-from-bottom-5 duration-200 ${
          toast.type === 'error'
            ? 'bg-rose-900 text-rose-100 border border-rose-700'
            : toast.type === 'info'
            ? 'bg-blue-900 text-blue-100 border border-blue-700'
            : 'bg-slate-900 text-white border border-slate-700'
        }`}>
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : toast.type === 'info' ? (
            <Info className="w-4 h-4 text-blue-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  );
}
