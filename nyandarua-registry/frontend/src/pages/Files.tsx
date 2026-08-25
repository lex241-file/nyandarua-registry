import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RegistryFile, FileCategory } from '../types';

export default function Files() {
  const { user } = useAuth();
  const [files, setFiles] = useState<RegistryFile[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FileCategory | ''>('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newCategory, setNewCategory] = useState<FileCategory>('custom');

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      const res = await api.get<{ files: RegistryFile[] }>(`/files?${params.toString()}`);
      setFiles(res.files);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    load();
  }

  async function requestFile(fileId: number) {
    setMsg('');
    try {
      await api.post('/requests', { fileId });
      setMsg('Request submitted.');
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not submit request.');
    }
  }

  async function addFile(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/files', { fileName: newName, fileNumber: newNumber, category: newCategory });
      setNewName('');
      setNewNumber('');
      setShowAdd(false);
      setMsg('File added successfully.');
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not add file.');
    }
  }

  return (
    <div className="card">
      <div className="card-title">Registry Files</div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search by name or number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value as FileCategory | '')} style={{ width: 160 }}>
          <option value="">All categories</option>
          <option value="general">General</option>
          <option value="personal">Personal</option>
          <option value="custom">Custom</option>
        </select>
        <button className="btn btn-primary" type="submit">Search</button>
        {user?.role === 'admin' && (
          <button type="button" className="btn btn-gold" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? 'Cancel' : '+ Add file'}
          </button>
        )}
      </form>

      {showAdd && (
        <form onSubmit={addFile} className="card" style={{ marginBottom: 12, background: '#f7f9fc' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
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
              </select>
            </div>
            <button className="btn btn-success" type="submit">Add</button>
          </div>
        </form>
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
              <th>Name</th>
              <th>Number</th>
              <th>Category</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id}>
                <td>{f.file_name}</td>
                <td>{f.file_number}</td>
                <td><span className="tag tag-gray">{f.category}</span></td>
                <td>
                  <button className="btn btn-sm" onClick={() => requestFile(f.id)}>Request</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
