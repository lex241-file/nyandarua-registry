import { FormEvent, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { RegistryFile } from '../types';

interface Props {
  files: RegistryFile[]; // for the optional "about this file" dropdown
}

export default function NoteToAdminCard({ files }: Props) {
  const [noteText, setNoteText] = useState('');
  const [relatedFileId, setRelatedFileId] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const combined = [...attachments, ...Array.from(newFiles)];
    if (combined.length > 5) {
      setMsg('You can attach at most 5 files per note.');
      return;
    }
    const tooBig = combined.find((f) => f.size > 10 * 1024 * 1024);
    if (tooBig) {
      setMsg(`"${tooBig.name}" is over 10 MB — each attachment must be 10 MB or smaller.`);
      return;
    }
    setAttachments(combined);
    setMsg('');
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) {
      setMsg('Please write a note before sending.');
      return;
    }
    setSubmitting(true);
    setMsg('');
    try {
      const formData = new FormData();
      formData.append('noteText', noteText);
      if (relatedFileId) formData.append('relatedFileId', relatedFileId);
      attachments.forEach((f) => formData.append('files', f));

      await api.postForm('/notes', formData);
      setMsg('Note sent to admin.');
      setNoteText('');
      setRelatedFileId('');
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Could not send note.');
    } finally {
      setSubmitting(false);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="card">
      <div className="card-title">Note to Admin</div>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
        Request a file informally, add details about a specific file, or attach a document/photo for admin to review.
      </p>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>About a specific file (optional)</label>
          <select value={relatedFileId} onChange={(e) => setRelatedFileId(e.target.value)}>
            <option value="">General note (not about a specific file)</option>
            {files.map((f) => (
              <option key={f.id} value={f.id}>{f.file_name} ({f.file_number})</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Your note</label>
          <textarea
            rows={4}
            placeholder="Write your request or details here..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <button
              type="button"
              className="btn btn-sm btn-gold"
              onClick={() => fileInputRef.current?.click()}
              disabled={attachments.length >= 5}
            >
              + Attach file or photo
            </button>
            <span style={{ fontSize: 11, color: '#888' }}>{attachments.length}/5 attached, 10 MB max each</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            style={{ display: 'none' }}
            onChange={(e) => addFiles(e.target.files)}
          />
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {attachments.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: '#f7f9fc', padding: '4px 8px', borderRadius: 4 }}>
                  <span style={{ flex: 1 }}>{f.name}</span>
                  <span style={{ color: '#888' }}>{formatSize(f.size)}</span>
                  <button type="button" className="btn btn-sm" onClick={() => removeAttachment(i)}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {msg && <div className={msg.includes('sent') ? 'info-msg' : 'err-msg'} style={{ marginBottom: 10 }}>{msg}</div>}

        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'Sending...' : 'Send to Admin'}
        </button>
      </form>
    </div>
  );
}
