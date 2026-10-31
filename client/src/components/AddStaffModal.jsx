import React, { useState } from 'react';
import { X, UserPlus, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AddStaffModal({ onClose, onStaffAdded }) {
  const { addStaff } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const hasMinLength = password.length > 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasSpecial;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setErrorMsg('Password must be more than 8 characters, with an uppercase letter, a lowercase letter and a special character.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await addStaff({ name, email, password });
      if (res.success) {
        onStaffAdded(res.message);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to add staff member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Add Staff Member</h3>
              <p className="text-[11px] text-slate-400">Admin-exclusive team provision</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Employee Name *</label>
            <input 
              type="text" 
              required 
              placeholder="e.g. Rachel Adams"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Company Email *</label>
            <input 
              type="email" 
              required 
              placeholder="rachel.adams@brightloop.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Temporary Password *</label>
            <input 
              type="password" 
              required 
              placeholder="e.g. Staff@TempPass2024!"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-brand-500"
            />
            
            <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] space-y-1">
              <span className="text-slate-500 block font-bold">Security Criteria:</span>
              <div className={hasMinLength ? 'text-emerald-700' : 'text-slate-400'}>
                &bull; &gt; 8 characters
              </div>
              <div className={hasUppercase ? 'text-emerald-700' : 'text-slate-400'}>
                &bull; Uppercase letter
              </div>
              <div className={hasLowercase ? 'text-emerald-700' : 'text-slate-400'}>
                &bull; Lowercase letter
              </div>
              <div className={hasSpecial ? 'text-emerald-700' : 'text-slate-400'}>
                &bull; Special character
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || !isPasswordValid}
              className={`px-4 py-2 rounded-lg font-bold text-white shadow-xs transition ${
                isPasswordValid ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              {loading ? 'Creating...' : 'Register Staff Account'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
