import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { getStoredToken, getStoredUser } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getStoredToken());
  const [loading, setLoading] = useState(true);

  // Validate or fetch current user on initial load
  useEffect(() => {
    async function initAuth() {
      if (token) {
        try {
          const res = await api.auth.me();
          if (res?.user) {
            setUser(res.user);
          }
        } catch (err) {
          console.warn('Session expired or invalid:', err.message);
          api.auth.logout();
          setUser(null);
          setToken('');
        }
      }
      setLoading(false);
    }
    initAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.auth.login(email, password);
    setToken(res.token);
    setUser(res.user);
    return res;
  };

  const register = async (username, email, password) => {
    const res = await api.auth.register(username, email, password);
    setToken(res.token);
    setUser(res.user);
    return res;
  };

  const logout = () => {
    api.auth.logout();
    setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
