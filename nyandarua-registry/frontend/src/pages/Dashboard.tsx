import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RegistryRequest } from '../types';

export default function Dashboard() {
  const { user } = useAuth();
  const [myRequests, setMyRequests] = useState<RegistryRequest[]>([]);
  const [allRequests, setAllRequests] = useState<RegistryRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [mine, all] = await Promise.all([
          api.get<{ requests: RegistryRequest[] }>('/requests?mine=true'),
          api.get<{ requests: RegistryRequest[] }>('/requests'),
        ]);
        setMyRequests(mine.requests);
        setAllRequests(all.requests);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const overdue = allRequests.filter(
    (r) => r.due_date && r.status !== 'returned' && new Date(r.due_date) < new Date()
  );
  const withMe = myRequests.filter((r) => r.status === 'assigned' || r.status === 'accepted');
  const pending = allRequests.filter((r) => r.status === 'requested');

  return (
    <>
      <div className="card">
        <div className="card-title">Welcome, {user?.name}</div>
        <div style={{ fontSize: 13, color: '#555' }}>
          {user?.designation} &middot; File No. {user?.file_number}
        </div>
      </div>

      <div className="grid3">
        <Link to="/requests" className="stat-card" style={{ textDecoration: 'none' }}>
          <div className="stat-num">{loading ? '—' : withMe.length}</div>
          <div className="stat-lbl">Files with me</div>
        </Link>
        <Link to="/requests" className="stat-card" style={{ textDecoration: 'none' }}>
          <div className="stat-num">{loading ? '—' : overdue.length}</div>
          <div className="stat-lbl">Overdue registry-wide</div>
        </Link>
        {user?.role === 'admin' && (
          <Link to="/requests" className="stat-card" style={{ textDecoration: 'none' }}>
            <div className="stat-num">{loading ? '—' : pending.length}</div>
            <div className="stat-lbl">Pending requests</div>
          </Link>
        )}
      </div>

      <div className="card">
        <div className="card-title">My recent activity</div>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : myRequests.length === 0 ? (
          <div className="empty-state">No requests yet.</div>
        ) : (
          <table className="reg-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Status</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.slice(0, 10).map((r) => (
                <tr key={r.id} className={r.due_date && r.status !== 'returned' && new Date(r.due_date) < new Date() ? 'overdue-row' : ''}>
                  <td>{r.file_name} <span style={{ color: '#888' }}>({r.file_number_label})</span></td>
                  <td><span className="tag tag-blue">{r.status}</span></td>
                  <td>{r.due_date ? new Date(r.due_date).toLocaleDateString('en-KE') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
