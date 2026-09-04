import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import Login from './pages/Login';
import Home from './pages/Home';
import Movements from './pages/Movements';
import Manage from './pages/Manage';
import ChangePassword from './pages/ChangePassword';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/change-password"
        element={
          <RequireAuth>
            <ChangePassword />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        {/* Home is the ONLY page regular staff ever see — it contains
            everything they need (browse, search, request, accept, my files).
            Admins get two additional pages, matching the original app's
            role-gated nav exactly. */}
        <Route index element={<Home />} />
        <Route
          path="movements"
          element={
            <RequireAuth roles={['admin']}>
              <Movements />
            </RequireAuth>
          }
        />
        <Route
          path="manage"
          element={
            <RequireAuth roles={['admin']}>
              <Manage />
            </RequireAuth>
          }
        />
      </Route>
    </Routes>
  );
}
