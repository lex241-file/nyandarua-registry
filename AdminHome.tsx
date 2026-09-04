import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import RegistryFilesBrowser from '../components/RegistryFilesBrowser';
import SearchCard from '../components/SearchCard';
import SelectedFilesPanel from '../components/SelectedFilesPanel';
import { RegistryFile, RegistryRequest, Stats, UserDirectoryEntry } from '../types';

type StatView = 'total' | 'assigned' | 'remaining' | 'pending' | 'rejected' | null;

export default function AdminHome() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fileCache, setFileCache] = useState<Map<number, RegistryFile>>(new Map());
  const [msg, setMsg] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [allRegistryFiles, setAllRegistryFiles] = useState<RegistryFile[]>([]);
  const [allUsers, setAllUsers] = useState<UserDirectoryEntry[]>([]);
  const [statView, setStatView] = useState<StatView>(null);

  const [pending, setPending] = useState<RegistryRequest[]>([]);
  const [rejected, setRejected] = useState<RegistryRequest[]>([]);
  const [assigned, setAssigned] = useState<RegistryRequest[]>([]);
  const [assignedSearch, setAssignedSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Per-pending-request inline approve fields.
  const [approveFields, setApproveFields] = useState<Record<number, { registryCode: string; folio: string; reason: string; assignTo: number | null }>>({});

  async function loadAll() {
    setLoading(true);
    try {
      const [pendingRes, rejectedRes, acceptedRes, pendingAcceptRes, statsRes, filesRes, usersRes] = await Promise.all([
        api.get<{ requests: RegistryRequest[] }>('/requests?status=pending'),
        api.get<{ requests: RegistryRequest[] }>('/requests?status=rejected_auto'),
        api.get<{ requests: RegistryRequest[] }>('/requests?status=accepted'),
        api.get<{ requests: RegistryRequest[] }>('/requests?status=pending_accept'),
        api.get<Stats>('/stats'),
        api.get<{ files: RegistryFile[] }>('/files'),
        // Same list source as the Manage Files & Users page — the Assign
        // dropdown must offer exactly the same set of accounts, not a
        // separate search-as-you-type lookup.
        api.get<{ users: UserDirectoryEntry[] }>('/users/directory'),
      ]);
      setPending(pendingRes.requests);
      setRejected(rejectedRes.requests);
      setAssigned([...pendingAcceptRes.requests, ...acceptedRes.requests]);
      setStats(statsRes);
      setAllRegistryFiles(filesRes.files);
      setAllUsers(usersRes.users);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function mergeFiles(files: RegistryFile[]) {
    setFileCache((prev) => {
      const next = new Map(prev);
      files.forEach((f) => next.set(f.id, f));
      return next;
    });
  }

  function toggleSelect(fileId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  function getApproveFields(id: number) {
    return approveFields[id] || { registryCode: '', folio: '', reason: '', assignTo: null };
  }
  function updateApproveFields(id: number, patch: Partial<ReturnType<typeof getApproveFields>>) {
    setApproveFields((prev) => ({ ...prev, [id]: { ...getApproveFields(id), ...patch } }));
  }

  async function approveRequest(r: RegistryRequest) {
    const fields = getApproveFields(r.id);
    const assignedToId = fields.assignTo ?? r.requester_id;
    if (!assignedToId) {
      setMsg('Choose who to assign this file to.');
      return;
    }
    setMsg('');
    try {
      await api.post('/requests/assign', {
        requestId: r.id,
        fileId: r.file_id,
        assignedToId,
        registryCode: fields.registryCode || undefined,
      });
      setMsg('Request approved and assigned.');
      loadAll();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not approve request.');
    }
  }

  async function returnFile(id: number) {
    setMsg('');
    try {
      await api.post(`/requests/${id}/return`, {});
      setMsg('File returned to registry.');
      loadAll();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not return file.');
    }
  }

  async function updateFileStatus(id: number, fileStatus: string, proceedToDest?: string) {
    try {
      await api.post(`/requests/${id}/return`, { fileStatus, proceedToDest });
    } catch {
      // silent — this is an inline convenience update, not a hard return action here
    }
  }

  const allFiles = Array.from(fileCache.values());
  const filteredAssigned = assignedSearch
    ? assigned.filter((r) =>
        r.file_name.toLowerCase().includes(assignedSearch.toLowerCase()) ||
        r.file_number_label.toLowerCase().includes(assignedSearch.toLowerCase()) ||
        (r.assigned_to_name || '').toLowerCase().includes(assignedSearch.toLowerCase()) ||
        (r.registry_code || '').toLowerCase().includes(assignedSearch.toLowerCase())
      )
    : assigned;

  function isOverdue(r: RegistryRequest) {
    return !!r.due_date && new Date(r.due_date) < new Date();
  }

  return (
    <div className="page">
      <div className="user-header">
        <div className="avatar-circle" style={{ background: 'linear-gradient(135deg,#b8860b,#27ae60)' }}>{user?.name.charAt(0)}</div>
        <div className="user-header-info">
          <div className="user-header-name">{user?.name} <span className="tag tag-gold">Admin</span></div>
          <div className="user-header-sub">{user?.designation}</div>
        </div>
      </div>

      {stats && (
        <div className="admin-stats-row">
          <div className="stat-card admin-total-card clickable" onClick={() => setStatView('total')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="stat-lbl">📁 Total Files in Registry</div>
              <div className="stat-num" style={{ fontSize: 26 }}>{stats.totalFiles}</div>
            </div>
            <div className="admin-total-grid">
              <div className="admin-total-cell"><div className="admin-total-num">{stats.breakdown.general}</div><div className="admin-total-sub">📚 General Files</div></div>
              <div className="admin-total-cell"><div className="admin-total-num">{stats.breakdown.personalTotal}</div><div className="admin-total-sub">👤 Personal Files</div></div>
              <div className="admin-total-cell admin-total-cell-dim"><div className="admin-total-num-sm">{stats.breakdown.personalActive}</div><div className="admin-total-sub-dim">Active Staff</div></div>
              <div className="admin-total-cell admin-total-cell-dim"><div className="admin-total-num-sm">{stats.breakdown.interns}</div><div className="admin-total-sub-dim">Interns</div></div>
              <div className="admin-total-cell admin-total-cell-dim" style={{ gridColumn: 'span 2' }}><div className="admin-total-num-sm">{stats.breakdown.semiActive}</div><div className="admin-total-sub-dim">Semi-Active (Retired/Resigned/etc.)</div></div>
            </div>
          </div>
          <div className="stat-card clickable" onClick={() => setStatView('assigned')}><div className="stat-num">{stats.assignedFiles}</div><div className="stat-lbl">✅ Files Assigned</div></div>
          <div className="stat-card clickable" onClick={() => setStatView('remaining')}><div className="stat-num">{stats.remainingFiles}</div><div className="stat-lbl">📂 Files Remaining</div></div>
          <div className="stat-card clickable" onClick={() => setStatView('pending')}><div className="stat-num">{stats.pendingRequests}</div><div className="stat-lbl">🔔 Awaiting Assignment</div></div>
          <div className="stat-card clickable" onClick={() => setStatView('rejected')}><div className="stat-num">{stats.rejectedFiles}</div><div className="stat-lbl">❌ Rejected</div></div>
        </div>
      )}

      {statView && (
        <div className="modal-overlay" onClick={() => setStatView(null)}>
          <div className="modal-box" style={{ width: 700 }} onClick={(e) => e.stopPropagation()}>
            {statView === 'total' && (
              <>
                <div className="modal-title">All Files in Registry ({allRegistryFiles.length})</div>
                <table className="reg-table">
                  <thead><tr><th>File Number</th><th>Name</th><th>Category</th><th>Status</th></tr></thead>
                  <tbody>
                    {allRegistryFiles.slice(0, 200).map((f) => (
                      <tr key={f.id}>
                        <td>{f.file_number}</td>
                        <td>{f.file_name}</td>
                        <td>{f.category}</td>
                        <td>{f.is_unavailable ? <span className="tag tag-amber">Out</span> : <span className="tag tag-green">Available</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {statView === 'assigned' && (
              <>
                <div className="modal-title">Files Assigned ({assigned.length})</div>
                <table className="reg-table">
                  <thead><tr><th>File Number</th><th>File Name</th><th>Assigned To</th><th>Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {assigned.map((r) => (
                      <tr key={r.id}>
                        <td>{r.file_number_label}</td>
                        <td>{r.file_name}</td>
                        <td>{r.assigned_to_name || r.requester_name || '—'}</td>
                        <td>{r.assigned_date ? new Date(r.assigned_date).toLocaleDateString('en-KE') : '—'}</td>
                        <td><span className={`tag ${r.status === 'accepted' ? 'tag-green' : 'tag-amber'}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {statView === 'remaining' && (
              <>
                <div className="modal-title">Available Files ({allRegistryFiles.filter((f) => !f.is_unavailable).length})</div>
                <table className="reg-table">
                  <thead><tr><th>File Number</th><th>Name</th><th>Category</th></tr></thead>
                  <tbody>
                    {allRegistryFiles.filter((f) => !f.is_unavailable).slice(0, 200).map((f) => (
                      <tr key={f.id}><td>{f.file_number}</td><td>{f.file_name}</td><td>{f.category}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {statView === 'pending' && (
              <>
                <div className="modal-title">Pending Requests ({pending.length})</div>
                <table className="reg-table">
                  <thead><tr><th>File Number</th><th>File Name</th><th>Requested By</th><th>Date</th><th>Reason</th></tr></thead>
                  <tbody>
                    {pending.map((r) => (
                      <tr key={r.id}>
                        <td>{r.file_number_label}</td>
                        <td>{r.file_name}</td>
                        <td>{r.requester_name || '—'}</td>
                        <td>{r.requested_date ? new Date(r.requested_date).toLocaleDateString('en-KE') : '—'}</td>
                        <td>{r.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {statView === 'rejected' && (
              <>
                <div className="modal-title">Rejected Files ({rejected.length})</div>
                <table className="reg-table">
                  <thead><tr><th>File Number</th><th>File Name</th><th>Requested By</th><th>Assigned Date</th><th>Folio</th></tr></thead>
                  <tbody>
                    {rejected.map((r) => (
                      <tr key={r.id}>
                        <td>{r.file_number_label}</td>
                        <td>{r.file_name}</td>
                        <td>{r.requester_name || '—'}</td>
                        <td>{r.assigned_date ? new Date(r.assigned_date).toLocaleDateString('en-KE') : '—'}</td>
                        <td>{r.action_folio || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <button className="btn" style={{ marginTop: 12, width: '100%' }} onClick={() => setStatView(null)}>Close</button>
          </div>
        </div>
      )}

      {msg && <div className="info-msg">{msg}</div>}

      <div className="cols">
        <div className="col-left">
          <RegistryFilesBrowser role="admin" selected={selected} onToggle={toggleSelect} onFilesLoaded={mergeFiles} />
        </div>
        <div className="col-right">
          <SearchCard selected={selected} onToggle={toggleSelect} onResults={mergeFiles} />
          <SelectedFilesPanel
            role="admin"
            files={allFiles}
            selectedIds={selected}
            confidential={[]}
            allUsers={allUsers}
            onClearSelection={() => setSelected(new Set())}
            onClearConfidential={() => {}}
            onDone={(m) => { setMsg(m); loadAll(); }}
          />

          <div className="card">
            <div className="card-title">🔔 Files Requested — Awaiting Assignment {pending.length > 0 && <span className="tag tag-red">{pending.length} pending</span>}</div>
            {loading ? <p style={{ fontSize: 12, color: '#888' }}>Loading…</p> : pending.length === 0 ? (
              <p style={{ fontSize: 12, color: '#888' }}>No pending file requests.</p>
            ) : (
              pending.map((r) => {
                const f = getApproveFields(r.id);
                return (
                  <div key={r.id} className="assign-row">
                    <div style={{ flex: 1 }}>
                      <strong>{r.file_name}</strong> <span style={{ color: '#888' }}>{r.file_number_label}</span>
                      <div style={{ fontSize: 11 }}>Requested by: <strong>{r.requester_name}</strong> on {r.requested_date ? new Date(r.requested_date).toLocaleDateString('en-KE') : '—'}</div>
                      <div className="assign-fields">
                        <div><label>Registry Code</label><input type="text" value={f.registryCode} onChange={(e) => updateApproveFields(r.id, { registryCode: e.target.value })} /></div>
                        <div><label>Folio</label><input type="text" value={f.folio} onChange={(e) => updateApproveFields(r.id, { folio: e.target.value })} /></div>
                        <div><label>Reason</label><input type="text" value={f.reason} onChange={(e) => updateApproveFields(r.id, { reason: e.target.value })} /></div>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 2 }}>Assign to</label>
                        <select
                          value={f.assignTo ?? r.requester_id ?? ''}
                          onChange={(e) => updateApproveFields(r.id, { assignTo: e.target.value ? Number(e.target.value) : null })}
                        >
                          {allUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.file_number}){u.id === r.requester_id ? ' — requester' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button className="btn btn-success btn-sm" onClick={() => approveRequest(r)}>✓ Assign</button>
                  </div>
                );
              })
            )}
          </div>

          <div className="card">
            <div className="card-title">
              ❌ Rejected Files <span style={{ fontSize: 11, fontWeight: 400, color: '#888' }}>(not accepted within 12 hours)</span>
              <span className="tag tag-red" style={{ marginLeft: 'auto' }}>{rejected.length}</span>
            </div>
            {loading ? <p style={{ fontSize: 12, color: '#888' }}>Loading…</p> : rejected.length === 0 ? (
              <p style={{ fontSize: 12, color: '#888' }}>No rejected files at this time.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="reg-table">
                  <thead><tr><th>Date Assigned</th><th>File Number</th><th>File Name</th><th>Requested By</th><th>Registry Code</th><th>Action</th></tr></thead>
                  <tbody>
                    {rejected.map((r) => (
                      <tr key={r.id}>
                        <td>{r.assigned_date ? new Date(r.assigned_date).toLocaleDateString('en-KE') : '—'}</td>
                        <td style={{ fontWeight: 700 }}>{r.file_number_label}</td>
                        <td>{r.file_name}</td>
                        <td>{r.requester_name || '—'}</td>
                        <td>{r.registry_code || '—'}</td>
                        <td><button className="btn btn-warn btn-sm" onClick={() => returnFile(r.id)}>↩ Return to Registry</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">👥 Files Assigned to Users <span className="tag tag-blue" style={{ marginLeft: 'auto' }}>{assigned.length}</span></div>
            <input type="text" placeholder="Search assigned files…" value={assignedSearch} onChange={(e) => setAssignedSearch(e.target.value)} style={{ marginBottom: 8 }} />
            {loading ? <p style={{ fontSize: 12, color: '#888' }}>Loading…</p> : filteredAssigned.length === 0 ? (
              <p style={{ fontSize: 12, color: '#888' }}>No files currently assigned.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="reg-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>File No.</th><th>File Name</th><th>Registry Code</th><th>Assigned To</th>
                      <th>Action Folio</th><th>Due Date</th><th>Status</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssigned.map((r) => {
                      const overdue = isOverdue(r);
                      return (
                        <tr key={r.id} className={overdue ? 'overdue-row' : ''}>
                          <td>{r.assigned_date ? new Date(r.assigned_date).toLocaleDateString('en-KE') : '—'}</td>
                          <td style={{ fontWeight: 700 }}>{r.file_number_label}</td>
                          <td>{r.file_name}</td>
                          <td>{r.registry_code || '—'}</td>
                          <td>{r.assigned_to_name || '—'}</td>
                          <td>{r.action_folio || '—'}</td>
                          <td style={{ color: overdue ? '#c0392b' : '#27ae60', fontWeight: 700 }}>{r.due_date ? new Date(r.due_date).toLocaleDateString('en-KE') : '—'}</td>
                          <td>
                            <select
                              defaultValue={r.file_status || ''}
                              onChange={(e) => updateFileStatus(r.id, e.target.value)}
                              style={{ fontSize: 11, padding: '2px 4px', marginBottom: 4 }}
                            >
                              <option value="">— Status —</option>
                              <option value="actioned">Actioned</option>
                              <option value="not_actioned">Not Actioned</option>
                              <option value="proceed_to">Proceed To</option>
                            </select>
                          </td>
                          <td>
                            <span className={`tag ${r.status === 'accepted' ? 'tag-green' : 'tag-amber'}`} style={{ display: 'block', marginBottom: 4 }}>
                              {r.status === 'accepted' ? 'Accepted' : 'Pending'}
                            </span>
                            <button className="btn btn-danger btn-sm" onClick={() => returnFile(r.id)}>↩ Return</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
