import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onLogin }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const userData = await login(username, password);
      if (onLogin) onLogin(userData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="card login-card" style={{ maxWidth: '400px', margin: '4rem auto' }}>
        <div className="header">
          <div className="header-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '1rem', borderRadius: '50%', width: 'fit-content', marginBottom: '1rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1>CareResolve Login</h1>
          <p className="subtitle">Sign in to access your role dashboard.</p>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <div className="input-group">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              required
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              required
            />
          </div>

          {error && (
            <div className="error-message" style={{ color: 'var(--danger-color)', fontSize: '0.85rem', fontWeight: 600 }}>
              <span>⚠ {error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? <><div className="spinner"></div> Signing In...</> : 'Sign In'}
          </button>
        </form>

        <div className="login-hint" style={{ marginTop: '2rem', padding: '1.2rem', background: 'var(--primary-light)', borderRadius: '12px', border: '1px solid var(--primary)', fontSize: '0.85rem' }}>
          <p style={{ fontWeight: 700, marginBottom: '0.8rem', color: '#fff' }}>Quick Demo Login:</p>
          <select 
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                setUsername(val);
                setPassword('pass123');
              } else {
                setUsername('');
                setPassword('');
              }
            }}
            style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.9)', color: 'var(--text-main)', cursor: 'pointer', outline: 'none' }}
          >
            <option value="">Select a Role...</option>
            <option value="support_user">Support Executive</option>
            <option value="qa_user">Quality Assurance</option>
            <option value="manager_user">Operations Manager</option>
          </select>
        </div>
      </div>
    </div>
  );
}
