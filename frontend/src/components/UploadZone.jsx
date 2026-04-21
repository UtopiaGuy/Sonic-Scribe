import { useState, useRef, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function UploadZone({ onUploadStart, onUploadComplete, whisperModel, analysisEngine, saveHistory }) {
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith('audio/') && file.type !== 'video/webm') {
      alert('Please select an audio file');
      return;
    }

    setUploading(true);
    setFileName(file.name);
    onUploadStart?.();

    try {
      const form = new FormData();
      form.append('audio', file);
      form.append('whisperModel', whisperModel || 'base.en');
      form.append('analysisEngine', analysisEngine || 'auto');
      form.append('saveHistory', saveHistory !== false ? 'true' : 'false');

      const res = await fetch(`${API}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Upload failed');

      onUploadComplete?.(data);
    } catch (err) {
      console.error('Upload error:', err);
      onUploadComplete?.({ error: err.message });
    } finally {
      setUploading(false);
      setFileName('');
    }
  }, [whisperModel, analysisEngine, saveHistory, onUploadStart, onUploadComplete]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  return (
    <div
      className={`glass upload-zone ${dragover ? 'dragover' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
      onDragLeave={() => setDragover(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {uploading ? (
        <div className="upload-processing">
          <div className="waveform">
            {[...Array(8)].map((_, i) => <div key={i} className="bar" />)}
          </div>
          <div className="upload-filename">{fileName}</div>
          <div className="upload-subtitle">Processing audio...</div>
        </div>
      ) : (
        <>
          <div className="upload-icon">🎙️</div>
          <div className="upload-title">Drop audio file here</div>
          <div className="upload-subtitle">
            or click to browse · MP3, WAV, M4A, WebM, OGG
          </div>
        </>
      )}
    </div>
  );
}
