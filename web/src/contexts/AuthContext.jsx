import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getStoredToken, getStoredUser } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getStoredToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = getStoredToken();
      if (savedToken) {
        try {
          const res = await api.auth.me();
          if (res?.user) {
            setUser(res.user);
          }
        } catch {
          // Token expired or invalid
          api.auth.logout();
          setUser(null);
          setToken('');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.auth.login(email, password);
    setUser(res.user);
    setToken(res.token);
    return res;
  };

  const register = async (username, email, password) => {
    const res = await api.auth.register(username, email, password);
    setUser(res.user);
    setToken(res.token);
    return res;
  };

  const logout = () => {
    api.auth.logout();
    setUser(null);
    setToken('');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
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
