import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SupportDashboard from './pages/SupportDashboard';
import QADashboard from './pages/QADashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };
  
  if (!user) return null;

  return (
    <nav className="app-nav" style={{ padding: '1rem', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>CareResolve</div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Logged in as: <strong>{user.username}</strong> ({user.role})
        </span>
        <button 
          onClick={handleLogout}
          style={{ padding: '0.5rem 1rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

function MainApp() {
  const { user } = useAuth();

  return (
    <Router>
      <Navigation />
      <Routes>
        <Route path="/" element={user ? <Navigate to={`/${user.role}`} replace /> : <LoginPage />} />
        
        <Route 
          path="/support" 
          element={
            <ProtectedRoute requiredRoles={["support"]}>
              <SupportDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/qa" 
          element={
            <ProtectedRoute requiredRoles={["qa"]}>
              <QADashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/manager" 
          element={
            <ProtectedRoute requiredRoles={["manager"]}>
              <ManagerDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
