import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function QADashboard() {
  const { token } = useAuth();
  
  // Tab Management: 'audit' | 'trends' | 'recurring' | 'consistency'
  const [activeTab, setActiveTab] = useState('audit');

  const [trends, setTrends] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [uncertainComplaints, setUncertainComplaints] = useState([]);
  const [allComplaints, setAllComplaints] = useState([]);
  const [recurringIssues, setRecurringIssues] = useState(null);
  const [consistency, setConsistency] = useState(null);
  const [loading, setLoading] = useState(true);

  // Resolution State for QA
  const [resolveId, setResolveId] = useState(null);
  const [resSource, setResSource] = useState('Manual');
  const [resolveAction, setResolveAction] = useState('');

  const fetchQAData = async () => {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [tRes, aRes, uRes, rRes, cRes, compRes] = await Promise.all([
        fetch('http://localhost:8000/qa/trends', { headers }),
        fetch('http://localhost:8000/qa/accuracy', { headers }),
        fetch('http://localhost:8000/qa/uncertain-complaints', { headers }),
        fetch('http://localhost:8000/qa/recurring-issues', { headers }),
        fetch('http://localhost:8000/qa/consistency', { headers }),
        fetch('http://localhost:8000/complaints/', { headers })
      ]);
      
      setTrends(await tRes.json());
      setAccuracy(await aRes.json());
      setUncertainComplaints(await uRes.json());
      setRecurringIssues(await rRes.json());
      setConsistency(await cRes.json());
      setAllComplaints((await compRes.json()).sort((a, b) => b.id - a.id));
    } catch (err) {
      console.error('Error fetching QA data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQAData();
    const interval = setInterval(fetchQAData, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const handleCorrection = async (id, correctedCategory) => {
    try {
      const res = await fetch(`http://localhost:8000/qa/corrections/${id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ corrected_category: correctedCategory })
      });
      if (res.ok) {
        fetchQAData();
      }
    } catch (err) {
      console.error('Error submitting correction', err);
    }
  };

  const updateStatus = async (id, newStatus) => {
    if (newStatus === 'Resolved') {
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
      if (res.ok) fetchQAData();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleResolve = async (id) => {
    if (!resolveAction.trim() && resSource === 'Manual') {
      alert("Please describe the resolution for this audit.");
      return;
    }
    
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
        fetchQAData();
      }
    } catch (err) {
      console.error('Error resolving audit item:', err);
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

  const tabStyle = (id) => ({
    padding: '1rem 2rem',
    cursor: 'pointer',
    borderBottom: activeTab === id ? '4px solid var(--primary)' : '4px solid transparent',
    color: activeTab === id ? 'var(--primary)' : 'var(--text-muted)',
    fontWeight: '700',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  });

  const badgeStyle = (bg, color) => ({
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '10px',
    fontSize: '0.75rem',
    fontWeight: '800',
    background: bg,
    color: color
  });

  if (loading) return <div className="app-container"><div className="card"><p>Syncing with Intelligence Hub...</p></div></div>;

  return (
    <div className="app-container" style={{ maxWidth: '1200px', flexDirection: 'column', gap: '2rem', padding: '2rem' }}>
      
      {trends?.alerts && trends.alerts.length > 0 && (
        <div className="card fade-in" style={{ width: '100%', borderLeft: '8px solid var(--danger-color)', backgroundColor: 'var(--danger-bg)', padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', color: 'var(--danger-color)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <h2 style={{ margin: 0, fontSize: '1.4rem', letterSpacing: '-0.5px' }}>Critical Anomaly Alerts</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {trends.alerts.map((alert, idx) => (
              <div key={idx} style={{ padding: '1rem', backgroundColor: 'var(--danger-bg)', borderRadius: '12px', color: 'var(--danger-color)', fontSize: '0.95rem', fontWeight: '700', border: '1px solid var(--danger-color)' }}>
                {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ width: '100%', padding: '0' }}>
        <div style={{ padding: '2.5rem 2.5rem 1.5rem', background: 'transparent', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div className="header-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)', margin: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.75rem', letterSpacing: '-0.5px' }}>QA Intelligence Hub</h1>
                <span style={{ fontSize: '0.65rem', background: 'var(--success-bg)', color: 'var(--success-color)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '6px', height: '6px', background: 'var(--success-color)', borderRadius: '50%', display: 'inline-block' }}></span> LIVE SYNC
                </span>
              </div>
              <p className="subtitle" style={{ margin: 0 }}>Probability Auditing, DBSCAN Clustering & Consistency Tracking</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', background: 'transparent', padding: '0 2.5rem', borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}>
          <div style={tabStyle('audit')} onClick={() => setActiveTab('audit')}>🔍 Audit Queue</div>
          <div style={tabStyle('trends')} onClick={() => setActiveTab('trends')}>📊 Trend Analytics</div>
          <div style={tabStyle('recurring')} onClick={() => setActiveTab('recurring')}>🧩 Issue Clustering</div>
          <div style={tabStyle('consistency')} onClick={() => setActiveTab('consistency')}>⚖️ Resolution Audit</div>
          <div style={tabStyle('manage')} onClick={() => setActiveTab('manage')}>📋 Resolution Manager</div>
        </div>

        <div style={{ padding: '2.5rem' }}>
          {activeTab === 'audit' && (
            <div className="fade-in">
              {uncertainComplaints.length === 0 ? (
                <div style={{ padding: '6rem', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: '24px' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                  <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Audit Queue is Clear!</h3>
                  <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>The AI is highly confident in all recent classifications.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <th style={{ padding: '1rem' }}>ID</th>
                        <th style={{ padding: '1rem' }}>Content</th>
                        <th style={{ padding: '1rem' }}>AI Prediction</th>
                        <th style={{ padding: '1rem' }}>Confidence</th>
                        <th style={{ padding: '1rem' }}>QA Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uncertainComplaints.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
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
                            <span style={{ fontWeight: '700', color: c.confidence > 0.75 ? 'var(--success-color)' : 'var(--warning-color)' }}>
                              {Math.round(c.confidence * 100)}%
                            </span>
                          </td>
                          <td style={{ padding: '1.25rem 1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <select 
                                onChange={(e) => handleCorrection(c.id, e.target.value)}
                                defaultValue=""
                                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600' }}
                              >
                                <option value="" disabled>Select Action...</option>
                                <option value={c.category} style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Approve ({c.category})</option>
                                <optgroup label="AI Alternatives">
                                  {c.alternatives?.map((alt, i) => (
                                    <option key={i} value={alt.category}>{alt.category} ({Math.round(alt.confidence * 100)}%)</option>
                                  ))}
                                </optgroup>
                                <optgroup label="All Categories">
                                  <option value="Product">Product</option>
                                  <option value="Packaging">Packaging</option>
                                  <option value="Trade">Trade</option>
                                  <option value="Miscellaneous">Miscellaneous</option>
                                </optgroup>
                              </select>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'trends' && (
            <div className="fade-in">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Volume Temporal Trends</h3>
              <div style={{ width: '100%', height: 400, background: 'transparent', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends?.time_series || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="date" tick={{fontSize: 11, fontWeight: 600, fill: 'var(--text-muted)'}} stroke="var(--border-color)" />
                    <YAxis tick={{fontSize: 11, fontWeight: 600, fill: 'var(--text-muted)'}} stroke="var(--border-color)" />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', boxShadow: 'var(--glass-shadow)', fontWeight: '600', color: 'var(--text-main)' }} />
                    <Legend iconType="circle" />
                    <Line type="monotone" dataKey="Product" stroke="#3b82f6" strokeWidth={4} dot={false} />
                    <Line type="monotone" dataKey="Packaging" stroke="#f59e0b" strokeWidth={4} dot={false} />
                    <Line type="monotone" dataKey="Trade" stroke="#8b5cf6" strokeWidth={4} dot={false} />
                    <Line type="monotone" dataKey="Miscellaneous" stroke="#94a3b8" strokeWidth={4} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'recurring' && (
            <div className="fade-in">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>Automated Issue Clustering</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                {recurringIssues?.recurring_issues?.map((cluster, idx) => (
                  <div key={idx} style={{ padding: '2rem', border: '1px solid var(--border-color)', borderRadius: '24px', background: 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                      <span style={badgeStyle('var(--primary-light)', 'var(--primary)')}>Cluster #{idx + 1}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--text-muted)' }}>{cluster.count} Mentions</span>
                    </div>
                    <p style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '1.25rem', fontSize: '1.1rem' }}>"{cluster.issue}"</p>
                    <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {cluster.samples.map((s, si) => <li key={si} style={{ fontStyle: 'italic' }}>"{s}"</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'consistency' && (
            <div className="fade-in">
              {consistency?.variance_score && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
                    <div style={{ padding: '2rem', background: 'var(--success-bg)', borderRadius: '24px', textAlign: 'center' }}><div style={{ fontSize: '0.8rem', fontWeight: '800' }}>AI Adherence</div><div style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--success-color)' }}>{consistency.variance_score.ai_followed}</div></div>
                    <div style={{ padding: '2rem', background: 'var(--danger-bg)', borderRadius: '24px', textAlign: 'center' }}><div style={{ fontSize: '0.8rem', fontWeight: '800' }}>Manual Overrides</div><div style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--danger-color)' }}>{consistency.variance_score.ai_ignored}</div></div>
                    <div style={{ padding: '2rem', background: 'transparent', borderRadius: '24px', textAlign: 'center', border: '1px solid var(--border-color)' }}><div style={{ fontSize: '0.8rem', fontWeight: '800' }}>Variance</div><div style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--text-main)' }}>{consistency.variance_score.variance_percentage}%</div></div>
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead style={{ background: 'var(--card-bg)' }}><tr style={{ color: 'var(--text-muted)' }}><th style={{ padding: '1.25rem 1rem' }}>ID</th><th style={{ padding: '1.25rem 1rem' }}>RAG Solution</th><th style={{ padding: '1.25rem 1rem' }}>Human Res.</th><th style={{ padding: '1.25rem 1rem' }}>Source</th><th style={{ padding: '1.25rem 1rem' }}>Alignment</th></tr></thead>
                      <tbody>{consistency.comparison_table.map((row, idx) => (<tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '1.25rem 1rem', fontWeight: '800' }}>#{row.id}</td><td style={{ padding: '1.25rem 1rem' }}>{row.ai_recommended}</td><td style={{ padding: '1.25rem 1rem' }}>{row.executive_action}</td><td style={{ padding: '1.25rem 1rem' }}><span style={badgeStyle(row.resolution_source === 'AI' ? 'var(--success-bg)' : 'var(--warning-bg)', row.resolution_source === 'AI' ? 'var(--success-color)' : 'var(--warning-color)')}>{row.resolution_source || 'Manual'}</span></td><td style={{ padding: '1.25rem 1rem' }}><span style={badgeStyle(row.match ? 'var(--success-bg)' : 'var(--danger-bg)', row.match ? 'var(--success-color)' : 'var(--danger-color)')}>{row.match ? 'Followed' : 'Diverged'}</span></td></tr>))}</tbody>
                    </table>
                  </div>
                </>
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
                      <th style={{ padding: '1rem' }}>Action Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allComplaints.length === 0 ? (
                      <tr><td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No complaints found.</td></tr>
                    ) : (
                      allComplaints.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
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
                          <td style={{ padding: '1.25rem 1rem', maxWidth: '250px' }}>
                            {c.status === 'Resolved' ? (
                              <div className="custom-tooltip" style={{ width: '100%' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {c.executive_action || c.ai_recommended_action || "Standard resolution."}
                                </div>
                                <span className="tooltip-text">{c.executive_action || c.ai_recommended_action || "Standard resolution."}</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pending Action</span>
                            )}
                          </td>
                        </tr>
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
  );
}
