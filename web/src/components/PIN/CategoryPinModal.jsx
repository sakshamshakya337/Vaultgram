import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { PinKeypad } from './PinKeypad';
import { Fingerprint, ScanFace, Shield } from 'lucide-react';

export const CategoryPinModal = () => {
  const { verifyPin, verifyBiometrics, hasBiometrics, user } = useAuth();
  const {
    categoryLockTarget,
    setCategoryLockTarget,
    unlockCategoryForSession,
    unlockReelsForSession,
    fetchVideos,
  } = useVideoFeed();

  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricAttempted, setBiometricAttempted] = useState(false);

  const isReelsLock = categoryLockTarget === 'Reels';
  const hasUserBiometrics = !!(hasBiometrics || user?.hasBiometrics);

  // Success handler for both PIN and Biometrics
  const handleUnlockSuccess = () => {
    if (isReelsLock) {
      unlockReelsForSession();
      fetchVideos('All', true);
    } else {
      unlockCategoryForSession(categoryLockTarget);
    }
    setCategoryLockTarget(null);
    setError('');
  };

  // Trigger biometric WebAuthn verification
  const handleBiometricAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await verifyBiometrics();
      if (res?.valid) {
        handleUnlockSuccess();
      }
    } catch (err) {
      console.log('Biometric prompt closed or cancelled:', err.name || err.message);
      // Graceful fallback to PIN: do not show alarming error on user cancellation
      if (err.name !== 'NotAllowedError' && err.message && !err.message.includes('cancel')) {
        // Only log or show note if it's an actual authentication rejection
      }
    } finally {
      setLoading(false);
    }
  };

  // Automatically trigger biometric unlock on mount if available (native iOS/Android feel)
  useEffect(() => {
    if (categoryLockTarget && hasUserBiometrics && !biometricAttempted) {
      setBiometricAttempted(true);
      // Small timeout to allow modal mount animation
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [categoryLockTarget, hasUserBiometrics, biometricAttempted]);

  if (!categoryLockTarget) return null;

  const handlePinSubmit = async (pin, clearPin) => {
    setError('');
    setLoading(true);

    try {
      const res = await verifyPin(pin);
      if (res?.valid) {
        handleUnlockSuccess();
      } else {
        triggerWrongPin(res?.message || 'Incorrect PIN', clearPin);
      }
    } catch (err) {
      triggerWrongPin(err.message || 'Incorrect PIN. Try again.', clearPin);
    } finally {
      setLoading(false);
    }
  };

  const triggerWrongPin = (msg, clearPin) => {
    setError(msg);
    setIsShaking(true);
    if (clearPin) clearPin();
    setTimeout(() => setIsShaking(false), 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-fade-in select-none">
      <div className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/10 p-6 shadow-2xl relative">
        <PinKeypad
          title={isReelsLock ? 'Unlock Reels Feed' : `Unlock ${categoryLockTarget}`}
          subtitle={
            hasUserBiometrics
              ? 'Use Face ID, Fingerprint or Passcode'
              : isReelsLock
              ? 'Enter passcode to access video reels'
              : 'This folder is protected by a PIN passcode'
          }
          onSubmit={handlePinSubmit}
          onCancel={() => {
            setCategoryLockTarget(null);
            setBiometricAttempted(false);
          }}
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
