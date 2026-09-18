import React from 'react';
import { formatTime } from '../constants';

interface SoloTimerScreenProps {
  selectedDuration: number;
  timerSecondsLeft: number;
  isPhoneGrounded: boolean;
  isGraceActive: boolean;
  graceSecondsLeft: number;
  soloViolations: number;
  soloViolationDuration: number;
  onTogglePhoneLift: () => void;
  onEndSession: () => void;
}

export function SoloTimerScreen({
  selectedDuration,
  timerSecondsLeft,
  isPhoneGrounded,
  isGraceActive,
  graceSecondsLeft,
  soloViolations,
  soloViolationDuration,
  onTogglePhoneLift,
  onEndSession,
}: SoloTimerScreenProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="acrylic-card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isPhoneGrounded ? 'bg-blue-600' : 'bg-red-500'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isPhoneGrounded ? 'bg-blue-600' : 'bg-red-500'
              }`}
            />
          </span>
          <div className="flex flex-col">
            <span className="font-bold text-xs text-[#0F172A]">
              {isPhoneGrounded ? 'Phone-Down Detection: Active' : 'Phone Lifted!'}
            </span>
            <span
              className={`font-mono text-[10px] uppercase font-bold ${
                isPhoneGrounded ? 'text-blue-600' : 'text-red-600'
              }`}
            >
              {isPhoneGrounded ? 'Ambient Gyro Locked' : 'Breach in Progress'}
            </span>
          </div>
        </div>
        <div className="acrylic-pill px-2.5 py-1 rounded-full flex items-center gap-1 text-[11px] font-bold text-[#0F172A]">
          <span className="material-symbols-outlined text-blue-600 text-[14px]">screen_rotation</span>
          <span>{isPhoneGrounded ? 'Flat Surface' : 'Off Table'}</span>
        </div>
      </div>

      <div className="acrylic-card p-6 flex flex-col items-center justify-center relative overflow-hidden text-center">
        <div className="acrylic-pill px-3.5 py-1 rounded-full flex items-center gap-1.5 mb-3 text-xs font-bold text-blue-600">
          <span className="material-symbols-outlined text-[16px]">do_not_disturb_on</span>
          <span className="font-mono">DO NOT LIFT PHONE</span>
        </div>

        <div className="relative w-56 h-56 flex items-center justify-center my-2">
          <svg className="w-full h-full -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="rgba(255, 255, 255, 0.6)"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={isGraceActive ? '#ef4444' : '#2563eb'}
              strokeWidth="5"
              strokeDasharray="276.46"
              strokeDashoffset={
                (1 - timerSecondsLeft / (selectedDuration * 60 || 1)) * 276.46
              }
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>

          <div className="absolute flex flex-col items-center justify-center">
            <span id="timer-readout" className="font-mono text-5xl font-extrabold text-[#0F172A] tracking-tight tabular-nums">
              {formatTime(timerSecondsLeft)}
            </span>
            <div className="acrylic-pill px-3 py-0.5 rounded-full mt-2 text-[11px] font-bold text-[#475569]">
              {selectedDuration}:00 SOLO INTERVAL
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-2">
          <div className="w-1 h-3 rounded-full bg-blue-500/50 animate-pulse" />
          <div className="w-1 h-5 rounded-full bg-blue-600" />
          <div className="w-1 h-2 rounded-full bg-blue-500/40" />
          <div className="w-1 h-6 rounded-full bg-blue-600 animate-pulse" />
          <div className="w-1 h-3 rounded-full bg-blue-500/60" />
          <span className="text-xs text-[#64748b] font-medium ml-2">Deep Stillness Mode</span>
        </div>
      </div>

      {isGraceActive && (
        <div id="grace-alert-box" className="acrylic-card p-4 border border-red-400 bg-red-50/60 transition-all duration-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">screen_lock_rotation</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold text-red-800">Lift Detected!</span>
                  <span className="bg-red-200 text-red-800 font-mono text-[10px] px-2 py-0.2 rounded-full font-bold">
                    GRACE ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-[#475569] mt-0.5">
                  Place phone back face-down immediately to prevent penalty.
                </p>
              </div>
            </div>

            <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeDasharray="94.2"
                  strokeDashoffset={(1 - graceSecondsLeft / 3) * 94.2}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <span id="grace-countdown-readout" className="absolute font-mono text-xs font-extrabold text-red-600">
                {graceSecondsLeft}s
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          id="btn-elevator-simulation"
          onClick={onTogglePhoneLift}
          className={`flex-1 py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
            isPhoneGrounded
              ? 'acrylic-button-sec text-blue-700'
              : 'bg-red-600 text-white shadow-red-500/30'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">touch_app</span>
          <span>{isPhoneGrounded ? 'Elevator Simulation (Simulate Lift)' : 'Put Phone Face-Down'}</span>
        </button>

        <button
          id="btn-end-solo-session"
          onClick={onEndSession}
          className="py-2.5 px-4 rounded-2xl acrylic-button-sec font-bold text-xs text-red-700 flex items-center gap-1 shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">stop</span>
          <span>End</span>
        </button>
      </div>

      <div className="acrylic-card p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#0F172A]">
            <span>Violations Logged</span>
            <span className="font-mono text-[#64748b]">({soloViolations})</span>
          </div>
          <div className="acrylic-pill px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-800">
            {soloViolations === 0 ? '✓ Clean Session' : `⚠️ ${soloViolations * 10} Penalty Pts`}
          </div>
        </div>
        <div className="acrylic-pill p-2.5 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-[16px]">health_and_safety</span>
            <span className="text-[11px] text-[#475569]">
              {soloViolations === 0
                ? 'No penalties recorded yet • Streak protected'
                : `${soloViolations} lift breaches recorded (${soloViolationDuration}s total duration)`}
            </span>
          </div>
          <span className="font-mono font-bold text-blue-600 text-xs">
            {soloViolations * 10 + soloViolationDuration} PTS
          </span>
        </div>
      </div>
    </div>
  );
}
