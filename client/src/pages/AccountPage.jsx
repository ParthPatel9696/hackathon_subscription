import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, FileText, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { formatCurrency } from '../utils/locale';
import { useAuthStore } from '../store';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

const profileKeys = ['name', 'companyName', 'phone', 'alternatePhone', 'website', 'taxId', 'billingContactName', 'billingContactEmail', 'billingContactPhone', 'billingAddress', 'billingAddressLine2', 'billingCity', 'billingState', 'billingPostalCode', 'billingCountry', 'shippingAddress', 'preferredPaymentMethod'];

export default function AccountPage() {
  const sessionUser = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);
  const customerMode = sessionUser?.role === 'customer';
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [closeAccountOpen, setCloseAccountOpen] = useState(false);
  const [form, setForm] = useState(Object.fromEntries(profileKeys.map((key) => [key, key === 'billingCountry' ? 'India' : ''])));
  const me = useQuery({
    queryKey: [customerMode ? 'customer-me' : 'me'],
    queryFn: async () => (await api.get(customerMode ? '/customers/me' : '/auth/me')).data
  });
  const subscriptions = useQuery({ queryKey: ['subscriptions'], queryFn: async () => (await api.get('/subscriptions')).data, enabled: customerMode });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: async () => (await api.get('/invoices')).data, enabled: customerMode });
  const payments = useQuery({ queryKey: ['payments'], queryFn: async () => (await api.get('/payments')).data, enabled: customerMode });
  const profile = customerMode ? me.data?.data?.customer : me.data?.user || sessionUser;
  useEffect(() => {
    if (!profile) return;
    setForm(Object.fromEntries(profileKeys.map((key) => [key, profile[key] || (key === 'billingCountry' ? 'India' : '')])));
  }, [profile]);
  const mutation = useMutation({
    mutationFn: async (payload) => (await api.patch('/customers/me', payload)).data.data,
    onSuccess: (updated) => {
      setSession({ ...sessionUser, ...updated });
      queryClient.setQueryData(['customer-me'], (current) => current ? { ...current, data: { ...current.data, customer: { ...current.data.customer, ...updated } } } : current);
      queryClient.setQueryData(['current-user'], updated);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['customer'] });
      setMessage('Your profile is saved and linked subscription records are up to date.');
      setEditing(false);
    }
  });
  const passwordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }) => (await api.post('/auth/change-password', { currentPassword, newPassword })).data,
    onSuccess: () => { clearSession(); queryClient.clear(); navigate('/login', { replace: true, state: { message: 'Password changed. Sign in again with your new password.' } }); }
  });
  const closeAccount = useMutation({
    mutationFn: async () => (await api.delete('/customers/me')).data,
    onSuccess: () => { clearSession(); queryClient.clear(); navigate('/account-closed', { replace: true }); }
  });
  const submit = (event) => { event.preventDefault(); setMessage(''); mutation.mutate(form); };
  const active = subscriptions.data?.data?.filter((item) => item.status === 'Active').length || 0;
  const outstanding = invoices.data?.data?.reduce((sum, item) => sum + Math.max(0, Number(item.grandTotal || 0) - Number(item.paidAmount || 0)), 0) || 0;
  return <>
    <PageHeader title={customerMode ? 'My account' : 'Account and settings'} subtitle={customerMode ? 'Keep your contact and billing profile current across your Brightloop records.' : 'Your Brightloop user profile.'} />
    {me.isError && <p className="error mb-4" role="alert">Unable to load your account details. <button className="inline-action" onClick={() => me.refetch()}>Try again</button></p>}
    <section className="card mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Profile information</h2><p className="mt-1 text-sm text-slate-500">Email: {profile?.email || sessionUser?.email}</p></div>{customerMode && !editing && <button type="button" className="button secondary-button" onClick={() => { setMessage(''); setEditing(true); }}>Edit profile</button>}</div>
      {editing ? <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Field label="Company" value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
        <Field label="Phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <Field label="Alternate phone" type="tel" value={form.alternatePhone} onChange={(event) => setForm({ ...form, alternatePhone: event.target.value })} />
        <Field label="Website" type="url" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
        <Field label="Tax identification number" value={form.taxId} onChange={(event) => setForm({ ...form, taxId: event.target.value })} />
        <Field label="Billing contact name" value={form.billingContactName} onChange={(event) => setForm({ ...form, billingContactName: event.target.value })} />
        <Field label="Billing contact email" type="email" value={form.billingContactEmail} onChange={(event) => setForm({ ...form, billingContactEmail: event.target.value })} />
        <Field label="Billing contact phone" type="tel" value={form.billingContactPhone} onChange={(event) => setForm({ ...form, billingContactPhone: event.target.value })} />
        <Field label="Billing address line 1" className="sm:col-span-2"><textarea className="field min-h-16" value={form.billingAddress} onChange={(event) => setForm({ ...form, billingAddress: event.target.value })} /></Field>
        <Field label="Billing address line 2" value={form.billingAddressLine2} onChange={(event) => setForm({ ...form, billingAddressLine2: event.target.value })} />
        <Field label="City" value={form.billingCity} onChange={(event) => setForm({ ...form, billingCity: event.target.value })} />
        <Field label="State" value={form.billingState} onChange={(event) => setForm({ ...form, billingState: event.target.value })} />
        <Field label="PIN code" value={form.billingPostalCode} onChange={(event) => setForm({ ...form, billingPostalCode: event.target.value })} />
        <Field label="Country" value={form.billingCountry} onChange={(event) => setForm({ ...form, billingCountry: event.target.value })} />
        <Field label="Shipping address" className="sm:col-span-2"><textarea className="field min-h-16" value={form.shippingAddress} onChange={(event) => setForm({ ...form, shippingAddress: event.target.value })} /></Field>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">Preferred payment method<select className="field" value={form.preferredPaymentMethod} onChange={(event) => setForm({ ...form, preferredPaymentMethod: event.target.value })}><option value="">Not specified</option>{['UPI','Bank transfer','Card','Cheque','Cash','Other'].map((method) => <option key={method}>{method}</option>)}</select></label>
        {mutation.isError && <p className="error sm:col-span-2" role="alert">{mutation.error?.response?.data?.error || 'Unable to update profile.'}</p>}
        <div className="flex gap-2 sm:col-span-2"><button className="button" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save profile'}</button><button type="button" className="button secondary-button" onClick={() => { setEditing(false); setForm(Object.fromEntries(profileKeys.map((key) => [key, profile?.[key] || (key === 'billingCountry' ? 'India' : '')]))); }}>Cancel</button></div>
      </form> : <dl className="mt-4 grid gap-4 sm:grid-cols-2"><ProfileField label="Name" value={profile?.name} /><ProfileField label="Company" value={profile?.companyName} /><ProfileField label="Primary email" value={profile?.email} /><ProfileField label="Phone" value={profile?.phone} /><ProfileField label="Tax ID" value={profile?.taxId} /><ProfileField label="Billing contact" value={[profile?.billingContactName, profile?.billingContactEmail, profile?.billingContactPhone].filter(Boolean).join(' · ')} /><ProfileField label="Billing address" value={[profile?.billingAddress, profile?.billingAddressLine2, profile?.billingCity, profile?.billingState, profile?.billingPostalCode, profile?.billingCountry].filter(Boolean).join(', ')} /><ProfileField label="Shipping address" value={profile?.shippingAddress} /><ProfileField label="Preferred payment method" value={profile?.preferredPaymentMethod} /></dl>}
      {message && <p className="mt-4 text-sm text-emerald-700" role="status">{message}</p>}
    </section>
    <section className="card mb-6"><h2 className="text-lg font-semibold">Password and security</h2><p className="mt-1 text-sm text-slate-500">Changing your password signs out other active sessions.</p><form className="mt-4 grid gap-4 sm:max-w-xl" onSubmit={(event) => { event.preventDefault(); if (passwordForm.newPassword !== passwordForm.confirmPassword) return; passwordMutation.mutate({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }); }}><Field label="Current password" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required /><Field label="New password" type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} minLength={9} required /><Field label="Confirm new password" type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} minLength={9} required />{passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && <p className="error" role="alert">The passwords do not match.</p>}{passwordMutation.isError && <p className="error" role="alert">{passwordMutation.error?.response?.data?.error || 'Unable to change your password.'}</p>}<button className="button justify-self-start" disabled={passwordMutation.isPending || passwordForm.newPassword !== passwordForm.confirmPassword}>{passwordMutation.isPending ? 'Updating…' : 'Change password'}</button></form></section>
    {customerMode && <><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><SummaryCard icon={Wallet} label="Active subscriptions" value={active} /><SummaryCard icon={FileText} label="Invoices" value={invoices.data?.data?.length || 0} /><SummaryCard icon={CreditCard} label="Payments" value={payments.data?.data?.length || 0} /><SummaryCard icon={CreditCard} label="Outstanding balance" value={currency(outstanding)} /></div><p className="mt-5 text-xs text-slate-500">To protect your billing history, invoices and payments are managed as permanent records. Contact the Brightloop team if a financial record needs correction.</p><section className="card mt-6"><h2 className="font-semibold text-rose-800">Close account</h2><p className="mt-2 text-sm text-slate-500">You can close your account after active subscriptions have ended and invoices are paid. Your billing history remains available to Brightloop for account records.</p><button type="button" className="button danger-button mt-4" onClick={() => setCloseAccountOpen(true)}>Close my account</button></section></>}
    {closeAccountOpen && <Modal title="Close your Brightloop account?" onClose={() => setCloseAccountOpen(false)}><p className="text-sm text-slate-600">You will lose sign-in access immediately. Your billing history will remain linked to your customer record. Active subscriptions or unpaid invoices will prevent closure.</p>{closeAccount.isError && <p className="error mt-3" role="alert">{closeAccount.error?.response?.data?.error || 'Unable to close your account.'}</p>}<div className="mt-5 flex justify-end gap-2"><button className="button secondary-button" onClick={() => setCloseAccountOpen(false)}>Keep account</button><button className="button danger-button" disabled={closeAccount.isPending} onClick={() => closeAccount.mutate()}>{closeAccount.isPending ? 'Closing…' : 'Close account'}</button></div></Modal>}
  </>;
}

function Field({ label, children, ...props }) { return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label}{children || <input className="field" {...props} />}</label>; }
function ProfileField({ label, value }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-800">{value || 'Not provided'}</dd></div>; }
function SummaryCard({ icon: Icon, label, value }) { return <div className="card flex items-center gap-4"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Icon aria-hidden="true" size={21} /></div><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div></div>; }
function currency(amount) { return formatCurrency(amount); }
