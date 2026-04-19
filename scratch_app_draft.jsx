import React, { useState } from 'react';
import './index.css';

function App() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('Product');
  const [feedbackPriority, setFeedbackPriority] = useState('High');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setShowFeedback(false);
    setFeedbackSuccess(false);

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

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setFeedbackLoading(true);
    try {
      await fetch('http://localhost:8000/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, category: feedbackCategory, priority: feedbackPriority }),
      });
      await fetch('http://localhost:8000/retrain', { method: 'POST' });
      setFeedbackSuccess(true);
      setTimeout(() => {
        setShowFeedback(false);
        setFeedbackSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Feedback error:', err);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const getCategoryColor = (category) => {
// ...
