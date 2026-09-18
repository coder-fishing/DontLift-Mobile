import React, { useState } from 'react';

interface LoginScreenProps {
  onAuthenticated: () => void;
  showToast: (msg: string) => void;
}

export function LoginScreen({ onAuthenticated, showToast }: LoginScreenProps): React.ReactElement {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authIdentifier, setAuthIdentifier] = useState<string>('minh.tran@example.com');
  const [authPin, setAuthPin] = useState<string>('882941');
  const [authName, setAuthName] = useState<string>('Minh Tran');
  const [authConfirmPin, setAuthConfirmPin] = useState<string>('882941');
  const [authShowPin, setAuthShowPin] = useState<boolean>(false);
  const [authRemember, setAuthRemember] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<boolean>(false);

  const handleSubmit = () => {
    if (!authIdentifier || !authPin) {
      setAuthError('Please fill in all required fields.');
      return;
    }
    if (authMode === 'signup' && authPin !== authConfirmPin) {
      setAuthError('PIN / Passwords do not match.');
      return;
    }
    setAuthError(null);
    setAuthSuccess(true);
    showToast('Authenticated! Entering Focus Mode...');
    setTimeout(() => onAuthenticated(), 800);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center text-center pb-2">
        <div className="w-16 h-16 rounded-2xl acrylic-pill flex items-center justify-center mb-3 shadow-md">
          <span className="material-symbols-outlined text-blue-600 text-[32px]">screen_lock_rotation</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Welcome to DontLift</h1>
        <p className="text-xs text-[#475569] max-w-xs mt-1 font-medium">
          Offline-first phone discipline. Put your device down and cultivate deep focus.
        </p>
      </div>

      <div className="p-1 rounded-full acrylic-pill flex items-center shadow-xs">
        <button
          id="btn-auth-signin"
          onClick={() => {
            setAuthMode('signin');
            setAuthError(null);
          }}
          className={`flex-1 py-2 rounded-full text-xs font-bold transition-all min-h-[40px] ${
            authMode === 'signin' ? 'frosted-pill-active text-blue-600 shadow-sm' : 'text-[#475569]'
          }`}
        >
          Sign In
        </button>
        <button
          id="btn-auth-signup"
          onClick={() => {
            setAuthMode('signup');
            setAuthError(null);
          }}
          className={`flex-1 py-2 rounded-full text-xs font-bold transition-all min-h-[40px] ${
            authMode === 'signup' ? 'frosted-pill-active text-blue-600 shadow-sm' : 'text-[#475569]'
          }`}
        >
          Create Account
        </button>
      </div>

      <div className="acrylic-card p-5 space-y-3.5">
        {authError && (
          <div id="auth-error-msg" className="p-3 rounded-xl bg-red-100/90 border border-red-300 text-red-800 text-xs font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{authError}</span>
          </div>
        )}

        {authSuccess && (
          <div id="auth-success-msg" className="p-3 rounded-xl bg-emerald-100/90 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Authenticated! SQLite profile initialized.</span>
          </div>
        )}

        {authMode === 'signup' && (
          <div>
            <label className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wider block mb-1">
              Full Name
            </label>
            <div className="acrylic-input flex items-center px-3.5 py-2.5">
              <span className="material-symbols-outlined text-[#64748b] text-[18px] mr-2">person</span>
              <input
                id="input-auth-name"
                type="text"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="Minh Tran"
                className="w-full bg-transparent text-sm font-semibold text-[#0F172A] focus:outline-none"
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wider block mb-1">
            Phone or Email Address
          </label>
          <div className="acrylic-input flex items-center px-3.5 py-2.5">
            <span className="material-symbols-outlined text-[#64748b] text-[18px] mr-2">mail</span>
            <input
              id="input-auth-id"
              type="text"
              value={authIdentifier}
              onChange={(e) => setAuthIdentifier(e.target.value)}
              placeholder="minh.tran@example.com"
              className="w-full bg-transparent text-sm font-semibold text-[#0F172A] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wider block mb-1">
            6-Digit PIN or Password
          </label>
          <div className="acrylic-input flex items-center px-3.5 py-2.5">
            <span className="material-symbols-outlined text-[#64748b] text-[18px] mr-2">lock</span>
            <input
              id="input-auth-pin"
              type={authShowPin ? 'text' : 'password'}
              value={authPin}
              onChange={(e) => setAuthPin(e.target.value)}
              placeholder="••••••"
              maxLength={16}
              className="w-full bg-transparent text-sm font-mono font-bold text-[#0F172A] focus:outline-none"
            />
            <button
              id="btn-auth-toggle-pin"
              type="button"
              onClick={() => setAuthShowPin(!authShowPin)}
              className="text-[#64748b] hover:text-[#0F172A]"
            >
              <span className="material-symbols-outlined text-[18px]">
                {authShowPin ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {authMode === 'signup' && (
          <div>
            <label className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wider block mb-1">
              Confirm PIN / Password
            </label>
            <div className="acrylic-input flex items-center px-3.5 py-2.5">
              <span className="material-symbols-outlined text-[#64748b] text-[18px] mr-2">verified_user</span>
              <input
                id="input-auth-confirm"
                type={authShowPin ? 'text' : 'password'}
                value={authConfirmPin}
                onChange={(e) => setAuthConfirmPin(e.target.value)}
                placeholder="••••••"
                maxLength={16}
                className="w-full bg-transparent text-sm font-mono font-bold text-[#0F172A] focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#0F172A]">Remember Device</span>
            <span className="text-[11px] text-[#64748b]">Offline-first SQLite local store</span>
          </div>
          <button
            id="btn-toggle-remember"
            type="button"
            onClick={() => setAuthRemember(!authRemember)}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              authRemember ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                authRemember ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <button
          id="btn-auth-submit"
          type="button"
          onClick={handleSubmit}
          className="w-full h-12 rounded-full btn-primary font-bold text-sm mt-2 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">lock_clock</span>
          <span>{authMode === 'signin' ? 'Enter Focus Mode' : 'Create & Arm Device'}</span>
        </button>
      </div>

      <div className="acrylic-card p-3.5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-800 shrink-0">
          <span className="material-symbols-outlined text-[18px]">database</span>
        </div>
        <div className="flex flex-col text-xs">
          <span className="font-bold text-[#0F172A]">Zero Intermediary Server Dependency</span>
          <span className="text-[#475569] mt-0.5 leading-relaxed">
            Credentials and session logs persist securely in local SQLite. Motion detection operates 100% offline.
          </span>
        </div>
      </div>
    </div>
  );
}
