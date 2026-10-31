import { Link } from 'react-router-dom';
import AuthForm from './AuthForm.jsx';
import { useState } from 'react';
import { authApi } from '../../services/api.js';

export const LoginPage = () => <AuthForm mode="login" />;
export const RegisterPage = () => <AuthForm mode="register" />;
export function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false);
  const submit = async (event) => { event.preventDefault(); await authApi.forgotPassword({ email }); setSent(true); };
  return <AuthPage title="Reset your password">{sent ? <p className="text-slate-600">If an account exists, reset instructions have been sent.</p> :
    <form onSubmit={submit}><input required type="email" placeholder="Email address" className="field" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white">Send instructions</button></form>}</AuthPage>;
}
export function ResetPasswordPage() {
  const [password, setPassword] = useState(''); const [done, setDone] = useState(false);
  const token = new URLSearchParams(location.search).get('token');
  const submit = async (event) => { event.preventDefault(); await authApi.resetPassword({ token, password }); setDone(true); };
  return <AuthPage title="Choose a new password">{done ? <Link className="text-blue-700" to="/login">Return to sign in</Link> :
    <form onSubmit={submit}><input required type="password" minLength="9" placeholder="New password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} /><button className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white">Reset password</button></form>}</AuthPage>;
}
function AuthPage({ title, children }) { return <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4"><div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm"><h1 className="mb-6 text-2xl font-bold">{title}</h1>{children}<Link className="mt-6 block text-sm text-slate-500" to="/login">Back to sign in</Link></div></div>; }
