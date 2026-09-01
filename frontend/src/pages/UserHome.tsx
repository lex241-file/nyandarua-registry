import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import RegistryFilesBrowser from '../components/RegistryFilesBrowser';
import SearchCard from '../components/SearchCard';
import SelectedFilesPanel, { ConfidentialEntry } from '../components/SelectedFilesPanel';
import { RegistryFile, RegistryRequest } from '../types';

export default function UserHome() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confidential, setConfidential] = useState<ConfidentialEntry[]>([]);
  const [fileCache, setFileCache] = useState<Map<number, RegistryFile>>(new Map());
  const [msg, setMsg] = useState('');

  const [myRequests, setMyRequests] = useState<RegistryRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadMyRequests() {
    setLoading(true);
    try {
      const res = await api.get<{ requests: RegistryRequest[] }>('/requests?mine=true');
      setMyRequests(res.requests);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMyRequests();
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

  function addConfidential(fileNumber: string, fileName: string) {
    setConfidential((prev) => [...prev, { fileNumber, fileName }]);
  }

  async function acceptFile(id: number) {
    setMsg('');
    try {
      await api.post(`/requests/${id}/accept`);
      loadMyRequests();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not accept file.');
    }
  }

  async function requestAgain(id: number) {
    setMsg('');
    try {
      await api.post(`/requests/${id}/request-again`);
      setMsg('File re-requested. Admin will process your request.');
      loadMyRequests();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not re-request file.');
    }
  }

  const pendingAccept = myRequests.filter((r) => r.status === 'pending_accept');
  const myFiles = myRequests.filter((r) => r.status === 'accepted');
  const allFiles = Array.from(fileCache.values());

  function isOverdue(r: RegistryRequest) {
    return !!r.due_date && new Date(r.due_date) < new Date();
  }

  return (
    <div className="page">
      <div className="user-header">
        <div className="avatar-circle">{user?.name.charAt(0)}</div>
        <div className="user-header-info">
          <div className="user-header-name">{user?.name}</div>
          <div className="user-header-sub">{user?.designation} &nbsp;|&nbsp; File No: {user?.file_number}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="mini-stat">
            <div className="mini-stat-num">{myFiles.length}</div>
            <div className="mini-stat-lbl">My Files</div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-num" style={{ color: '#ffd700' }}>{pendingAccept.length}</div>
            <div className="mini-stat-lbl">Pending</div>
          </div>
        </div>
      </div>

      {msg && <div className="info-msg">{msg}</div>}

      <div className="cols">
        <div className="col-left">
          <RegistryFilesBrowser role="user" selected={selected} onToggle={toggleSelect} onAddConfidential={addConfidential} onFilesLoaded={mergeFiles} />
        </div>
        <div className="col-right">
          <SearchCard selected={selected} onToggle={toggleSelect} onResults={mergeFiles} />
          <SelectedFilesPanel
            role="user"
            files={allFiles}
            selectedIds={selected}
            confidential={confidential}
            onClearSelection={() => setSelected(new Set())}
            onClearConfidential={() => setConfidential([])}
            onDone={(m) => { setMsg(m); loadMyRequests(); }}
          />

          <div className="card">
            <div className="card-title">
              📥 Files Assigned to Me
              {pendingAccept.length > 0 && <span className="tag tag-amber">{pendingAccept.length} pending</span>}
            </div>
            {loading ? (
              <p style={{ fontSize: 12, color: '#888' }}>Loading…</p>
            ) : pendingAccept.length === 0 ? (
              <p style={{ fontSize: 12, color: '#888' }}>No files awaiting your acceptance.</p>
            ) : (
              pendingAccept.map((r) => (
                <div key={r.id} className="file-row-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{r.file_name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {r.file_number_label} | Assigned: {r.assigned_date ? new Date(r.assigned_date).toLocaleDateString('en-KE') : '—'}
                    </div>
                    {r.registry_code && <div style={{ fontSize: 11 }}>Registry Code: <strong>{r.registry_code}</strong></div>}
                  </div>
                  <button className="btn btn-sm btn-success" onClick={() => acceptFile(r.id)}>✓ Accept</button>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div className="card-title">📋 My Files {myFiles.length > 0 && <span className="tag tag-green" style={{ marginLeft: 'auto' }}>{myFiles.length} files</span>}</div>
            {loading ? (
              <p style={{ fontSize: 12, color: '#888' }}>Loading…</p>
            ) : myFiles.length === 0 ? (
              <p style={{ fontSize: 12, color: '#888' }}>You have no files currently assigned to you.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="reg-table">
                  <thead>
                    <tr>
                      <th>Date Assigned</th><th>File Number</th><th>File Name</th><th>Registry Code</th>
                      <th>Action Folio</th><th>Reason</th><th>Due Date</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myFiles.map((r) => {
                      const overdue = isOverdue(r);
                      return (
                        <tr key={r.id} className={overdue ? 'overdue-row' : ''}>
                          <td>{r.assigned_date ? new Date(r.assigned_date).toLocaleDateString('en-KE') : '—'}</td>
                          <td style={{ fontWeight: 700 }}>{r.file_number_label}</td>
                          <td>{r.file_name}</td>
                          <td>{r.registry_code || '—'}</td>
                          <td>{r.action_folio || '—'}</td>
                          <td>{r.reason || '—'}</td>
                          <td style={{ color: overdue ? '#c0392b' : '#27ae60', fontWeight: 700 }}>
                            {r.due_date ? new Date(r.due_date).toLocaleDateString('en-KE') : '—'}
                          </td>
                          <td>
                            {overdue ? (
                              <button className="btn btn-warn btn-sm" onClick={() => requestAgain(r.id)}>↺ Request Again</button>
                            ) : (
                              <span className="tag tag-green">Active</span>
                            )}
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
