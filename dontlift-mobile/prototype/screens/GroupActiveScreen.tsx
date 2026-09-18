import React from 'react';
import { Participant } from '../types';
import { formatTime } from '../constants';

interface GroupActiveScreenProps {
  participants: Participant[];
  groupTimerSeconds: number;
  groupAlertVisible: boolean;
  groupGraceSeconds: number;
  isHostRole: boolean;
  onEndSession: () => void;
  showToast: (msg: string) => void;
}

export function GroupActiveScreen({
  participants,
  groupTimerSeconds,
  groupAlertVisible,
  groupGraceSeconds,
  isHostRole,
  onEndSession,
  showToast,
}: GroupActiveScreenProps): React.ReactElement {
  return (
    <div className="space-y-4">
      {groupAlertVisible && (
        <div id="group-breach-alert" className="p-3.5 rounded-2xl bg-red-100/90 border border-red-400 text-[#0F172A] shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 animate-bounce">
              <span className="material-symbols-outlined text-[18px]">screen_rotation</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase font-bold text-red-700">Lift Detected</span>
                <span className="text-xs font-bold text-[#0F172A]">Sarah Jenkins</span>
              </div>
              <span className="text-[11px] text-[#475569]">
                <strong className="text-red-700 font-mono">0{groupGraceSeconds}s</strong> in Grace Window
              </span>
            </div>
          </div>

          <button
            id="btn-nudge-member"
            onClick={() => {
              showToast('🔔 Nudge sent to Sarah Jenkins!');
            }}
            className="px-3 py-1.5 rounded-full bg-red-600 text-white font-mono text-xs font-bold shadow-sm active:scale-95 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">notifications_active</span>
            <span>Nudge</span>
          </button>
        </div>
      )}

      <div className="acrylic-card p-5 flex flex-col items-center text-center space-y-3">
        <div className="w-full flex items-center justify-between text-xs">
          <div className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-mono font-bold text-[10px]">
            DO NOT LIFT PHONE
          </div>
          <div className="acrylic-pill px-2.5 py-0.5 rounded-full font-mono text-[11px] text-emerald-800 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>Detection: Active</span>
          </div>
        </div>

        <div className="relative w-52 h-52 flex items-center justify-center my-1">
          <svg className="w-full h-full -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="4" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#2563eb"
              strokeWidth="5"
              strokeDasharray="276.46"
              strokeDashoffset="85"
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span id="group-timer-readout" className="font-mono text-4xl font-extrabold text-[#0F172A] tracking-tight tabular-nums">
              {formatTime(groupTimerSeconds)}
            </span>
            <span className="acrylic-pill px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold text-[#475569] mt-1">
              Target: 45:00
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full pt-1">
          <div className="acrylic-pill p-2.5 rounded-xl text-left">
            <div className="text-[10px] text-[#64748b] font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-emerald-600 text-[14px]">check_circle</span>
              <span>Clean Time</span>
            </div>
            <span className="font-mono text-sm font-bold text-[#0F172A] mt-0.5 block">31m 20s</span>
          </div>
          <div className="acrylic-pill p-2.5 rounded-xl text-left">
            <div className="text-[10px] text-[#64748b] font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-red-600 text-[14px]">warning</span>
              <span>Violations</span>
            </div>
            <span className="font-mono text-sm font-bold text-[#0F172A] mt-0.5 block">3 Breaches</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#0F172A]">
            <span className="material-symbols-outlined text-blue-600 text-[18px]">leaderboard</span>
            <span>Penalty Leaderboard</span>
          </div>
          <span className="text-[11px] text-[#64748b]">Lowest pts ranks highest</span>
        </div>

        {participants
          .slice()
          .sort((a, b) => a.lifts - b.lifts)
          .map((p, idx) => (
            <div
              key={p.id}
              className={`acrylic-card p-3 flex items-center justify-between ${
                p.isCurrentUser ? 'ring-2 ring-blue-500/50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#0F172A]">{p.name}</span>
                    {p.isCurrentUser && (
                      <span className="px-1 py-0.2 rounded bg-blue-600 text-white font-mono text-[9px] font-bold uppercase">
                        YOU
                      </span>
                    )}
                    {p.role === 'host' && (
                      <span className="px-1 py-0.2 rounded bg-slate-200 text-[#0F172A] font-mono text-[9px] font-bold uppercase">
                        HOST
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#64748b]">{p.lifts} lifts logged</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#0F172A]">
                  {p.lifts === 0 ? '0' : p.lifts * 10 + p.violationSeconds}{' '}
                  <span className="text-[10px] text-[#64748b]">pts</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                    p.lifts === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {p.lifts === 0 ? 'CLEAN' : 'PENALTY'}
                </span>
              </div>
            </div>
          ))}
      </div>

      {isHostRole ? (
        <button
          id="btn-end-group-session"
          onClick={onEndSession}
          className="w-full h-12 rounded-full btn-primary font-bold text-sm shadow-md flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">gavel</span>
          <span>End Session & Allocate Bill</span>
        </button>
      ) : (
        <button
          id="btn-early-exit-req"
          onClick={() => {
            showToast('Early exit request submitted to Host.');
          }}
          className="w-full h-12 rounded-full acrylic-button-sec font-bold text-xs text-[#0F172A]"
        >
          Request Early Exit
        </button>
      )}
    </div>
  );
}
