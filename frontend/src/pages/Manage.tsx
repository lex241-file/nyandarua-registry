import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { SafeUser, Role, SubCategory, SUB_CATEGORY_OPTIONS, SUB_CATEGORY_LABELS, RegistryFile, FileCategory } from '../types';

export default function Manage() {
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
  const [newFileCategory, setNewFileCategory] = useState<SubCategory>('personal');

  // Bulk selection.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkDesignation, setBulkDesignation] = useState('');
  const [bulkRole, setBulkRole] = useState<Role | ''>('');
  const [bulkFileCategory, setBulkFileCategory] = useState<SubCategory | ''>('');

  // Single-user edit (reuses the bulk endpoint with a one-item array).
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editRole, setEditRole] = useState<Role>('user');
  const [editFileCategory, setEditFileCategory] = useState<SubCategory>('personal');

  // Custom / confidential file management.
  const [customFiles, setCustomFiles] = useState<RegistryFile[]>([]);
  const [customSearch, setCustomSearch] = useState('');
  const [showAddFile, setShowAddFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileNumberF, setNewFileNumberF] = useState('');
  const [newFileCategoryF, setNewFileCategoryF] = useState<FileCategory>('custom');

  async function loadCustomFiles() {
    const params = new URLSearchParams();
    if (customSearch) params.set('search', customSearch);
    const [customRes, confRes] = await Promise.all([
      api.get<{ files: RegistryFile[] }>(`/files?category=custom&${params.toString()}`),
      api.get<{ files: RegistryFile[] }>(`/files?category=confidential&${params.toString()}`),
    ]);
    setCustomFiles([...customRes.files, ...confRes.files]);
  }

  async function addCustomFile(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/files', { fileName: newFileName, fileNumber: newFileNumberF, category: newFileCategoryF });
      setNewFileName(''); setNewFileNumberF(''); setShowAddFile(false);
      setMsg('File added.');
      loadCustomFiles();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not add file.');
    }
  }

  async function removeCustomFile(fileId: string, name: string) {
    if (!confirm(`Remove "${name}" from the registry?`)) return;
    try {
      await api.delete(`/files/${encodeURIComponent(fileId)}`);
      loadCustomFiles();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not remove file.');
    }
  }

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

  useEffect(() => {
    loadCustomFiles();
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
    if (!confirm(`Remove ${selected.size} selected user(s)?\n\nThis disables their login but keeps their personal file records.`)) return;
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
    setEditName(u.name);
    setEditDesignation(u.designation);
    setEditRole(u.role);
    setEditFileCategory(u.file_category);
  }
  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setMsg('');
    try {
      // Reuses the bulk endpoint with a single-item array — same effect
      // as a dedicated single-user edit route, no separate backend call needed.
      // Name changes aren't supported by /users/bulk (only designation/role/
      // fileCategory), so we only send what's actually editable there.
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

  return (
    <>
    <div className="card">
      <div className="card-title">⚙️ Manage Files &amp; Users — Staff Accounts</div>

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
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
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>File category</label>
              <select value={newFileCategory} onChange={(e) => setNewFileCategory(e.target.value as SubCategory)}>
                {SUB_CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-success" type="submit">Add</button>
          </div>
        </form>
      )}

      {editingUser && (
        <form onSubmit={submitEdit} className="card" style={{ marginBottom: 12, background: '#f7f9fc' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Edit {editingUser.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Designation</label>
              <input type="text" value={editDesignation} onChange={(e) => setEditDesignation(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Role</label>
              <select value={editRole} onChange={(e) => setEditRole(e.target.value as Role)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="special">Special</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>File category</label>
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
          <p style={{ fontSize: 11, color: '#888', marginTop: 6 }}>Name and ID number aren't editable here — contact your database administrator for corrections to those.</p>
        </form>
      )}

      {selected.size > 0 && (
        <div className="card" style={{ marginBottom: 12, background: '#fef0cc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: showBulkEdit ? 10 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{selected.size} selected</span>
            <button className="btn btn-sm btn-warn" onClick={() => setShowBulkEdit((s) => !s)}>
              {showBulkEdit ? 'Cancel bulk edit' : 'Bulk edit'}
            </button>
            <button className="btn btn-sm btn-danger" onClick={bulkRemove}>Remove selected</button>
            <button className="btn btn-sm" onClick={() => setSelected(new Set())}>Clear selection</button>
          </div>
          {showBulkEdit && (
            <form onSubmit={submitBulkEdit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Designation (optional)</label>
                <input type="text" value={bulkDesignation} onChange={(e) => setBulkDesignation(e.target.value)} placeholder="Leave blank to skip" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Role (optional)</label>
                <select value={bulkRole} onChange={(e) => setBulkRole(e.target.value as Role | '')}>
                  <option value="">Leave unchanged</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="special">Special</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>File category (optional)</label>
                <select value={bulkFileCategory} onChange={(e) => setBulkFileCategory(e.target.value as SubCategory | '')}>
                  <option value="">Leave unchanged</option>
                  {SUB_CATEGORY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-success btn-sm" type="submit">Apply to {selected.size}</button>
            </form>
          )}
        </div>
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
              <th style={{ width: 28 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={selected.size === users.length && users.length > 0} onChange={toggleSelectAll} />
              </th>
              <th>File number</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Role</th>
              <th>File category</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <input type="checkbox" style={{ width: 'auto' }} checked={selected.has(u.file_number)} onChange={() => toggleSelect(u.file_number)} />
                </td>
                <td>{u.file_number}</td>
                <td>{u.name}</td>
                <td>{u.designation}</td>
                <td><span className="tag tag-purple">{u.role}</span></td>
                <td style={{ fontSize: 11 }}>{SUB_CATEGORY_LABELS[u.file_category]}</td>
                <td>{u.is_active ? <span className="tag tag-green">active</span> : <span className="tag tag-gray">inactive</span>}</td>
                <td style={{ display: 'flex', gap: 4, whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm btn-warn" onClick={() => openEdit(u)}>Edit</button>
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

    <div className="card">
      <div className="card-title">📁 Custom &amp; Confidential Files</div>
      <form
        onSubmit={(e) => { e.preventDefault(); loadCustomFiles(); }}
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}
      >
        <input
          type="text"
          className="search-input"
          placeholder="Search custom/confidential files…"
          value={customSearch}
          onChange={(e) => setCustomSearch(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">Search</button>
        <button type="button" className="btn btn-gold" onClick={() => setShowAddFile((s) => !s)} style={{ marginLeft: 'auto' }}>
          {showAddFile ? 'Cancel' : '+ Add file'}
        </button>
      </form>

      {showAddFile && (
        <form onSubmit={addCustomFile} className="card" style={{ marginBottom: 12, background: '#f7f9fc' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>File name</label>
              <input type="text" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>File number</label>
              <input type="text" value={newFileNumberF} onChange={(e) => setNewFileNumberF(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Category</label>
              <select value={newFileCategoryF} onChange={(e) => setNewFileCategoryF(e.target.value as FileCategory)}>
                <option value="custom">Custom</option>
                <option value="confidential">Confidential</option>
              </select>
            </div>
            <button className="btn btn-success" type="submit">Add</button>
          </div>
        </form>
      )}

      {customFiles.length === 0 ? (
        <div className="empty-state">No custom or confidential files found.</div>
      ) : (
        <table className="reg-table">
          <thead><tr><th>Name</th><th>Number</th><th>Category</th><th></th></tr></thead>
          <tbody>
            {customFiles.map((f) => (
              <tr key={f.id}>
                <td>{f.file_name}</td>
                <td>{f.file_number}</td>
                <td><span className={`tag ${f.category === 'confidential' ? 'tag-red' : 'tag-gray'}`}>{f.category}</span></td>
                <td><button className="btn btn-sm btn-danger" onClick={() => removeCustomFile(f.file_id, f.file_name)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    </>
  );
}
