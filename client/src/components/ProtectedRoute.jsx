import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store.js';

export default function ProtectedRoute({ roles }) {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
