import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  RegistryRequest, RequestStatus, REQUEST_STATUS_LABELS,
  ProceedToDest, PROCEED_TO_LABELS, SafeUser,
} from '../types';

const STATUS_TAG: Record<RequestStatus, string> = {
  pending: 'tag-amber',
  pending_accept: 'tag-blue',
  accepted: 'tag-green',
  returned: 'tag-gray',
  rejected_auto: 'tag-red',
};

export default function Requests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RegistryRequest[]>([]);
  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Admin "approve" picker — choosing who a pending request gets assigned to.
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [approveUserSearch, setApproveUserSearch] = useState('');
  const [approveResults, setApproveResults] = useState<SafeUser[]>([]);

  // Return-details form state.
  const [returningId, setReturningId] = useState<number | null>(null);
  const [actionFolio, setActionFolio] = useState('');
  const [lastFolio, setLastFolio] = useState('');
  const [reason, setReason] = useState('');
  const [fileStatus, setFileStatus] = useState<'actioned' | 'not_actioned' | 'proceed_to' | ''>('');
  const [proceedToDest, setProceedToDest] = useState<ProceedToDest | ''>('');
  const [bringUpNote, setBringUpNote] = useState('');

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

  function openApprove(id: number, requesterName: string | null) {
    setApprovingId(id);
    setApproveUserSearch(requesterName || '');
    setApproveResults([]);
  }
  function closeApprove() {
    setApprovingId(null);
    setApproveUserSearch('');
    setApproveResults([]);
  }
  async function searchApproveUsers(e: FormEvent) {
    e.preventDefault();
    if (!approveUserSearch.trim()) return;
    const res = await api.get<{ users: SafeUser[] }>(`/users?search=${encodeURIComponent(approveUserSearch)}`);
    setApproveResults(res.users);
  }
  async function confirmApprove(assignedToId: number, fileId: number) {
    if (approvingId === null) return;
    setMsg('');
    try {
      await api.post('/requests/assign', { requestId: approvingId, fileId, assignedToId });
      setMsg('Request approved and assigned.');
      closeApprove();
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not approve request.');
    }
  }

  async function accept(id: number) {
    setMsg('');
    try {
      await api.post(`/requests/${id}/accept`);
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not accept request.');
    }
  }

  function openReturn(id: number) {
    setReturningId(id);
    setActionFolio(''); setLastFolio(''); setReason('');
    setFileStatus(''); setProceedToDest(''); setBringUpNote('');
  }
  function closeReturn() {
    setReturningId(null);
  }
  async function submitReturn(e: FormEvent) {
    e.preventDefault();
    if (returningId === null) return;
    setMsg('');
    try {
      await api.post(`/requests/${returningId}/return`, {
        actionFolio: actionFolio || undefined,
        lastFolio: lastFolio || undefined,
        reason: reason || undefined,
        fileStatus: fileStatus || undefined,
        proceedToDest: fileStatus === 'proceed_to' ? (proceedToDest || undefined) : undefined,
        bringUpNote: bringUpNote || undefined,
      });
      setMsg('File marked as returned.');
      closeReturn();
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not mark as returned.');
    }
  }

  function isOverdue(r: RegistryRequest) {
    return !!r.due_date && r.status !== 'returned' && r.status !== 'rejected_auto' && new Date(r.due_date) < new Date();
  }

  return (
    <div className="card">
      <div className="card-title">Requests</div>

      <select value={status} onChange={(e) => setStatus(e.target.value as RequestStatus | '')} style={{ width: 220, marginBottom: 12 }}>
        <option value="">All statuses</option>
        {(Object.keys(REQUEST_STATUS_LABELS) as RequestStatus[]).map((s) => (
          <option key={s} value={s}>{REQUEST_STATUS_LABELS[s]}</option>
        ))}
      </select>

      {msg && <div className="info-msg" style={{ marginBottom: 10 }}>{msg}</div>}

      {approvingId !== null && (
        <div className="card" style={{ marginBottom: 12, background: '#f7f9fc' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Approve and assign to…</div>
          <form onSubmit={searchApproveUsers} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input type="text" value={approveUserSearch} onChange={(e) => setApproveUserSearch(e.target.value)} autoFocus />
            <button className="btn btn-primary btn-sm" type="submit">Search</button>
            <button type="button" className="btn btn-sm" onClick={closeApprove}>Cancel</button>
          </form>
          {approveResults.length > 0 && (
            <table className="reg-table">
              <thead><tr><th>Name</th><th>File number</th><th></th></tr></thead>
              <tbody>
                {approveResults.map((u) => {
                  const req = requests.find((r) => r.id === approvingId);
                  return (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.file_number}</td>
                      <td>
                        <button className="btn btn-sm btn-success" onClick={() => req && confirmApprove(u.id, req.file_id)}>
                          Assign here
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {returningId !== null && (
        <form onSubmit={submitReturn} className="card" style={{ marginBottom: 12, background: '#f7f9fc' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Mark file as returned</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Action folio</label>
              <input type="text" value={actionFolio} onChange={(e) => setActionFolio(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Last folio</label>
              <input type="text" value={lastFolio} onChange={(e) => setLastFolio(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: fileStatus === 'proceed_to' ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>File status</label>
              <select value={fileStatus} onChange={(e) => setFileStatus(e.target.value as typeof fileStatus)}>
                <option value="">—</option>
                <option value="actioned">Actioned</option>
                <option value="not_actioned">Not Actioned</option>
                <option value="proceed_to">Proceed To</option>
              </select>
            </div>
            {fileStatus === 'proceed_to' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Proceed to</label>
                <select value={proceedToDest} onChange={(e) => setProceedToDest(e.target.value as ProceedToDest)}>
                  <option value="">— Select —</option>
                  {(Object.keys(PROCEED_TO_LABELS) as ProceedToDest[]).map((d) => (
                    <option key={d} value={d}>{PROCEED_TO_LABELS[d]}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Bring up note</label>
            <textarea value={bringUpNote} onChange={(e) => setBringUpNote(e.target.value)} rows={2} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-success" type="submit">Confirm return</button>
            <button className="btn" type="button" onClick={closeReturn}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="empty-state">No requests found.</div>
      ) : (
        <table className="reg-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Registry code</th>
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
                <td>{r.registry_code || '—'}</td>
                <td>{r.requester_name || '—'}</td>
                <td>{r.assigned_to_name || '—'}</td>
                <td><span className={`tag ${STATUS_TAG[r.status]}`}>{REQUEST_STATUS_LABELS[r.status]}</span></td>
                <td>{r.due_date ? new Date(r.due_date).toLocaleDateString('en-KE') : '—'}</td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {r.status === 'pending' && user?.role === 'admin' && (
                    <button className="btn btn-sm btn-gold" onClick={() => openApprove(r.id, r.requester_name)}>Approve</button>
                  )}
                  {r.status === 'pending_accept' && (r.assigned_to_id === user?.id || user?.role === 'admin') && (
                    <button className="btn btn-sm btn-success" onClick={() => accept(r.id)}>Accept</button>
                  )}
                  {(r.status === 'accepted' || r.status === 'pending_accept') && (
                    <button className="btn btn-sm" onClick={() => openReturn(r.id)}>Mark returned</button>
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
