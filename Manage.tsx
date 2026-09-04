import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { SafeUser, Role, SubCategory, SUB_CATEGORY_OPTIONS, RegistryFile, FileCategory, Stats } from '../types';

export default function Manage() {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [specialUsers, setSpecialUsers] = useState<SafeUser[]>([]);

  const [newFileNumber, setNewFileNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [newIdNumber, setNewIdNumber] = useState('');
  const [newRole, setNewRole] = useState<Role>('user');
  const [newFileCategory, setNewFileCategory] = useState<SubCategory>('personal');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkDesignation, setBulkDesignation] = useState('');
  const [bulkRole, setBulkRole] = useState<Role | ''>('');
  const [bulkFileCategory, setBulkFileCategory] = useState<SubCategory | ''>('');

  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [editDesignation, setEditDesignation] = useState('');
  const [editRole, setEditRole] = useState<Role>('user');
  const [editFileCategory, setEditFileCategory] = useState<SubCategory>('personal');

  const [newFileName, setNewFileName] = useState('');
  const [newFileNumberF, setNewFileNumberF] = useState('');
  const [newDesignationF, setNewDesignationF] = useState('');
  const [newIdNumberF, setNewIdNumberF] = useState('');
  const [newFileCategoryF, setNewFileCategoryF] = useState<FileCategory>('general');

  const [allFiles, setAllFiles] = useState<RegistryFile[]>([]);
  const [fileSearch, setFileSearch] = useState('');
  const [filesLoading, setFilesLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const [usersRes, specialRes, statsRes] = await Promise.all([
        api.get<{ users: SafeUser[] }>(`/users?${params.toString()}`),
        api.get<{ users: SafeUser[] }>('/users?includeInactive=false'),
        api.get<Stats>('/stats'),
      ]);
      setUsers(usersRes.users.filter((u) => u.role !== 'special'));
      setSpecialUsers(specialRes.users.filter((u) => u.role === 'special'));
      setStats(statsRes);
    } finally {
      setLoading(false);
    }
  }

  async function loadFiles() {
    setFilesLoading(true);
    try {
      const params = new URLSearchParams();
      if (fileSearch) params.set('search', fileSearch);
      const res = await api.get<{ files: RegistryFile[] }>(`/files?${params.toString()}`);
      setAllFiles(res.files);
    } finally {
      setFilesLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        fileCategory: newFileCategory,
      });
      setNewFileNumber(''); setNewName(''); setNewDesignation(''); setNewIdNumber('');
      setNewRole('user'); setNewFileCategory('personal');
      setMsg('User added. Default password is their ID number (or file number if none given).');
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not add user.');
    }
  }

  async function deactivate(fileNumber: string, name: string) {
    if (!confirm(`Remove "${name}" from the user list? This disables their login but keeps their personal file record.`)) return;
    setMsg('');
    try {
      await api.post(`/users/${encodeURIComponent(fileNumber)}/deactivate`);
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = Array.isArray(err.details) && err.details.length
          ? ` (${err.details.map((d: any) => d.msg || d.path).join(', ')})`
          : '';
        setMsg(`Could not remove user: ${err.message}${detail}`);
      } else {
        setMsg('Could not remove user.');
      }
    }
  }

  function toggleSelect(fileNumber: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileNumber)) next.delete(fileNumber);
      else next.add(fileNumber);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.file_number)));
  }

  async function submitBulkEdit(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.patch('/users/bulk', {
        fileNumbers: Array.from(selected),
        designation: bulkDesignation || undefined,
        role: bulkRole || undefined,
        fileCategory: bulkFileCategory || undefined,
      });
      setMsg(`${selected.size} user(s) updated.`);
      setShowBulkEdit(false);
      setBulkDesignation(''); setBulkRole(''); setBulkFileCategory('');
      setSelected(new Set());
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not update selected users.');
    }
  }

  async function bulkRemove() {
    if (!confirm(`Remove ${selected.size} selected user(s)? This disables their login but keeps their personal file records.`)) return;
    setMsg('');
    try {
      await api.post('/users/bulk-deactivate', { fileNumbers: Array.from(selected) });
      setMsg(`${selected.size} user(s) removed.`);
      setSelected(new Set());
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not remove selected users.');
    }
  }

  function openEdit(u: SafeUser) {
    setEditingUser(u);
    setEditDesignation(u.designation);
    setEditRole(u.role);
    setEditFileCategory(u.file_category);
  }
  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setMsg('');
    try {
      await api.patch('/users/bulk', {
        fileNumbers: [editingUser.file_number],
        designation: editDesignation || undefined,
        role: editRole,
        fileCategory: editFileCategory,
      });
      setMsg(`${editingUser.name} updated.`);
      setEditingUser(null);
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not update user.');
    }
  }

  async function addCustomFile(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/files', { fileName: newFileName, fileNumber: newFileNumberF, category: newFileCategoryF });
      setNewFileName(''); setNewFileNumberF(''); setNewDesignationF(''); setNewIdNumberF('');
      setMsg('File added to registry.');
      loadFiles();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not add file.');
    }
  }

  async function removeFile(fileId: string, name: string, category: string) {
    if (category !== 'custom' && category !== 'confidential') return;
    if (!confirm(`Remove "${name}" from the registry?`)) return;
    try {
      await api.delete(`/files/${encodeURIComponent(fileId)}`);
      loadFiles();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not remove file.');
    }
  }

  const userCount = users.length;
  const adminCount = stats?.totalAdmins ?? 0;

  return (
    <div className="page">
      <div className="grid2">
        <div className="card">
          <div className="card-title">Add New User / Admin</div>
          <form onSubmit={addUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 4 }}>File Number *</label>
              <input type="text" placeholder="File number" value={newFileNumber} onChange={(e) => setNewFileNumber(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 4 }}>Full Name *</label>
              <input type="text" placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 4 }}>Designation</label>
              <input type="text" placeholder="Designation" value={newDesignation} onChange={(e) => setNewDesignation(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 4 }}>ID Number (used as password)</label>
              <input type="text" placeholder="ID number" value={newIdNumber} onChange={(e) => setNewIdNumber(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 4 }}>Role</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                <option value="user">Staff (User)</option>
                <option value="admin">Admin</option>
                <option value="special">Special</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 4 }}>File Category</label>
              <select value={newFileCategory} onChange={(e) => setNewFileCategory(e.target.value as SubCategory)}>
                {SUB_CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" type="submit">+ Add User</button>
          </form>
        </div>

        <div className="card">
          <div className="card-title">
            Active Users &amp; Admins
            <span className="tag tag-blue" style={{ marginLeft: 8 }}>{userCount} users</span>
            <span className="tag tag-purple" style={{ marginLeft: 4 }}>{adminCount} admins</span>
          </div>
          <p style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
            These accounts can log in to the system. Default password is ID Number (or File Number if no ID).
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); load(); }}
            style={{ display: 'flex', gap: 8, marginBottom: 10 }}
          >
            <input
              type="text"
              className="search-input"
              placeholder="Search users by name, file number, or designation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn-primary btn-sm" type="submit">Search</button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
              <input type="checkbox" checked={selected.size === users.length && users.length > 0} onChange={toggleSelectAll} style={{ width: 'auto' }} />
              Select All
            </label>
            {selected.size > 0 && (
              <>
                <button className="btn btn-sm btn-gold" onClick={() => setShowBulkEdit((s) => !s)}>Edit Selected</button>
                <button className="btn btn-sm btn-danger" onClick={bulkRemove}>Remove Selected</button>
              </>
            )}
          </div>

          {showBulkEdit && (
            <form onSubmit={submitBulkEdit} className="card" style={{ marginBottom: 10, background: '#f7f9fc' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>Designation</label>
                  <input type="text" value={bulkDesignation} onChange={(e) => setBulkDesignation(e.target.value)} placeholder="Leave blank to skip" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>Role</label>
                  <select value={bulkRole} onChange={(e) => setBulkRole(e.target.value as Role | '')}>
                    <option value="">Leave unchanged</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="special">Special</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>File category</label>
                  <select value={bulkFileCategory} onChange={(e) => setBulkFileCategory(e.target.value as SubCategory | '')}>
                    <option value="">Leave unchanged</option>
                    {SUB_CATEGORY_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-success btn-sm" type="submit">Apply to {selected.size}</button>
              </div>
            </form>
          )}

          {editingUser && (
            <form onSubmit={submitEdit} className="card" style={{ marginBottom: 10, background: '#f7f9fc' }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Edit {editingUser.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>Designation</label>
                  <input type="text" value={editDesignation} onChange={(e) => setEditDesignation(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>Role</label>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value as Role)}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="special">Special</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>File category</label>
                  <select value={editFileCategory} onChange={(e) => setEditFileCategory(e.target.value as SubCategory)}>
                    {SUB_CATEGORY_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-success btn-sm" type="submit">Save</button>
                  <button className="btn btn-sm" type="button" onClick={() => setEditingUser(null)}>Cancel</button>
                </div>
              </div>
            </form>
          )}

          {msg && <div className="info-msg" style={{ marginBottom: 10 }}>{msg}</div>}

          <div className="scroll-area-lg">
            {loading ? (
              <div className="empty-state">Loading…</div>
            ) : users.length === 0 ? (
              <div className="empty-state">No users found.</div>
            ) : (
              <table className="reg-table">
                <thead>
                  <tr>
                    <th style={{ width: 24 }}></th>
                    <th>File Number</th>
                    <th>Name</th>
                    <th>Designation</th>
                    <th>Role</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <input type="checkbox" style={{ width: 'auto' }} checked={selected.has(u.file_number)} onChange={() => toggleSelect(u.file_number)} />
                      </td>
                      <td style={{ fontWeight: 700 }}>{u.file_number}</td>
                      <td>{u.name}</td>
                      <td>{u.designation}</td>
                      <td><span className="tag tag-blue">{u.role}</span></td>
                      <td style={{ display: 'flex', gap: 4, whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm btn-gold" onClick={() => openEdit(u)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deactivate(u.file_number, u.name)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Special Users (No Login Required)</div>
        <p style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
          These users can be assigned files by admin. Files due in 3 months. They do not log in to the system.
        </p>
        <table className="reg-table">
          <thead>
            <tr><th>File Number</th><th>Name</th><th>Designation</th><th>Type</th><th>Due Period</th></tr>
          </thead>
          <tbody>
            {specialUsers.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 700 }}>{u.file_number}</td>
                <td>{u.name}</td>
                <td>{u.designation}</td>
                <td><span className="tag tag-gold">Special</span></td>
                <td>3 Months</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Add Custom File to Registry</div>
        <form onSubmit={addCustomFile} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>File Name *</label>
            <input type="text" placeholder="File name" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>File Number *</label>
            <input type="text" placeholder="File number" value={newFileNumberF} onChange={(e) => setNewFileNumberF(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Designation</label>
            <input type="text" placeholder="Designation (optional)" value={newDesignationF} onChange={(e) => setNewDesignationF(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>ID Number</label>
            <input type="text" placeholder="ID Number (optional)" value={newIdNumberF} onChange={(e) => setNewIdNumberF(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Category</label>
            <select value={newFileCategoryF} onChange={(e) => setNewFileCategoryF(e.target.value as FileCategory)}>
              <option value="general">General</option>
              <option value="custom">Custom</option>
              <option value="confidential">Confidential</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="btn btn-primary" type="submit">+ Add</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-title">
          All Files in Registry
          <span className="tag tag-blue" style={{ marginLeft: 8 }}>{stats?.totalFiles ?? '—'} files</span>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); loadFiles(); }}
          style={{ display: 'flex', gap: 8, marginBottom: 10 }}
        >
          <input
            type="text"
            className="search-input"
            placeholder="Search files by name or number…"
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" type="submit">Search</button>
        </form>

        <div className="scroll-area-xl">
          {filesLoading ? (
            <div className="empty-state">Loading…</div>
          ) : allFiles.length === 0 ? (
            <div className="empty-state">No files found.</div>
          ) : (
            <table className="reg-table">
              <thead>
                <tr><th>File Number</th><th>File Name</th><th>Type</th><th>Category</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {allFiles.slice(0, 300).map((f) => {
                  const removable = f.category === 'custom' || f.category === 'confidential';
                  return (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 700 }}>{f.file_number}</td>
                      <td>{f.file_name}</td>
                      <td><span className={`tag ${f.category === 'confidential' ? 'tag-red' : 'tag-gray'}`}>{f.category}</span></td>
                      <td style={{ fontSize: 11 }}>{f.sub_category || '—'}</td>
                      <td>{f.is_unavailable ? <span className="tag tag-amber">Out</span> : <span className="tag tag-green">Available</span>}</td>
                      <td>
                        {removable ? (
                          <button className="btn btn-sm btn-danger" onClick={() => removeFile(f.file_id, f.file_name, f.category)}>Remove</button>
                        ) : (
                          <span style={{ fontSize: 11, color: '#aaa' }}>System file</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {allFiles.length > 300 && (
          <p style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
            Showing first 300 of {allFiles.length} — use search to narrow this down.
          </p>
        )}
      </div>
    </div>
  );
}
