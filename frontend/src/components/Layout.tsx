import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { api } from '../api/client';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifCount, setNotifCount] = useState(0);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const { showWarning } = useIdleTimeout(!!user, handleLogout);

  useEffect(() => {
    let cancelled = false;
    async function loadNotifs() {
      try {
        const res = await api.get<{ count: number }>('/stats/notifications');
        if (!cancelled) setNotifCount(res.count);
      } catch {
        // non-critical — badge just stays at its last known value
      }
    }
    loadNotifs();
    const interval = setInterval(loadNotifs, 60000); // refresh every minute
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <div className="nav">
        <div className="nav-brand">
          <img src="/logo.png" alt="Nyandarua County" />
          Nyandarua County Registry
        </div>
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Dashboard
        </NavLink>
        <NavLink to="/files" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Files
        </NavLink>
        <NavLink to="/requests" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Requests
        </NavLink>
        <NavLink to="/movements" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Movements
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/users" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Users
          </NavLink>
        )}
        <NavLink to="/change-password" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Change password
        </NavLink>

        <button
          className="bell-btn"
          onClick={() => navigate('/requests')}
          aria-label="Notifications"
          title={notifCount > 0 ? `${notifCount} awaiting your action` : 'No pending notifications'}
        >
          🔔
          {notifCount > 0 && <span className="notif-badge">{notifCount > 99 ? '99+' : notifCount}</span>}
        </button>

        <span className="nav-link" style={{ color: 'rgba(255,255,255,.6)', cursor: 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
          {user?.name}
          <span
            className="tag"
            style={{
              background: user?.role === 'admin' ? 'rgba(184,134,11,.35)' : 'rgba(255,255,255,.15)',
              color: '#fff',
              fontSize: 10,
            }}
          >
            {user?.role}
          </span>
        </span>
        <span className="nav-link" onClick={handleLogout}>
          Log out
        </span>
      </div>
      <div className="page">
        <Outlet />
      </div>
      {showWarning && (
        <div className="idle-warning">
          ⚠ Session expiring in 1 minute due to inactivity. Click anywhere to stay logged in.
        </div>
      )}
    </div>
  );
}
