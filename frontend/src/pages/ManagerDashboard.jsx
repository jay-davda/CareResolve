import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function ManagerDashboard() {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [sla, setSla] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch real data from backend
  const fetchData = async () => {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [dRes, sRes, cRes] = await Promise.all([
        fetch('http://localhost:8000/manager/dashboard', { headers }),
        fetch('http://localhost:8000/manager/sla', { headers }),
        fetch('http://localhost:8000/complaints/', { headers }),
      ]);
      setDashboard(await dRes.json());
      setSla(await sRes.json());
      const cData = await cRes.json();
      setComplaints(Array.isArray(cData) ? cData.sort((a, b) => b.id - a.id) : []);
    } catch (err) {
      console.error('Failed to fetch manager data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update category or priority for a complaint
  const updateField = async (id, field, value) => {
    try {
      await fetch(`http://localhost:8000/complaints/${id}/update-fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: value }),
      });
      fetchData(); // refresh everything
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  // Delete a single complaint
  const deleteComplaint = async (id) => {
    if (!window.confirm(`Delete complaint #${id}?`)) return;
    try {
      await fetch(`http://localhost:8000/complaints/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Fetch on mount + auto-refresh every 10 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [token]);

  // Transform category distribution into chart-friendly format
  const categoryData = useMemo(() => {
    if (!dashboard?.distribution) return [];
    return Object.entries(dashboard.distribution).map(([name, count]) => ({ name, count }));
  }, [dashboard]);

  // Transform priority breakdown into chart-friendly format
  const priorityData = useMemo(() => {
    if (!dashboard?.priority_breakdown) return [];
    return Object.entries(dashboard.priority_breakdown).map(([name, value]) => ({ name, value }));
  }, [dashboard]);

  // Color maps
  const CAT_COLORS = { 'Product': '#3b82f6', 'Packaging': '#f59e0b', 'Trade': '#8b5cf6', 'Miscellaneous': '#94a3b8' };
  const PRI_COLORS = { 'High': '#ef4444', 'Medium': '#f97316', 'Low': '#22c55e', 'Unassigned': '#64748b' };

  const badgeStyle = (bg, color) => ({
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '10px',
    fontSize: '0.75rem',
    fontWeight: '800',
    background: bg,
    color: color
  });

  if (loading) return <div className="app-container"><div className="card"><p>Accessing Operations Oversight...</p></div></div>;

  return (
    <div className="app-container" style={{ maxWidth: '1200px', flexDirection: 'column', gap: '2rem', padding: '2rem' }}>
      
      <div className="card" style={{ width: '100%', padding: '0' }}>
        {/* Header */}
        <div style={{ padding: '2.5rem 2.5rem 1.5rem', background: 'transparent', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div className="header-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning-color)', margin: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.75rem', letterSpacing: '-0.5px' }}>Operations Oversight</h1>
                <span style={{ fontSize: '0.65rem', background: 'var(--success-bg)', color: 'var(--success-color)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '6px', height: '6px', background: 'var(--success-color)', borderRadius: '50%', display: 'inline-block' }}></span> LIVE
                </span>
              </div>
              <p className="subtitle" style={{ margin: 0 }}>Real-Time SLA Compliance & Resolution Metrics</p>
            </div>
          </div>
        </div>

        <div style={{ padding: '2.5rem' }}>

          {/* ── Quick Stats (all from real DB data) ─────────────────── */}
          <div className="dashboard-grid" style={{ marginBottom: '3rem' }}>
            <div className="dashboard-stat" style={{ border: '1px solid var(--border-color)' }}>
              <span className="stat-label">Total Complaints</span>
              <span className="stat-value">{dashboard?.total_all ?? 0}</span>
            </div>
            <div className="dashboard-stat" style={{ border: '1px solid var(--border-color)' }}>
              <span className="stat-label">New Today</span>
              <span className="stat-value">{dashboard?.total_complaints_today ?? 0}</span>
            </div>
            <div className="dashboard-stat" style={{ border: '1px solid var(--success-color)', background: 'var(--success-bg)' }}>
              <span className="stat-label">Resolved Today</span>
              <span className="stat-value" style={{ color: 'var(--success-color)' }}>{dashboard?.resolved_today ?? 0}</span>
            </div>
          </div>



          {/* ── Live Charts ─────────────────────────────────────────── */}
          {(categoryData.length > 0 || priorityData.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
              
              {/* Category Distribution Bar Chart */}
              {categoryData.length > 0 && (
                <div style={{ padding: '2rem', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '700' }}>Category Distribution</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={categoryData} barSize={36}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} stroke="rgba(255,255,255,0.08)" />
                      <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} stroke="rgba(255,255,255,0.08)" allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.95)', color: '#f8fafc', fontWeight: '600', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }} />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]} animationDuration={800}>
                        {categoryData.map((entry, i) => (
                          <Cell key={`c-${i}`} fill={CAT_COLORS[entry.name] || '#64748b'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Priority Distribution Pie Chart */}
              {priorityData.length > 0 && (
                <div style={{ padding: '2rem', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '700' }}>Priority Distribution</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={priorityData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value" animationDuration={800}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                      >
                        {priorityData.map((entry, i) => (
                          <Cell key={`p-${i}`} fill={PRI_COLORS[entry.name] || '#64748b'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.95)', color: '#f8fafc', fontWeight: '600' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '0.8rem', fontWeight: 600 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── Complaint Management Table ────────────────────────── */}
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '4px', height: '28px', background: 'var(--primary)', borderRadius: '4px' }}></div>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Complaint Management</h3>
              <span style={{ fontSize: '0.7rem', background: 'var(--success-bg)', color: 'var(--success-color)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: '800' }}>
                {complaints.length} records
              </span>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--card-bg)' }}>
                    <th style={{ padding: '1rem' }}>ID</th>
                    <th style={{ padding: '1rem' }}>Content</th>
                    <th style={{ padding: '1rem' }}>Category</th>
                    <th style={{ padding: '1rem' }}>Priority</th>
                    <th style={{ padding: '1rem' }}>Status</th>
                    <th style={{ padding: '1rem' }}>Date</th>
                    <th style={{ padding: '1rem' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.length === 0 ? (
                    <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No complaints in the system.</td></tr>
                  ) : (
                    complaints.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--text-muted)' }}>#{c.id}</td>
                        <td style={{ padding: '1rem', maxWidth: '280px' }}>
                          <div className="custom-tooltip" style={{ width: '100%' }}>
                            <div style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.description || c.title}
                            </div>
                            <span className="tooltip-text">{c.description || c.title}</span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <select
                            value={c.category}
                            onChange={(e) => updateField(c.id, 'category', e.target.value)}
                            style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
                          >
                            <option value="Product">Product</option>
                            <option value="Packaging">Packaging</option>
                            <option value="Trade">Trade</option>
                            <option value="Miscellaneous">Miscellaneous</option>
                          </select>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <select
                            value={c.priority || 'Low'}
                            onChange={(e) => updateField(c.id, 'priority', e.target.value)}
                            style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: c.priority === 'High' ? '#ef4444' : (c.priority === 'Medium' ? '#f97316' : '#22c55e'), cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.85rem', color: c.status === 'Resolved' ? 'var(--success-color)' : 'var(--warning-color)' }}>{c.status}</span>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {c.created_at?.split('T')[0]}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <button onClick={() => deleteComplaint(c.id)} style={{ padding: '0.4rem', background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '1rem' }}>🗑️</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── AI Governance (Retrain Button) ──────────────────────── */}
          <div style={{ padding: '2rem', background: 'linear-gradient(135deg, #1e293b, #334155)', borderRadius: '24px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>AI Governance & Continuous Retraining</h3>
              <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem' }}>Trigger a full model update using all recent human-QA ground truth corrections.</p>
            </div>
            <button 
              onClick={() => {
                if(window.confirm("Retrain AI models with latest QA corrections?")) {
                  fetch('http://localhost:8000/retrain', { method: 'POST', headers: { Authorization: `Bearer ${token}` }})
                  .then(r => r.ok ? alert("Models successfully retrained!") : alert("Retrain failed."));
                }
              }}
              style={{ padding: '1rem 2rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(139,92,246,0.3)', whiteSpace: 'nowrap' }}
            >
              🔄 Trigger Retrain
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
