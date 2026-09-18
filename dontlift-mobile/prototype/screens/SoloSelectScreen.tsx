import React, { useState } from 'react';
import { FocusModeType } from '../types';

interface SoloSelectScreenProps {
  selectedDuration: number;
  onSelectDuration: (mins: number) => void;
  onStartSession: (mins: number) => void;
  showToast: (msg: string) => void;
}

export function SoloSelectScreen({
  selectedDuration,
  onSelectDuration,
  onStartSession,
  showToast,
}: SoloSelectScreenProps): React.ReactElement {
  const [focusModeType, setFocusModeType] = useState<FocusModeType>('countdown');
  const [customMinutes, setCustomMinutes] = useState<number>(90);
  const [showCustomStepper, setShowCustomStepper] = useState<boolean>(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-[22px]">screen_rotation</span>
          <h2 className="text-xl font-extrabold text-[#0F172A] tracking-tight">Solo Focus Mode</h2>
        </div>
        <p className="text-xs text-[#475569] font-medium leading-relaxed">
          Select your discipline interval before placing your phone face-down on the table.
        </p>
      </div>

      <div className="p-1 rounded-full acrylic-pill flex items-center shadow-xs">
        <button
          id="mode-countdown"
          onClick={() => setFocusModeType('countdown')}
          className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all min-h-[40px] flex items-center justify-center gap-1.5 ${
            focusModeType === 'countdown' ? 'frosted-pill-active text-blue-600 shadow-sm' : 'text-[#475569]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
          <span>Countdown Timer</span>
        </button>
        <button
          id="mode-stopwatch"
          onClick={() => setFocusModeType('stopwatch')}
          className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all min-h-[40px] flex items-center justify-center gap-1.5 ${
            focusModeType === 'stopwatch' ? 'frosted-pill-active text-blue-600 shadow-sm' : 'text-[#475569]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">timer</span>
          <span>Stopwatch Mode</span>
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] uppercase tracking-wider text-[#64748b] font-bold">
            Focus Intervals
          </span>
          <span className="font-mono text-xs text-blue-600 flex items-center gap-1 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            Zero Distraction
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div
            id="card-pomodoro-25"
            onClick={() => {
              onSelectDuration(25);
              setShowCustomStepper(false);
            }}
            className={`p-4 rounded-2xl cursor-pointer transition-all flex flex-col justify-between ${
              selectedDuration === 25 && !showCustomStepper
                ? 'frosted-glass-selected'
                : 'acrylic-card hover:bg-white/45'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="px-2 py-0.5 rounded-full bg-blue-100/80 text-blue-700 text-[10px] font-bold">
                Recommended
              </span>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  selectedDuration === 25 && !showCustomStepper
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-300 text-transparent'
                }`}
              >
                ✓
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl font-extrabold text-blue-600">
                25<span className="text-sm font-sans font-bold text-[#0F172A]">m</span>
              </div>
              <div className="text-xs font-bold text-[#0F172A] mt-0.5">Pomodoro Sprint</div>
              <div className="text-[10px] text-[#64748b]">Standard deep work block</div>
            </div>
          </div>

          <div
            id="card-deepwork-45"
            onClick={() => {
              onSelectDuration(45);
              setShowCustomStepper(false);
            }}
            className={`p-4 rounded-2xl cursor-pointer transition-all flex flex-col justify-between ${
              selectedDuration === 45 && !showCustomStepper
                ? 'frosted-glass-selected'
                : 'acrylic-card hover:bg-white/45'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="px-2 py-0.5 rounded-full bg-purple-100/80 text-purple-700 text-[10px] font-bold">
                Standard
              </span>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  selectedDuration === 45 && !showCustomStepper
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-300 text-transparent'
                }`}
              >
                ✓
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl font-extrabold text-[#0F172A]">
                45<span className="text-sm font-sans font-bold text-[#475569]">m</span>
              </div>
              <div className="text-xs font-bold text-[#0F172A] mt-0.5">Deep Work Flow</div>
              <div className="text-[10px] text-[#64748b]">Cognitive peak without burnout</div>
            </div>
          </div>

          <div
            id="card-immersion-60"
            onClick={() => {
              onSelectDuration(60);
              setShowCustomStepper(false);
            }}
            className={`p-4 rounded-2xl cursor-pointer transition-all flex flex-col justify-between ${
              selectedDuration === 60 && !showCustomStepper
                ? 'frosted-glass-selected'
                : 'acrylic-card hover:bg-white/45'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-700 text-[10px] font-bold">
                Intense
              </span>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  selectedDuration === 60 && !showCustomStepper
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-300 text-transparent'
                }`}
              >
                ✓
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl font-extrabold text-[#0F172A]">
                60<span className="text-sm font-sans font-bold text-[#475569]">m</span>
              </div>
              <div className="text-xs font-bold text-[#0F172A] mt-0.5">Total Immersion</div>
              <div className="text-[10px] text-[#64748b]">Extended focus for complex builds</div>
            </div>
          </div>

          <div
            id="card-custom-stepper"
            onClick={() => {
              setShowCustomStepper(true);
              onSelectDuration(customMinutes);
            }}
            className={`p-4 rounded-2xl cursor-pointer transition-all flex flex-col justify-between ${
              showCustomStepper ? 'frosted-glass-selected' : 'acrylic-card hover:bg-white/45'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="px-2 py-0.5 rounded-full bg-white/70 text-[#475569] text-[10px] font-bold">
                Variable ±5m
              </span>
              <span className="material-symbols-outlined text-[16px] text-blue-600">tune</span>
            </div>
            <div>
              <div className="font-mono text-3xl font-extrabold text-[#0F172A]">
                {customMinutes}
                <span className="text-sm font-sans font-bold text-[#475569]">m</span>
              </div>
              <div className="text-xs font-bold text-[#0F172A] mt-0.5">Custom Stepper</div>
              <div className="text-[10px] text-[#64748b]">Tap to adjust ±5m</div>
            </div>
          </div>
        </div>
      </div>

      {showCustomStepper && (
        <div className="acrylic-card p-3.5 flex items-center justify-between">
          <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider pl-1">
            Adjust Custom Interval
          </span>
          <div className="flex items-center gap-3 acrylic-pill px-3 py-1 rounded-full">
            <button
              id="btn-custom-minus"
              onClick={() => {
                const next = Math.max(5, customMinutes - 5);
                setCustomMinutes(next);
                onSelectDuration(next);
              }}
              className="w-7 h-7 rounded-full bg-white/80 flex items-center justify-center font-bold text-sm shadow-xs active:scale-95"
            >
              -
            </button>
            <span className="font-mono text-sm font-extrabold text-blue-600 min-w-[44px] text-center">
              {customMinutes}m
            </span>
            <button
              id="btn-custom-plus"
              onClick={() => {
                const next = Math.min(180, customMinutes + 5);
                setCustomMinutes(next);
                onSelectDuration(next);
              }}
              className="w-7 h-7 rounded-full bg-white/80 flex items-center justify-center font-bold text-sm shadow-xs active:scale-95"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className="acrylic-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-800">
              <span className="material-symbols-outlined text-[20px]">screen_rotation</span>
            </div>
            <div>
              <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1">
                <span>Phone-Down Detection Ready</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              </div>
              <span className="font-mono text-[10px] text-emerald-800 font-semibold">
                50Hz Gyroscope Active
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100/90 text-emerald-800 font-mono text-[10px] font-bold">
            Arm on Start
          </span>
        </div>

        <div className="p-2.5 rounded-xl acrylic-pill flex items-center gap-2 text-xs text-[#475569]">
          <span className="material-symbols-outlined text-blue-600 text-[18px]">timer</span>
          <span>3.0s grace period is permitted for accidental bumps or adjustments.</span>
        </div>
      </div>

      <button
        id="btn-start-solo-session"
        onClick={() => {
          onStartSession(selectedDuration);
          showToast(`🚀 Solo session armed for ${selectedDuration} minutes!`);
        }}
        className="w-full h-13 rounded-full btn-primary text-base font-bold shadow-lg flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-[20px]">play_arrow</span>
        <span>Start Solo Focus Session</span>
      </button>
    </div>
  );
}
