import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RegistryRequest, RequestStatus } from '../types';

const STATUS_TAG: Record<RequestStatus, string> = {
  requested: 'tag-amber',
  assigned: 'tag-blue',
  accepted: 'tag-green',
  returned: 'tag-gray',
  declined: 'tag-red',
};

export default function Requests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RegistryRequest[]>([]);
  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      const res = await api.get<{ requests: RegistryRequest[] }>(`/requests?${params.toString()}`);
      setRequests(res.requests);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function accept(id: number) {
    setMsg('');
    try {
      await api.post(`/requests/${id}/accept`);
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not accept request.');
    }
  }

  async function returnFile(id: number) {
    setMsg('');
    try {
      await api.post(`/requests/${id}/return`, {});
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not mark as returned.');
    }
  }

  function isOverdue(r: RegistryRequest) {
    return !!r.due_date && r.status !== 'returned' && new Date(r.due_date) < new Date();
  }

  return (
    <div className="card">
      <div className="card-title">Requests</div>

      <select value={status} onChange={(e) => setStatus(e.target.value as RequestStatus | '')} style={{ width: 200, marginBottom: 12 }}>
        <option value="">All statuses</option>
        <option value="requested">Requested</option>
        <option value="assigned">Assigned</option>
        <option value="accepted">Accepted</option>
        <option value="returned">Returned</option>
        <option value="declined">Declined</option>
      </select>

      {msg && <div className="err-msg" style={{ marginBottom: 10 }}>{msg}</div>}

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="empty-state">No requests found.</div>
      ) : (
        <table className="reg-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Requested by</th>
              <th>Assigned to</th>
              <th>Status</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className={isOverdue(r) ? 'overdue-row' : ''}>
                <td>{r.file_name} <span style={{ color: '#888' }}>({r.file_number_label})</span></td>
                <td>{r.requester_name || '—'}</td>
                <td>{r.assigned_to_name || '—'}</td>
                <td><span className={`tag ${STATUS_TAG[r.status]}`}>{r.status}</span></td>
                <td>{r.due_date ? new Date(r.due_date).toLocaleDateString('en-KE') : '—'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  {r.status === 'assigned' && (r.assigned_to_id === user?.id || user?.role === 'admin') && (
                    <button className="btn btn-sm btn-success" onClick={() => accept(r.id)}>Accept</button>
                  )}
                  {(r.status === 'accepted' || r.status === 'assigned') && (
                    <button className="btn btn-sm" onClick={() => returnFile(r.id)}>Mark returned</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
