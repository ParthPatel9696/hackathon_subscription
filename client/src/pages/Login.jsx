import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      setSession(data.user, data.token);
      navigate('/');
    } catch (err) { setError(err.response?.data?.error || 'Unable to sign in.'); }
  };
  return <AuthCard title="Welcome back" subtitle="Sign in to manage subscriptions and billing."><form onSubmit={submit} className="grid gap-4">
    <input className="field" type="email" placeholder="Email address" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
    <input className="field" type="password" placeholder="Password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
    {error && <p className="error">{error}</p>}<button className="button">Sign in</button>
    <p className="text-center text-sm text-slate-500">New to Brightloop? <Link className="font-semibold text-blue-700" to="/register">Create account</Link></p>
  </form></AuthCard>;
}

function AuthCard({ title, subtitle, children }) {
  return <div className="grid min-h-screen place-items-center bg-slate-100 p-5"><div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm"><div className="mb-7 text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-navy font-black text-mint">B</div><h1 className="text-2xl font-bold text-ink">{title}</h1><p className="mt-2 text-sm text-slate-500">{subtitle}</p></div>{children}</div></div>;
}
