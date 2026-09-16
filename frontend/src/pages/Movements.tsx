import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api/client';
import { Movement, PROCEED_TO_LABELS, ProceedToDest } from '../types';

function fileStatusLabel(m: Movement): string {
  if (m.file_status === 'proceed_to') {
    return `Proceed To: ${m.proceed_to_dest ? PROCEED_TO_LABELS[m.proceed_to_dest as ProceedToDest] : '-'}`;
  }
  if (m.file_status === 'actioned') return 'Actioned';
  if (m.file_status === 'not_actioned') return 'Not Actioned';
  return '-';
}

export default function Movements() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  async function load() {
    if (!hasLoadedOnce) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await api.get<{ movements: Movement[] }>(`/movements?${params.toString()}`);
      setMovements(res.movements);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function downloadExcel() {
    const rows = movements.map((m) => ({
      'File Number': m.file_number_label,
      'File Name': m.file_name,
      'Registry Code': m.registry_code || '',
      'Requested By': m.requester_name || '',
      'Date Requested': m.requested_date ? new Date(m.requested_date).toLocaleDateString('en-KE') : '',
      'Assigned To': m.assigned_to_name || '',
      'Date Assigned': m.assigned_date ? new Date(m.assigned_date).toLocaleDateString('en-KE') : '',
      'Date Accepted': m.accepted_date ? new Date(m.accepted_date).toLocaleDateString('en-KE') : '',
      'Action Folio': m.action_folio || '',
      'Last Folio': m.last_folio || '',
      'Reason': m.reason || '',
      'Status': fileStatusLabel(m),
      'Bring Up': m.bring_up_note || '',
      'Returned By': m.returned_by_name || '',
      'Date Returned': m.returned_date ? new Date(m.returned_date).toLocaleDateString('en-KE') : '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'File Movements');
    XLSX.writeFile(workbook, `file-movements-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="card">
      <div className="card-title">
        File Movement Register - Completed Cycles
        <span className="tag tag-blue" style={{ marginLeft: 'auto' }}>{movements.length} records</span>
      </div>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        Each file appears here once, after it has completed a full cycle (assigned and returned to the registry).
        The underlying step-by-step audit trail is permanent and cannot be edited or deleted, including by administrators.
      </p>

      <form
        onSubmit={(e) => { e.preventDefault(); load(); }}
        style={{ display: 'flex', gap: 8, marginBottom: 12 }}
      >
        <input
          type="text"
          className="search-input"
          placeholder="Search by file name or number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">Search</button>
        <button type="button" className="btn btn-gold" onClick={downloadExcel} disabled={movements.length === 0}>
          Download
        </button>
      </form>

      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : movements.length === 0 ? (
        <div className="empty-state">No completed file movements yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="reg-table">
            <thead>
              <tr>
                <th>File Number</th>
                <th>File Name</th>
                <th>Registry Code</th>
                <th>Requested By</th>
                <th>Assigned To</th>
                <th>Date Assigned</th>
                <th>Action Folio</th>
                <th>Last Folio</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Bring Up</th>
                <th>Returned By</th>
                <th>Date Returned</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 700 }}>{m.file_number_label}</td>
                  <td>{m.file_name}</td>
                  <td>{m.registry_code || '-'}</td>
                  <td>{m.requester_name || '-'}</td>
                  <td>{m.assigned_to_name || '-'}</td>
                  <td>{m.assigned_date ? new Date(m.assigned_date).toLocaleDateString('en-KE') : '-'}</td>
                  <td>{m.action_folio || '-'}</td>
                  <td>{m.last_folio || '-'}</td>
                  <td>{m.reason || '-'}</td>
                  <td>{fileStatusLabel(m)}</td>
                  <td>{m.bring_up_note || '-'}</td>
                  <td>{m.returned_by_name || '-'}</td>
                  <td>{m.returned_date ? new Date(m.returned_date).toLocaleDateString('en-KE') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
