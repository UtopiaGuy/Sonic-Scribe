import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';

function App() {
  const [statusMessages, setStatusMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      console.log('WebSocket connected');
      setStatusMessages(prev => [...prev, 'STATUS: Connected to server.']);
    };

    ws.onmessage = (event) => {
      setStatusMessages(prev => [...prev, event.data]);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setStatusMessages(prev => [...prev, 'STATUS: Disconnected from server.']);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatusMessages(prev => [...prev, `STATUS: WebSocket error: ${error.message}`]);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setStatusMessages(prev => [...prev, `STATUS: Uploading ${file.name}...`]);

    const formData = new FormData();
    formData.append('audio', file);

    try {
      const response = await axios.post('http://localhost:3001/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setStatusMessages(prev => [...prev, `STATUS: ${response.data.message}`]);
    } catch (error) {
      console.error('Error uploading file:', error);
      setStatusMessages(prev => [...prev, `STATUS: Error uploading file: ${error.message}`]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'audio/*': [] } });

  return (
    <div className="App">
      <header className="App-header">
        <h1>Sonic Scribe</h1>
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          {
            isDragActive ?
              <p>Drop the audio files here ...</p> :
              <p>Drag 'n' drop some audio files here, or click to select files</p>
          }
        </div>
        <div className="status-box">
          <h2>Status:</h2>
          {statusMessages.map((msg, index) => (
            <p key={index}>{msg}</p>
          ))}
        </div>
      </header>
    </div>
  );
}

export default App;