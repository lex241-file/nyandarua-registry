import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Movement, REQUEST_STATUS_LABELS, RequestStatus, PROCEED_TO_LABELS, ProceedToDest } from '../types';

const ACTION_TAG: Record<string, string> = {
  pending: 'tag-amber',
  pending_accept: 'tag-blue',
  accepted: 'tag-green',
  returned: 'tag-gray',
  rejected_auto: 'tag-red',
};

function fileStatusLabel(m: Movement): string {
  if (m.file_status === 'proceed_to') {
    return `Proceed To: ${m.proceed_to_dest ? PROCEED_TO_LABELS[m.proceed_to_dest as ProceedToDest] : '—'}`;
  }
  if (m.file_status === 'actioned') return 'Actioned';
  if (m.file_status === 'not_actioned') return 'Not Actioned';
  return '—';
}

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
      <div className="card-title">
        File Movement Register — Permanent Record
        <span className="tag tag-blue" style={{ marginLeft: 'auto' }}>{movements.length} records</span>
      </div>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        This log is append-only — entries can never be edited or deleted, including by administrators.
      </p>

      <form
        onSubmit={(e) => { e.preventDefault(); load(); }}
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
        <div style={{ overflowX: 'auto' }}>
          <table className="reg-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>File Number</th>
                <th>File Name</th>
                <th>Registry Code</th>
                <th>Action</th>
                <th>By</th>
                <th>Subject</th>
                <th>Action Folio</th>
                <th>Last Folio</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Bring Up</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.created_at).toLocaleString('en-KE')}</td>
                  <td style={{ fontWeight: 700 }}>{m.file_number_label}</td>
                  <td>{m.file_name}</td>
                  <td>{m.registry_code || '—'}</td>
                  <td>
                    <span className={`tag ${ACTION_TAG[m.action] || 'tag-gray'}`}>
                      {REQUEST_STATUS_LABELS[m.action as RequestStatus] || m.action}
                    </span>
                  </td>
                  <td>{m.actor_name || '—'}</td>
                  <td>{m.subject_name || '—'}</td>
                  <td>{m.action_folio || '—'}</td>
                  <td>{m.last_folio || '—'}</td>
                  <td>{m.reason || '—'}</td>
                  <td>{fileStatusLabel(m)}</td>
                  <td>{m.bring_up_note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
