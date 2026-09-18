import React, { useState } from 'react';

interface ActivationScreenProps {
  showToast: (msg: string) => void;
}

export function ActivationScreen({ showToast }: ActivationScreenProps): React.ReactElement {
  const [licenseKeyInput, setLicenseKeyInput] = useState<string>('DONTLIFT-8924-K92M-991A');
  const [isProActive, setIsProActive] = useState<boolean>(true);

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-1">
        <div className="flex items-center justify-between">
          <span className="acrylic-pill px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-800">
            {isProActive ? '✓ Pro License Active' : 'Free Tier (5 Peer Limit)'}
          </span>
          <span className="font-mono text-xs text-[#64748b]">Ed25519 Verified</span>
        </div>
        <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Unlock DontLift Pro</h2>
        <p className="text-xs text-[#475569] font-medium leading-relaxed">
          Upgrade to unlimited group room participants, permanent offline SQLite telemetry storage, and priority mesh sync.
        </p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <div className="acrylic-pill px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold text-[#0F172A] shrink-0">
          <span className="material-symbols-outlined text-blue-600 text-[15px]">all_inclusive</span>
          <span>Unlimited Peers</span>
        </div>
        <div className="acrylic-pill px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold text-[#0F172A] shrink-0">
          <span className="material-symbols-outlined text-emerald-600 text-[15px]">database</span>
          <span>Offline SQLite</span>
        </div>
        <div className="acrylic-pill px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold text-[#0F172A] shrink-0">
          <span className="material-symbols-outlined text-blue-600 text-[15px]">timer</span>
          <span>Sub-Second Grace</span>
        </div>
      </div>

      <div className="acrylic-card p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wider">
            Enter Activation License Key
          </label>
          <button
            id="btn-paste-license"
            onClick={() => {
              setLicenseKeyInput('DL-PRO-2026-X99');
              showToast('Sample Pro key pasted!');
            }}
            className="acrylic-pill px-2.5 py-0.5 rounded-full text-xs font-bold text-blue-600"
          >
            Paste
          </button>
        </div>

        <div className="acrylic-input flex items-center px-3.5 py-3">
          <span className="material-symbols-outlined text-[#64748b] text-[20px] mr-2">vpn_key</span>
          <input
            id="input-pro-license"
            type="text"
            value={licenseKeyInput}
            onChange={(e) => setLicenseKeyInput(e.target.value.toUpperCase())}
            placeholder="DONTLIFT-XXXX-XXXX-XXXX"
            className="w-full bg-transparent font-mono text-sm font-bold text-[#0F172A] tracking-wider uppercase focus:outline-none"
          />
          <button
            id="btn-clear-license"
            type="button"
            onClick={() => setLicenseKeyInput('')}
            className="w-6 h-6 rounded-full bg-white/60 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        <div className="acrylic-pill p-3 rounded-2xl flex items-start gap-2.5 border border-emerald-400/50">
          <span className="material-symbols-outlined text-emerald-600 text-[20px] mt-0.5">verified</span>
          <div className="flex flex-col text-xs">
            <span className="font-bold text-emerald-800">Valid Cryptographic License</span>
            <span className="text-[#475569] mt-0.5">
              DontLift Lifetime Pro • Signature Verified via Ed25519 Local Hardware Key
            </span>
          </div>
        </div>

        <button
          id="btn-activate-pro"
          onClick={() => {
            setIsProActive(true);
            showToast('🎉 DontLift Pro activated! Unlimited features unlocked.');
          }}
          className="w-full h-12 rounded-full btn-primary font-bold text-sm shadow-md"
        >
          Activate Pro License
        </button>
      </div>
    </div>
  );
}
