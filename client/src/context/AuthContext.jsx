import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('brightloop_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const savedToken = localStorage.getItem('brightloop_token');
      const savedUser = localStorage.getItem('brightloop_user');

      if (savedToken && savedUser) {
        try {
          setUser(JSON.parse(savedUser));
          setToken(savedToken);
          // Verify with backend
          const res = await api.getMe();
          if (res.success && res.user) {
            setUser(res.user);
            localStorage.setItem('brightloop_user', JSON.stringify(res.user));
          }
        } catch (err) {
          console.warn('Session expired or invalid, logging out:', err.message);
          logout();
        }
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    if (res.success) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('brightloop_token', res.token);
      localStorage.setItem('brightloop_user', JSON.stringify(res.user));
    }
    return res;
  };

  const register = async (payload) => {
    const res = await api.register(payload);
    if (res.success) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('brightloop_token', res.token);
      localStorage.setItem('brightloop_user', JSON.stringify(res.user));
    }
    return res;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('brightloop_token');
    localStorage.removeItem('brightloop_user');
  };

  const forgotPassword = async (email) => {
    return await api.forgotPassword(email);
  };

  const addStaff = async (payload) => {
    return await api.addStaff(payload);
  };

  // 1-Click Demo Login helper for hackathon evaluation
  const quickLogin = async (roleType) => {
    const credentials = {
      admin: { email: 'admin@brightloop.com', password: 'Admin@Secure2024!' },
      staff: { email: 'jordan.lee@brightloop.com', password: 'Staff@Secure2024!' },
      customer: { email: 'finance@acmeretail.com', password: 'Acme@Customer2024!' }
    };

    const cred = credentials[roleType] || credentials.admin;
    return await login(cred.email, cred.password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
        forgotPassword,
        addStaff,
        quickLogin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
