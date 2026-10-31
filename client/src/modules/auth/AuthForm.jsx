import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../services/api.js';
import { useAuthStore } from '../../store/auth-store.js';

export default function AuthForm({ mode }) {
  const isLogin = mode === 'login';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await (isLogin ? authApi.login(form) : authApi.register(form));
      if (isLogin) { setUser(data.data.user); navigate('/dashboard'); }
      else navigate('/login');
    } catch (requestError) { setError(requestError.response?.data?.error?.message || 'Something went wrong'); }
    finally { setBusy(false); }
  };
  return <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-700">Ledgerly</p>
      <h1 className="mb-2 text-3xl font-bold text-slate-900">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
      <p className="mb-8 text-slate-500">{isLogin ? 'Sign in to manage your subscriptions.' : 'Start managing customer billing securely.'}</p>
      {!isLogin && <input required minLength="2" placeholder="Full name" className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
      <input required type="email" placeholder="Work email" className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input required type="password" placeholder="Password" className="field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white hover:bg-slate-700 disabled:opacity-60">{busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}</button>
      <div className="mt-6 flex justify-between text-sm text-slate-500">
        <Link className="hover:text-slate-900" to={isLogin ? '/register' : '/login'}>{isLogin ? 'Create account' : 'Back to sign in'}</Link>
        {isLogin && <Link className="hover:text-slate-900" to="/forgot-password">Forgot password?</Link>}
      </div>
    </form>
  </div>;
}
