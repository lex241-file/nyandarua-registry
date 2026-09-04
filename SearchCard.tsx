import { FormEvent, useState } from 'react';
import { api } from '../api/client';
import { RegistryFile } from '../types';

interface Props {
  selected: Set<number>;
  onToggle: (fileId: number) => void;
  onResults: (files: RegistryFile[]) => void;
}

export default function SearchCard({ selected, onToggle, onResults }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RegistryFile[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    const res = await api.get<{ files: RegistryFile[] }>(`/files?search=${encodeURIComponent(query)}`);
    setResults(res.files);
    setSearched(true);
    onResults(res.files);
  }

  return (
    <div className="card">
      <div className="card-title">🔍 Search Files</div>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="Search by file name, number, or designation…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" type="submit">🔍 Search</button>
      </form>
      <div style={{ marginTop: 8 }}>
        {!searched ? (
          <p style={{ fontSize: 12, color: '#888' }}>Start typing to see matching files.</p>
        ) : results.length === 0 ? (
          <p style={{ fontSize: 12, color: '#888' }}>No files found for "{query}".</p>
        ) : (
          <>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 6, fontWeight: 700 }}>
              {results.length} result(s) for "{query}"
            </div>
            <div className="scroll-area">
              {results.slice(0, 30).map((f) => (
                <label key={f.id} className={`file-row-label ${f.is_unavailable ? 'unavail' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    disabled={!!f.is_unavailable}
                    onChange={() => onToggle(f.id)}
                    style={{ width: 'auto' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {f.file_name} {!!f.is_unavailable && <span className="tag tag-amber">Out</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {f.file_number} <span className="tag tag-gray">{f.category}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
