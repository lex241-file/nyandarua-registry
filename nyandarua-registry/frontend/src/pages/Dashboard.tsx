import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RegistryRequest, Stats, REQUEST_STATUS_LABELS } from '../types';

export default function Dashboard() {
  const { user } = useAuth();
  const [myRequests, setMyRequests] = useState<RegistryRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [mine, statsRes] = await Promise.all([
          api.get<{ requests: RegistryRequest[] }>('/requests?mine=true'),
          api.get<Stats>('/stats'),
        ]);
        setMyRequests(mine.requests);
        setStats(statsRes);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const withMe = myRequests.filter((r) => r.status === 'pending_accept' || r.status === 'accepted');
  const isAdmin = user?.role === 'admin';

  return (
    <>
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Welcome, {user?.name}
          <span className={`tag ${isAdmin ? 'tag-purple' : user?.role === 'special' ? 'tag-gold' : 'tag-blue'}`}>
            {user?.role}
          </span>
        </div>
        <div style={{ fontSize: 13, color: '#555' }}>
          {user?.designation} &middot; File No. {user?.file_number}
        </div>
      </div>

      <div className="grid3">
        <Link to="/requests" className="stat-card" style={{ textDecoration: 'none' }}>
          <div className="stat-num">{loading ? '—' : withMe.length}</div>
          <div className="stat-lbl">Files with me</div>
        </Link>
        <Link to="/files" className="stat-card" style={{ textDecoration: 'none' }}>
          <div className="stat-num">{loading || !stats ? '—' : stats.totalFiles.toLocaleString()}</div>
          <div className="stat-lbl">Total files in registry</div>
        </Link>
        <Link to="/requests" className="stat-card" style={{ textDecoration: 'none' }}>
          <div className="stat-num">{loading || !stats ? '—' : stats.overdueRequests}</div>
          <div className="stat-lbl">Overdue registry-wide</div>
        </Link>
      </div>

      {isAdmin && stats && (
        <div className="grid3">
          <div className="stat-card">
            <div className="stat-num">{stats.breakdown.general}</div>
            <div className="stat-lbl">General files</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{stats.breakdown.personalTotal}</div>
            <div className="stat-lbl">Personal files ({stats.breakdown.personalActive} active, {stats.breakdown.interns} interns, {stats.breakdown.semiActive} semi-active)</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{stats.breakdown.custom}</div>
            <div className="stat-lbl">Custom / confidential files</div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="grid2">
          <Link to="/requests" className="stat-card" style={{ textDecoration: 'none' }}>
            <div className="stat-num">{loading || !stats ? '—' : stats.pendingRequests}</div>
            <div className="stat-lbl">Pending requests to review</div>
          </Link>
          <Link to="/users" className="stat-card" style={{ textDecoration: 'none' }}>
            <div className="stat-num">{loading || !stats ? '—' : stats.totalActiveUsers.toLocaleString()}</div>
            <div className="stat-lbl">Active staff accounts</div>
          </Link>
        </div>
      )}

      <div className="card">
        <div className="card-title">My recent activity</div>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : myRequests.length === 0 ? (
          <div className="empty-state">No requests yet.</div>
        ) : (
          <table className="reg-table">
            <thead>
              <tr><th>File</th><th>Status</th><th>Due</th></tr>
            </thead>
            <tbody>
              {myRequests.slice(0, 10).map((r) => (
                <tr key={r.id} className={r.due_date && r.status !== 'returned' && r.status !== 'rejected_auto' && new Date(r.due_date) < new Date() ? 'overdue-row' : ''}>
                  <td>{r.file_name} <span style={{ color: '#888' }}>({r.file_number_label})</span></td>
                  <td><span className="tag tag-blue">{REQUEST_STATUS_LABELS[r.status]}</span></td>
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
