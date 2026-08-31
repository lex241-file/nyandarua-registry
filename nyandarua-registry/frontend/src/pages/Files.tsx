import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RegistryFile, FileCategory, SafeUser, SubCategory, SUB_CATEGORY_OPTIONS } from '../types';

export default function Files() {
  const { user } = useAuth();
  const [files, setFiles] = useState<RegistryFile[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FileCategory | ''>('');
  const [subCategory, setSubCategory] = useState<SubCategory | ''>('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newCategory, setNewCategory] = useState<FileCategory>('custom');
  const [newSubCategory, setNewSubCategory] = useState<SubCategory | ''>('');

  // Batch selection for requesting multiple files at once.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submittingBatch, setSubmittingBatch] = useState(false);

  // Admin "assign to user" picker state.
  const [assigningFileId, setAssigningFileId] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<SafeUser[]>([]);
  const [assigning, setAssigning] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (category === 'personal' && subCategory) params.set('subCategory', subCategory);
      const res = await api.get<{ files: RegistryFile[] }>(`/files?${params.toString()}`);
      setFiles(res.files);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, subCategory]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    load();
  }

  function toggleSelect(fileId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  async function requestSelected() {
    if (selected.size === 0) return;
    setSubmittingBatch(true);
    setMsg('');
    try {
      const res = await api.post<{ created: number[]; skipped: number[] }>('/requests', {
        fileIds: Array.from(selected),
      });
      const parts: string[] = [];
      if (res.created.length) parts.push(`${res.created.length} file(s) requested.`);
      if (res.skipped.length) parts.push(`${res.skipped.length} file(s) skipped (already out).`);
      setMsg(parts.join(' '));
      setSelected(new Set());
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not submit batch request.');
    } finally {
      setSubmittingBatch(false);
    }
  }

  async function addFile(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/files', {
        fileName: newName,
        fileNumber: newNumber,
        category: newCategory,
        subCategory: newCategory === 'personal' && newSubCategory ? newSubCategory : undefined,
      });
      setNewName('');
      setNewNumber('');
      setNewSubCategory('');
      setShowAdd(false);
      setMsg('File added successfully.');
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not add file.');
    }
  }

  function openAssign(fileId: number) {
    setAssigningFileId(fileId);
    setUserSearch('');
    setUserResults([]);
  }

  function closeAssign() {
    setAssigningFileId(null);
    setUserSearch('');
    setUserResults([]);
  }

  async function searchUsers(e: FormEvent) {
    e.preventDefault();
    if (!userSearch.trim()) {
      setUserResults([]);
      return;
    }
    const res = await api.get<{ users: SafeUser[] }>(`/users?search=${encodeURIComponent(userSearch)}`);
    setUserResults(res.users);
  }

  async function confirmAssign(assignedToId: number) {
    if (assigningFileId === null) return;
    setAssigning(true);
    setMsg('');
    try {
      await api.post('/requests/assign', { fileId: assigningFileId, assignedToId });
      setMsg('File assigned successfully.');
      closeAssign();
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not assign file.');
    } finally {
      setAssigning(false);
    }
  }

  const assigningFile = files.find((f) => f.id === assigningFileId);

  return (
    <div className="card">
      <div className="card-title">Registry Files</div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search by name or number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as FileCategory | '');
            setSubCategory('');
          }}
          style={{ width: 160 }}
        >
          <option value="">All categories</option>
          <option value="general">General</option>
          <option value="personal">Personal</option>
          <option value="custom">Custom</option>
          <option value="confidential">Confidential</option>
        </select>
        {category === 'personal' && (
          <select value={subCategory} onChange={(e) => setSubCategory(e.target.value as SubCategory | '')} style={{ width: 200 }}>
            <option value="">All personal sub-categories</option>
            {SUB_CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        )}
        <button className="btn btn-primary" type="submit">Search</button>
        {user?.role === 'admin' && (
          <button type="button" className="btn btn-gold" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? 'Cancel' : '+ Add file'}
          </button>
        )}
      </form>

      {showAdd && (
        <form onSubmit={addFile} className="card" style={{ marginBottom: 12, background: '#f7f9fc' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>File name</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>File number</label>
              <input type="text" value={newNumber} onChange={(e) => setNewNumber(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Category</label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as FileCategory)}>
                <option value="custom">Custom</option>
                <option value="general">General</option>
                <option value="personal">Personal</option>
                <option value="confidential">Confidential</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Sub-category</label>
              <select
                value={newSubCategory}
                onChange={(e) => setNewSubCategory(e.target.value as SubCategory | '')}
                disabled={newCategory !== 'personal'}
              >
                <option value="">—</option>
                {SUB_CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-success" type="submit">Add</button>
          </div>
        </form>
      )}

      {assigningFileId !== null && (
        <div className="card" style={{ marginBottom: 12, background: '#f7f9fc' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
            Assign "{assigningFile?.file_name}" to a user
          </div>
          <form onSubmit={searchUsers} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Search staff by name or file number…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" type="submit">Search</button>
            <button type="button" className="btn btn-sm" onClick={closeAssign}>Cancel</button>
          </form>
          {userResults.length > 0 && (
            <table className="reg-table">
              <thead>
                <tr><th>Name</th><th>File number</th><th>Designation</th><th></th></tr>
              </thead>
              <tbody>
                {userResults.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.file_number}</td>
                    <td>{u.designation}</td>
                    <td>
                      <button className="btn btn-sm btn-success" disabled={assigning} onClick={() => confirmAssign(u.id)}>
                        Assign here
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="card" style={{ marginBottom: 12, background: '#fef0cc', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{selected.size} file(s) selected</span>
          <button className="btn btn-sm btn-primary" disabled={submittingBatch} onClick={requestSelected}>
            {submittingBatch ? 'Submitting…' : 'Request selected files'}
          </button>
          <button className="btn btn-sm" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      {msg && <div className="info-msg" style={{ marginBottom: 10 }}>{msg}</div>}

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : files.length === 0 ? (
        <div className="empty-state">No files found.</div>
      ) : (
        <table className="reg-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>Name</th>
              <th>Number</th>
              <th>Category</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id}>
                <td>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={selected.has(f.id)}
                    disabled={!!f.is_unavailable}
                    onChange={() => toggleSelect(f.id)}
                  />
                </td>
                <td>{f.file_name}</td>
                <td>{f.file_number}</td>
                <td>
                  <span className="tag tag-gray">{f.category}</span>
                  {f.sub_category && f.sub_category !== 'personal' && (
                    <span className="tag tag-teal" style={{ marginLeft: 4 }}>{f.sub_category}</span>
                  )}
                </td>
                <td>
                  {f.is_unavailable ? <span className="tag tag-amber">Out</span> : <span className="tag tag-green">Available</span>}
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  {user?.role === 'admin' && (
                    <button className="btn btn-sm btn-gold" onClick={() => openAssign(f.id)}>Assign</button>
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
