import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store';
import AuthFrame from '../components/AuthFrame';

export default function Register() {
  const [form, setForm] = useState({ name: '', companyName: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (form.password !== form.confirmPassword) { setError('The passwords do not match.'); return; }
    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      const { data } = await api.post('/auth/register', payload);
      setSession(data.user);
      queryClient.setQueryData(['current-user'], data.user);
      navigate('/app/dashboard', { replace: true });
    } catch (err) { setError(err.response?.data?.error || 'Unable to create your account. Please try again.'); }
    finally { setLoading(false); }
  };
  return <AuthFrame title="Create your account" subtitle="Start managing your subscriptions and billing."><form onSubmit={submit} className="auth-form">
    <label className="form-label" htmlFor="register-name">Full name</label><input id="register-name" className="field" autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
    <label className="form-label" htmlFor="register-company">Company name <span className="optional-label">Optional</span></label><input id="register-company" className="field" autoComplete="organization" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
    <label className="form-label" htmlFor="register-phone">Phone <span className="optional-label">Optional</span></label><input id="register-phone" className="field" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
    <label className="form-label" htmlFor="register-email">Work email</label><input id="register-email" className="field" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
    <label className="form-label" htmlFor="register-password">Password</label><div className="password-wrap"><input id="register-password" className="field" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={9} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div><p className="field-hint">Use at least 9 characters with uppercase, lowercase, and a symbol.</p>
    <label className="form-label" htmlFor="register-confirm">Confirm password</label><input id="register-confirm" className="field" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
    <label className="terms-check"><input type="checkbox" required onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })} /><span>I agree to the <Link to="/terms">terms of use</Link> and have read the <Link to="/privacy">privacy notice</Link>.</span></label>
    {error && <p className="error" role="alert">{error}</p>}<button className="button auth-submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>
    <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
  </form></AuthFrame>;
}
