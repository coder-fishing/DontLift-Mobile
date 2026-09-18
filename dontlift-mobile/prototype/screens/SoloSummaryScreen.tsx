import React from 'react';

interface SoloSummaryScreenProps {
  selectedDuration: number;
  streakDays: number;
  onNewFocus: () => void;
  showToast: (msg: string) => void;
}

export function SoloSummaryScreen({
  selectedDuration,
  streakDays,
  onNewFocus,
  showToast,
}: SoloSummaryScreenProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="acrylic-card p-5 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-white/80 mx-auto flex items-center justify-center text-emerald-700 shadow-sm">
          <span className="material-symbols-outlined text-[24px]">verified</span>
        </div>
        <h2 className="text-xl font-extrabold text-[#0F172A] tracking-tight">Session Completed!</h2>
        <p className="text-xs text-[#475569] font-medium">
          {selectedDuration}m 00s Focus Interval • Flawless phone discipline maintained
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="acrylic-card p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748b]">Discipline Rate</span>
            <span className="material-symbols-outlined text-blue-600 text-[16px]">workspace_premium</span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-blue-600">100%</div>
          <div className="text-[10px] text-emerald-800 font-bold">Flawless compliance</div>
        </div>

        <div className="acrylic-card p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748b]">Streak Status</span>
            <span className="material-symbols-outlined text-amber-500 text-[16px]">local_fire_department</span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-[#0F172A]">{streakDays} Days</div>
          <div className="text-[10px] text-[#475569] font-semibold">Next badge in 24h</div>
        </div>

        <div className="acrylic-card p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748b]">Violations</span>
            <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-emerald-700">0 Lifts</div>
          <div className="text-[10px] text-emerald-800 font-bold">Clean Run Verified</div>
        </div>

        <div className="acrylic-card p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748b]">Penalty Score</span>
            <span className="material-symbols-outlined text-blue-600 text-[16px]">shield</span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-[#0F172A]">0 pts</div>
          <div className="text-[10px] text-blue-800 font-bold">Full deposit safe</div>
        </div>
      </div>

      <div className="acrylic-card p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-white/60 pb-2">
          <div className="flex items-center gap-1.5 font-bold text-xs text-[#0F172A]">
            <span className="material-symbols-outlined text-[18px]">history_toggle_off</span>
            <span>SQLite Movement Telemetry Log</span>
          </div>
          <span className="acrylic-pill px-2 py-0.5 rounded font-mono text-[10px] font-bold text-[#475569]">
            2 Events Logged
          </span>
        </div>

        <div className="space-y-2">
          <div className="acrylic-pill p-2.5 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[14px]">touch_app</span>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-bold text-[#0F172A]">17:40</span>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">• Permitted</span>
                </div>
                <span className="text-[11px] text-[#475569]">Quick adjustment (Within 3s grace: 1.8s)</span>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-800">0 pts</span>
          </div>

          <div className="acrylic-pill p-2.5 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[14px]">lock</span>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-bold text-[#0F172A]">25:00</span>
                  <span className="text-[10px] font-bold text-blue-800 uppercase">• Completed</span>
                </div>
                <span className="text-[11px] text-[#475569]">Full session grounded on tabletop</span>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-blue-800">Valid</span>
          </div>
        </div>
      </div>

      <div className="acrylic-card p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-white/80 flex items-center justify-center text-emerald-700">
            <span className="material-symbols-outlined text-[20px]">storage</span>
          </div>
          <div>
            <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1">
              <span>Saved to Local SQLite</span>
              <span className="material-symbols-outlined text-emerald-600 text-[14px]">check_circle</span>
            </div>
            <span className="text-[10px] text-[#64748b]">Offline-first reconciliation verified</span>
          </div>
        </div>
        <span className="acrylic-pill px-2.5 py-1 rounded-full font-mono text-[11px] font-bold text-[#0F172A]">
          #S-8829
        </span>
      </div>

      <div className="flex gap-2.5">
        <button
          id="btn-share-card"
          onClick={() => {
            showToast('Discipline summary copied to clipboard!');
          }}
          className="flex-1 py-3 rounded-full acrylic-button-sec text-xs font-bold text-[#0F172A] flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">share</span>
          <span>Share Card</span>
        </button>

        <button
          id="btn-new-focus"
          onClick={onNewFocus}
          className="flex-1 py-3 rounded-full btn-primary text-xs font-bold"
        >
          Done / New Focus
        </button>
      </div>
    </div>
  );
}
