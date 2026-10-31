import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle, Calculator } from 'lucide-react';
import { api } from '../services/api';

export default function NewQuotationModal({ onClose, onCreated }) {
  const [customerName, setCustomerName] = useState('Global Trade Ventures');
  const [customerEmail, setCustomerEmail] = useState('billing@globaltrade.io');
  const [billingFrequency, setBillingFrequency] = useState('monthly');
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [products, setProducts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [isOdooBrand, setIsOdooBrand] = useState(true);
  const [userSeats, setUserSeats] = useState(5);
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function loadCatalog() {
      try {
        const [prodRes, planRes] = await Promise.all([
          api.getProducts(),
          api.getPlans()
        ]);
        setProducts(prodRes.data || []);
        setPlans(planRes.data || []);
        if (planRes.data?.length > 0) {
          setSelectedPlanId(planRes.data[0]._id);
        }
      } catch (err) {
        console.error('Failed to load catalog:', err);
      }
    }
    loadCatalog();
  }, []);

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    try {
      const res = await api.validateCoupon({
        code: couponCode,
        cartAmount: 1560 + (userSeats * 25),
        quantity: userSeats
      });
      if (res.success) {
        setAppliedDiscount(res.data.calculatedDiscount);
        setErrorMsg('');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Invalid coupon');
      setAppliedDiscount(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const selectedPlan = plans.find(p => p._id === selectedPlanId) || plans[0];
      const erpProduct = products.find(p => p.type === 'software') || products[0];
      const seatProduct = products.find(p => p.type === 'seat') || products[1];

      const lines = [
        {
          productId: erpProduct?._id,
          productName: erpProduct?.name || 'Brightloop Core ERP Suite',
          variantName: isOdooBrand ? 'Odoo Brand Edition (+ $60.00)' : 'Standard Edition',
          variantPriceExtra: isOdooBrand ? 60 : 0,
          quantity: 1,
          unitPrice: erpProduct?.salesPrice || 1500,
          taxRate: 0.10,
          discountAmount: appliedDiscount > 0 ? appliedDiscount : 0
        },
        {
          productId: seatProduct?._id,
          productName: seatProduct?.name || 'Additional User Seats',
          variantName: 'Standard',
          variantPriceExtra: 0,
          quantity: parseInt(userSeats),
          unitPrice: seatProduct?.salesPrice || 25,
          taxRate: 0.10,
          discountAmount: 0
        }
      ];

      const payload = {
        customerId: '66321f8a84c8a2b5e4c89111', // Test customer reference
        customerName,
        customerEmail,
        planId: selectedPlan?._id,
        planName: selectedPlan?.name || 'Enterprise Cloud Suite',
        billingFrequency,
        paymentTerms,
        lines
      };

      const res = await api.createSubscription(payload);
      if (res.success) {
        onCreated(res.data);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Creation failed');
    } finally {
      setLoading(false);
    }
  };

  // Live price calculations
  const basePrice = 1500;
  const brandPrice = isOdooBrand ? 60 : 0;
  const seatsPrice = userSeats * 25;
  const subtotal = basePrice + brandPrice + seatsPrice;
  const tax = subtotal * 0.10;
  const total = subtotal + tax - appliedDiscount;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Create Quotation / Subscription</h3>
            <p className="text-xs text-slate-500">Configure plan, variants, user seats, and auto-discounts</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Customer / Company Name *</label>
              <input 
                type="text" 
                required 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Customer Email *</label>
              <input 
                type="email" 
                required 
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Plan Template</label>
              <select 
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-brand-500"
              >
                {plans.map(p => (
                  <option key={p._id} value={p._id}>{p.name} ({p.billingFrequency})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Billing Frequency</label>
              <select 
                value={billingFrequency}
                onChange={(e) => setBillingFrequency(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-brand-500"
              >
                <option value="monthly">Monthly Recurring</option>
                <option value="yearly">Yearly Contract</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>

          {/* Product Variant & Seat Controls */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center justify-between">
              <span>Configurable Lines & Variants</span>
              <span className="text-[10px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded font-mono">
                Page 3 Spec
              </span>
            </h4>

            {/* Odoo Brand Variant Checkbox */}
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
              <div>
                <span className="font-bold text-slate-900 block">Product: Brightloop Core ERP</span>
                <span className="text-slate-500">Variant option: Odoo Brand Edition</span>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isOdooBrand}
                  onChange={(e) => setIsOdooBrand(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span className="font-bold text-xs text-indigo-700">Add Odoo Brand (+ $60.00)</span>
              </label>
            </div>

            {/* Additional Seats */}
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
              <div>
                <span className="font-bold text-slate-900 block">Additional User Seats ($25/seat)</span>
                <span className="text-slate-500">Tier licensing for organization</span>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="number" 
                  min="1" 
                  max="500"
                  value={userSeats}
                  onChange={(e) => setUserSeats(parseInt(e.target.value) || 1)}
                  className="w-16 border border-slate-300 rounded p-1 text-center font-bold"
                />
                <span className="text-slate-400">seats</span>
              </div>
            </div>

            {/* Coupon Code Input */}
            <div className="flex items-center space-x-2 pt-2">
              <input 
                type="text" 
                placeholder="Enter promo coupon (e.g. ODOOPARTNER15)" 
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="flex-1 border border-slate-300 rounded-lg p-2 uppercase font-mono font-bold"
              />
              <button 
                type="button"
                onClick={handleApplyCoupon}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold"
              >
                Apply Coupon
              </button>
            </div>
            {appliedDiscount > 0 && (
              <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Coupon active: -${appliedDiscount.toFixed(2)} deducted automatically!
              </div>
            )}
          </div>

          {/* Summary Box */}
          <div className="p-4 bg-brand-50/50 rounded-xl border border-brand-100 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-slate-500 block">Calculated Recurring Total:</span>
              <span className="text-xs text-slate-400">Subtotal: ${subtotal} + 10% Tax: ${tax.toFixed(2)} - Discount: ${appliedDiscount.toFixed(2)}</span>
            </div>
            <div className="text-2xl font-black text-brand-700">
              ${total.toFixed(2)}<span className="text-xs font-normal text-slate-500">/cycle</span>
            </div>
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
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-xs transition"
            >
              {loading ? 'Generating...' : 'Create Quotation (Draft)'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
