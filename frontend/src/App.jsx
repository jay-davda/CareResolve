import React, { useState } from 'react';
import './index.css';

function App() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Error analyzing complaint:', err);
      setError('Unable to connect to the analysis engine. Please ensure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category) => {
    if (!category) return 'cat-default';
    const cat = category.toLowerCase();
    if (cat.includes('product')) return 'cat-product';
    if (cat.includes('packaging')) return 'cat-packaging';
    if (cat.includes('trade')) return 'cat-trade';
    return 'cat-default';
  };

  const getPriorityColor = (priority) => {
    if (!priority) return 'pri-default';
    const pri = priority.toLowerCase();
    if (pri.includes('high')) return 'pri-high';
    if (pri.includes('medium')) return 'pri-medium';
    if (pri.includes('low')) return 'pri-low';
    return 'pri-default';
  };

  return (
    <div className="app-container">
      <div className="card">
        <div className="header">
          <div className="header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              <line x1="9" y1="10" x2="15" y2="10"></line>
              <line x1="12" y1="7" x2="12" y2="13"></line>
            </svg>
          </div>
          <h1>Complaint Intelligence</h1>
          <p className="subtitle">AI-powered categorization and priority scoring for customer feedback.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="form">
          <div className="input-group">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste the customer complaint here..."
              disabled={loading}
              className="textarea"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !text.trim()} 
            className="submit-btn"
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Analyzing Feedback...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12h4l3-9 5 18 3-9h5"/>
                </svg>
                Analyze Complaint
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="error-message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="result-card">
            <div className="result-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Analysis Complete
            </div>
            <div className="result-grid">
              <div className="result-item">
                <span className="item-label">Detected Category</span>
                <span className={`badge ${getCategoryColor(result.category)}`}>
                  {result.category || 'Uncategorized'}
                </span>
              </div>
              <div className="result-item">
                <span className="item-label">Suggested Priority</span>
                <span className={`badge ${getPriorityColor(result.priority)}`}>
                  {result.priority || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
