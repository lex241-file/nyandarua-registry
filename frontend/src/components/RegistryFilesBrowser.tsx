import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { RegistryFile, SubCategory, SUB_CATEGORY_OPTIONS } from '../types';

interface Props {
  role: 'user' | 'admin';
  selected: Set<number>;
  onToggle: (fileId: number) => void;
  onAddConfidential?: (fileNumber: string, fileName: string) => void;
  onFilesLoaded?: (files: RegistryFile[]) => void;
}

const GENERAL_CATEGORIES = ['All'] as const;

export default function RegistryFilesBrowser({ role, selected, onToggle, onAddConfidential, onFilesLoaded }: Props) {
  const [generalFiles, setGeneralFiles] = useState<RegistryFile[]>([]);
  const [personalFiles, setPersonalFiles] = useState<RegistryFile[]>([]);
  const [personalCategory, setPersonalCategory] = useState<'personal' | 'interns' | 'semi_active'>('personal');
  const [semiActiveSub, setSemiActiveSub] = useState<SubCategory>('retired');
  const [personalSearch, setPersonalSearch] = useState('');
  const [confNum, setConfNum] = useState('');
  const [confName, setConfName] = useState('');

  const semiActiveOptions = SUB_CATEGORY_OPTIONS.filter(([v]) => !['personal', 'interns'].includes(v));

  async function loadGeneral() {
    const res = await api.get<{ files: RegistryFile[] }>('/files?category=general');
    setGeneralFiles(res.files);
    onFilesLoaded?.(res.files);
  }

  async function loadPersonal() {
    const params = new URLSearchParams({ category: 'personal' });
    const subCat = personalCategory === 'semi_active' ? semiActiveSub : personalCategory;
    params.set('subCategory', subCat);
    if (personalSearch) params.set('search', personalSearch);
    const res = await api.get<{ files: RegistryFile[] }>(`/files?${params.toString()}`);
    setPersonalFiles(res.files);
    onFilesLoaded?.(res.files);
  }

  useEffect(() => {
    loadGeneral();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPersonal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalCategory, semiActiveSub]);

  function submitConfidential(e: React.FormEvent) {
    e.preventDefault();
    if (!confNum.trim() || !confName.trim() || !onAddConfidential) return;
    onAddConfidential(confNum.trim(), confName.trim());
    setConfNum('');
    setConfName('');
  }

  return (
    <div className="card">
      <div className="card-title">📁 Registry Files</div>

      <div className="section-hd">General Files</div>
      <div className="scroll-area">
        {generalFiles.length === 0 ? (
          <p style={{ fontSize: 12, color: '#888', padding: 6 }}>No general files found.</p>
        ) : (
          generalFiles.map((f) => (
            <label key={f.id} className={`file-row-label ${f.is_unavailable ? 'unavail' : ''}`}>
              <input
                type="checkbox"
                checked={selected.has(f.id)}
                disabled={!!f.is_unavailable}
                onChange={() => onToggle(f.id)}
                style={{ width: 'auto' }}
              />
              <span>
                {f.file_name}
                <br />
                <span style={{ fontSize: 10, color: '#888' }}>{f.file_number}</span>
                {!!f.is_unavailable && <span className="tag tag-amber" style={{ marginLeft: 4 }}>Out</span>}
              </span>
            </label>
          ))
        )}
      </div>

      <div className="divider" />

      <div className="section-hd">
        Personal Files <span className="tag tag-blue" style={{ marginLeft: 4 }}>{personalFiles.length} in category</span>
      </div>
      <select value={personalCategory} onChange={(e) => setPersonalCategory(e.target.value as typeof personalCategory)} style={{ marginBottom: 6 }}>
        <option value="personal">Personal (Active Staff)</option>
        <option value="interns">Interns</option>
        <option value="semi_active">Semi Active</option>
      </select>
      {personalCategory === 'semi_active' && (
        <select value={semiActiveSub} onChange={(e) => setSemiActiveSub(e.target.value as SubCategory)} style={{ marginBottom: 6 }}>
          {semiActiveOptions.map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input
          type="text"
          placeholder="Search name or file number…"
          value={personalSearch}
          onChange={(e) => setPersonalSearch(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" onClick={loadPersonal}>🔍</button>
      </div>
      <div className="scroll-area">
        {personalFiles.length === 0 ? (
          <p style={{ fontSize: 12, color: '#888', padding: 6 }}>No records in this category.</p>
        ) : (
          personalFiles.map((f) => (
            <label key={f.id} className={`file-row-label ${f.is_unavailable ? 'unavail' : ''}`}>
              <input
                type="checkbox"
                checked={selected.has(f.id)}
                disabled={!!f.is_unavailable}
                onChange={() => onToggle(f.id)}
                style={{ width: 'auto' }}
              />
              <span>
                {f.file_name}
                <br />
                <span style={{ fontSize: 10, color: '#888' }}>{f.file_number}</span>
                {!!f.is_unavailable && <span className="tag tag-amber" style={{ marginLeft: 4 }}>Out</span>}
              </span>
            </label>
          ))
        )}
      </div>

      {role === 'user' && onAddConfidential && (
        <>
          <div className="divider" />
          <div className="section-hd">Confidential Files</div>
          <form onSubmit={submitConfidential} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input type="text" placeholder="File number" value={confNum} onChange={(e) => setConfNum(e.target.value)} />
            <input type="text" placeholder="File name" value={confName} onChange={(e) => setConfName(e.target.value)} />
            <button className="btn btn-primary btn-sm" type="submit">🔒 Add to request</button>
          </form>
        </>
      )}
    </div>
  );
}
