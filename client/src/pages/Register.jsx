import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store';

export default function Register() {
  const [form, setForm] = useState({ name: '', companyName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const submit = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post('/auth/register', form);
      setSession(data.user, data.token);
      navigate('/');
    } catch (err) { setError(err.response?.data?.error || 'Unable to create account.'); }
  };
  return <div className="grid min-h-screen place-items-center bg-slate-100 p-5"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Create your account</h1><p className="mb-6 mt-2 text-sm text-slate-500">Start managing your recurring services.</p><div className="grid gap-4">
    {['name', 'companyName', 'email', 'password'].map((field) => <input key={field} className="field" type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} placeholder={field === 'companyName' ? 'Company name' : field[0].toUpperCase() + field.slice(1)} required={field !== 'companyName'} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />)}
    {error && <p className="error">{error}</p>}<button className="button">Create account</button><p className="text-center text-sm text-slate-500">Already registered? <Link className="font-semibold text-blue-700" to="/login">Sign in</Link></p>
  </div></form></div>;
}
