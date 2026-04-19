import React from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute
 * Wraps any page/component and enforces role-based access.
 *
 * Usage:
 *   <ProtectedRoute requiredRoles={["qa"]}>
 *     <QADashboard />
 *   </ProtectedRoute>
 *
 * If the user is not logged in → shows LoginPrompt.
 * If the user's role is not in requiredRoles → shows AccessDenied.
 * Otherwise → renders the children normally.
 */
export default function ProtectedRoute({ requiredRoles, children }) {
  const { user } = useAuth();

  // Not logged in at all
  if (!user) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card">
          <div className="auth-gate-icon">🔒</div>
          <h2>Login Required</h2>
          <p>You must be logged in to access this page.</p>
          <a href="/" className="auth-gate-btn">Go to Login</a>
        </div>
      </div>
    );
  }

  // Logged in but wrong role
  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card auth-gate-denied">
          <div className="auth-gate-icon">⛔</div>
          <h2>Access Denied</h2>
          <p>
            Your role (<strong>{user.role}</strong>) does not have permission to view this page.
          </p>
          <p className="auth-gate-sub">Required: {requiredRoles.join(' or ')}</p>
        </div>
      </div>
    );
  }

  // Authorized — render the protected content
  return children;
}
