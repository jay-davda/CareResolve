import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SupportDashboard() {
  const { token } = useAuth();
  
  // Tab Management: 'type' | 'bulk' | 'manage'
  const [activeTab, setActiveTab] = useState('type');

  // Single Complaint State
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const baseTextRef = useRef('');

  // Bulk Processing State
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);

  // Management State
  const [complaints, setComplaints] = useState([]);
  const [resolveId, setResolveId] = useState(null);
  const [resSource, setResSource] = useState('Manual'); // 'AI' or 'Manual'
  const [resolveAction, setResolveAction] = useState('');

  const fetchComplaints = async () => {
    try {
      const res = await fetch('http://localhost:8000/complaints/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setComplaints(data.sort((a, b) => b.id - a.id));
      }
    } catch (err) {
      console.error('Error fetching complaints:', err);
    }
  };

  // Fetch complaints on mount so charts always have data
  useEffect(() => {
    fetchComplaints();
  }, [token]);

  // Re-fetch when switching to 'manage' tab for freshness
  useEffect(() => {
    if (activeTab === 'manage') fetchComplaints();
  }, [activeTab]);

  // ── Chart Color Palettes ──────────────────────────────────────────────────
  const CATEGORY_COLORS = { 'Product': '#3b82f6', 'Packaging': '#f59e0b', 'Trade': '#8b5cf6', 'Miscellaneous': '#94a3b8' };
  const PRIORITY_COLORS = { 'High': '#ef4444', 'Medium': '#f97316', 'Low': '#22c55e' };

  // ── Derive chart data from real complaints (no dummy data) ────────────────
  const categoryData = useMemo(() => {
    const counts = {};
    complaints.forEach(c => {
      const cat = c.category || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [complaints]);

  const priorityData = useMemo(() => {
    const counts = {};
    complaints.forEach(c => {
      const pri = c.priority || 'Unassigned';
      counts[pri] = (counts[pri] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [complaints]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setText(baseTextRef.current + (baseTextRef.current ? ' ' : '') + currentTranscript);
      };

      rec.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert("Microphone access denied! Please click the camera/mic icon in your browser's address bar and select 'Allow'.");
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) {
      alert("Speech Recognition is not supported in this browser. Try Google Chrome or Edge.");
      return;
    }
    baseTextRef.current = text;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.error(e);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const cancelListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setText(baseTextRef.current);
      setIsListening(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error('API request failed');
      const data = await response.json();
      setResult(data);
      
      // Auto-save to database and refresh charts
      const saveRes = await fetch('http://localhost:8000/complaints/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          description: text,
          category: data.category || "Uncategorized",
          priority: data.priority || "Unassigned",
          confidence: data.confidence,
          ai_recommended_action: data.recommended_solutions ? data.recommended_solutions.join(' | ') : null
        }),
      });

      if (saveRes.ok) {
        setText('');
        fetchComplaints(); // Refresh chart data in real-time
      }
    } catch (err) {
      console.error('Error analyzing complaint:', err);
      setError('Unable to connect to the RAG analysis engine.');
    } finally {
      setLoading(false);
    }
  };

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
      fetchComplaints();
    } catch (err) {
      console.error('Bulk upload error:', err);
      alert(`Upload Failed: ${err.message || 'Check server logs for details.'}`);
    } finally {
      setBulkLoading(false);
    }
  };

  const deleteComplaint = async (id) => {
    if (!window.confirm("Are you sure you want to delete this complaint?")) return;
    try {
      const res = await fetch(`http://localhost:8000/complaints/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchComplaints();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const deleteAllComplaints = async () => {
    if (!window.confirm("CRITICAL: Delete ALL complaints from the database?")) return;
    try {
      const res = await fetch(`http://localhost:8000/complaints/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchComplaints();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  };

  const updateStatus = async (id, newStatus) => {
    if (newStatus === 'Resolved') {
      const complaint = complaints.find(c => c.id === id);
      setResolveId(id);
      setResSource('Manual');
      setResolveAction('');
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchComplaints();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleResolve = async (id) => {
    if (!resolveAction.trim() && resSource === 'Manual') {
      alert("Please describe your manual resolution.");
      return;
    }
    
    // If AI used, we might want to default the text to the AI's recommendation
    const finalAction = resSource === 'AI' ? (resolveAction || "Followed AI Recommendation") : resolveAction;

    try {
      const res = await fetch(`http://localhost:8000/complaints/${id}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          executive_action: finalAction,
          resolution_source: resSource
        }),
      });
      if (res.ok) {
        setResolveId(null);
        setResolveAction('');
        fetchComplaints();
      }
    } catch (err) {
      console.error('Error resolving complaint:', err);
    }
  };

  const getCategoryColor = (category) => {
    if (!category) return 'cat-default';
    const cat = category.toLowerCase();
    if (cat.includes('product')) return 'cat-product';
    if (cat.includes('packaging')) return 'cat-packaging';
    if (cat.includes('trade')) return 'cat-trade';
    return 'cat-misc';
  };

  const getPriorityColor = (priority) => {
    if (!priority) return 'pri-default';
    const pri = priority.toLowerCase();
    if (pri.includes('high')) return 'pri-high';
    if (pri.includes('medium')) return 'pri-medium';
    return 'pri-low';
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const tabStyle = (id) => ({
    padding: '1rem 2rem',
    cursor: 'pointer',
    borderBottom: activeTab === id ? '4px solid var(--primary)' : '4px solid transparent',
    color: activeTab === id ? 'var(--primary)' : 'var(--text-muted)',
    fontWeight: '700',
    fontSize: '0.95rem',
    transition: '0.2s all ease',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  });

  return (
    <>
      <div className="app-container" style={{ maxWidth: '1200px', flexDirection: 'column', gap: '2rem', padding: '2rem' }}>
      
      <div className="card" style={{ width: '100%', padding: '0' }}>
        {/* Header Section */}
        <div style={{ padding: '2.5rem 2.5rem 1.5rem', background: 'transparent', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div className="header-icon" style={{ background: 'var(--success-bg)', color: 'var(--success-color)', margin: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.75rem', letterSpacing: '-0.5px' }}>Support Executive Hub</h1>
                <p className="subtitle" style={{ margin: 0 }}>RAG-Enhanced Complaint Intelligence & Resolution</p>
              </div>
            </div>
            {activeTab === 'manage' && complaints.length > 0 && (
              <button onClick={deleteAllComplaints} style={{ padding: '0.6rem 1.2rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', border: '1px solid var(--danger-bg)', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                🗑️ Delete All Data
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', background: 'transparent', padding: '0 2.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={tabStyle('type')} onClick={() => setActiveTab('type')}><span>✍️</span> Single Input</div>
          <div style={tabStyle('bulk')} onClick={() => setActiveTab('bulk')}><span>📁</span> Bulk Processing</div>
          <div style={tabStyle('manage')} onClick={() => setActiveTab('manage')}><span>📋</span> Resolution Manager</div>
        </div>

        {/* Dynamic Content */}
        <div style={{ padding: '2.5rem' }}>
          {activeTab === 'type' && (
            <div className="fade-in">
              <form onSubmit={handleSubmit} className="form">
                <div className={`input-group input-focus-wrapper ${isListening ? 'active' : ''}`}>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Describe the customer issue in detail..."
                    disabled={loading || isListening}
                    className="textarea"
                    style={{ minHeight: '180px', fontSize: '1.05rem', lineHeight: '1.6', paddingBottom: '4rem' }}
                  />
                  
                  <div className="mic-btn-container">
                    <div className={`listening-indicator ${isListening ? 'active' : ''}`}>
                      Listening <div className="dot-anim"><span></span><span></span><span></span></div>
                    </div>
                    
                    <div className={`voice-controls ${isListening ? 'active' : ''}`}>
                      <button type="button" onClick={cancelListening} className="voice-action-btn cancel" title="Cancel">✖</button>
                      <button type="button" onClick={stopListening} className="voice-action-btn stop" title="Done">✔</button>
                    </div>

                    <button 
                      type="button" 
                      onClick={isListening ? stopListening : startListening}
                      className={`mic-btn ${isListening ? 'active' : ''}`}
                      title={isListening ? "Stop Listening" : "Start Voice Input"}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" y1="19" x2="12" y2="22"></line>
                        <line x1="8" y1="22" x2="16" y2="22"></line>
                      </svg>
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading || !text.trim()} className="submit-btn" style={{ height: '60px', fontSize: '1.1rem' }}>
                  {loading ? <div className="spinner"></div> : 'Analyze with RAG Engine'}
                </button>
              </form>

              {result && (
                <div className="result-card fade-in" style={{ marginTop: '2.5rem', border: '2px solid var(--success-color)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--success-color)' }}>Intelligence Report</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--success-color)', fontWeight: '800' }}>{Math.round(result.confidence * 100)}% Match</span>
                  </div>
                  
                  <div className="result-grid">
                    <div className="result-item">
                      <span className="item-label">AI Classification</span>
                      <span className={`badge ${getCategoryColor(result.category)}`}>{result.category}</span>
                    </div>
                    <div className="result-item">
                      <span className="item-label">Recommended Priority</span>
                      <span className={`badge ${getPriorityColor(result.priority)}`}>{result.priority}</span>
                    </div>
                  </div>

                  {result.recommended_solutions && (
                    <div className="solutions-container">
                      <div className="solutions-header">💡 Proven Resolution Patterns (RAG)</div>
                      <ul className="solutions-list">
                        {result.recommended_solutions.map((s, idx) => (
                          <li key={idx}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* ── Real-Time Analytics Section ──────────────────────── */}
              {complaints.length > 0 && (
                <div className="fade-in" style={{ marginTop: '3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                    <div style={{ width: '4px', height: '28px', background: 'var(--primary)', borderRadius: '4px' }}></div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Live Analytics</h3>
                    <span style={{ fontSize: '0.7rem', background: 'var(--success-bg)', color: 'var(--success-color)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ width: '5px', height: '5px', background: 'var(--success-color)', borderRadius: '50%', display: 'inline-block' }}></span> {complaints.length} Records
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* Category Distribution Bar Chart */}
                    <div style={{ padding: '2rem', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '700' }}>Category Distribution</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={categoryData} barSize={36}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} stroke="rgba(255,255,255,0.08)" />
                          <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} stroke="rgba(255,255,255,0.08)" allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)', color: '#f8fafc', fontWeight: '600', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
                            cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }}
                          />
                          <Bar dataKey="count" radius={[8, 8, 0, 0]} animationDuration={800}>
                            {categoryData.map((entry, index) => (
                              <Cell key={`cat-${index}`} fill={CATEGORY_COLORS[entry.name] || '#64748b'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Priority Distribution Pie Chart */}
                    <div style={{ padding: '2rem', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '700' }}>Priority Distribution</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={priorityData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={4}
                            dataKey="value"
                            animationDuration={800}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                          >
                            {priorityData.map((entry, index) => (
                              <Cell key={`pri-${index}`} fill={PRIORITY_COLORS[entry.name] || '#64748b'} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)', color: '#f8fafc', fontWeight: '600', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '0.8rem', fontWeight: 600 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {complaints.length === 0 && (
                <div style={{ marginTop: '3rem', padding: '3rem', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: '20px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📊</div>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>Submit your first complaint to see live analytics here.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bulk' && (
            <div className="fade-in">
              <div style={{ padding: '4rem 2rem', border: '3px dashed var(--border-color)', borderRadius: '24px', textAlign: 'center', background: 'transparent' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>📊</div>
                <h3 style={{ margin: '0 0 0.5rem' }}>Upload Bulk Datasets</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Accepts .txt (bulk complaints) or .eml (single raw email)</p>
                <label style={{ padding: '1rem 2.5rem', background: 'var(--primary)', color: 'white', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', boxShadow: '0 10px 15px -3px rgba(139, 92, 246, 0.3)' }}>
                  {bulkLoading ? 'Processing Intelligence...' : '📁 Choose File'}
                  <input type="file" accept=".txt,.eml" onChange={handleFileUpload} disabled={bulkLoading} style={{ display: 'none' }} />
                </label>
              </div>

              {bulkResults && (
                <div className="bulk-results fade-in" style={{ marginTop: '3rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <span style={{ padding: '0.5rem 1rem', background: 'var(--success-bg)', color: 'var(--success-color)', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem' }}>{bulkResults.count} Items Processed</span>
                    <span style={{ padding: '0.5rem 1rem', background: 'var(--card-bg)', color: 'var(--text-muted)', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem' }}>Time: {bulkResults.processing_time_seconds}s</span>
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ background: 'var(--card-bg)' }}>
                        <tr>
                          <th style={{ padding: '1.25rem 1rem' }}>Snippet</th>
                          <th style={{ padding: '1.25rem 1rem' }}>Category</th>
                          <th style={{ padding: '1.25rem 1rem' }}>RAG Solution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkResults.results.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '1.25rem 1rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>{r.text.substring(0, 100)}...</td>
                            <td style={{ padding: '1.25rem 1rem' }}><span className={`badge ${getCategoryColor(r.category)}`} style={{ fontSize: '0.75rem' }}>{r.category}</span></td>
                            <td style={{ padding: '1.25rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.recommended_solutions?.[0] || 'Manual Review'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="fade-in">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '1rem' }}>ID</th>
                      <th style={{ padding: '1rem' }}>Content</th>
                      <th style={{ padding: '1rem' }}>Category</th>
                      <th style={{ padding: '1rem' }}>Status</th>
                      <th style={{ padding: '1rem' }}>Action</th>
                      <th style={{ padding: '1rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaints.length === 0 ? (
                      <tr><td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No data currently indexed.</td></tr>
                    ) : (
                      complaints.map(c => (
                        <React.Fragment key={c.id}>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', background: resolveId === c.id ? 'var(--success-bg)' : 'transparent' }}>
                            <td style={{ padding: '1.25rem 1rem', fontWeight: '800', color: 'var(--text-muted)' }}>#{c.id}</td>
                            <td style={{ padding: '1.25rem 1rem', maxWidth: '300px' }}>
                              <div className="custom-tooltip" style={{ width: '100%', marginBottom: '0.25rem' }}>
                                <div style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {c.title}
                                </div>
                                <span className="tooltip-text">{c.title}</span>
                              </div>
                              <div className="custom-tooltip" style={{ width: '100%' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {c.description ? c.description : c.created_at.split('T')[0]}
                                </div>
                                <span className="tooltip-text">{c.description ? c.description : c.created_at.split('T')[0]}</span>
                              </div>
                            </td>
                            <td style={{ padding: '1.25rem 1rem' }}><span className={`badge ${getCategoryColor(c.category)}`}>{c.category}</span></td>
                            <td style={{ padding: '1.25rem 1rem' }}>
                              <span style={{ fontWeight: '700', color: c.status === 'Resolved' ? 'var(--success-color)' : 'var(--warning-color)' }}>{c.status}</span>
                            </td>
                            <td style={{ padding: '1.25rem 1rem' }}>
                              {c.status === 'Resolved' ? (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Source: {c.resolution_source}</span>
                              ) : (
                                <select 
                                  value={c.status} 
                                  onChange={(e) => updateStatus(c.id, e.target.value)} 
                                  style={{ padding: '0.5rem', borderRadius: '10px', border: '1px solid var(--border-color)', cursor: 'pointer', background: 'var(--card-bg)', color: 'var(--text-main)' }}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="Resolved">Resolved</option>
                                </select>
                              )}
                            </td>
                            <td style={{ padding: '1.25rem 1rem' }}>
                              <button onClick={() => deleteComplaint(c.id)} style={{ padding: '0.4rem', background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>🗑️</button>
                            </td>
                          </tr>
                          
                          {resolveId === c.id && (
                            <tr style={{ background: 'transparent' }}>
                              <td colSpan="6" style={{ padding: '2rem' }}>
                                <div className="card fade-in" style={{ padding: '2rem', border: '1px solid var(--success-color)', margin: 0, background: 'var(--card-bg)' }}>
                                  <h4 style={{ marginTop: 0, marginBottom: '1.5rem' }}>📋 Resolution Workflow - Complaint #{c.id}</h4>
                                  
                                  <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>
                                      <input type="radio" checked={resSource === 'AI'} onChange={() => setResSource('AI')} /> 🤖 Used AI Recommendation
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>
                                      <input type="radio" checked={resSource === 'Manual'} onChange={() => setResSource('Manual')} /> 🧠 Resolved Myself (Learn Mode)
                                    </label>
                                  </div>

                                  {resSource === 'Manual' && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Describe your solution. This will be added to the RAG knowledge base to help others.</p>
                                      <textarea 
                                        value={resolveAction} 
                                        onChange={(e) => setResolveAction(e.target.value)} 
                                        placeholder="E.g. Verified the batch number and issued a full refund with a 20% discount code for next purchase."
                                        style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid var(--border-color)', minHeight: '100px', background: 'var(--card-bg)', color: 'var(--text-main)' }}
                                      />
                                    </div>
                                  )}

                                  {resSource === 'AI' && (
                                    <div style={{ padding: '1rem', background: 'var(--success-bg)', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--success-bg)' }}>
                                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--success-color)', marginBottom: '0.5rem' }}>AI SUGGESTION:</div>
                                      <div style={{ fontSize: '0.9rem', color: 'var(--success-color)' }}>{c.ai_recommended_action?.split(' | ')[0] || "Standard resolution procedure."}</div>
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button onClick={() => handleResolve(c.id)} style={{ padding: '0.75rem 2rem', background: 'var(--primary)', color: 'white', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Confirm Resolution</button>
                                    <button onClick={() => setResolveId(null)} style={{ padding: '0.75rem 2rem', background: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Cancel</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
