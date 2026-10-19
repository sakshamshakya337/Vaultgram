import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { PinKeypad } from './PinKeypad';
import { Shield } from 'lucide-react';
import { api } from '../../services/api';

export const PrivateVaultModal = ({ onSuccess, onCancel }) => {
  const { hasBiometrics, user } = useAuth();
  const {
    isPrivateVaultModalOpen,
    setIsPrivateVaultModalOpen,
    openPrivateVault,
    openPrivateVaultWithBiometrics,
  } = useVideoFeed();

  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricAttempted, setBiometricAttempted] = useState(false);

  const hasUserBiometrics = !!(hasBiometrics || user?.hasBiometrics);

  const handleClose = () => {
    setIsPrivateVaultModalOpen(false);
    setError('');
    if (onCancel) onCancel();
  };

  const handleBiometricAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const opts = await api.auth.biometric.getAuthOptions();
      if (!opts?.options) {
        throw new Error('Could not initialize biometric challenge');
      }
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const assertion = await startAuthentication({ optionsJSON: opts.options });
      const res = await openPrivateVaultWithBiometrics(assertion);
      if (res?.success || res?.vaultToken) {
        setIsPrivateVaultModalOpen(false);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setError(err.message || 'Biometric authentication failed');
      }
    } finally {
      setLoading(false);
      setBiometricAttempted(true);
    }
  };

  // Auto-prompt biometrics once on modal mount if supported
  useEffect(() => {
    if (isPrivateVaultModalOpen && hasUserBiometrics && !biometricAttempted) {
      handleBiometricAuth();
    }
  }, [isPrivateVaultModalOpen, hasUserBiometrics, biometricAttempted]);

  const handlePinSubmit = async (enteredPin, clearPin) => {
    setError('');
    setLoading(true);
    try {
      await openPrivateVault(enteredPin);
      setIsPrivateVaultModalOpen(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'Incorrect PIN');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      if (clearPin) clearPin();
    } finally {
      setLoading(false);
    }
  };

  if (!isPrivateVaultModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/10 p-6 shadow-2xl">
        <div className="flex flex-col items-center mb-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2 shadow-lg shadow-cyan-500/10">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Private Vault</h3>
          <p className="text-xs text-zinc-400">
            {hasUserBiometrics
              ? 'Unlock with Face ID, Fingerprint or PIN'
              : 'Enter your PIN passcode to access your hidden folders'}
          </p>
        </div>

        <PinKeypad
          title=""
          subtitle=""
          onSubmit={handlePinSubmit}
          onCancel={handleClose}
          error={error}
          isShaking={isShaking}
          loading={loading}
          hasBiometrics={hasUserBiometrics}
          onBiometricClick={handleBiometricAuth}
        />
      </div>
    </div>
  );
};
