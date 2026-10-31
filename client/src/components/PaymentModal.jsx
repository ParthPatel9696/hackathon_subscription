import React, { useState } from 'react';
import { X, DollarSign, Calendar, CreditCard, FileCheck } from 'lucide-react';

export default function PaymentModal({ invoice, onClose, onPaymentSuccess }) {
  const [amount, setAmount] = useState(invoice ? invoice.grandTotal - (invoice.paidAmount || 0) : 0);
  const [method, setMethod] = useState('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNote, setReferenceNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!invoice) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await onPaymentSuccess({
        invoiceId: invoice._id,
        amount: parseFloat(amount),
        method,
        paymentDate,
        referenceNote
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Payment recording failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Record Payment</h3>
              <p className="text-xs text-slate-500">Reconcile against invoice #{invoice.invoiceNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Customer</label>
            <input 
              type="text" 
              readOnly 
              value={invoice.customerName} 
              className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 font-medium text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Total Due</label>
              <div className="font-mono font-bold text-sm text-slate-900 p-2 bg-slate-50 rounded-lg border border-slate-200">
                ${invoice.grandTotal.toFixed(2)}
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount to Pay ($) *</label>
              <input 
                type="number" 
                step="0.01" 
                required 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold text-sm text-emerald-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Payment Method *</label>
            <select 
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:ring-2 focus:ring-brand-500"
            >
              <option value="Bank Transfer">Bank Wire / Electronic Transfer</option>
              <option value="Credit Card">Corporate Credit / Debit Card</option>
              <option value="UPI / Online">Instant UPI / Gateway</option>
              <option value="Check">Company Check</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
            <input 
              type="date" 
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Transaction Ref / Note</label>
            <input 
              type="text" 
              placeholder="e.g. Wire reference TXN-9821-NY"
              value={referenceNote}
              onChange={(e) => setReferenceNote(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs flex items-center space-x-1.5 transition"
            >
              <FileCheck className="w-4 h-4" />
              <span>{loading ? 'Reconciling...' : 'Confirm Payment'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
