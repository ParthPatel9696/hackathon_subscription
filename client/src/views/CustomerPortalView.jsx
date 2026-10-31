import React, { useState } from 'react';
import { 
  CheckCircle2, 
  CreditCard, 
  Download, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  FileText,
  Clock
} from 'lucide-react';

export default function CustomerPortalView({ onDownloadPDF, onShowToast }) {
  const [analyticsActive, setAnalyticsActive] = useState(true);
  const [prioritySupportActive, setPrioritySupportActive] = useState(false);

  const basePrice = 89;
  const analyticsPrice = analyticsActive ? 15 : 0;
  const supportPrice = prioritySupportActive ? 25 : 0;
  const currentTotal = basePrice + analyticsPrice + supportPrice;

  const handleToggleAddon = (name, active, price) => {
    if (active) {
      onShowToast(`Activated ${name} (+$${price}/mo). Will be included in next invoice.`, 'success');
    } else {
      onShowToast(`Deactivated ${name}. Recurring amount adjusted.`, 'info');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Customer Header Banner */}
      <div className="bg-gradient-to-r from-brand-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 text-brand-200 text-xs font-bold mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Customer Self-Service Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Welcome back, Acme Retail Corp
            </h1>
            <p className="text-xs text-brand-100 mt-1 max-w-xl">
              Manage your active subscription, customize optional add-ons in real time, and download official receipts without contacting support.
            </p>
          </div>

          <div className="text-right sm:border-l sm:border-white/10 sm:pl-6">
            <span className="text-[11px] text-brand-200 uppercase font-bold tracking-wider block">Customer ID</span>
            <span className="font-mono font-bold text-white text-sm">CUST-8831</span>
            <span className="text-xs text-slate-400 block mt-1">finance@acmeretail.com</span>
          </div>
        </div>
      </div>

      {/* Active Plan Detail Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                ACTIVE SUBSCRIPTION
              </span>
              <span className="text-xs text-slate-400 font-medium">Autorenews Nov 15, 2024</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-1.5">Business Suite Professional</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Includes Core ERP, POS Sync, and 5 team user licenses.
            </p>
          </div>

          <div className="text-left md:text-right">
            <div className="text-3xl font-black text-brand-700">
              ${currentTotal}
              <span className="text-xs font-semibold text-slate-400">/month</span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center md:justify-end gap-1 mt-1">
              <CreditCard className="w-3 h-3 text-slate-400" />
              MasterCard ending in &bull;&bull;&bull;&bull; 4242
            </p>
          </div>
        </div>

        {/* Add-ons Toggles (Problem Statement Page 1 Feature) */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Modular Add-ons (Switch On / Off Anytime)
            </h3>
            <span className="text-[11px] text-brand-600 font-semibold bg-brand-50 px-2 py-0.5 rounded">
              Page 1 Spec Feature
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Addon 1: Advanced Analytics */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-brand-300 transition">
              <div>
                <span className="font-bold text-slate-900 text-sm block">Advanced Financial Analytics</span>
                <span className="text-xs text-slate-500 block">Real-time revenue forecast, MRR cohorts, and P&L drilldowns</span>
                <span className="text-xs font-bold text-brand-700 block mt-1">+$15.00 / month</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input 
                  type="checkbox" 
                  checked={analyticsActive}
                  onChange={(e) => {
                    setAnalyticsActive(e.target.checked);
                    handleToggleAddon('Advanced Financial Analytics', e.target.checked, 15);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            {/* Addon 2: Priority Support */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-brand-300 transition">
              <div>
                <span className="font-bold text-slate-900 text-sm block">24/7 Priority Support SLA</span>
                <span className="text-xs text-slate-500 block">Dedicated enterprise engineer with 1-hour response guarantee</span>
                <span className="text-xs font-bold text-brand-700 block mt-1">+$25.00 / month</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input 
                  type="checkbox" 
                  checked={prioritySupportActive}
                  onChange={(e) => {
                    setPrioritySupportActive(e.target.checked);
                    handleToggleAddon('24/7 Priority Support SLA', e.target.checked, 25);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

          </div>
        </div>

      </div>

      {/* Customer Invoices & Receipts History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Billing History & Receipts
          </h3>
          <span className="text-xs text-slate-400">Official tax invoices available for download</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">Invoice #</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Plan / Description</th>
                <th className="p-3.5">Amount Paid</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              <tr className="hover:bg-slate-50/80 transition">
                <td className="p-3.5 font-mono font-bold text-slate-900">INV-2024-001</td>
                <td className="p-3.5 text-slate-600">Oct 15, 2024</td>
                <td className="p-3.5 font-semibold text-slate-800">Business Suite Pro + Analytics</td>
                <td className="p-3.5 font-black text-slate-900">$104.00</td>
                <td className="p-3.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">PAID</span>
                </td>
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => onDownloadPDF('INV-2024-001')}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold border border-slate-200 transition inline-flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5 text-rose-500" />
                    <span>Download PDF</span>
                  </button>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/80 transition">
                <td className="p-3.5 font-mono font-bold text-slate-900">INV-2024-098</td>
                <td className="p-3.5 text-slate-600">Sep 15, 2024</td>
                <td className="p-3.5 font-semibold text-slate-800">Business Suite Pro</td>
                <td className="p-3.5 font-black text-slate-900">$89.00</td>
                <td className="p-3.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">PAID</span>
                </td>
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => onDownloadPDF('INV-2024-098')}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold border border-slate-200 transition inline-flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5 text-rose-500" />
                    <span>Download PDF</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
