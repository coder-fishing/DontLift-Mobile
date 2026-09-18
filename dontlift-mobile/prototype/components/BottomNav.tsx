import React from 'react';
import { ScreenId } from '../types';

interface BottomNavProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}

export function BottomNav({ currentScreen, onNavigate }: BottomNavProps): React.ReactElement {
  const isSoloActive =
    currentScreen === '02-solo-select' ||
    currentScreen === '03-solo-timer' ||
    currentScreen === '04-solo-summary';

  const isGroupActive =
    currentScreen === '05-group-lobby' ||
    currentScreen === '06-group-active' ||
    currentScreen === '07-bill-allocation' ||
    currentScreen === '08-vietqr-settlement';

  return (
    <nav className="fixed bottom-0 w-full z-40 pb-safe acrylic-chrome-nav select-none">
      <div className="flex justify-around items-center h-16 px-2 max-w-md mx-auto">
        <button
          id="tab-solo-focus"
          onClick={() => onNavigate('02-solo-select')}
          className={`flex flex-col items-center justify-center gap-1 min-w-[56px] transition-colors ${
            isSoloActive ? 'text-blue-600 font-bold' : 'text-[#64748b] hover:text-[#0F172A]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">timer</span>
          <span className="text-[10px]">Solo Focus</span>
        </button>

        <button
          id="tab-group-room"
          onClick={() => onNavigate('05-group-lobby')}
          className={`flex flex-col items-center justify-center gap-1 min-w-[56px] transition-colors ${
            isGroupActive ? 'text-blue-600 font-bold' : 'text-[#64748b] hover:text-[#0F172A]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">groups</span>
          <span className="text-[10px]">Group Room</span>
        </button>

        <button
          id="tab-sensors"
          onClick={() => onNavigate('10-hardware-diagnostics')}
          className={`flex flex-col items-center justify-center gap-1 min-w-[56px] transition-colors ${
            currentScreen === '10-hardware-diagnostics'
              ? 'text-blue-600 font-bold'
              : 'text-[#64748b] hover:text-[#0F172A]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">sensors</span>
          <span className="text-[10px]">Sensors</span>
        </button>

        <button
          id="tab-pro"
          onClick={() => onNavigate('09-activation')}
          className={`flex flex-col items-center justify-center gap-1 min-w-[56px] transition-colors ${
            currentScreen === '09-activation'
              ? 'text-blue-600 font-bold'
              : 'text-[#64748b] hover:text-[#0F172A]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">workspace_premium</span>
          <span className="text-[10px]">Pro</span>
        </button>

        <button
          id="tab-account"
          onClick={() => onNavigate('01-login')}
          className={`flex flex-col items-center justify-center gap-1 min-w-[56px] transition-colors ${
            currentScreen === '01-login'
              ? 'text-blue-600 font-bold'
              : 'text-[#64748b] hover:text-[#0F172A]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">account_circle</span>
          <span className="text-[10px]">Account</span>
        </button>
      </div>
    </nav>
  );
}
