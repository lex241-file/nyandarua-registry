import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

export default function RequireAuth({
  children,
  roles,
}: {
  children: JSX.Element;
  roles?: Role[];
}) {
  const { user, loading, forced } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  // Accounts still on their default (ID-number) password must change it
  // before touching anything else in the app.
  if (forced && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
