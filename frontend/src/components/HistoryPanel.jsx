import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function HistoryPanel({ onSelect, refreshTick }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [refreshTick]);

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.warn('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this transcription?')) return;
    try {
      await fetch(`${API}/api/history/${id}`, { method: 'DELETE' });
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleSelect = async (id) => {
    try {
      const res = await fetch(`${API}/api/history/${id}`);
      if (res.ok) {
        const data = await res.json();
        onSelect?.({
          transcription: data.transcription,
          analysis: data.analysis,
          engine: data.engine,
          duration: data.duration,
        });
      }
    } catch (err) {
      console.error('Load error:', err);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return 'Today';
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const typeIcons = {
    'Meeting Notes': '🤝',
    'Lecture': '🎓',
    'Interview': '🎤',
    'Brainstorm': '💡',
    'Journal': '📔',
    'Conversation': '💬',
    'Podcast': '🎧',
    'Voice Memo': '🗣️',
  };

  return (
    <div className="glass history-panel">
      <div className="section-title">
        <span className="icon">📚</span> History
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
          {items.length} saved
        </span>
      </div>

      {loading ? (
        <div className="empty-state"><span className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <div className="empty-text">No transcriptions yet</div>
        </div>
      ) : (
        <div className="history-list">
          {items.map(item => (
            <div key={item.id} className="history-item" onClick={() => handleSelect(item.id)}>
              <span className="h-icon">{typeIcons[item.type] || '🎙️'}</span>
              <span className="h-title">{item.title || item.filename || 'Untitled'}</span>
              <span className="h-date">{formatDate(item.created_at)}</span>
              <button className="h-delete" onClick={(e) => handleDelete(e, item.id)} title="Delete">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
