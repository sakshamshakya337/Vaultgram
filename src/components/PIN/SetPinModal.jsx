import React, { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { PinKeypad } from './PinKeypad';

export const SetPinModal = () => {
  const { isSetPinModalOpen, setIsSetPinModalOpen, setPin, hasPin } = useAuth();

  const [step, setStep] = useState(1); // 1 = Enter PIN, 2 = Confirm PIN
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isSetPinModalOpen) return null;

  const handleFirstPin = (pin, clearPin) => {
    setFirstPin(pin);
    setError('');
    setStep(2);
    if (clearPin) clearPin();
  };

  const handleConfirmPin = async (confirmPin, clearPin) => {
    if (confirmPin !== firstPin) {
      setError('PINs do not match. Please try again.');
      setIsShaking(true);
      if (clearPin) clearPin();
      setTimeout(() => setIsShaking(false), 500);
      setStep(1);
      setFirstPin('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await setPin(confirmPin);
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to set PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsSetPinModalOpen(false);
    setStep(1);
    setFirstPin('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-fade-in select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/10 p-6 shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {step === 1 ? (
          <PinKeypad
            title={hasPin ? 'Change Passcode' : 'Secure with PIN'}
            subtitle="Enter a 4-6 digit PIN to lock this app and private categories"
            onSubmit={handleFirstPin}
            onCancel={handleClose}
            error={error}
            isShaking={isShaking}
            loading={loading}
          />
        ) : (
          <PinKeypad
            title="Confirm Passcode"
            subtitle="Re-enter your 4-6 digit PIN to verify"
            onSubmit={handleConfirmPin}
            onCancel={() => {
              setStep(1);
              setFirstPin('');
            }}
            error={error}
            isShaking={isShaking}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};
