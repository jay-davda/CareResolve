import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function EnterpriseDashboard() {
  const { token, user, logout } = useAuth();
  
  // Tab Management: 'analyze' | 'bulk' | 'manage' | 'analytics'
  const [activeTab, setActiveTab] = useState('analyze');

  // Single Analysis State
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Bulk State
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);

  // Management State
  const [complaints, setComplaints] = useState([]);
  
  // Analytics State
  const [analytics, setAnalytics] = useState({
    trends: [
      { category: 'Product Quality', count: 45, trend: '+12%' },
      { category: 'Packaging', count: 28, trend: '-5%' },
      { category: 'Trade Issues', count: 18, trend: '+8%' }
    ],
    sla: { high: 12, medium: 24, low: 56 },
    recurring: ['Bottle cap leakage in Batch #442', 'Delayed shipping in Northern region', 'Trade partner portal login issues']
  });

  const fetchComplaints = async () => {
    try {
      const res = await fetch('http://localhost:8000/complaints/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setComplaints(await res.json());
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'manage') fetchComplaints();
  }, [activeTab, token]);

  const handleAnalyze = async (e) => {
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

      if (!response.ok) throw new Error('AI Engine unreachable');
      const data = await response.json();
      setResult(data);
      
      // Auto-save to database for management view
      await fetch('http://localhost:8000/complaints/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          description: text,
          category: data.category,
          priority: data.priority,
          confidence: data.confidence,
          ai_recommended_action: data.recommended_solutions?.join(' | ')
        }),
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBulkLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://localhost:8000/bulk-predict', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) throw new Error('Bulk processing failed');
      const data = await res.json();
      setBulkResults(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const deleteComplaint = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      await fetch(`http://localhost:8000/complaints/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchComplaints();
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityBadge = (priority) => {
    const p = priority?.toLowerCase() || '';
    if (p.includes('high')) return <span className="badge badge-red">{priority}</span>;
    if (p.includes('medium')) return <span className="badge badge-yellow">{priority}</span>;
    return <span className="badge badge-green">{priority || 'Low'}</span>;
  };

  return (
    <div className="app-container">
      <header className="enterprise-header">
        <div className="logo-section">
          <div style={{ background: 'var(--primary)', color: 'white', padding: '8px', borderRadius: '10px', display: 'flex' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px' }}>CareResolve AI</h1>
            <div className="live-indicator"><span className="live-dot"></span>Complaint Intelligence Live</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{user?.username}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role} Portal</div>
          </div>
          <button onClick={logout} style={{ padding: '0.5rem 1rem', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Logout</button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '0 2.5rem 5rem', width: '100%', margin: '0 auto' }}>
        
        <div className="nav-tabs">
          <button className={`nav-tab ${activeTab === 'analyze' ? 'active' : ''}`} onClick={() => setActiveTab('analyze')}>🎯 Analyze</button>
          <button className={`nav-tab ${activeTab === 'bulk' ? 'active' : ''}`} onClick={() => setActiveTab('bulk')}>📁 Bulk</button>
          <button className={`nav-tab ${activeTab === 'manage' ? 'active' : ''}`} onClick={() => setActiveTab('manage')}>📋 Manage</button>
          <button className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>📈 Insights</button>
        </div>

        <div className="fade-in">
          {activeTab === 'analyze' && (
            <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: '2.5rem', alignItems: 'start' }}>
              <section className="card">
                <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Direct Intelligence Input</h2>
                <form onSubmit={handleAnalyze}>
                  <textarea className="textarea" placeholder="Enter complaint details..." value={text} onChange={(e) => setText(e.target.value)} disabled={loading} />
                  <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} disabled={loading || !text.trim()}>
                    {loading ? <><div className="spinner"></div> Analyzing...</> : 'Analyze & Save'}
                  </button>
                </form>
              </section>

              {result && (
                <section className="card" style={{ border: '2px solid var(--primary-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem' }}>Analysis Results</h2>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>CONFIDENCE</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{Math.round(result.confidence * 100)}%</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <div className="card" style={{ flex: 1, padding: '1.25rem', boxShadow: 'none', border: '1px solid var(--border)', background: '#f8fafc' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px' }}>CATEGORY</div>
                      <div style={{ fontWeight: 800 }}>{result.category}</div>
                    </div>
                    <div className="card" style={{ flex: 1, padding: '1.25rem', boxShadow: 'none', border: '1px solid var(--border)', background: '#f8fafc' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px' }}>PRIORITY</div>
                      <div>{getPriorityBadge(result.priority)}</div>
                    </div>
                  </div>
                  <div style={{ padding: '1.5rem', background: 'var(--primary-light)', borderRadius: '16px', border: '1px solid var(--primary)' }}>
                    <div style={{ color: 'var(--primary-dark)', fontWeight: 800, marginBottom: '1rem', fontSize: '0.9rem' }}>RAG RECOMMENDED ACTIONS</div>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {result.recommended_solutions?.map((sol, i) => <li key={i} style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>• {sol}</li>)}
                    </ul>
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === 'bulk' && (
            <section className="card" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
              <div style={{ background: 'var(--primary-light)', width: '80px', height: '80px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: 'var(--primary)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Bulk Dataset Processing</h2>
              <label className="btn-primary" style={{ width: 'fit-content', margin: '2rem auto', cursor: 'pointer' }}>
                {bulkLoading ? 'Processing...' : '📁 Select .txt File'}
                <input type="file" accept=".txt" onChange={handleBulkUpload} disabled={bulkLoading} style={{ display: 'none' }} />
              </label>
              {bulkResults && <p style={{ color: 'var(--primary)', fontWeight: 700 }}>Successfully processed {bulkResults.count} records.</p>}
            </section>
          )}

          {activeTab === 'manage' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem' }}>Complaint Management</h2>
                <button onClick={fetchComplaints} className="btn-primary" style={{ padding: '0.5rem 1.5rem', background: '#f1f5f9', color: 'var(--text-main)', border: '1px solid var(--border)' }}>🔄 Refresh</button>
              </div>
              <div className="table-container">
                <table className="enterprise-table">
                  <thead>
                    <tr><th>ID</th><th>Description</th><th>Category</th><th>Priority</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {complaints.map(c => (
                      <tr key={c.id}>
                        <td>#{c.id}</td>
                        <td style={{ maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.description}</td>
                        <td style={{ fontWeight: 700 }}>{c.category}</td>
                        <td>{getPriorityBadge(c.priority)}</td>
                        <td><button onClick={() => deleteComplaint(c.id)} style={{ color: '#ef4444', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              <section className="card"><h3>Trends</h3>{analytics.trends.map((t, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px solid #f1f5f9' }}><span>{t.category}</span><strong>{t.trend}</strong></div>)}</section>
              <section className="card"><h3>Recurring Issues</h3>{analytics.recurring.map((item, i) => <div key={i} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.85rem' }}>{item}</div>)}</section>
              <section className="card"><h3>SLA State</h3><div style={{ marginTop: '1rem' }}>High: {analytics.sla.high} | Med: {analytics.sla.medium} | Low: {analytics.sla.low}</div></section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
