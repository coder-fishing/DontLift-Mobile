import React from 'react';
import { ScreenId } from '../types';
import { SCREEN_TITLES } from '../constants';

interface HeaderProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  onToggleDrawer: () => void;
}

export function Header({ currentScreen, onNavigate, onToggleDrawer }: HeaderProps): React.ReactElement {
  return (
    <header className="fixed top-0 w-full z-40 pt-safe acrylic-chrome-header select-none">
      <div className="h-6 w-full px-6 flex items-center justify-between text-[#0F172A] pt-1">
        <span className="text-xs font-bold tracking-tight">9:41</span>
        <div className="flex items-center gap-1.5 text-[#0F172A]">
          <span className="material-symbols-outlined text-[16px]">signal_cellular_alt</span>
          <span className="material-symbols-outlined text-[16px]">wifi</span>
          <span className="material-symbols-outlined text-[18px]">battery_full</span>
        </div>
      </div>

      <div className="h-14 px-4 flex items-center justify-between">
        <div
          id="brand-header"
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onNavigate('02-solo-select')}
        >
          <div className="w-8 h-8 rounded-xl acrylic-pill flex items-center justify-center font-bold text-blue-600 text-sm shadow-xs">
            DL
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-[#0F172A] leading-none">
              DontLift
            </span>
            <span className="text-[11px] text-[#475569] font-semibold mt-0.5">
              {SCREEN_TITLES[currentScreen]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full acrylic-pill">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="font-mono text-[11px] text-emerald-800 font-bold">SQLite Synced</span>
          </div>

          <button
            id="btn-control-deck"
            onClick={onToggleDrawer}
            className="w-9 h-9 rounded-full acrylic-pill flex items-center justify-center text-[#0F172A] active:scale-95 transition-all shadow-xs"
            title="Open Prototype Navigation & Testing Tools"
          >
            <span className="material-symbols-outlined text-[20px]">menu_open</span>
          </button>
        </div>
      </div>
    </header>
  );
}
