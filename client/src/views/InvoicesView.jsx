import React, { useState } from 'react';
import { 
  Receipt, 
  Bolt, 
  DollarSign, 
  CheckCircle, 
  AlertTriangle, 
  Download, 
  Search,
  Filter
} from 'lucide-react';

export default function InvoicesView({ 
  invoices = [], 
  onRunBillingBatch, 
  onRecordPayment,
  onDownloadPDF 
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInvoices = invoices.filter(inv => {
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.subscriptionNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Paid':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">PAID</span>;
      case 'Overdue':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">OVERDUE</span>;
      case 'Confirmed':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">CONFIRMED</span>;
      case 'Draft':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">DRAFT</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Recurring Billing & Invoices</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated cycle billing. Each invoice moves: Draft &rarr; Confirmed &rarr; Paid. Guaranteed no duplicate charges.
          </p>
        </div>

        <button
          onClick={onRunBillingBatch}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition self-start sm:self-auto"
        >
          <Bolt className="w-4 h-4" />
          <span>Run Recurring Billing Batch</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Status Filters */}
        <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {['ALL', 'Paid', 'Confirmed', 'Overdue', 'Draft'].map(st => (
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

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice #, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>

      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">Invoice #</th>
                <th className="p-3.5">Subscription Ref</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Invoice Date</th>
                <th className="p-3.5">Due Date</th>
                <th className="p-3.5">Subtotal</th>
                <th className="p-3.5">Tax</th>
                <th className="p-3.5">Total Amount</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400">
                    No invoices match your search. Click "Run Recurring Billing Batch" to generate invoices from active contracts.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv._id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="p-3.5 font-mono text-slate-500 font-bold">{inv.subscriptionNumber}</td>
                    <td className="p-3.5 font-semibold text-slate-800">{inv.customerName}</td>
                    <td className="p-3.5 text-slate-600">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="p-3.5 text-slate-600">{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td className="p-3.5 text-slate-600">${inv.subtotal.toFixed(2)}</td>
                    <td className="p-3.5 text-slate-600">${(inv.taxTotal || 0).toFixed(2)}</td>
                    <td className="p-3.5 font-black text-slate-900">${inv.grandTotal.toFixed(2)}</td>
                    <td className="p-3.5">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {inv.status !== 'Paid' ? (
                        <button
                          onClick={() => onRecordPayment(inv)}
                          className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-xs transition"
                        >
                          Record Payment
                        </button>
                      ) : (
                        <button
                          onClick={() => onDownloadPDF(inv.invoiceNumber)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold border border-slate-200 transition inline-flex items-center space-x-1"
                        >
                          <Download className="w-3.5 h-3.5 text-rose-500" />
                          <span>PDF</span>
                        </button>
                      )}
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
