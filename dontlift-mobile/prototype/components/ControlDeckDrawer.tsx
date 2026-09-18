import React from 'react';
import { ScreenId } from '../types';

interface ControlDeckDrawerProps {
  currentScreen: ScreenId;
  isHostRole: boolean;
  reducedMotion: boolean;
  showEmptyState: boolean;
  onNavigate: (screen: ScreenId) => void;
  onClose: () => void;
  onToggleHostRole: () => void;
  onToggleReducedMotion: () => void;
  onToggleEmptyState: () => void;
}

export function ControlDeckDrawer({
  currentScreen,
  isHostRole,
  reducedMotion,
  showEmptyState,
  onNavigate,
  onClose,
  onToggleHostRole,
  onToggleReducedMotion,
  onToggleEmptyState,
}: ControlDeckDrawerProps): React.ReactElement {
  const screens: Array<{ id: ScreenId; label: string }> = [
    { id: '01-login', label: '01. Log In / Sign Up' },
    { id: '02-solo-select', label: '02. Solo Time Selection' },
    { id: '03-solo-timer', label: '03. Solo Timer & Grace' },
    { id: '04-solo-summary', label: '04. Solo Summary Log' },
    { id: '05-group-lobby', label: '05. Group Room Lobby' },
    { id: '06-group-active', label: '06. Active Group Session' },
    { id: '07-bill-allocation', label: '07. Host Bill Allocation' },
    { id: '08-vietqr-settlement', label: '08. VietQR Settlement' },
    { id: '09-activation', label: '09. Pro License Key' },
    { id: '10-hardware-diagnostics', label: '10. Hardware Diagnostics' },
  ];

  return (
    <div id="drawer-testing-deck" className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30 backdrop-blur-xs">
      <div className="acrylic-card m-3 p-5 rounded-3xl max-h-[85vh] overflow-y-auto space-y-4 border border-white shadow-2xl">
        <div className="flex items-center justify-between pb-2 border-b border-white/60">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-[22px]">tune</span>
            <span className="font-bold text-base text-[#0F172A]">Prototype Control Deck</span>
          </div>
          <button
            id="btn-close-drawer"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
            Jump to Screen (1–10)
          </span>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {screens.map((s) => (
              <button
                key={s.id}
                id={`nav-${s.id}`}
                onClick={() => {
                  onNavigate(s.id);
                  onClose();
                }}
                className={`p-2.5 rounded-xl text-left text-xs font-bold transition-all ${
                  currentScreen === s.id ? 'bg-blue-600 text-white' : 'acrylic-pill text-[#0F172A]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-white/60 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
            Evaluation & Accessibility Toggles
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              id="toggle-host-role"
              onClick={onToggleHostRole}
              className={`px-3 py-1.5 rounded-full text-xs font-bold acrylic-pill flex items-center gap-1.5 ${
                isHostRole ? 'border-blue-500 text-blue-700 bg-blue-50' : 'text-[#64748b]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isHostRole ? 'admin_panel_settings' : 'person'}
              </span>
              Role: {isHostRole ? 'Host View' : 'Member View'}
            </button>

            <button
              id="toggle-reduced-motion"
              onClick={onToggleReducedMotion}
              className={`px-3 py-1.5 rounded-full text-xs font-bold acrylic-pill flex items-center gap-1.5 ${
                reducedMotion ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'text-[#64748b]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">motion_photos_off</span>
              Reduced Motion: {reducedMotion ? 'ON' : 'OFF'}
            </button>

            <button
              id="toggle-empty-state"
              onClick={onToggleEmptyState}
              className={`px-3 py-1.5 rounded-full text-xs font-bold acrylic-pill flex items-center gap-1.5 ${
                showEmptyState ? 'border-amber-500 text-amber-700 bg-amber-50' : 'text-[#64748b]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">layers_clear</span>
              Empty State: {showEmptyState ? 'Simulated' : 'Normal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
