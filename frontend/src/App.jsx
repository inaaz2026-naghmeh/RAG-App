import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

function App() {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsUploading(true);
    setUploadStatus('Uploading and indexing...');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadStatus('✅ File indexed successfully');
      setMessages([{ type: 'ai', text: 'Hi! I have indexed your Excel file. What would you like to know about it?' }]);
    } catch (error) {
      console.error(error);
      setUploadStatus('❌ Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isQuerying) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { type: 'user', text: userMessage }]);
    setIsQuerying(true);

    try {
      const response = await axios.post(`${API_BASE}/query`, { question: userMessage });
      setMessages(prev => [...prev, { type: 'ai', text: response.data.answer }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { type: 'ai', text: 'Sorry, I encountered an error: ' + (error.response?.data?.detail || error.message) }]);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Excel Intelligence RAG</h1>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '0.5rem' }}>
          Powered by Groq & FAISS
        </p>
      </header>

      <div className="upload-section">
        {!file ? (
          <>
            <label className="upload-label">
              <input type="file" className="file-input" onChange={handleFileChange} accept=".xlsx,.xls" />
              <span>Choose Excel File</span>
            </label>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Support .xlsx and .xls formats</p>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontWeight: 600 }}>{file.name}</span>
            <span className="status-badge">{uploadStatus}</span>
            <button 
              onClick={() => { setFile(null); setMessages([]); setUploadStatus(''); }}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Reset
            </button>
          </div>
        )}
      </div>

      <div className="chat-section">
        <div className="messages-container">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.type}`}>
              {msg.text}
            </div>
          ))}
          {isQuerying && (
            <div className="message ai">
              <div className="loader">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <input 
            type="text" 
            placeholder={file ? "Ask a question about the file..." : "Please upload a file first"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            disabled={!file || isUploading || isQuerying}
          />
          <button 
            className="send-btn" 
            onClick={handleSend}
            disabled={!file || isUploading || isQuerying || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
