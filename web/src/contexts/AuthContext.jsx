import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  api,
  getStoredRefreshToken,
  getStoredUser,
  setStoredUser,
  removeStoredUser,
  setAccessToken,
  clearAccessToken,
} from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);
  const [isSetPinModalOpen, setIsSetPinModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const savedRefreshToken = getStoredRefreshToken();
      if (savedRefreshToken) {
        try {
          // Silent refresh on app load
          const refreshRes = await api.auth.refresh();
          if (refreshRes?.accessToken) {
            const meRes = await api.auth.me();
            if (meRes?.user) {
              setUser(meRes.user);
              setStoredUser(meRes.user);
            }
          }
        } catch (err) {
          console.warn('Initial session restore note:', err.message);
          clearAccessToken();
          setUser(null);
          removeStoredUser();
        }
      }
      setLoading(false);
    };

    initAuth();

    // Listen for unauthorized events from API interceptor
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (email, password) => {
    const res = await api.auth.login(email, password);
    setUser(res.user);
    // If newly logged in user has no PIN set, prompt them optionally
    if (res.user && !res.user.hasPin) {
      setTimeout(() => setIsSetPinModalOpen(true), 600);
    }
    return res;
  };

  const register = async (username, email, password) => {
    const res = await api.auth.register(username, email, password);
    setUser(res.user);
    if (res.user && !res.user.hasPin) {
      setTimeout(() => setIsSetPinModalOpen(true), 600);
    }
    return res;
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  const handleSetPin = async (pin) => {
    const res = await api.auth.setPin(pin);
    setUser((prev) => (prev ? { ...prev, hasPin: true } : prev));
    setIsSetPinModalOpen(false);
    return res;
  };

  const handleRemovePin = async (pin) => {
    const res = await api.auth.removePin(pin);
    setUser((prev) => (prev ? { ...prev, hasPin: false, lockedCategories: [] } : prev));
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated: !!user,
        hasPin: !!user?.hasPin,
        loading,
        login,
        register,
        logout,
        setPin: handleSetPin,
        verifyPin: api.auth.verifyPin,
        removePin: handleRemovePin,
        isSetPinModalOpen,
        setIsSetPinModalOpen,
        isSettingsOpen,
        setIsSettingsOpen,
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
