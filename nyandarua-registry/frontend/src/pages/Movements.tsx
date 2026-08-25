import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Movement } from '../types';

export default function Movements() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await api.get<{ movements: Movement[] }>(`/movements?${params.toString()}`);
      setMovements(res.movements);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card">
      <div className="card-title">Movement History (audit log)</div>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        This log is append-only — entries can never be edited or deleted, including by administrators.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        style={{ display: 'flex', gap: 8, marginBottom: 12 }}
      >
        <input
          type="text"
          className="search-input"
          placeholder="Search by file name or number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : movements.length === 0 ? (
        <div className="empty-state">No movements recorded yet.</div>
      ) : (
        <table className="reg-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>File</th>
              <th>Action</th>
              <th>By</th>
              <th>Subject</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.created_at).toLocaleString('en-KE')}</td>
                <td>{m.file_name} <span style={{ color: '#888' }}>({m.file_number_label})</span></td>
                <td><span className="tag tag-blue">{m.action}</span></td>
                <td>{m.actor_name || '—'}</td>
                <td>{m.subject_name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
