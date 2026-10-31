import { BarChart3, CreditCard, FileText, LayoutDashboard, LogOut, Package, Percent, Settings, Tags, Users, Wallet } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store';

const links = [
  ['/', 'Overview', LayoutDashboard, ['admin', 'staff', 'customer']],
  ['/customers', 'Customers', Users, ['admin', 'staff']],
  ['/products', 'Products', Package, ['admin']],
  ['/plans', 'Plans', Tags, ['admin', 'staff', 'customer']],
  ['/quotations', 'Quotations', FileText, ['admin', 'staff']],
  ['/subscriptions', 'Subscriptions', Wallet, ['admin', 'staff', 'customer']],
  ['/invoices', 'Invoices', CreditCard, ['admin', 'staff', 'customer']],
  ['/payments', 'Payments', CreditCard, ['admin', 'staff', 'customer']],
  ['/discounts', 'Discounts', Percent, ['admin']],
  ['/reports', 'Reports', BarChart3, ['admin', 'staff']],
  ['/settings', 'Settings', Settings, ['admin', 'staff', 'customer']]
];

export default function Shell() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();

  const logout = async () => {
    try { await api.post('/auth/logout'); } finally {
      clearSession();
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-ink lg:flex">
      <aside className="w-full bg-navy px-5 py-6 text-slate-200 lg:min-h-screen lg:w-64">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint font-black text-navy">B</div>
          <div><p className="font-bold text-white">Brightloop</p><p className="text-xs text-slate-400">{user.role.toUpperCase()} PORTAL</p></div>
        </div>
        <nav className="grid gap-1">
          {links.filter(([, , , roles]) => roles.includes(user.role)).map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
        <button onClick={logout} className="mt-8 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"><LogOut size={17} /> Sign out</button>
      </aside>
      <main className="flex-1 p-5 sm:p-8"><Outlet /></main>
    </div>
  );
}
