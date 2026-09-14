import { useEffect, useState } from 'react';
import { api, attachmentDownloadUrl } from '../api/client';
import { Note, NoteAttachment } from '../types';

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [attachmentsByNote, setAttachmentsByNote] = useState<Record<number, NoteAttachment[]>>({});
  const [unreadOnly, setUnreadOnly] = useState(false);

  async function load() {
    if (!hasLoadedOnce) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (unreadOnly) params.set('unreadOnly', 'true');
      const res = await api.get<{ notes: Note[] }>(`/notes?${params.toString()}`);
      setNotes(res.notes);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  async function toggleExpand(note: Note) {
    if (expandedId === note.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(note.id);
    if (!note.is_read) {
      await api.post(`/notes/${note.id}/mark-read`);
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, is_read: 1 } : n)));
    }
    if (note.attachment_count > 0 && !attachmentsByNote[note.id]) {
      const res = await api.get<{ attachments: NoteAttachment[] }>(`/notes/${note.id}/attachments`);
      setAttachmentsByNote((prev) => ({ ...prev, [note.id]: res.attachments }));
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const unreadCount = notes.filter((n) => !n.is_read).length;

  return (
    <div className="page">
      <div className="card">
        <div className="card-title">
          Notes from Staff
          {unreadCount > 0 && <span className="tag tag-red" style={{ marginLeft: 8 }}>{unreadCount} unread</span>}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} style={{ width: 'auto' }} />
          Show unread only
        </label>

        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : notes.length === 0 ? (
          <div className="empty-state">No notes yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.map((note) => (
              <div key={note.id} className="card" style={{ background: note.is_read ? '#fff' : '#fef9e7', cursor: 'pointer' }} onClick={() => toggleExpand(note)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{note.sender_name}</strong> <span style={{ color: '#888', fontSize: 12 }}>({note.sender_file_number})</span>
                    {!note.is_read && <span className="tag tag-red" style={{ marginLeft: 8 }}>New</span>}
                    {note.related_file_name && (
                      <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                        Re: {note.related_file_name} ({note.related_file_number})
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>
                    {new Date(note.created_at).toLocaleString('en-KE')}
                  </div>
                </div>

                {expandedId === note.id ? (
                  <>
                    <p style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 13 }}>{note.note_text}</p>
                    {note.attachment_count > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Attachments:</div>
                        {(attachmentsByNote[note.id] || []).map((a) => (
                          <a
                            key={a.id}
                            href={attachmentDownloadUrl(note.id, a.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: '#f7f9fc', padding: '4px 8px', borderRadius: 4, marginBottom: 4, textDecoration: 'none', color: '#185FA5' }}
                          >
                            <span style={{ flex: 1 }}>{a.file_name}</span>
                            <span style={{ color: '#888' }}>{formatSize(a.file_size)}</span>
                            <span>Download</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ marginTop: 6, fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.note_text} {note.attachment_count > 0 && `(${note.attachment_count} attachment${note.attachment_count > 1 ? 's' : ''})`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
