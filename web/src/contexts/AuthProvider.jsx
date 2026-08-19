import React, { useState, useEffect } from 'react';
import {
  api,
  getAccessToken,
  getStoredRefreshToken,
  getStoredUser,
  setStoredUser,
  removeStoredUser,
  clearAccessToken,
} from '../services/api';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { AuthContext } from './AuthContext.js';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);
  const [isSetPinModalOpen, setIsSetPinModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = getStoredUser();
      const token = getAccessToken();
      const savedRefreshToken = getStoredRefreshToken();

      if (token && savedUser) {
        // Instant restore from storage - no waiting / no flicker!
        setUser(savedUser);
        try {
          const meRes = await api.auth.me();
          if (meRes?.user) {
            setUser(meRes.user);
            setStoredUser(meRes.user);
          }
        } catch (err) {
          if (err.status === 401 && savedRefreshToken) {
            const refreshRes = await api.auth.refresh().catch(() => null);
            if (refreshRes?.accessToken) {
              const meRes = await api.auth.me().catch(() => null);
              if (meRes?.user) {
                setUser(meRes.user);
                setStoredUser(meRes.user);
              }
            }
          }
        }
      } else if (savedRefreshToken) {
        try {
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

  // WebAuthn Biometrics: Register fingerprint / Face ID
  const enableBiometrics = async (deviceLabel = 'My Device') => {
    const options = await api.auth.biometric.getRegisterOptions();
    const regResponse = await startRegistration({ optionsJSON: options });
    const verifyRes = await api.auth.biometric.verifyRegistration(regResponse, deviceLabel);
    if (verifyRes?.verified) {
      setUser((prev) => (prev ? { ...prev, hasBiometrics: true } : prev));
      const meRes = await api.auth.me().catch(() => null);
      if (meRes?.user) setUser(meRes.user);
    }
    return verifyRes;
  };

  // WebAuthn Biometrics: Disable fingerprint / Face ID
  const disableBiometrics = async () => {
    const res = await api.auth.biometric.remove();
    setUser((prev) => (prev ? { ...prev, hasBiometrics: false } : prev));
    return res;
  };

  // WebAuthn Biometrics: Verify assertion
  const verifyBiometrics = async () => {
    const options = await api.auth.biometric.getAuthOptions();
    const authResponse = await startAuthentication({ optionsJSON: options });
    const verifyRes = await api.auth.biometric.verifyAuth(authResponse);
    return verifyRes;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated: !!user,
        hasPin: !!user?.hasPin,
        hasBiometrics: !!user?.hasBiometrics,
        loading,
        login,
        register,
        logout,
        setPin: handleSetPin,
        verifyPin: api.auth.verifyPin,
        removePin: handleRemovePin,
        enableBiometrics,
        disableBiometrics,
        verifyBiometrics,
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
