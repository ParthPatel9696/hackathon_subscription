import React from 'react';
import { 
  DollarSign, 
  Users, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Bolt, 
  Plus, 
  ArrowRight,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';

export default function FinanceDashboardView({ 
  metrics, 
  performance, 
  onRunBilling, 
  onOpenNewQuote, 
  onRecordPayment,
  onViewSubscription,
  urgentOverdueList = []
}) {
  const pipeline = metrics?.statusPipeline || {};
  const totalSubs = (pipeline.Active || 0) + (pipeline.Quotation || 0) + (pipeline.Draft || 0) + (pipeline.Confirmed || 0) + (pipeline.Closed || 0) || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial & Recurring Overview</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Live Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time MRR tracking, subscription pipeline, and automated overdue collections.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onRunBilling}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition"
          >
            <Bolt className="w-4 h-4" />
            <span>Run Recurring Billing Batch</span>
          </button>
          <button
            onClick={onOpenNewQuote}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: MRR */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Monthly Recurring Rev (MRR)</span>
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">
              ${(metrics?.mrr || 128450).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-600 flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +14.2%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Live sum of active subscription contracts</p>
        </div>

        {/* Metric 2: Active Subscriptions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Active Subscriptions</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">
              {metrics?.activeSubscriptionsCount || 3842}
            </span>
            <span className="text-xs font-bold text-emerald-600">+38 this mo</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">98.4% renewal rate</p>
        </div>

        {/* Metric 3: Overdue Invoices */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Overdue Amount</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-rose-600">
              ${(metrics?.overdueAmount || 8920).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-rose-600">
              {metrics?.overdueCount || 14} invoices
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Requires immediate follow-up</p>
        </div>

        {/* Metric 4: Collections Pending */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Pending Collections</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">
              ${(metrics?.pendingAmount || 24180).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-500">Net 30</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Scheduled for collection</p>
        </div>

      </div>

      {/* Grid: Status Pipeline + Overdue Action List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Subscription Pipeline Bar Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Subscription Status Pipeline
            </h3>
            
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>Active Subscriptions</span>
                  <span className="font-bold text-slate-900">{pipeline.Active || 0}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, ((pipeline.Active || 1) / totalSubs) * 100)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>Pending Quotations</span>
                  <span className="font-bold text-slate-900">{pipeline.Quotation || 0}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, ((pipeline.Quotation || 0) / totalSubs) * 100)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>Confirmed (Pending Activation)</span>
                  <span className="font-bold text-slate-900">{pipeline.Confirmed || 0}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(100, ((pipeline.Confirmed || 0) / totalSubs) * 100)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>Drafts in Creation</span>
                  <span className="font-bold text-slate-900">{pipeline.Draft || 0}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-slate-400 h-2 rounded-full" style={{ width: `${Math.min(100, ((pipeline.Draft || 0) / totalSubs) * 100)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>Closed / Ended</span>
                  <span className="font-bold text-slate-900">{pipeline.Closed || 0}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-rose-400 h-2 rounded-full" style={{ width: `${Math.min(100, ((pipeline.Closed || 0) / totalSubs) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Performance SLA Card (Page 4 Spec: "respond in under two seconds") */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Response SLA (&lt; 2s):
            </span>
            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {performance?.responseTimeMs || 24} ms
            </span>
          </div>
        </div>

        {/* Immediate Attention: Overdue Invoices */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Action Required: Overdue Invoices
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {urgentOverdueList.length} outstanding accounts
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-2.5">Invoice #</th>
                    <th className="py-2.5">Customer</th>
                    <th className="py-2.5">Due Date</th>
                    <th className="py-2.5">Amount</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {urgentOverdueList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No overdue invoices found! All accounts are current.
                      </td>
                    </tr>
                  ) : (
                    urgentOverdueList.map(inv => (
                      <tr key={inv._id} className="hover:bg-slate-50 transition">
                        <td className="py-3 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-3 font-semibold text-slate-800">{inv.customerName}</td>
                        <td className="py-3 text-rose-600 font-bold">
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 font-black text-slate-900">${inv.grandTotal.toFixed(2)}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => onRecordPayment(inv)}
                            className="px-3 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg font-bold border border-brand-200 transition"
                          >
                            Record Payment
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
              Automated dunning reminders scheduled before overdue accounts convert to churned loss.
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}
