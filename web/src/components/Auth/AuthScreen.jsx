import React, { useState } from 'react';
import { Mail, Lock, User, Sparkles, LogIn, UserPlus, Eye, EyeOff, AlertCircle, ShieldCheck, Cloud, Film } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useTheme } from '../../contexts/useTheme';

export const AuthScreen = () => {
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim() || !password) {
          setError('Please enter both email and password.');
          setLoading(false);
          return;
        }
        await login(email.trim(), password);
      } else {
        if (!username.trim()) {
          setError('Please enter a username.');
          setLoading(false);
          return;
        }
        if (!email.trim() || !password) {
          setError('Please enter email and password.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        await register(username.trim(), email.trim(), password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-black text-slate-900 dark:text-white transition-colors duration-200 overflow-y-auto select-none">
      {/* Ambient background glows */}
      <div className="fixed -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 w-96 h-96 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative w-full max-w-md my-auto rounded-3xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-white/10 shadow-2xl p-6 sm:p-8 backdrop-blur-2xl transition-all">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-rose-500 p-0.5 shadow-xl shadow-cyan-500/20 mb-3.5">
            <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-cyan-500 dark:text-cyan-400 animate-pulse" />
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Stream<span className="text-cyan-500">Vault</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-xs leading-relaxed">
            Personal Encrypted Cloud Storage & TikTok-Style Reels Streamer
          </p>
        </div>

        {/* Mode Selector Tabs (Sign In / Register) */}
        <div className="p-1 rounded-2xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 grid grid-cols-2 gap-1 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-white/10'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-white/10'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs mb-4 animate-fade-in leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. streamer99"
                  required
                  autoFocus={mode === 'register'}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 focus:border-cyan-500 dark:focus:border-cyan-400 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                autoFocus={mode === 'login'}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 focus:border-cyan-500 dark:focus:border-cyan-400 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 focus:border-cyan-500 dark:focus:border-cyan-400 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 p-1 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-rose-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/25 hover:opacity-95 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In to Vault</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Free Account</span>
              </>
            )}
          </button>
        </form>

        {/* Feature Highlights Footer */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-white/10 grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center gap-1">
            <Cloud className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Unlimited Cloud</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">PIN Encrypted</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Film className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Instant Reels</span>
          </div>
        </div>
      </div>
    </div>
  );
};
