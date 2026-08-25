import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

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
        <span className="nav-link" style={{ color: 'rgba(255,255,255,.6)', cursor: 'default' }}>
          {user?.name}
        </span>
        <span className="nav-link" onClick={handleLogout}>
          Log out
        </span>
      </div>
      <div className="page">
        <Outlet />
      </div>
    </div>
  );
}
