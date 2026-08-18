import React, { useState } from 'react';
import { Delete, Lock, Check } from 'lucide-react';

export const PinKeypad = ({
  title = 'Enter PIN',
  subtitle = 'Enter your 4-6 digit passcode',
  onSubmit,
  onCancel,
  error,
  isShaking,
  loading = false,
  rateLimitCountdown = null,
}) => {
  const [pin, setPin] = useState('');

  const handleDigit = (digit) => {
    if (loading || rateLimitCountdown) return;
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length >= 4) {
        // Auto-attempt when reaching 4 or user presses submit
      }
    }
  };

  const handleDelete = () => {
    if (loading || rateLimitCountdown) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleVerify = () => {
    if (pin.length >= 4 && onSubmit) {
      onSubmit(pin, handleClear);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 w-full max-w-xs mx-auto text-center select-none">
      {/* Icon */}
      <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-cyan-500/20 to-rose-500/20 border border-white/10 flex items-center justify-center text-cyan-400 mb-4 shadow-xl">
        <Lock className="w-7 h-7" />
      </div>

      <h2 className="text-xl font-black text-white tracking-tight mb-1">{title}</h2>
      <p className="text-xs text-zinc-400 mb-6">{subtitle}</p>

      {/* PIN Dots Indicator */}
      <div
        className={`flex items-center justify-center gap-3 mb-6 ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const isFilled = index < pin.length;
          return (
            <div
              key={index}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                isFilled
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-500 scale-125 shadow-md shadow-cyan-400/50'
                  : 'bg-zinc-800 border border-white/20'
              }`}
            />
          );
        })}
      </div>

      {/* Error / Rate Limit Message */}
      {error && (
        <div className="text-xs text-rose-400 font-semibold mb-4 animate-fade-in bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20 max-w-xs">
          {error}
        </div>
      )}

      {rateLimitCountdown && (
        <div className="text-xs text-amber-400 font-semibold mb-4 animate-fade-in bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
          Too many attempts. Try again in {rateLimitCountdown}s
        </div>
      )}

      {/* Keypad Grid */}
      <div className="grid grid-cols-3 gap-3.5 w-full my-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(String(num))}
            disabled={loading || !!rateLimitCountdown}
            className="keypad-btn cursor-pointer"
          >
            {num}
          </button>
        ))}

        {/* Bottom Row */}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-16 h-16 rounded-full flex items-center justify-center text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer active:scale-95 transition-transform"
          >
            Cancel
          </button>
        ) : (
          <div className="w-16 h-16" />
        )}

        <button
          type="button"
          onClick={() => handleDigit('0')}
          disabled={loading || !!rateLimitCountdown}
          className="keypad-btn cursor-pointer"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={loading || pin.length === 0}
          className="w-16 h-16 rounded-full bg-zinc-900/60 border border-white/5 hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Delete"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {/* Submit button when 4+ digits */}
      {pin.length >= 4 && (
        <button
          type="button"
          onClick={handleVerify}
          disabled={loading || !!rateLimitCountdown}
          className="mt-4 w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer animate-fade-in"
        >
          {loading ? (
            <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Unlock</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
