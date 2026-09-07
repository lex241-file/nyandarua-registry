import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { RegistryFile, UserDirectoryEntry } from '../types';

export interface ConfidentialEntry {
  fileNumber: string;
  fileName: string;
}

interface RowMeta {
  registryCode: string;
  actionFolio: string;
  reason: string;
  assignedToId?: number;
  urgent?: boolean;
}

interface Props {
  role: 'user' | 'admin';
  files: RegistryFile[];
  selectedIds: Set<number>;
  confidential: ConfidentialEntry[];
  allUsers?: UserDirectoryEntry[];
  onClearSelection: () => void;
  onUnselectOne?: (fileId: number) => void;
  onClearConfidential: () => void;
  onDone: (message: string) => void;
}

export default function SelectedFilesPanel({
  role, files, selectedIds, confidential, allUsers = [],
  onClearSelection, onUnselectOne, onClearConfidential, onDone,
}: Props) {
  const [rowMeta, setRowMeta] = useState<Record<string, RowMeta>>({});
  const [submitting, setSubmitting] = useState(false);

  const selectedFiles = files.filter((f) => selectedIds.has(f.id));
  const totalCount = selectedFiles.length + confidential.length;

  function getMeta(key: string): RowMeta {
    return rowMeta[key] || { registryCode: '', actionFolio: '', reason: '', urgent: false };
  }
  function updateMeta(key: string, patch: Partial<RowMeta>) {
    setRowMeta((prev) => ({ ...prev, [key]: { ...getMeta(key), ...patch } }));
  }

  if (totalCount === 0) {
    return (
      <div className="card">
        <div className="card-title">Selected Files <span className="tag tag-blue" style={{ marginLeft: 'auto' }}>0 selected</span></div>
        <p style={{ fontSize: 12, color: '#888' }}>No files selected. Select files from the panel or search results.</p>
      </div>
    );
  }

  async function submitAsUser() {
    setSubmitting(true);
    try {
      const urgentFileIds = selectedFiles.filter((f) => getMeta(String(f.id)).urgent).map((f) => f.id);
      const reasons: Record<number, string> = {};
      selectedFiles.forEach((f) => {
        const r = getMeta(String(f.id)).reason;
        if (r) reasons[f.id] = r;
      });
      const res = await api.post<{ created: number[]; skipped: number[] }>('/requests', {
        fileIds: selectedFiles.map((f) => f.id),
        urgentFileIds,
        reasons,
        confidentialFiles: confidential,
      });
      const parts: string[] = [];
      if (res.created.length) parts.push(`${res.created.length} file(s) requested.`);
      if (res.skipped.length) parts.push(`${res.skipped.length} skipped (already out).`);
      onDone(parts.join(' '));
      onClearSelection();
      onClearConfidential();
      setRowMeta({});
    } catch (err) {
      onDone(err instanceof ApiError ? err.message : 'Could not submit request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAsAdmin() {
    setSubmitting(true);
    try {
      let ok = 0;
      let failed = 0;
      for (const f of selectedFiles) {
        const meta = getMeta(String(f.id));
        if (!meta.assignedToId) { failed++; continue; }
        try {
          await api.post('/requests/assign', {
            fileId: f.id,
            assignedToId: meta.assignedToId,
            registryCode: meta.registryCode || undefined,
            actionFolio: meta.actionFolio || undefined,
            reason: meta.reason || undefined,
          });
          ok++;
        } catch {
          failed++;
        }
      }
      onDone(`${ok} file(s) assigned.${failed ? ` ${failed} could not be assigned (choose an assignee for each row).` : ''}`);
      if (failed === 0) {
        onClearSelection();
        setRowMeta({});
      }
    } catch (err) {
      onDone(err instanceof ApiError ? err.message : 'Could not assign files.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Selected Files <span className="tag tag-blue" style={{ marginLeft: 'auto' }}>{totalCount} selected</span></div>
      <div style={{ overflowX: 'auto' }}>
        <table className="reg-table">
          <thead>
            <tr>
              <th>#</th>
              <th>File Number</th>
              <th>File Name</th>
              {role === 'admin' && <th>Registry Code</th>}
              {role === 'admin' && <th>Action Folio</th>}
              <th>Reason</th>
              {role === 'admin' && <th>Assign To</th>}
              {role === 'user' && <th>Urgent</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {selectedFiles.map((f, i) => {
              const key = String(f.id);
              const meta = getMeta(key);
              return (
                <tr key={f.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 700 }}>{f.file_number}</td>
                  <td>{f.file_name}</td>
                  {role === 'admin' && (
                    <td><input type="text" value={meta.registryCode} onChange={(e) => updateMeta(key, { registryCode: e.target.value })} style={{ minWidth: 100 }} /></td>
                  )}
                  {role === 'admin' && (
                    <td><input type="text" value={meta.actionFolio} onChange={(e) => updateMeta(key, { actionFolio: e.target.value })} style={{ minWidth: 100 }} /></td>
                  )}
                  <td><input type="text" value={meta.reason} onChange={(e) => updateMeta(key, { reason: e.target.value })} style={{ minWidth: 120 }} /></td>
                  {role === 'admin' && (
                    <td>
                      <select
                        value={meta.assignedToId ?? ''}
                        onChange={(e) => updateMeta(key, { assignedToId: e.target.value ? Number(e.target.value) : undefined })}
                        style={{ minWidth: 160 }}
                      >
                        <option value="">Choose user</option>
                        {allUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.file_number})</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {role === 'user' && (
                    <td>
                      <button
                        type="button"
                        className={`btn btn-sm ${meta.urgent ? 'btn-danger' : ''}`}
                        onClick={() => updateMeta(key, { urgent: !meta.urgent })}
                      >
                        {meta.urgent ? 'Urgent' : 'Mark Urgent'}
                      </button>
                    </td>
                  )}
                  <td>
                    <button type="button" className="btn btn-sm" onClick={() => onUnselectOne?.(f.id)}>Unselect</button>
                  </td>
                </tr>
              );
            })}
            {confidential.map((c, i) => (
              <tr key={`conf-${c.fileNumber}`}>
                <td>{selectedFiles.length + i + 1}</td>
                <td style={{ fontWeight: 700 }}>{c.fileNumber}</td>
                <td>{c.fileName} <span className="tag tag-red" style={{ marginLeft: 4 }}>Confidential</span></td>
                <td colSpan={role === 'admin' ? 4 : 2} style={{ color: '#888', fontSize: 11 }}>New confidential file, will be created on submit</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {role === 'user' && (
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={submitting} onClick={submitAsUser}>
          {submitting ? 'Submitting...' : `Request ${totalCount} File(s)`}
        </button>
      )}
      {role === 'admin' && (
        <button className="btn btn-success" style={{ width: '100%', marginTop: 8 }} disabled={submitting || selectedFiles.length === 0} onClick={submitAsAdmin}>
          {submitting ? 'Assigning...' : 'Assign All Selected'}
        </button>
      )}
    </div>
  );
}
