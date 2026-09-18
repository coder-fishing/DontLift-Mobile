import React, { useState } from 'react';
import { BillParticipantShare } from '../types';
import { formatVND } from '../constants';

interface VietQRSettlementScreenProps {
  billBreakdown: BillParticipantShare[];
  showToast: (msg: string) => void;
}

export function VietQRSettlementScreen({
  billBreakdown,
  showToast,
}: VietQRSettlementScreenProps): React.ReactElement {
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState<boolean>(false);
  const currentMemberShare = billBreakdown.find((p) => p.isCurrentUser)?.totalShare || 55000;

  return (
    <div className="space-y-4">
      <div className="acrylic-card p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
              Your Assigned Share
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span id="member-assigned-share" className="font-mono text-3xl font-extrabold text-[#0F172A]">
                {formatVND(currentMemberShare)}
              </span>
              <span className="text-sm font-bold text-blue-600">VND</span>
            </div>
          </div>

          <button
            id="btn-toggle-payment-status"
            onClick={() => {
              setIsPaymentConfirmed(!isPaymentConfirmed);
              showToast(isPaymentConfirmed ? 'Status: Unpaid' : 'Settlement marked as confirmed!');
            }}
            className={`px-3 py-1 rounded-full font-mono text-[11px] font-bold transition-all ${
              isPaymentConfirmed
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'acrylic-pill text-[#0F172A]'
            }`}
          >
            {isPaymentConfirmed ? '✓ Settled' : 'Unpaid'}
          </button>
        </div>

        <div className="acrylic-pill p-3 rounded-xl space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#475569] flex items-center gap-1">
              <span className="material-symbols-outlined text-blue-600 text-[14px]">pie_chart</span>
              <span>Base Share (40%)</span>
            </span>
            <span className="font-mono font-bold text-[#0F172A]">55,000 VND</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#475569] flex items-center gap-1">
              <span className="material-symbols-outlined text-emerald-600 text-[14px]">verified</span>
              <span>Penalty Share (Clean Run)</span>
            </span>
            <span className="font-mono font-bold text-emerald-800">0 VND</span>
          </div>
        </div>
      </div>

      <div className="acrylic-card p-5 flex flex-col items-center text-center space-y-3">
        <div className="w-full flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
            </div>
            <div className="text-left">
              <span className="font-bold text-[#0F172A] block leading-tight">VietQR P2P Direct</span>
              <span className="text-[10px] text-[#64748b]">NAPAS 24/7 Fast Transfer</span>
            </div>
          </div>
          <span className="acrylic-pill px-2 py-0.5 rounded text-[10px] font-bold text-emerald-800 uppercase">
            No Fee
          </span>
        </div>

        <div className="relative w-52 h-52 p-3 rounded-2xl acrylic-pill flex items-center justify-center shadow-inner">
          <div className="absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 border-blue-600 rounded-tl-sm pointer-events-none" />
          <div className="absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 border-blue-600 rounded-tr-sm pointer-events-none" />
          <div className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 border-blue-600 rounded-bl-sm pointer-events-none" />
          <div className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-blue-600 rounded-br-sm pointer-events-none" />

          <svg className="w-44 h-44 text-[#0F172A]" fill="currentColor" viewBox="0 0 100 100">
            <rect x="10" y="10" width="24" height="24" rx="3" fill="currentColor" />
            <rect x="14" y="14" width="16" height="16" rx="2" fill="#ffffff" />
            <rect x="18" y="18" width="8" height="8" rx="1" fill="currentColor" />

            <rect x="66" y="10" width="24" height="24" rx="3" fill="currentColor" />
            <rect x="70" y="14" width="16" height="16" rx="2" fill="#ffffff" />
            <rect x="74" y="18" width="8" height="8" rx="1" fill="currentColor" />

            <rect x="10" y="66" width="24" height="24" rx="3" fill="currentColor" />
            <rect x="14" y="70" width="16" height="16" rx="2" fill="#ffffff" />
            <rect x="18" y="74" width="8" height="8" rx="1" fill="currentColor" />

            <rect x="40" y="14" width="6" height="6" rx="1" />
            <rect x="52" y="14" width="6" height="6" rx="1" />
            <rect x="40" y="26" width="6" height="6" rx="1" />
            <rect x="48" y="36" width="6" height="6" rx="1" />
            <rect x="20" y="44" width="6" height="6" rx="1" />
            <rect x="32" y="48" width="6" height="6" rx="1" />
            <rect x="66" y="44" width="6" height="6" rx="1" />
            <rect x="76" y="48" width="6" height="6" rx="1" />
            <rect x="44" y="56" width="12" height="6" rx="1" />
            <rect x="64" y="66" width="6" height="6" rx="1" />
            <rect x="76" y="66" width="6" height="6" rx="1" />
            <rect x="68" y="76" width="14" height="6" rx="1" />
          </svg>
        </div>

        <div className="w-full space-y-2 pt-1 text-xs">
          <div className="acrylic-pill p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-[#64748b]">Recipient / Host</span>
              <span className="font-bold text-[#0F172A]">Techcombank • ALEX RIVERS</span>
              <span className="font-mono text-[11px] text-[#0F172A]">1903 8821 0092 11</span>
            </div>
            <button
              id="btn-copy-account"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText('19038821009211');
                }
                showToast('Account number copied!');
              }}
              className="acrylic-pill px-2.5 py-1 rounded text-[11px] font-bold text-blue-600 shadow-xs"
            >
              Copy
            </button>
          </div>

          <div className="acrylic-pill p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-[#64748b]">Transfer Memo</span>
              <span className="font-mono font-bold text-blue-700">DL8821 MINH TRAN</span>
            </div>
            <button
              id="btn-copy-memo"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText('DL8821 MINH TRAN');
                }
                showToast('Transfer memo copied!');
              }}
              className="acrylic-pill px-2.5 py-1 rounded text-[11px] font-bold text-blue-600 shadow-xs"
            >
              Copy Memo
            </button>
          </div>
        </div>
      </div>

      <button
        id="btn-confirm-payment"
        onClick={() => {
          setIsPaymentConfirmed(true);
          showToast('✅ Payment confirmed! Telemetry reconciled.');
        }}
        className="w-full h-13 rounded-full btn-primary font-bold text-sm shadow-lg flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">check_circle</span>
        <span>{isPaymentConfirmed ? 'Payment Confirmed & Settled' : 'Confirm VietQR Payment'}</span>
      </button>
    </div>
  );
}
