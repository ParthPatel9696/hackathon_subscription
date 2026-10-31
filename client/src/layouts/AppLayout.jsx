import { Link, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Users } from 'lucide-react';
import { useAuthStore } from '../store/auth-store.js';

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const handleLogout = async () => { await logout(); navigate('/login'); };
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="text-xl font-bold tracking-tight text-navy-900">Ledgerly</Link>
          <div className="flex items-center gap-5">
            <span className="text-sm text-slate-500">{user?.name} · {user?.role}</span>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-8">
        <aside className="hidden w-56 shrink-0 space-y-2 md:block">
          <Link className="flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white" to="/dashboard">
            <LayoutDashboard size={17} /> Overview
          </Link>
          {user?.role === 'ADMIN' && <Link className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-600 hover:bg-white" to="/admin/staff">
            <Users size={17} /> Staff
          </Link>}
        </aside>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}
