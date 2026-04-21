import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ExportPanel({ data, notionDbId }) {
  const [notionStatus, setNotionStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [obsidianStatus, setObsidianStatus] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);
  const [notionUrl, setNotionUrl] = useState('');

  if (!data?.analysis) return null;

  const handleNotion = async () => {
    if (!notionDbId) {
      alert('Please select a Notion database in Settings first');
      return;
    }
    setNotionStatus('loading');
    try {
      const res = await fetch(`${API}/api/export/notion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: data.analysis, databaseId: notionDbId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setNotionStatus('success');
      setNotionUrl(result.url);
    } catch (err) {
      setNotionStatus('error');
      console.error('Notion export error:', err);
    }
  };

  const handleObsidian = async () => {
    setObsidianStatus('loading');
    try {
      const res = await fetch(`${API}/api/export/obsidian`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: data.analysis, transcription: data.transcription }),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(data.analysis.title || 'Untitled').replace(/[^a-zA-Z0-9\s-]/g, '')}.md`;
      a.click();
      URL.revokeObjectURL(url);
      setObsidianStatus('success');
    } catch (err) {
      setObsidianStatus('error');
      console.error('Obsidian download error:', err);
    }
  };

  const handleCopy = async () => {
    setCopyStatus('loading');
    try {
      const res = await fetch(`${API}/api/export/clipboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: data.analysis, transcription: data.transcription }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await navigator.clipboard.writeText(result.text);
      setCopyStatus('success');
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (err) {
      setCopyStatus('error');
      console.error('Copy error:', err);
    }
  };

  return (
    <div className="glass export-panel">
      <div className="section-title">
        <span className="icon">📤</span> Export
      </div>
      <div className="export-grid">
        {/* Notion */}
        <button
          className={`export-btn ${notionStatus === 'success' ? 'success' : ''}`}
          onClick={handleNotion}
          disabled={notionStatus === 'loading'}
        >
          <span className="export-icon">📓</span>
          <div>
            <div className="export-label">
              {notionStatus === 'loading' ? 'Exporting...' :
               notionStatus === 'success' ? '✓ Sent to Notion' :
               'Export to Notion'}
            </div>
            <div className="export-desc">
              {notionStatus === 'success' && notionUrl ? (
                <a href={notionUrl} target="_blank" rel="noopener" style={{ color: 'var(--success)' }}>Open in Notion →</a>
              ) : notionDbId ? 'Send to your Notion database' : 'Select a database in Settings'}
            </div>
          </div>
          {notionStatus === 'loading' && <span className="spinner" />}
        </button>

        {/* Obsidian */}
        <button
          className={`export-btn ${obsidianStatus === 'success' ? 'success' : ''}`}
          onClick={handleObsidian}
          disabled={obsidianStatus === 'loading'}
        >
          <span className="export-icon">💎</span>
          <div>
            <div className="export-label">
              {obsidianStatus === 'loading' ? 'Generating...' :
               obsidianStatus === 'success' ? '✓ Downloaded' :
               'Download for Obsidian'}
            </div>
            <div className="export-desc">Markdown with YAML frontmatter + auto-saved to vault</div>
          </div>
          {obsidianStatus === 'loading' && <span className="spinner" />}
        </button>

        {/* Copy */}
        <button
          className={`export-btn ${copyStatus === 'success' ? 'success' : ''}`}
          onClick={handleCopy}
          disabled={copyStatus === 'loading'}
        >
          <span className="export-icon">📋</span>
          <div>
            <div className="export-label">
              {copyStatus === 'success' ? '✓ Copied!' : 'Copy to Clipboard'}
            </div>
            <div className="export-desc">Formatted text ready to paste anywhere</div>
          </div>
        </button>
      </div>
    </div>
  );
}
