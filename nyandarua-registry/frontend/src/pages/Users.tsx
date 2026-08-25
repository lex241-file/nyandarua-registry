import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { SafeUser, Role } from '../types';

export default function Users() {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newFileNumber, setNewFileNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [newIdNumber, setNewIdNumber] = useState('');
  const [newRole, setNewRole] = useState<Role>('user');

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (includeInactive) params.set('includeInactive', 'true');
      const res = await api.get<{ users: SafeUser[] }>(`/users?${params.toString()}`);
      setUsers(res.users);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  async function addUser(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/users', {
        fileNumber: newFileNumber,
        name: newName,
        designation: newDesignation,
        idNumber: newIdNumber || null,
        role: newRole,
      });
      setNewFileNumber(''); setNewName(''); setNewDesignation(''); setNewIdNumber(''); setNewRole('user');
      setShowAdd(false);
      setMsg('User added. Default password is their ID number (or file number if none given).');
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not add user.');
    }
  }

  async function deactivate(fileNumber: string, name: string) {
    if (!confirm(`Remove "${name}" from the user list?\n\nThis disables their login but keeps their personal file record.`)) return;
    await api.post(`/users/${encodeURIComponent(fileNumber)}/deactivate`);
    load();
  }

  async function reactivate(fileNumber: string) {
    await api.post(`/users/${encodeURIComponent(fileNumber)}/reactivate`);
    load();
  }

  return (
    <div className="card">
      <div className="card-title">Users</div>

      <form
        onSubmit={(e) => { e.preventDefault(); load(); }}
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}
      >
        <input
          type="text"
          className="search-input"
          placeholder="Search by name, file number, designation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">Search</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} style={{ width: 'auto' }} />
          Show deactivated
        </label>
        <button type="button" className="btn btn-gold" onClick={() => setShowAdd((s) => !s)} style={{ marginLeft: 'auto' }}>
          {showAdd ? 'Cancel' : '+ Add user'}
        </button>
      </form>

      {showAdd && (
        <form onSubmit={addUser} className="card" style={{ marginBottom: 12, background: '#f7f9fc' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>File number</label>
              <input type="text" value={newFileNumber} onChange={(e) => setNewFileNumber(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Name</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Designation</label>
              <input type="text" value={newDesignation} onChange={(e) => setNewDesignation(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>ID number</label>
              <input type="text" value={newIdNumber} onChange={(e) => setNewIdNumber(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Role</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="special">Special</option>
              </select>
            </div>
            <button className="btn btn-success" type="submit">Add</button>
          </div>
        </form>
      )}

      {msg && <div className="info-msg" style={{ marginBottom: 10 }}>{msg}</div>}

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : users.length === 0 ? (
        <div className="empty-state">No users found.</div>
      ) : (
        <table className="reg-table">
          <thead>
            <tr>
              <th>File number</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.file_number}</td>
                <td>{u.name}</td>
                <td>{u.designation}</td>
                <td><span className="tag tag-purple">{u.role}</span></td>
                <td>{u.is_active ? <span className="tag tag-green">active</span> : <span className="tag tag-gray">inactive</span>}</td>
                <td>
                  {u.is_active ? (
                    <button className="btn btn-sm btn-danger" onClick={() => deactivate(u.file_number, u.name)}>Remove</button>
                  ) : (
                    <button className="btn btn-sm btn-success" onClick={() => reactivate(u.file_number)}>Restore</button>
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
