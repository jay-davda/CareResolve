import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // { username, role }
  const [token, setToken] = useState(null);

  // On mount, restore session from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('cr_token');
    const storedUser = localStorage.getItem('cr_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (username, password) => {
    const response = await fetch('http://localhost:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Login failed');
    }

    const data = await response.json();
    const userData = { username, role: data.role };

    // Persist to localStorage so session survives page refresh
    localStorage.setItem('cr_token', data.access_token);
    localStorage.setItem('cr_user', JSON.stringify(userData));

    setToken(data.access_token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('cr_token');
    localStorage.removeItem('cr_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
