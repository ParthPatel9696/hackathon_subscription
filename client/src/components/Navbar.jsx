import React from 'react';
import { 
  RotateCw, 
  BarChart3, 
  FileText, 
  Receipt, 
  Tag, 
  UserCheck, 
  Search, 
  Sparkles,
  Shield,
  Briefcase,
  User,
  LogOut,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ 
  activeTab, 
  onTabChange, 
  onSeedData,
  loadingSeed,
  onOpenAddStaff 
}) {
  const { user, role, logout } = useAuth();

  const getRoleBadge = () => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
            <Shield className="w-3 h-3 text-purple-600" />
            ADMIN
          </span>
        );
      case 'staff':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-blue-600" />
            STAFF
          </span>
        );
      case 'customer':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <User className="w-3 h-3 text-emerald-600" />
            CUSTOMER
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      
      {/* Top Banner & Control Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <RotateCw className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-extrabold tracking-tight text-slate-900">Brightloop</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                Odoo Challenge
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Subscription & Recurring Billing</p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search subscriptions, customers, invoices..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Action Controls & User Profile */}
        <div className="flex items-center space-x-3">
          
          {/* Quick Database Seeder Button */}
          <button
            onClick={onSeedData}
            disabled={loadingSeed}
            title="Reset database with standard test scenarios"
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{loadingSeed ? 'Seeding...' : 'Reset Demo'}</span>
          </button>

          {/* Add Staff Button (Admin only per Page 2) */}
          {role === 'admin' && (
            <button
              onClick={onOpenAddStaff}
              title="Only the admin can add a new member of staff"
              className="hidden lg:flex items-center space-x-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Staff</span>
            </button>
          )}

          {/* User Profile Badge */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-brand-700 text-white font-bold flex items-center justify-center text-xs shadow-xs uppercase">
              {user?.name?.substring(0, 2) || 'US'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-900 leading-tight">{user?.name || 'User'}</span>
                {getRoleBadge()}
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">{user?.email}</p>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              title="Sign out of workspace"
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 flex items-center justify-center transition ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

      {/* Main Navigation Tabs */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 text-xs font-semibold border-t border-slate-100 overflow-x-auto">
        
        {/* Finance Dashboard (Admin view) */}
        {role === 'admin' && (
          <button
            onClick={() => onTabChange('dashboard')}
            className={`py-3 px-3 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'dashboard'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Finance Dashboard</span>
          </button>
        )}

        {/* Subscriptions & Quotes (Admin & Staff) */}
        {role !== 'customer' && (
          <button
            onClick={() => onTabChange('subscriptions')}
            className={`py-3 px-3 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'subscriptions'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Subscriptions & Quotations</span>
          </button>
        )}

        {/* Invoices & Billing (Admin & Staff) */}
        {role !== 'customer' && (
          <button
            onClick={() => onTabChange('invoices')}
            className={`py-3 px-3 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'invoices'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Billing & Invoices</span>
          </button>
        )}

        {/* Discounts (Admin Only per Problem Statement Page 4) */}
        {role === 'admin' && (
          <button
            onClick={() => onTabChange('discounts')}
            className={`py-3 px-3 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'discounts'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Discounts & Promotions</span>
          </button>
        )}

        {/* Customer Self-Service Portal (All roles can test, but Customers see this exclusively) */}
        <button
          onClick={() => onTabChange('portal')}
          className={`py-3 px-3 border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'portal'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Customer Portal</span>
        </button>

      </nav>
    </header>
  );
}
