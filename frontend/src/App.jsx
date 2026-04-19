import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, File as FileIcon, CheckCircle, DownloadCloud, Clock, Zap } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import Peer from 'peerjs';

// Use dynamic hostname so mobile devices can reach the backend on local network, or use environment variable for production
const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('code') ? 'receive' : 'send';
  });

  return (
    <div className="app-container">
      <div className="glass-card">
        <h1 className="title">Dropzy</h1>
        <p className="subtitle">Lightning fast file transfer across devices</p>

        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'send' ? 'active' : ''}`}
            onClick={() => setActiveTab('send')}
          >
            Send File
          </button>
          <button 
            className={`tab-btn ${activeTab === 'receive' ? 'active' : ''}`}
            onClick={() => setActiveTab('receive')}
          >
            Receive File
          </button>
        </div>

        <div className="content-area">
          {activeTab === 'send' ? <SendTab /> : <ReceiveTab />}
        </div>
      </div>
    </div>
  );
}

function SendTab() {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generatedCode, setGeneratedCode] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  const [peer, setPeer] = useState(null);

  // Initialize WebRTC Peer
  useEffect(() => {
    const p = new Peer();
    setPeer(p);
    return () => p.destroy();
  }, []);

  // Countdown timer logic
  useEffect(() => {
    if (!generatedCode || timeLeft <= 0) {
      if (timeLeft === 0 && generatedCode) {
        reset(); // Time is over, terminate the share
      }
      return;
    }
    const intervalId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(intervalId);
  }, [generatedCode, timeLeft]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setError('');
      setGeneratedCode('');
      setUploadProgress(0);
      setSuccessMsg('');
    }
  };

  const handleUpload = async () => {
    if (files.length === 0 || !peer || !peer.id) return;
    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      const metadata = { 
        filename: files.length === 1 ? files[0].name : 'Multiple Files', 
        size: files.reduce((acc, f) => acc + f.size, 0) 
      };

      const totalBytes = metadata.size || 1;
      let totalSentBytes = 0;

      const sendFileInChunks = async (conn, file) => {
        return new Promise(async (resolve) => {
          const CHUNK_SIZE = 128 * 1024; // 128kb
          conn.send({ type: 'header', filename: file.name, size: file.size });
          
          let offset = 0;
          while (offset < file.size) {
            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const buffer = await chunk.arrayBuffer();
            
            // Handle Backpressure so we don't crash
            while (conn.dataChannel.bufferedAmount > 8 * 1024 * 1024) {
              await new Promise(r => setTimeout(r, 50));
            }

            conn.send({ type: 'chunk', data: buffer });
            offset += chunk.size;
            totalSentBytes += chunk.size;
            setUploadProgress(Math.min(100, Math.floor((totalSentBytes / totalBytes) * 100)));
          }
          conn.send({ type: 'eof' });
          resolve();
        });
      };

      // 1. Signal Backend
      const response = await axios.post(`${API_BASE}/webrtc/signal`, {
        peerId: peer.id,
        metadata: metadata
      });
      
      setGeneratedCode(response.data.code);
      setTimeLeft(600); // 10 minutes session

      // 2. Wait for Peer to Connect directly
      peer.on('connection', (conn) => {
        conn.on('open', async () => {
          setIsUploading(true); // Re-trigger UI 
          
          for (let file of files) {
            await sendFileInChunks(conn, file);
          }

          setSuccessMsg('Transfer Complete!');
          setIsUploading(false);
          setUploadProgress(100);
        });
      });

    } catch (err) {
      setError('Failed to setup connection. Servers might be down.');
      setIsUploading(false);
    }
  };

  function reset() {
    setFiles([]);
    setGeneratedCode('');
    setTimeLeft(0);
    setUploadProgress(0);
    setIsUploading(false);
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (generatedCode) {
    let directDownloadUrl = window.location.origin + '/?code=' + generatedCode;

    return (
      <div className="generated-code-box fade-in">
        {successMsg ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <CheckCircle size={64} color="#10b981" style={{ marginBottom: '1rem' }} />
            <h2 style={{ color: '#10b981' }}>{successMsg}</h2>
            <p className="info-text">Ready for another transfer...</p>
            <button className="btn" onClick={reset} style={{ marginTop: '2rem' }}>Send More</button>
          </div>
        ) : (
          <>
            <Zap size={48} color="#c084fc" style={{ marginBottom: '1rem' }} />
            <h2>Ready to Send!</h2>
            <p className="info-text">Securely connected. Waiting for receiver...</p>
        
            <div className="generated-code">{generatedCode}</div>
            
            <div style={{ background: 'white', padding: '1rem', borderRadius: '16px', marginBottom: '1rem' }}>
              <QRCodeCanvas value={directDownloadUrl} size={160} level={"H"} />
            </div>

            {isUploading && (
               <div style={{width: '100%', marginBottom: '1rem'}}>
                 <div className="progress-container">
                   <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                 </div>
                 <p className="info-text" style={{margin: '0.5rem 0'}}>Transferring Over Network... {uploadProgress}%</p>
               </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', marginTop: '0.5rem', fontWeight: 'bold' }}>
               <Clock size={24} /> {formatTime(timeLeft)}
            </div>

            <button className="btn" onClick={reset} style={{ marginTop: '2rem' }}>Cancel</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <label className="upload-box">
        <input type="file" multiple className="input-file" onChange={handleFileChange} />
        {files.length > 0 ? (
          <>
            <FileIcon size={48} className="upload-icon" />
            <h3 style={{ margin: '1rem 0 0.5rem 0' }}>
              {files.length === 1 ? files[0].name : `${files.length} Files Selected`}
            </h3>
            <p className="info-text">
              {(files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB total
            </p>
          </>
        ) : (
          <>
            <UploadCloud size={56} className="upload-icon" />
            <h3 style={{ margin: '1rem 0 0.5rem 0' }}>Click to select files</h3>
            <p className="info-text">Securely transfer across devices</p>
          </>
        )}
      </label>

      {error && <p className="error-text">{error}</p>}

      <button className="btn" onClick={handleUpload} disabled={files.length === 0 || isUploading}>
        {isUploading ? <div className="loader" /> : 'Generate Secure Link'}
      </button>
    </div>
  );
}

function ReceiveTab() {
  const [code, setCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    if (urlCode) {
      window.history.replaceState({}, document.title, window.location.pathname);
      return urlCode;
    }
    return '';
  });
  
  const [peer] = useState(() => new Peer());
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  const handleDownload = async () => {
    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsChecking(true);
    setError('');
    setStatusText('Locating Peer...');

    try {
      // 1. Get Peer ID from backend
      const checkRes = await axios.get(`${API_BASE}/webrtc/${code}`);
      const senderPeerId = checkRes.data.peerId;
      const totalSessionBytes = checkRes.data.metadata?.size || 1;
      
      setStatusText('Establishing P2P Tunnel...');

      // 2. Connect to Sender
      const conn = peer.connect(senderPeerId, { reliable: true });
      
      let incomingFilename = '';
      let receivedBuffers = [];
      let totalReceivedBytes = 0;

      conn.on('open', () => {
         setStatusText('Connected! Receiving chunks...');
      });

      // 3. Receive Chunks
      conn.on('data', (data) => {
         if (data.type === 'header') {
             incomingFilename = data.filename;
             receivedBuffers = [];
         } else if (data.type === 'chunk') {
             receivedBuffers.push(data.data);
             totalReceivedBytes += data.data.byteLength;
             setProgress(Math.min(100, Math.floor((totalReceivedBytes / totalSessionBytes) * 100)));
         } else if (data.type === 'eof') {
             // File fully received, reconstruct and save
             const blob = new Blob(receivedBuffers);
             const url = window.URL.createObjectURL(blob);
             const a = document.createElement('a');
             a.href = url;
             a.download = incomingFilename;
             a.click();
             
             // If this was the last file in the batch, the progress will naturally be at 100
             if (totalReceivedBytes >= totalSessionBytes * 0.99) {
                 setStatusText('Download Complete!');
                 setTimeout(() => { setStatusText(''); setProgress(0); setIsChecking(false); setCode(''); }, 2000);
             }
         }
      });

      conn.on('error', () => {
         setError('Peer Connection Lost.');
         setIsChecking(false);
      });

    } catch (err) {
      // Fallback for old codes that were uploaded to server before P2P update
      try {
        await axios.get(`${API_BASE}/files/${code}`);
        window.location.href = `${API_BASE}/download/${code}`;
        setCode('');
      } catch(e) {
        setError('Invalid code or Room closed');
      }
      setIsChecking(false);
      setStatusText('');
    }
  };

  return (
    <div className="receive-box fade-in">
      <h2 style={{ marginBottom: '2rem' }}>Enter Code to Download</h2>
      
      <input 
        type="text" 
        maxLength={6}
        className="code-input"
        placeholder="------"
        value={code}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, '');
          setCode(val);
          setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && code.length === 6 && !isChecking) handleDownload();
        }}
        disabled={isChecking}
      />
      
      {error && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}
      
      {isChecking && (
         <div style={{width: '100%', marginBottom: '1.5rem', textAlign: 'center'}}>
           <p className="info-text" style={{marginBottom: '0.5rem', color: '#c084fc'}}>{statusText}</p>
           {progress > 0 && (
              <div className="progress-container">
                 <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
           )}
         </div>
      )}

      <button className="btn" onClick={handleDownload} disabled={code.length !== 6 || isChecking}>
         {!isChecking && <DownloadCloud size={20} />}
         {isChecking ? `${progress > 0 ? progress + '%' : 'Connecting...'}` : 'Connect & Download'}
      </button>
    </div>
  );
}

export default App;
