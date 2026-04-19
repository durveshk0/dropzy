import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, File as FileIcon, X, CheckCircle, DownloadCloud, Clock } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

// Use dynamic hostname so mobile devices can reach the backend on local network, or use environment variable for production
const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

function App() {
  const [activeTab, setActiveTab] = useState('send');

  // Auto-switch to receive tab if there is a ?code= in the URL (scanned via QR)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('code')) {
      setActiveTab('receive');
    }
  }, []);

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
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [localIp, setLocalIp] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  // Countdown timer logic
  useEffect(() => {
    if (!generatedCode || timeLeft <= 0) {
      if (timeLeft === 0 && generatedCode) {
        reset(); // Time is over, terminate the share
      }
      return;
    }
    
    const intervalId = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [generatedCode, timeLeft]);

  // Poll for download status
  useEffect(() => {
    if (!generatedCode) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/status/${generatedCode}`);
        if (res.data.downloaded) {
          clearInterval(pollInterval);
          setSuccessMsg('Transfer Complete!');
          setTimeout(() => {
            setSuccessMsg('');
            reset();
          }, 2000);
        }
      } catch (err) {
        if (err.response && err.response.status === 404) {
          clearInterval(pollInterval);
          reset();
        }
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [generatedCode]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      setGeneratedCode('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setGeneratedCode(response.data.code);
      setLocalIp(response.data.local_ip);
      setTimeLeft(600); // 10 minutes = 600 seconds
    } catch (err) {
      setError('Failed to upload file. Please try again.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setGeneratedCode('');
    setLocalIp('');
    setTimeLeft(0);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (generatedCode) {
    // Generate URL to the frontend with the code pre-filled
    const host = localIp || window.location.hostname;
    const portStr = window.location.port ? ':' + window.location.port : '';
    const directDownloadUrl = `http://${host}${portStr}/?code=${generatedCode}`;

    return (
      <div className="generated-code-box fade-in">
        {successMsg ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <CheckCircle size={64} color="#10b981" style={{ marginBottom: '1rem' }} />
            <h2 style={{ color: '#10b981' }}>{successMsg}</h2>
            <p className="info-text">Ready for another transfer...</p>
          </div>
        ) : (
          <>
            <CheckCircle size={48} color="#10b981" style={{ marginBottom: '1rem' }} />
            <h2>File Ready!</h2>
        <p className="info-text">Scan QR to open app and download, or enter code</p>
        
        <div className="generated-code">{generatedCode}</div>
        
        {/* QR Code Display */}
        <div style={{ background: 'white', padding: '1rem', borderRadius: '16px', marginBottom: '1rem' }}>
          <QRCodeCanvas value={directDownloadUrl} size={160} level={"H"} />
        </div>

        {/* Timer Display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', marginTop: '0.5rem', fontWeight: 'bold', fontSize: '1.2rem' }}>
           <Clock size={24} />
           {formatTime(timeLeft)}
        </div>
        <p className="info-text" style={{margin: '0.5rem 0 0 0'}}>Share terminates automatically when time is up</p>

        <button className="btn" onClick={reset} style={{ marginTop: '2rem' }}>
          Terminate Share Now
        </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <label className="upload-box">
        <input type="file" className="input-file" onChange={handleFileChange} />
        {file ? (
          <>
            <FileIcon size={48} className="upload-icon" />
            <h3 style={{ margin: '1rem 0 0.5rem 0' }}>{file.name}</h3>
            <p className="info-text">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </>
        ) : (
          <>
            <UploadCloud size={56} className="upload-icon" />
            <h3 style={{ margin: '1rem 0 0.5rem 0' }}>Click to select a file</h3>
            <p className="info-text">Works over same WiFi or Internet</p>
          </>
        )}
      </label>

      {error && <p className="error-text">{error}</p>}

      <button 
        className="btn" 
        onClick={handleUpload}
        disabled={!file || isUploading}
      >
        {isUploading ? <div className="loader" /> : 'Upload & Generate Share'}
      </button>
    </div>
  );
}

function ReceiveTab() {
  const [code, setCode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  // Grab the code from URL exactly once on mount if user scanned a QR
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    if (urlCode) {
      setCode(urlCode);
      // Clean up the URL to make it look clean without refreshing
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleDownload = async () => {
    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsChecking(true);
    setError('');

    try {
      // First verify if the code exists by fetching filename
      const checkRes = await axios.get(`${API_BASE}/files/${code}`);
      const filename = checkRes.data.filename;
      
      // If it exists, initiate download
      window.location.href = `${API_BASE}/download/${code}`;
      setCode(''); // Reset after success
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError('Invalid code or file has expired');
      } else {
        setError('Connection error. Is the server running?');
      }
    } finally {
      setIsChecking(false);
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
          if (e.key === 'Enter') {
            handleDownload();
          }
        }}
      />
      
      {error && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}
      
      <button 
        className="btn" 
        onClick={handleDownload}
        disabled={code.length !== 6 || isChecking}
      >
        {isChecking ? <div className="loader" /> : (
          <>
            <DownloadCloud size={20} />
            Download File
          </>
        )}
      </button>
    </div>
  );
}

export default App;
