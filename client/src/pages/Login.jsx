import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store';
import AuthFrame from '../components/AuthFrame';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.message || '';
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      setSession(data.user);
      queryClient.setQueryData(['current-user'], data.user);
      navigate(location.state?.from?.startsWith('/app') ? location.state.from : '/app/dashboard', { replace: true });
    } catch (err) { setError(err.response?.data?.error || 'Unable to sign in. Please try again.'); }
    finally { setLoading(false); }
  };
  return <AuthFrame title="Welcome back" subtitle="Sign in to your Brightloop workspace."><form onSubmit={submit} className="auth-form">
    {notice && <p className="text-sm text-emerald-700" role="status">{notice}</p>}
    <label className="form-label" htmlFor="login-email">Email address</label><input id="login-email" className="field" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
    <div className="password-label"><label className="form-label" htmlFor="login-password">Password</label><Link to="/forgot-password">Forgot password?</Link></div>
    <div className="password-wrap"><input id="login-password" className="field" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
    {error && <p className="error" role="alert">{error}</p>}<button className="button auth-submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
    <p className="auth-switch">New to Brightloop? <Link to="/register">Create an account</Link></p>
  </form></AuthFrame>;
}
