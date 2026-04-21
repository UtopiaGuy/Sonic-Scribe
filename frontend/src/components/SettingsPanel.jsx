import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function SettingsPanel({ whisperModel, onWhisperModelChange, analysisEngine, onAnalysisEngineChange, notionDbId, onNotionDbChange, saveHistory, onSaveHistoryChange }) {
  const [notionDbs, setNotionDbs] = useState({ remote: [], saved: [] });
  const [newDbId, setNewDbId] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [aiOnline, setAiOnline] = useState(false);
  const [startingAi, setStartingAi] = useState(false);

  const whisperOptions = [
    { value: 'tiny.en', label: '⚡ Fast', desc: 'Quick, clear audio' },
    { value: 'base.en', label: '⚖️ Medium', desc: 'General use' },
    { value: 'large-v3', label: '🔥 Full Power', desc: 'Best quality' },
  ];

  useEffect(() => {
    loadNotionDbs();
    checkAiStatus();
    const interval = setInterval(checkAiStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkAiStatus = async () => {
    try {
      const res = await fetch(`${API}/api/system/ai-status`);
      if (res.ok) {
        const { online } = await res.json();
        setAiOnline(online);
        if (online) setStartingAi(false);
      }
    } catch {
      setAiOnline(false);
    }
  };

  const startLocalAi = async () => {
    setStartingAi(true);
    try {
      await fetch(`${API}/api/system/ai-start`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to command AI start', err);
    }
  };

  const loadNotionDbs = async () => {
    try {
      const res = await fetch(`${API}/api/notion/databases`);
      if (res.ok) {
        const data = await res.json();
        setNotionDbs(data);
      }
    } catch (err) {
      console.warn('Failed to load Notion databases:', err);
    }
  };

  const addCustomDb = () => {
    const id = newDbId.trim().replace(/-/g, '');
    if (id.length >= 32) {
      onNotionDbChange(id);
      setNewDbId('');
    }
  };

  const createNotionDb = async () => {
    const id = newDbId.trim().replace(/-/g, '');
    if (id.length >= 32) {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/notion/database`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create database');
        
        // Refresh DB list and select the new one
        await loadNotionDbs();
        onNotionDbChange(data.database.id);
        setNewDbId('');
        alert('Successfully created new Sonic Scribe database down in that page!');
      } catch (err) {
        alert(`Error creating database: ${err.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      alert('Please enter a valid Notion Page ID');
    }
  };

  return (
    <div className="glass settings-panel">
      <div className="section-title">
        <span className="icon">⚙️</span> Settings
      </div>

      {/* Whisper Model */}
      <div className="setting-group">
        <div className="setting-label">Whisper Model</div>
        <div className="setting-options">
          {whisperOptions.map(opt => (
            <button
              key={opt.value}
              className={`setting-option ${whisperModel === opt.value ? 'active' : ''}`}
              onClick={() => onWhisperModelChange(opt.value)}
              title={opt.desc}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis Engine */}
      <div className="setting-group">
        <div className="setting-label">Analysis Engine</div>
        <div className="setting-options">
          <button
            className={`setting-option ${analysisEngine === 'auto' ? 'active' : ''}`}
            onClick={() => onAnalysisEngineChange('auto')}
            title="Try Local first, fallback to Cloud"
          >
            Auto
          </button>
          <button
            className={`setting-option ${analysisEngine === 'local' ? 'active' : ''}`}
            onClick={() => onAnalysisEngineChange('local')}
            title="Force Local (Gemma 4). Will fail if offline."
          >
            Local Gemma
          </button>
          <button
            className={`setting-option ${analysisEngine === 'cloud' ? 'active' : ''}`}
            onClick={() => onAnalysisEngineChange('cloud')}
            title="Force Cloud (Gemini API)."
          >
            Cloud Gemini
          </button>
        </div>

        {/* Local AI Status Line */}
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: aiOnline ? '#10b981' : '#ef4444', 
                          boxShadow: aiOnline ? '0 0 8px #10b981' : 'none' }} />
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Local Gemma 4: {aiOnline ? 'Online' : 'Offline'}</span>
          </div>

          {!aiOnline && (
            <button 
              onClick={startLocalAi}
              disabled={startingAi}
              style={{
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                color: '#c4b5fd',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: startingAi ? 'wait' : 'pointer',
                fontSize: '12px',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.4)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'}
            >
              {startingAi ? 'Booting Model (approx 15s)...' : 'Boot Local Server'}
            </button>
          )}
        </div>
      </div>

      {/* Notion Database */}
      <div className="setting-group">
        <div className="setting-label">Notion Database</div>

        {/* Saved databases */}
        {(notionDbs.saved.length > 0 || notionDbs.remote.length > 0) && (
          <div className="notion-db-list" style={{ marginBottom: 8 }}>
            {notionDbs.saved.map(db => (
              <button
                key={db.id}
                className={`notion-db-item ${notionDbId === db.id ? 'selected' : ''}`}
                onClick={() => onNotionDbChange(db.id)}
              >
                📓 {db.name || db.id.substring(0, 12) + '...'}
              </button>
            ))}
            {notionDbs.remote.filter(db => !notionDbs.saved.find(s => s.id === db.id)).map(db => (
              <button
                key={db.id}
                className={`notion-db-item ${notionDbId === db.id ? 'selected' : ''}`}
                onClick={() => onNotionDbChange(db.id)}
              >
                🔗 {db.title || db.id.substring(0, 12) + '...'}
              </button>
            ))}
          </div>
        )}

        {/* Custom DB / Page ID input */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="text"
            className="setting-input"
            placeholder="Enter Database ID or Page ID..."
            value={newDbId}
            onChange={(e) => setNewDbId(e.target.value)}
            disabled={loading}
          />
          <button className="btn btn-ghost btn-sm" onClick={addCustomDb} disabled={!newDbId.trim() || loading} title="Link existing database">
            Link DB
          </button>
          <button className="btn btn-ghost btn-sm" onClick={createNotionDb} disabled={!newDbId.trim() || loading} title="Create new database inside this page">
            {loading ? 'Creating...' : '+ Create DB on Page'}
          </button>
        </div>
      </div>

      {/* Save History */}
      <div className="setting-group">
        <div className="setting-label">Save History</div>
        <div className="setting-options">
          <button
            className={`setting-option ${saveHistory ? 'active' : ''}`}
            onClick={() => onSaveHistoryChange(true)}
          >
            ✓ Save
          </button>
          <button
            className={`setting-option ${!saveHistory ? 'active' : ''}`}
            onClick={() => onSaveHistoryChange(false)}
          >
            ✗ Don't Save
          </button>
        </div>
      </div>
    </div>
  );
}
