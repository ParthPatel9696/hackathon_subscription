import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store';
import Login from './pages/Login';
import Register from './pages/Register';
import Shell from './components/Shell';
import Dashboard from './pages/Dashboard';
import ResourcePage from './pages/ResourcePage';

function ProtectedRoute({ children, roles }) {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<ProtectedRoute><Shell /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<ResourcePage title="Customers" endpoint="/auth/me" />} />
        <Route path="products" element={<ResourcePage title="Products" resource="products" endpoint="/products" />} />
        <Route path="plans" element={<ResourcePage title="Subscription Plans" resource="plans" endpoint="/plans" />} />
        <Route path="quotations" element={<ResourcePage title="Quotations" resource="quotations" endpoint="/subscriptions?status=Quotation" />} />
        <Route path="subscriptions" element={<ResourcePage title="Subscriptions" resource="subscriptions" endpoint="/subscriptions" />} />
        <Route path="invoices" element={<ResourcePage title="Invoices" resource="invoices" endpoint="/invoices" />} />
        <Route path="payments" element={<ResourcePage title="Payments" resource="payments" endpoint="/payments" />} />
        <Route path="discounts" element={<ResourcePage title="Discounts" resource="discounts" endpoint="/discounts" />} />
        <Route path="reports" element={<Dashboard />} />
        <Route path="settings" element={<ResourcePage title="Account settings" endpoint="/auth/me" />} />
      </Route>
    </Routes>
  );
}
