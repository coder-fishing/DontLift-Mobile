import React, { useState } from 'react';
import { BillParticipantShare } from '../types';
import { formatVND } from '../constants';

interface BillAllocationScreenProps {
  totalBillAmount: number;
  billBreakdown: BillParticipantShare[];
  hostOverrideMode: boolean;
  onUpdateTotalBill: (amount: number) => void;
  onToggleHostOverride: () => void;
  onPublishBill: () => void;
  showToast: (msg: string) => void;
}

export function BillAllocationScreen({
  totalBillAmount,
  billBreakdown,
  hostOverrideMode,
  onUpdateTotalBill,
  onToggleHostOverride,
  onPublishBill,
  showToast,
}: BillAllocationScreenProps): React.ReactElement {
  const [billInputString, setBillInputString] = useState<string>(formatVND(totalBillAmount));

  const handleBillInputChange = (val: string) => {
    const raw = val.replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10) || 0;
    onUpdateTotalBill(num);
    setBillInputString(raw ? formatVND(num) : '');
  };

  const handleClearBill = () => {
    setBillInputString('');
    onUpdateTotalBill(0);
  };

  return (
    <div className="space-y-4">
      <div className="acrylic-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">Bill Allocation</h2>
          <span className="acrylic-pill px-2.5 py-0.5 rounded-full font-mono text-xs font-bold text-blue-600">
            Room #8821
          </span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <span className="acrylic-pill px-2.5 py-1 rounded-full font-semibold text-[#0F172A]">
            ⏱ 45m Deep Flow
          </span>
          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-bold">
            ⚠️ 3 Total Violations
          </span>
        </div>
      </div>

      <div className="acrylic-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            Enter Total Bill (VND)
          </label>
          <span className="acrylic-pill font-mono text-[11px] text-[#475569] font-bold px-2 py-0.5 rounded-full">
            Vietnamese Đồng
          </span>
        </div>

        <div className="acrylic-input p-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-2xl font-extrabold text-[#64748b]">₫</span>
            <input
              id="input-total-bill"
              type="text"
              value={billInputString}
              onChange={(e) => handleBillInputChange(e.target.value)}
              className="w-full bg-transparent text-2xl font-mono font-extrabold text-[#0F172A] focus:outline-none"
              placeholder="550,000"
            />
          </div>
          <button
            id="btn-clear-bill"
            type="button"
            onClick={handleClearBill}
            className="w-7 h-7 rounded-full bg-white/60 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        <div className="acrylic-pill p-3 rounded-2xl flex items-start gap-2.5 text-xs">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
            <span className="material-symbols-outlined text-[18px]">calculate</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[#0F172A]">How we calculate fair shares:</span>
            <span className="text-[#475569] mt-0.5 leading-snug">
              <strong>40% Flat Base</strong> split equally + <strong>60% Penalty Share</strong> weighted by violation score.
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#0F172A]">
            <span>Member Shares</span>
            <span className="text-[#64748b]">({billBreakdown.length} members)</span>
          </div>
          <button
            id="btn-toggle-override"
            onClick={() => {
              onToggleHostOverride();
              showToast(hostOverrideMode ? 'Auto formula active.' : 'Host override mode enabled.');
            }}
            className="text-xs font-bold text-blue-600"
          >
            {hostOverrideMode ? 'Auto Formula' : 'Host Override'}
          </button>
        </div>

        {billBreakdown.map((m) => (
          <div key={m.id} className="acrylic-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl acrylic-pill flex items-center justify-center font-bold text-xs text-blue-700">
                  {m.initials}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-[#0F172A]">{m.name}</span>
                    {m.role === 'host' && (
                      <span className="px-1 py-0.2 rounded bg-blue-600 text-white font-mono text-[9px] font-bold uppercase">
                        HOST
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#64748b]">
                    {m.lifts === 0 ? '✓ 0 violations (Clean)' : `⚠️ ${m.lifts} violations`}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-base font-extrabold text-[#0F172A]">
                  {formatVND(m.totalShare)} ₫
                </div>
                <span className="text-[10px] text-[#64748b]">Allocated Share</span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-white/60 flex items-center justify-between text-[10px] text-[#64748b] font-mono">
              <span>Base share: {formatVND(m.baseShare)} ₫</span>
              <span>Penalty share: {formatVND(m.penaltyShare)} ₫</span>
            </div>
          </div>
        ))}
      </div>

      <button
        id="btn-publish-bill"
        onClick={() => {
          onPublishBill();
          showToast('Bill published! VietQR settlement active.');
        }}
        className="w-full h-13 rounded-full btn-primary font-bold text-sm shadow-lg flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
        <span>Publish & Settle via VietQR</span>
      </button>
    </div>
  );
}
