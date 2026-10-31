import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  Clock, 
  Pause, 
  Play, 
  XCircle, 
  Receipt, 
  ShieldCheck, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function SubscriptionDetailModal({ 
  subscription, 
  onClose, 
  onTransition, 
  onInvoiceNow 
}) {
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!subscription) return null;

  const states = ['Draft', 'Quotation', 'Confirmed', 'Active', 'Closed'];
  const currentIndex = states.indexOf(subscription.status === 'Paused' ? 'Active' : subscription.status);

  const handleStateChange = async (targetStatus, reason = '') => {
    setTransitionLoading(true);
    setErrorMsg('');
    try {
      await onTransition(subscription._id, targetStatus, reason);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Transition failed');
    } finally {
      setTransitionLoading(false);
    }
  };

  const statusColors = {
    Draft: 'bg-slate-100 text-slate-700 border-slate-300',
    Quotation: 'bg-blue-100 text-blue-800 border-blue-200',
    Confirmed: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    Active: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Paused: 'bg-amber-100 text-amber-800 border-amber-300',
    Closed: 'bg-rose-100 text-rose-800 border-rose-200',
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header & Status Stepper */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-mono font-black text-slate-900">
                {subscription.subscriptionNumber}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColors[subscription.status] || 'bg-slate-100'}`}>
                {subscription.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer: <strong className="text-slate-800">{subscription.customerName}</strong> ({subscription.customerEmail})
            </p>
          </div>

          <button onClick={onClose} className="self-end md:self-auto text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* State Machine Pipeline Stepper */}
        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            State Machine Lifecycle Progress
          </div>
          <div className="flex items-center justify-between relative">
            {states.map((st, idx) => {
              const isPast = idx < currentIndex;
              const isCurrent = subscription.status === st;
              const isPaused = subscription.status === 'Paused' && st === 'Active';

              return (
                <React.Fragment key={st}>
                  <div className="flex flex-col items-center z-10">
                    <div 
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                        isCurrent
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-sm'
                          : isPaused
                          ? 'bg-amber-500 text-white ring-4 ring-amber-100'
                          : isPast
                          ? 'bg-brand-600 text-white'
                          : 'bg-white border-2 border-slate-300 text-slate-400'
                      }`}
                    >
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`text-[11px] font-bold mt-1 ${isCurrent ? 'text-emerald-700' : isPast ? 'text-brand-700' : 'text-slate-400'}`}>
                      {st} {isPaused && '(Paused)'}
                    </span>
                  </div>
                  {idx < states.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${idx < currentIndex ? 'bg-brand-500' : 'bg-slate-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
            {errorMsg}
          </div>
        )}

        {/* Contract Metadata Grid */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block font-medium">Plan</span>
            <span className="font-bold text-slate-900 mt-0.5 block">{subscription.planName}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block font-medium">Billing Cadence</span>
            <span className="font-bold text-slate-900 mt-0.5 block capitalize">{subscription.billingFrequency}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block font-medium">Next Due Date</span>
            <span className="font-bold text-emerald-600 mt-0.5 block">
              {subscription.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block font-medium">Payment Terms</span>
            <span className="font-bold text-slate-900 mt-0.5 block">{subscription.paymentTerms}</span>
          </div>
        </div>

        {/* Product Lines & Variant Table */}
        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Contract Product Lines & Variants
          </h4>
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Variant / Markup</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Tax (10%)</th>
                  <th className="p-3 text-right">Discount</th>
                  <th className="p-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {(subscription.lines || []).map((line, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-bold text-slate-900">{line.productName}</td>
                    <td className="p-3">
                      {line.variantName ? (
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-200">
                          {line.variantName}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-800">{line.quantity}</td>
                    <td className="p-3 text-right">${line.unitPrice.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-600">${(line.taxAmount || 0).toFixed(2)}</td>
                    <td className="p-3 text-right text-emerald-600 font-semibold">
                      {line.discountAmount ? `-$${line.discountAmount.toFixed(2)}` : '—'}
                    </td>
                    <td className="p-3 text-right font-extrabold text-slate-900">${line.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-xs text-slate-800">
                <tr>
                  <td colSpan={6} className="p-3 text-right">Subtotal:</td>
                  <td className="p-3 text-right">${subscription.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={6} className="p-3 text-right">Automatic Taxes:</td>
                  <td className="p-3 text-right">${subscription.taxTotal.toFixed(2)}</td>
                </tr>
                {subscription.discountTotal > 0 && (
                  <tr>
                    <td colSpan={6} className="p-3 text-right text-emerald-600">Discounts Applied:</td>
                    <td className="p-3 text-right text-emerald-600">-${subscription.discountTotal.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="border-t border-slate-200 text-sm">
                  <td colSpan={6} className="p-3 text-right text-brand-700 font-black">
                    Recurring Total / Cycle:
                  </td>
                  <td className="p-3 text-right text-brand-700 font-black">
                    ${subscription.recurringTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Action Controls for State Machine Transitions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {subscription.notes && <span>Note: {subscription.notes}</span>}
          </div>

          <div className="flex items-center space-x-2">
            {/* If Draft -> Can Send Quotation */}
            {subscription.status === 'Draft' && (
              <button
                disabled={transitionLoading}
                onClick={() => handleStateChange('Quotation', 'Quotation sent to customer')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                Send Quotation
              </button>
            )}

            {/* If Quotation -> Can Confirm */}
            {subscription.status === 'Quotation' && (
              <button
                disabled={transitionLoading}
                onClick={() => handleStateChange('Confirmed', 'Customer approved quotation')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                Confirm Quote
              </button>
            )}

            {/* If Confirmed -> Can Activate */}
            {subscription.status === 'Confirmed' && (
              <button
                disabled={transitionLoading}
                onClick={() => handleStateChange('Active', 'Subscription activated')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                Activate Subscription
              </button>
            )}

            {/* If Active -> Can Pause, Invoice, or Close */}
            {subscription.status === 'Active' && (
              <>
                <button
                  disabled={transitionLoading}
                  onClick={() => handleStateChange('Paused', 'Paused upon request')}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold border border-amber-200 transition"
                >
                  <Pause className="w-3.5 h-3.5 inline mr-1" /> Pause Plan
                </button>
                <button
                  onClick={() => onInvoiceNow(subscription)}
                  className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  <Receipt className="w-3.5 h-3.5 inline mr-1" /> Invoice Now
                </button>
                <button
                  disabled={transitionLoading}
                  onClick={() => handleStateChange('Closed', 'Contract ended')}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 transition"
                >
                  <XCircle className="w-3.5 h-3.5 inline mr-1" /> Close Contract
                </button>
              </>
            )}

            {/* If Paused -> Can Resume or Close */}
            {subscription.status === 'Paused' && (
              <>
                <button
                  disabled={transitionLoading}
                  onClick={() => handleStateChange('Active', 'Resumed plan')}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  <Play className="w-3.5 h-3.5 inline mr-1" /> Resume Plan
                </button>
                <button
                  disabled={transitionLoading}
                  onClick={() => handleStateChange('Closed', 'Closed while paused')}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 transition"
                >
                  <XCircle className="w-3.5 h-3.5 inline mr-1" /> Close Contract
                </button>
              </>
            )}

            {/* If Closed -> Reopen */}
            {subscription.status === 'Closed' && (
              <button
                disabled={transitionLoading}
                onClick={() => handleStateChange('Draft', 'Reopened as draft contract')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                Reopen as Draft
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
