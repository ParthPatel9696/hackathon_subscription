import { lazy, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from './store';
import Login from './pages/Login';
import Register from './pages/Register';
import PublicSite from './pages/PublicSite';
import PasswordRecovery from './pages/PasswordRecovery';
import StatusPage from './pages/StatusPage';
import Shell from './components/Shell';
import api from './api';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ResourcePage = lazy(() => import('./pages/ResourcePage'));
const Reports = lazy(() => import('./pages/Reports'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));

function ProtectedRoute({ children, roles }) {
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const location = useLocation();
  const session = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => (await api.get('/auth/me')).data.user,
    retry: false,
    staleTime: 30000
  });
  useEffect(() => {
    if (session.data) setSession(session.data);
    if (session.error) clearSession();
  }, [session.data, session.error, setSession, clearSession]);
  if (session.isLoading) return <RouteLoading />;
  if (session.error) {
    if (session.error.response?.status === 401) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    return <StatusPage code="500" />;
  }
  const verifiedUser = session.data;
  if (!verifiedUser) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user?.id !== verifiedUser.id || user?.role !== verifiedUser.role) return <RouteLoading />;
  if (roles && !roles.includes(verifiedUser.role)) return <Navigate to="/unauthorized" replace />;
  return children;
}

function PublicHome() {
  const user = useAuthStore((state) => state.user);
  return user ? <Navigate to="/app/dashboard" replace /> : <PublicSite />;
}

function RouteLoading() {
  return <div className="route-loading" role="status"><span className="loading-dot" /> Loading workspace…</div>;
}

export default function App() {
  return <Suspense fallback={<RouteLoading />}><Routes>
    <Route path="/" element={<PublicHome />} />
    <Route path="/features" element={<PublicSite />} />
    <Route path="/pricing" element={<PublicSite />} />
    <Route path="/contact" element={<PublicSite />} />
    <Route path="/privacy" element={<PublicSite />} />
    <Route path="/terms" element={<PublicSite />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<PasswordRecovery mode="forgot" />} />
    <Route path="/reset-password" element={<PasswordRecovery mode="reset" />} />
    <Route path="/reset-password/:token" element={<PasswordRecovery mode="reset" />} />
    <Route path="/unauthorized" element={<StatusPage code="403" />} />
    <Route path="/session-expired" element={<StatusPage code="session" />} />
    <Route path="/account-closed" element={<StatusPage code="account-closed" />} />
    <Route path="/500" element={<StatusPage code="500" />} />
    <Route path="/404" element={<StatusPage code="404" />} />
    <Route path="/app" element={<ProtectedRoute><Shell /></ProtectedRoute>}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="customers" element={<ProtectedRoute roles={['admin', 'staff']}><ResourcePage title="Customers" endpoint="/customers" resource="customers" /></ProtectedRoute>} />
      <Route path="customers/:id" element={<ProtectedRoute roles={['admin', 'staff']}><CustomerDetail /></ProtectedRoute>} />
      <Route path="products" element={<ProtectedRoute roles={['admin']}><ResourcePage title="Products" resource="products" endpoint="/products" /></ProtectedRoute>} />
      <Route path="plans" element={<ResourcePage title="Subscription Plans" resource="plans" endpoint="/plans" />} />
      <Route path="quotations" element={<ProtectedRoute roles={['admin', 'staff']}><ResourcePage title="Quotations" resource="quotations" endpoint="/subscriptions?status=Quotation" /></ProtectedRoute>} />
      <Route path="subscriptions" element={<ResourcePage title="Subscriptions" resource="subscriptions" endpoint="/subscriptions" />} />
      <Route path="invoices" element={<ResourcePage title="Invoices" resource="invoices" endpoint="/invoices" />} />
      <Route path="payments" element={<ResourcePage title="Payments" resource="payments" endpoint="/payments" />} />
      <Route path="discounts" element={<ProtectedRoute roles={['admin']}><ResourcePage title="Discounts" resource="discounts" endpoint="/discounts" /></ProtectedRoute>} />
      <Route path="reports" element={<ProtectedRoute roles={['admin', 'staff']}><Reports /></ProtectedRoute>} />
      <Route path="settings" element={<AccountPage />} />
      <Route path="*" element={<StatusPage code="404" />} />
    </Route>
    <Route path="*" element={<StatusPage code="404" />} />
  </Routes></Suspense>;
}
