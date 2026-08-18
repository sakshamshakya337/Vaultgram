import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useVideoFeed } from '../../contexts/VideoFeedContext';
import { PinKeypad } from './PinKeypad';

export const PinLockOverlay = () => {
  const { user, hasPin, verifyPin } = useAuth();
  const { isAppLocked, setIsAppLocked } = useVideoFeed();

  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(null);

  if (!hasPin || !isAppLocked) return null;

  const handlePinSubmit = async (pin, clearPin) => {
    setError('');
    setLoading(true);

    try {
      const res = await verifyPin(pin);
      if (res?.valid) {
        setIsAppLocked(false);
        setError('');
      } else {
        triggerWrongPin(res?.message || 'Incorrect PIN', clearPin);
      }
    } catch (err) {
      if (err.status === 429) {
        setError('Too many incorrect attempts. Rate limit applied.');
        startCountdown(600); // 10 minutes
      } else {
        triggerWrongPin(err.message || 'Incorrect PIN. Try again.', clearPin);
      }
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

  const startCountdown = (seconds) => {
    setRateLimitCountdown(seconds);
    const interval = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 animate-fade-in select-none">
      <div className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/10 p-6 shadow-2xl">
        <PinKeypad
          title="StreamVault Locked"
          subtitle={`Enter passcode for @${user?.username || 'user'}`}
          onSubmit={handlePinSubmit}
          error={error}
          isShaking={isShaking}
          loading={loading}
          rateLimitCountdown={rateLimitCountdown}
        />
      </div>
    </div>
  );
};
