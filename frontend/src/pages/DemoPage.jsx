import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function DemoPage() {
  const { token } = useAuth();

  // Mode: 'home' | 'single' | 'bulk'
  const [mode, setMode] = useState('home');

  // Single complaint state
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Bulk processing state
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // ---------- Single Complaint ----------
  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      setResult(data);
    } catch (err) {
      alert('Failed to connect to AI engine. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Bulk Processing ----------
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBulkLoading(true);
    setBulkResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://localhost:8000/bulk-predict', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      setBulkResults(data);
    } catch (err) {
      alert('Failed to process file. Is the backend running?');
    } finally {
      setBulkLoading(false);
    }
  };

  // ---------- Go Back ----------
  const goHome = () => {
    setMode('home');
    setResult(null);
    setText('');
    setBulkResults(null);
  };

  // ---------- Styles ----------
  const container = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfeff 50%, #eff6ff 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    padding: '2rem'
  };

  const card = {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '3rem',
    width: '100%',
    maxWidth: '650px',
    textAlign: 'center'
  };

  const title = {
    fontSize: '1.8rem',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '0.5rem'
  };

  const subtitle = {
    fontSize: '0.95rem',
    color: '#6b7280',
    marginBottom: '2.5rem'
  };

  const bigBtn = (color) => ({
    padding: '1rem 2.5rem',
    fontSize: '1.05rem',
    fontWeight: '600',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    color: 'white',
    background: color,
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: `0 4px 14px ${color}44`
  });

  const backBtn = {
    padding: '0.5rem 1.2rem',
    fontSize: '0.85rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: 'white',
    color: '#374151',
    cursor: 'pointer',
    marginBottom: '1.5rem'
  };

  const badge = (bg, color) => ({
    display: 'inline-block',
    padding: '0.35rem 1rem',
    borderRadius: '9999px',
    fontSize: '0.95rem',
    fontWeight: '600',
    background: bg,
    color: color
  });

  // ===================== HOME MODE =====================
  if (mode === 'home') {
    return (
      <div style={container}>
        <div style={card}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🤖</div>
          <h1 style={title}>CareResolve AI</h1>
          <p style={subtitle}>AI-Powered Complaint Classification System</p>

          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              style={bigBtn('#16a34a')}
              onClick={() => setMode('single')}
              onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; }}
            >
              ✍️ Type Complaint
            </button>
            <button
              style={bigBtn('#2563eb')}
              onClick={() => setMode('bulk')}
              onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; }}
            >
              📁 Bulk Process
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===================== SINGLE MODE =====================
  if (mode === 'single') {
    return (
      <div style={container}>
        <div style={card}>
          <button style={backBtn} onClick={goHome}>← Back</button>
          <h2 style={{ ...title, fontSize: '1.4rem' }}>Analyze a Complaint</h2>
          <p style={{ ...subtitle, marginBottom: '1.5rem' }}>Type or paste a customer complaint below.</p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. My product arrived damaged and the seal was broken..."
            rows={5}
            style={{
              width: '100%',
              padding: '0.9rem',
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              fontSize: '0.95rem',
              resize: 'vertical',
              marginBottom: '1rem',
              fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
          />

          <button
            onClick={handleAnalyze}
            disabled={loading || !text.trim()}
            style={{
              ...bigBtn('#16a34a'),
              width: '100%',
              opacity: (loading || !text.trim()) ? 0.6 : 1,
              cursor: (loading || !text.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '⏳ Analyzing...' : '🔍 Analyze Complaint'}
          </button>

          {/* Result Card */}
          {result && (
            <div style={{
              marginTop: '2rem',
              padding: '1.5rem',
              background: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              textAlign: 'left'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#111827', fontSize: '1.1rem' }}>AI Classification Result</h3>

              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.3rem', fontWeight: '600' }}>Category</div>
                  <span style={badge('#dbeafe', '#1e40af')}>{result.category}</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.3rem', fontWeight: '600' }}>Priority</div>
                  <span style={badge(
                    result.priority?.toLowerCase().includes('high') ? '#fee2e2' : '#dcfce7',
                    result.priority?.toLowerCase().includes('high') ? '#991b1b' : '#166534'
                  )}>{result.priority}</span>
                </div>
                {result.confidence != null && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.3rem', fontWeight: '600' }}>Confidence</div>
                    <span style={badge('#f3e8ff', '#6b21a8')}>{Math.round(result.confidence * 100)}%</span>
                  </div>
                )}
              </div>

              {result.recommended_solutions && result.recommended_solutions.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: '600' }}>Recommended Actions</div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#374151', fontSize: '0.9rem', lineHeight: '1.7' }}>
                    {result.recommended_solutions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===================== BULK MODE =====================
  if (mode === 'bulk') {
    return (
      <div style={container}>
        <div style={{ ...card, maxWidth: '850px' }}>
          <button style={backBtn} onClick={goHome}>← Back</button>
          <h2 style={{ ...title, fontSize: '1.4rem' }}>Bulk Complaint Processing</h2>
          <p style={{ ...subtitle, marginBottom: '1.5rem' }}>Upload a <strong>.txt</strong> file — one complaint per line.</p>

          <label style={{
            display: 'block',
            padding: '2rem',
            border: '2px dashed #d1d5db',
            borderRadius: '12px',
            cursor: 'pointer',
            color: '#6b7280',
            fontSize: '0.95rem',
            marginBottom: '1.5rem',
            transition: 'border-color 0.2s',
            background: '#fafafa'
          }}>
            {bulkLoading ? '⏳ Processing file...' : '📂 Click to select a .txt file'}
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              disabled={bulkLoading}
              style={{ display: 'none' }}
            />
          </label>

          {/* Bulk Results */}
          {bulkResults && (
            <div style={{ textAlign: 'left' }}>
              <div style={{
                display: 'flex', gap: '1rem', flexWrap: 'wrap',
                marginBottom: '1rem', justifyContent: 'center'
              }}>
                <span style={badge('#dcfce7', '#166534')}>
                  ✓ {bulkResults.count} complaints processed
                </span>
                <span style={badge('#f3e8ff', '#6b21a8')}>
                  ⏱ {bulkResults.processing_time_seconds}s
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.85rem',
                  textAlign: 'left'
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '0.7rem 0.5rem', color: '#6b7280', fontWeight: '600' }}>#</th>
                      <th style={{ padding: '0.7rem 0.5rem', color: '#6b7280', fontWeight: '600' }}>Complaint Text</th>
                      <th style={{ padding: '0.7rem 0.5rem', color: '#6b7280', fontWeight: '600' }}>Category</th>
                      <th style={{ padding: '0.7rem 0.5rem', color: '#6b7280', fontWeight: '600' }}>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResults.results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.6rem 0.5rem', color: '#9ca3af' }}>{i + 1}</td>
                        <td style={{
                          padding: '0.6rem 0.5rem',
                          maxWidth: '350px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: '#374151'
                        }}>
                          {r.text}
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <span style={badge('#dbeafe', '#1e40af')}>{r.category}</span>
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <span style={badge(
                            r.priority?.toLowerCase().includes('high') ? '#fee2e2' : '#dcfce7',
                            r.priority?.toLowerCase().includes('high') ? '#991b1b' : '#166534'
                          )}>{r.priority}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
