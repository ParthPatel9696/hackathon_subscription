import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import AuthFrame from '../components/AuthFrame';

export default function PasswordRecovery({ mode }) {
  const isReset = mode === 'reset';
  const { token: pathToken } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const token = pathToken || new URLSearchParams(location.search).get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [simulatedUrl, setSimulatedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      if (!isReset) {
        const { data } = await api.post('/auth/forgot-password', { email });
        setMessage(data.message || 'If an account exists with that address, reset instructions have been sent.');
        setSimulatedUrl(data.simulatedResetUrl || '');
      } else {
        if (!token) { setError('This reset link is missing its token. Request a new link to continue.'); return; }
        if (password !== confirm) { setError('The passwords do not match.'); return; }
        await api.post('/auth/reset-password', { token, password });
        setMessage('Your password has been updated. You can now sign in.');
        window.setTimeout(() => navigate('/login', { replace: true }), 1200);
      }
    } catch (err) { setError(err.response?.data?.error || 'We could not complete this request. Please try again.'); }
    finally { setLoading(false); }
  };
  return <AuthFrame title={isReset ? 'Choose a new password' : 'Reset your password'} subtitle={isReset ? 'Use a new password for your Brightloop account.' : 'Enter your account email and we’ll send reset instructions if an account matches.'}>
    <form onSubmit={submit} className="auth-form">
      {!isReset ? <><label className="form-label" htmlFor="recovery-email">Email address</label><input id="recovery-email" className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></> : <>
        {!token && <p className="error" role="alert">This link is missing its reset token.</p>}
        <label className="form-label" htmlFor="new-password">New password</label><div className="password-wrap"><input id="new-password" className="field" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={9} required value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
        <p className="field-hint">At least 9 characters with uppercase, lowercase, and a symbol.</p>
        <label className="form-label" htmlFor="confirm-password">Confirm new password</label><div className="password-wrap"><input id="confirm-password" className="field" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
      </>}
      {error && <p className="error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
      {simulatedUrl && <p className="simulated-reset">Development mode: email delivery isn’t configured. <Link to={simulatedUrl.replace(window.location.origin, '')}>Open the simulated reset link</Link>.</p>}
      <button className="button auth-submit" disabled={loading || (isReset && !token)}>{loading ? 'Please wait…' : isReset ? 'Update password' : 'Send reset instructions'}</button>
      <p className="auth-switch"><Link to="/login">Return to sign in</Link></p>
    </form>
  </AuthFrame>;
}
