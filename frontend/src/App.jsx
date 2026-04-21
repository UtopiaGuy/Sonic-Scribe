import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import UploadZone from './components/UploadZone';
import StatusFeed from './components/StatusFeed';
import TranscriptionView from './components/TranscriptionView';
import ExportPanel from './components/ExportPanel';
import SettingsPanel from './components/SettingsPanel';
import HistoryPanel from './components/HistoryPanel';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export default function App() {
  const [statuses, setStatuses] = useState([]);
  const [result, setResult] = useState(null);
  const [whisperModel, setWhisperModel] = useState('base.en');
  const [analysisEngine, setAnalysisEngine] = useState('auto');
  const [notionDbId, setNotionDbId] = useState('');
  const [saveHistory, setSaveHistory] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);
  const [historyTick, setHistoryTick] = useState(0);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  // --- WebSocket ---
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
          setStatuses(prev => [...prev, {
            ...data,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          }]);
          if (data.step === 'complete') {
            setHistoryTick(t => t + 1);
          }
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      reconnectTimer.current = setTimeout(connectWs, 3000);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connectWs]);

  // --- Load settings from localStorage ---
  useEffect(() => {
    const saved = localStorage.getItem('sonic-scribe-settings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.whisperModel) setWhisperModel(s.whisperModel);
        if (s.analysisEngine) setAnalysisEngine(s.analysisEngine);
        if (s.notionDbId) setNotionDbId(s.notionDbId);
        if (s.saveHistory !== undefined) setSaveHistory(s.saveHistory);
      } catch { /* ignore */ }
    }
  }, []);

  // --- Save settings to localStorage ---
  useEffect(() => {
    localStorage.setItem('sonic-scribe-settings', JSON.stringify({
      whisperModel, analysisEngine, notionDbId, saveHistory,
    }));
  }, [whisperModel, analysisEngine, notionDbId, saveHistory]);

  // --- Handlers ---
  const handleUploadStart = () => {
    setStatuses([]);
    setResult(null);
  };

  const handleUploadComplete = (data) => {
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }
    setResult(data);
    showToast('Processing complete!', 'success');
  };

  const handleHistorySelect = (data) => {
    setResult(data);
    setStatuses([]);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="glass header">
        <div className="header-brand">
          <div className="header-logo">🎙️</div>
          <div>
            <div className="header-title">Sonic Scribe</div>
            <div className="header-subtitle">Local AI Transcription & Analysis</div>
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`btn ${showSettings ? 'btn-primary' : 'btn-ghost'} btn-icon`}
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Left column — Primary */}
        <div className="primary-panel">
          <UploadZone
            onUploadStart={handleUploadStart}
            onUploadComplete={handleUploadComplete}
            whisperModel={whisperModel}
            analysisEngine={analysisEngine}
            saveHistory={saveHistory}
          />
          <StatusFeed statuses={statuses} />
          <TranscriptionView data={result} />
        </div>

        {/* Right column — Side */}
        <div className="side-panel">
          {showSettings && (
            <SettingsPanel
              whisperModel={whisperModel}
              onWhisperModelChange={setWhisperModel}
              analysisEngine={analysisEngine}
              onAnalysisEngineChange={setAnalysisEngine}
              notionDbId={notionDbId}
              onNotionDbChange={setNotionDbId}
              saveHistory={saveHistory}
              onSaveHistoryChange={setSaveHistory}
            />
          )}
          <ExportPanel data={result} notionDbId={notionDbId} />
          <HistoryPanel onSelect={handleHistorySelect} refreshTick={historyTick} />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
        </div>
      )}
    </div>
  );
}
