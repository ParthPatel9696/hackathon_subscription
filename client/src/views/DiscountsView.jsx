import React, { useState } from 'react';
import { 
  Tag, 
  Plus, 
  Percent, 
  DollarSign, 
  Clock, 
  Calendar, 
  Users, 
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function DiscountsView({ discounts = [], onRefresh, onShowToast }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [value, setValue] = useState(10);
  const [minPurchaseAmount, setMinPurchaseAmount] = useState(500);
  const [minQuantity, setMinQuantity] = useState(1);
  const [usageLimit, setUsageLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await api.createDiscount({
        code: code.toUpperCase(),
        name,
        discountType,
        value: parseFloat(value),
        minPurchaseAmount: parseFloat(minPurchaseAmount),
        minQuantity: parseInt(minQuantity),
        usageLimit: parseInt(usageLimit)
      });
      if (res.success) {
        onShowToast(`Created discount rule: ${code.toUpperCase()}`, 'success');
        setShowCreateModal(false);
        setCode('');
        setName('');
        onRefresh();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to create discount');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Discounts & Promotion Rules</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Admin Only Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure percentage or fixed vouchers with automated expiration, usage counters, and minimum thresholds.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Discount Rule</span>
        </button>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {discounts.map(d => {
          const isExpired = !d.isActive || (d.endDate && new Date(d.endDate) < new Date()) || d.timesUsed >= d.usageLimit;
          const usagePercent = Math.min(100, Math.round((d.timesUsed / (d.usageLimit || 1)) * 100));

          return (
            <div 
              key={d._id} 
              className={`bg-white p-5 rounded-2xl border shadow-xs relative overflow-hidden transition ${
                isExpired ? 'border-slate-200 opacity-60' : 'border-slate-200 hover:border-brand-300'
              }`}
            >
              <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full flex items-start justify-end p-2.5 ${
                d.discountType === 'percentage' ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {d.discountType === 'percentage' ? <Percent className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
              </div>

              <div className="font-mono font-black text-xs text-brand-700 tracking-wider">
                {d.code}
              </div>

              <h3 className="text-base font-black text-slate-900 mt-1">
                {d.name}
              </h3>

              <div className="mt-2 text-2xl font-black text-slate-900">
                {d.discountType === 'percentage' ? `${d.value}% OFF` : `$${d.value.toFixed(2)} OFF`}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                
                {/* Usage Bar */}
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span>Usage Limit:</span>
                    <span className="font-mono">{d.timesUsed} / {d.usageLimit} used</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full ${usagePercent >= 100 ? 'bg-rose-500' : 'bg-brand-600'}`} 
                      style={{ width: `${usagePercent}%` }} 
                    />
                  </div>
                </div>

                <div className="flex justify-between text-slate-500">
                  <span>Min Purchase:</span>
                  <strong className="text-slate-800">${d.minPurchaseAmount || 0}</strong>
                </div>

                <div className="flex justify-between text-slate-500">
                  <span>Valid Until:</span>
                  <strong className="text-slate-800">{new Date(d.endDate).toLocaleDateString()}</strong>
                </div>

                <div className="flex justify-between pt-1">
                  <span>Status:</span>
                  {isExpired ? (
                    <span className="font-bold text-rose-600">Expired / Limit Reached</span>
                  ) : (
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Active on Next Invoice
                    </span>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create New Discount Rule</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Coupon Code (Uppercase) *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. VIPCLIENT20"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Rule Name / Description *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. 20% Off Enterprise Renewal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Type</label>
                  <select 
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Dollar ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Value *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Min Purchase ($)</label>
                  <input 
                    type="number" 
                    value={minPurchaseAmount}
                    onChange={(e) => setMinPurchaseAmount(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Redemptions</label>
                  <input 
                    type="number" 
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-xs"
                >
                  {loading ? 'Creating...' : 'Create Rule'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
