import React, { useState } from 'react';
import { Participant } from '../types';

interface GroupLobbyScreenProps {
  roomPin: string;
  participants: Participant[];
  isHostRole: boolean;
  showEmptyState: boolean;
  onStartSession: () => void;
  showToast: (msg: string) => void;
}

export function GroupLobbyScreen({
  roomPin,
  participants,
  isHostRole,
  showEmptyState,
  onStartSession,
  showToast,
}: GroupLobbyScreenProps): React.ReactElement {
  const [showLobbyRosterPreview, setShowLobbyRosterPreview] = useState<boolean>(false);

  return (
    <div className="space-y-4">
      <div className="acrylic-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
              Group Room Lobby
            </span>
            <h2 id="room-pin-display" className="text-2xl font-mono font-extrabold text-[#0F172A] tracking-tight">
              {roomPin}
            </h2>
          </div>
          <button
            id="btn-copy-pin"
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText('8821');
              }
              showToast('Room PIN #8821 copied to clipboard!');
            }}
            className="acrylic-pill px-3 py-1.5 rounded-full text-xs font-bold text-blue-600 flex items-center gap-1 shadow-xs active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
            <span>Copy PIN</span>
          </button>
        </div>

        <div className="p-2.5 rounded-xl acrylic-pill flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="font-bold text-[#0F172A]">4 of 5 Members Ready</span>
          </div>
          <span className="font-mono text-[11px] text-[#64748b]">Free Tier: 5 Max</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="font-bold text-[#0F172A]">Connected Participants</span>
          <span className="text-[#64748b]">Real-Time Mesh Synced</span>
        </div>

        {showEmptyState ? (
          <div id="lobby-empty-state" className="acrylic-card p-6 flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-[24px]">sensors</span>
            </div>
            <span className="text-sm font-bold text-[#0F172A]">Waiting for members to join</span>
            <p className="text-xs text-[#64748b] max-w-xs">
              Share PIN <strong>#8821</strong> with tablemates to arm collective focus.
            </p>
          </div>
        ) : (
          participants.map((p) => (
            <div key={p.id} className="acrylic-card p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl acrylic-pill flex items-center justify-center font-extrabold text-sm text-blue-700 shadow-xs">
                  {p.initials}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[#0F172A]">{p.name}</span>
                    {p.role === 'host' && (
                      <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold text-[9px] uppercase">
                        HOST
                      </span>
                    )}
                    {p.isCurrentUser && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white font-bold text-[9px] uppercase">
                        YOU
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#64748b] font-medium">{p.device}</span>
                </div>
              </div>

              <div className="acrylic-pill px-2.5 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    p.status === 'Calibrating'
                      ? 'bg-purple-600 animate-spin'
                      : p.status === 'Grounded' || p.status === 'Ready' || p.status === 'Armed & Ready'
                      ? 'bg-emerald-600'
                      : 'bg-red-500'
                  }`}
                />
                <span
                  className={
                    p.status === 'Calibrating'
                      ? 'text-purple-700'
                      : 'text-emerald-800'
                  }
                >
                  {p.status}
                </span>
              </div>
            </div>
          ))
        )}

        {!showEmptyState && (
          <div className="acrylic-card p-3 flex items-center justify-between border-dashed border-white/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl acrylic-pill flex items-center justify-center text-[#64748b]">
                <span className="material-symbols-outlined text-[20px]">person_add</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#0F172A]">Slot #5 Open</span>
                <span className="text-[11px] text-[#64748b]">Awaiting invitee or guest</span>
              </div>
            </div>
            <button
              onClick={() => showToast('Invite link with PIN #8821 ready to share!')}
              className="acrylic-pill px-3 py-1 rounded-xl text-xs font-bold text-blue-600 shadow-xs"
            >
              Share PIN
            </button>
          </div>
        )}
      </div>

      <div className="acrylic-card p-3.5 space-y-2">
        <button
          id="btn-toggle-roster-preview"
          onClick={() => setShowLobbyRosterPreview(!showLobbyRosterPreview)}
          className="w-full flex items-center justify-between text-xs font-bold text-[#0F172A]"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-[18px]">science</span>
            <span>Roster State Previews (Skeleton & Empty)</span>
          </div>
          <span className="material-symbols-outlined text-[18px]">
            {showLobbyRosterPreview ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {showLobbyRosterPreview && (
          <div id="roster-preview-section" className="pt-2 border-t border-white/60 space-y-2">
            <div className="p-3 rounded-xl acrylic-pill space-y-1.5 animate-pulse">
              <span className="text-[10px] font-bold text-[#64748b] block">Simulated P2P Peer Ingestion:</span>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/60" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-white/60 rounded w-24" />
                  <div className="h-2 bg-white/60 rounded w-36" />
                </div>
                <div className="w-12 h-4 bg-white/60 rounded-full" />
              </div>
            </div>
          </div>
        )}
      </div>

      {isHostRole ? (
        <button
          id="btn-start-group-session"
          onClick={onStartSession}
          className="w-full h-13 rounded-full btn-primary font-bold text-base shadow-lg flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">play_arrow</span>
          <span>Start Group Session (Host)</span>
        </button>
      ) : (
        <div className="acrylic-pill p-3.5 rounded-2xl text-center text-xs font-semibold text-[#475569]">
          ⏳ Waiting for Host (Alex Rivers) to start the group session...
        </div>
      )}
    </div>
  );
}
