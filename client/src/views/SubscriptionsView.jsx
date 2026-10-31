import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  ArrowRightCircle, 
  Clock, 
  AlertCircle 
} from 'lucide-react';

export default function SubscriptionsView({ 
  subscriptions = [], 
  onSelectSubscription, 
  onOpenNewQuote,
  onFastConfirm 
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSubs = subscriptions.filter(sub => {
    const matchesStatus = statusFilter === 'ALL' || sub.status === statusFilter;
    const matchesSearch = 
      sub.subscriptionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.planName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Active':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Active</span>;
      case 'Quotation':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Quotation</span>;
      case 'Confirmed':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">Confirmed</span>;
      case 'Draft':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">Draft</span>;
      case 'Paused':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Paused</span>;
      case 'Closed':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Closed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Subscriptions & Quotations</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage contract pipeline: Draft &rarr; Quotation &rarr; Confirmed &rarr; Active &rarr; Closed.
          </p>
        </div>

        <button
          onClick={onOpenNewQuote}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Subscription Quote</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Status Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {['ALL', 'Active', 'Quotation', 'Confirmed', 'Draft', 'Paused', 'Closed'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search subscription #, client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>

      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">Subscription #</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Plan</th>
                <th className="p-3.5">Billing Cadence</th>
                <th className="p-3.5">Next Due</th>
                <th className="p-3.5">Recurring Amount</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    No subscriptions match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredSubs.map(sub => (
                  <tr key={sub._id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-slate-900">{sub.subscriptionNumber}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{sub.customerName}</div>
                      <div className="text-[11px] text-slate-400">{sub.customerEmail}</div>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800">{sub.planName}</td>
                    <td className="p-3.5 capitalize text-slate-600">{sub.billingFrequency}</td>
                    <td className="p-3.5 text-slate-700">
                      {sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3.5 font-black text-slate-900">
                      ${sub.recurringTotal.toFixed(2)}
                    </td>
                    <td className="p-3.5">
                      {getStatusBadge(sub.status)}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {sub.status === 'Quotation' && (
                        <button
                          onClick={() => onFastConfirm(sub._id)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold border border-emerald-200 transition"
                        >
                          Confirm Quote
                        </button>
                      )}
                      <button
                        onClick={() => onSelectSubscription(sub)}
                        className="px-3 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg font-bold border border-brand-200 transition inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Lines</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
