import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { PinKeypad } from './PinKeypad';

export const CategoryPinModal = () => {
  const { verifyPin } = useAuth();
  const {
    categoryLockTarget,
    setCategoryLockTarget,
    unlockCategoryForSession,
  } = useVideoFeed();

  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!categoryLockTarget) return null;

  const handlePinSubmit = async (pin, clearPin) => {
    setError('');
    setLoading(true);

    try {
      const res = await verifyPin(pin);
      if (res?.valid) {
        unlockCategoryForSession(categoryLockTarget);
        setCategoryLockTarget(null);
        setError('');
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
      <div className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/10 p-6 shadow-2xl">
        <PinKeypad
          title={`Unlock #${categoryLockTarget}`}
          subtitle="This category is protected by a PIN lock"
          onSubmit={handlePinSubmit}
          onCancel={() => setCategoryLockTarget(null)}
          error={error}
          isShaking={isShaking}
          loading={loading}
        />
      </div>
    </div>
  );
};
