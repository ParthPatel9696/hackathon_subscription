import React, { useState } from 'react';
import { 
  RotateCw, 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  Building, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Zap, 
  KeyRound,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthView({ onShowToast }) {
  const { login, register, forgotPassword, quickLogin } = useAuth();
  
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot'
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [regName, setRegName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  
  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSentMsg, setResetSentMsg] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password rules validation per Page 2:
  // "more than eight characters, with an uppercase letter, a lowercase letter and a special character."
  const hasMinLength = regPassword.length > 8;
  const hasUppercase = /[A-Z]/.test(regPassword);
  const hasLowercase = /[a-z]/.test(regPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(regPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasSpecial;

  // Handle Sign In
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await login(loginEmail, loginPassword);
      if (res.success) {
        onShowToast(`Signed in successfully as ${res.user.name} (${res.user.role.toUpperCase()})`, 'success');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Sign Up
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setErrorMsg('Please satisfy all password criteria before submitting.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await register({
        name: regName,
        companyName: regCompany,
        email: regEmail,
        password: regPassword
      });
      if (res.success) {
        onShowToast('Account created successfully! Welcome to Brightloop.', 'success');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setResetSentMsg('');
    try {
      const res = await forgotPassword(forgotEmail);
      if (res.success) {
        setResetSentMsg(res.message);
        onShowToast('Password reset link dispatched!', 'info');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Could not process reset request.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Quick Demo Login
  const handleQuickLogin = async (roleType) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await quickLogin(roleType);
      if (res.success) {
        onShowToast(`Instant Demo Login: Authenticated as ${roleType.toUpperCase()}`, 'success');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-600/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Header / Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 items-center justify-center text-white shadow-xl shadow-brand-500/25 mb-4">
          <RotateCw className="w-7 h-7" />
        </div>
        <h2 className="text-3xl font-black text-white tracking-tight">Brightloop Subscriptions</h2>
        <p className="mt-1.5 text-xs text-slate-400">
          Recurring Billing & Subscription Engine &bull; Odoo Hackathon
        </p>
      </div>

      {/* Main Auth Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg z-10 px-4">
        
        {/* Quick 1-Click Demo Login Bar */}
        <div className="bg-slate-800/80 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700/80 mb-4 shadow-lg">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              1-Click Demo Logins (Hackathon Evaluator)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin('admin')}
              className="px-2.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1"
            >
              <span>Admin / Finance</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin('staff')}
              className="px-2.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 border border-blue-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1"
            >
              <span>Staff (Sales)</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin('customer')}
              className="px-2.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 border border-emerald-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1"
            >
              <span>Customer Portal</span>
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          
          <div className="flex border-b border-slate-100 bg-slate-50 text-xs font-bold">
            <button
              onClick={() => { setTab('login'); setErrorMsg(''); }}
              className={`flex-1 py-3.5 text-center transition ${
                tab === 'login'
                  ? 'bg-white text-brand-700 border-b-2 border-brand-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setErrorMsg(''); }}
              className={`flex-1 py-3.5 text-center transition ${
                tab === 'register'
                  ? 'bg-white text-brand-700 border-b-2 border-brand-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Customer Sign Up
            </button>
            <button
              onClick={() => { setTab('forgot'); setErrorMsg(''); }}
              className={`flex-1 py-3.5 text-center transition ${
                tab === 'forgot'
                  ? 'bg-white text-brand-700 border-b-2 border-brand-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Forgot Password
            </button>
          </div>

          <div className="p-6 sm:p-8">
            
            {errorMsg && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {errorMsg}
              </div>
            )}

            {resetSentMsg && (
              <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                {resetSentMsg}
              </div>
            )}

            {/* TAB 1: SIGN IN */}
            {tab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="admin@brightloop.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => setTab('forgot')}
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="Enter password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-md shadow-brand-500/20 flex items-center justify-center space-x-2 transition"
                >
                  <span>{loading ? 'Signing in...' : 'Sign In to Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* TAB 2: CUSTOMER SIGN UP (PAGE 2 SPEC) */}
            {tab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="Sarah Jenkins"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Company Name</label>
                    <div className="relative">
                      <Building className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Acme Retail"
                        value={regCompany}
                        onChange={(e) => setRegCompany(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address (Unique) *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="finance@acmeretail.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="Enter strong password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  {/* Dynamic Password Criteria Checklist (Page 2 Requirement) */}
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                    <div className="font-bold text-slate-600 mb-1">Password Requirements:</div>
                    <div className={`flex items-center space-x-1.5 ${hasMinLength ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>More than 8 characters</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${hasUppercase ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      {hasUppercase ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>At least one uppercase letter (A-Z)</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${hasLowercase ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      {hasLowercase ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>At least one lowercase letter (a-z)</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${hasSpecial ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      {hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>At least one special character (!@#$%^&*)</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !isPasswordValid}
                  className={`w-full mt-2 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition ${
                    isPasswordValid
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>{loading ? 'Creating Account...' : 'Create Customer Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* TAB 3: FORGOT PASSWORD (PAGE 2 SPEC) */}
            {tab === 'forgot' && (
              <form onSubmit={handleForgotSubmit} className="space-y-4 text-xs">
                <p className="text-slate-500 text-xs leading-relaxed">
                  Enter your registered Brightloop email address. A password reset link will be generated and dispatched per the platform specification.
                </p>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Registered Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="user@brightloop.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  {loading ? 'Dispatching link...' : 'Send Password Reset Link'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setTab('login')}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    &larr; Back to Sign In
                  </button>
                </div>
              </form>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
