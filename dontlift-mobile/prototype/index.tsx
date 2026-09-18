import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

import { ScreenId, Participant, BillParticipantShare } from './types';
import { INITIAL_PARTICIPANTS } from './constants';

import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ControlDeckDrawer } from './components/ControlDeckDrawer';
import { Toast } from './components/Toast';

import { LoginScreen } from './screens/LoginScreen';
import { SoloSelectScreen } from './screens/SoloSelectScreen';
import { SoloTimerScreen } from './screens/SoloTimerScreen';
import { SoloSummaryScreen } from './screens/SoloSummaryScreen';
import { GroupLobbyScreen } from './screens/GroupLobbyScreen';
import { GroupActiveScreen } from './screens/GroupActiveScreen';
import { BillAllocationScreen } from './screens/BillAllocationScreen';
import { VietQRSettlementScreen } from './screens/VietQRSettlementScreen';
import { ActivationScreen } from './screens/ActivationScreen';
import { HardwareDiagnosticsScreen } from './screens/HardwareDiagnosticsScreen';

export default function InteractivePrototype(): React.ReactElement {
  // Global Navigation & Evaluation States
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('02-solo-select');
  const [isHostRole, setIsHostRole] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [showEmptyState, setShowEmptyState] = useState<boolean>(false);
  const [showNavDrawer, setShowNavDrawer] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Solo Focus State
  const [selectedDuration, setSelectedDuration] = useState<number>(25);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(25 * 60 - 42);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const [isPhoneGrounded, setIsPhoneGrounded] = useState<boolean>(true);
  const [isGraceActive, setIsGraceActive] = useState<boolean>(false);
  const [graceSecondsLeft, setGraceSecondsLeft] = useState<number>(3);
  const [soloViolations, setSoloViolations] = useState<number>(0);
  const [soloViolationDuration, setSoloViolationDuration] = useState<number>(0);

  // Group Room State
  const [roomPin] = useState<string>('#8821');
  const [lobbyParticipants] = useState<Participant[]>(INITIAL_PARTICIPANTS);
  const [groupTimerSeconds] = useState<number>(32 * 60 + 45);
  const [groupAlertVisible] = useState<boolean>(true);
  const [groupGraceSeconds] = useState<number>(2);

  // Bill Allocation State
  const [totalBillAmount, setTotalBillAmount] = useState<number>(550000);
  const [hostOverrideMode, setHostOverrideMode] = useState<boolean>(false);
  const [customShares] = useState<Record<string, number>>({});

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Timer Tick
  useEffect(() => {
    if (!isTimerRunning || currentScreen !== '03-solo-timer') return;
    const interval = setInterval(() => {
      setTimerSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, currentScreen]);

  // Grace Countdown Tick
  useEffect(() => {
    let graceTimer: ReturnType<typeof setInterval> | null = null;
    if (isGraceActive && graceSecondsLeft > 0) {
      graceTimer = setInterval(() => {
        setGraceSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsGraceActive(false);
            setSoloViolations((v) => v + 1);
            setSoloViolationDuration((d) => d + 5);
            showToast('⚠️ Grace period elapsed! Violation recorded in SQLite log.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (graceTimer) clearInterval(graceTimer);
    };
  }, [isGraceActive, graceSecondsLeft, showToast]);

  // 40% Base + 60% Penalty Share Breakdown
  const billBreakdown: BillParticipantShare[] = useMemo(() => {
    const participants = lobbyParticipants;
    const n = participants.length || 1;
    const baseSharePool = totalBillAmount * 0.40;
    const penaltySharePool = totalBillAmount * 0.60;
    const basePerMember = Math.round(baseSharePool / n);
    const totalViolations = participants.reduce((sum, p) => sum + (p.lifts || 0), 0);

    return participants.map((p) => {
      if (hostOverrideMode && customShares[p.id] !== undefined) {
        return {
          ...p,
          totalShare: customShares[p.id],
          baseShare: basePerMember,
          penaltyShare: customShares[p.id] - basePerMember,
        };
      }

      let penaltyPart = 0;
      if (totalViolations > 0) {
        penaltyPart = Math.round((p.lifts / totalViolations) * penaltySharePool);
      } else {
        penaltyPart = Math.round(penaltySharePool / n);
      }

      return {
        ...p,
        baseShare: basePerMember,
        penaltyShare: penaltyPart,
        totalShare: basePerMember + penaltyPart,
      };
    });
  }, [lobbyParticipants, totalBillAmount, hostOverrideMode, customShares]);

  // Phone Lift Toggle
  const handleTogglePhoneLift = () => {
    if (isPhoneGrounded) {
      setIsPhoneGrounded(false);
      setIsGraceActive(true);
      setGraceSecondsLeft(3);
      showToast('⚡ Phone lifted! 3-Second Grace Window initiated.');
    } else {
      setIsPhoneGrounded(true);
      if (isGraceActive) {
        setIsGraceActive(false);
        showToast('✅ Re-grounded in time! Zero penalty points logged.');
      } else {
        showToast('📱 Phone re-grounded on flat surface.');
      }
    }
  };

  const handleStartSoloSession = (mins: number) => {
    setSelectedDuration(mins);
    setTimerSecondsLeft(mins * 60);
    setIsTimerRunning(true);
    setIsPhoneGrounded(true);
    setIsGraceActive(false);
    setCurrentScreen('03-solo-timer');
  };

  const handleEndSoloSession = () => {
    setIsTimerRunning(false);
    setCurrentScreen('04-solo-summary');
    showToast('Focus session ended. Persisting SQLite telemetry summary.');
  };

  return (
    <div
      className={`min-h-screen text-[#0F172A] font-sans antialiased relative flex flex-col justify-between selection:bg-blue-500/20 ${
        reducedMotion ? 'reduced-motion' : ''
      }`}
      style={{
        background: 'linear-gradient(145deg, #E0E7FF 0%, #EDE9FE 45%, #D1FAE5 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Background Blooms */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-20 -left-16 w-80 h-80 rounded-full bg-blue-300/35 blur-3xl" />
        <div className="absolute top-1/4 -right-20 w-88 h-88 rounded-full bg-purple-300/35 blur-3xl" />
        <div className="absolute top-2/3 left-10 w-80 h-80 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="absolute bottom-0 inset-x-0 h-72 bg-emerald-200/30 blur-3xl" />
      </div>

      {/* Toast Notification */}
      <Toast message={toastMessage} />

      {/* Top Header */}
      <Header
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        onToggleDrawer={() => setShowNavDrawer((prev) => !prev)}
      />

      {/* Control Deck Testing Drawer */}
      {showNavDrawer && (
        <ControlDeckDrawer
          currentScreen={currentScreen}
          isHostRole={isHostRole}
          reducedMotion={reducedMotion}
          showEmptyState={showEmptyState}
          onNavigate={setCurrentScreen}
          onClose={() => setShowNavDrawer(false)}
          onToggleHostRole={() => setIsHostRole((prev) => !prev)}
          onToggleReducedMotion={() => setReducedMotion((prev) => !prev)}
          onToggleEmptyState={() => setShowEmptyState((prev) => !prev)}
        />
      )}

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 w-full max-w-md mx-auto pt-24 pb-28 px-4">
        {currentScreen === '01-login' && (
          <LoginScreen
            onAuthenticated={() => setCurrentScreen('02-solo-select')}
            showToast={showToast}
          />
        )}

        {currentScreen === '02-solo-select' && (
          <SoloSelectScreen
            selectedDuration={selectedDuration}
            onSelectDuration={setSelectedDuration}
            onStartSession={handleStartSoloSession}
            showToast={showToast}
          />
        )}

        {currentScreen === '03-solo-timer' && (
          <SoloTimerScreen
            selectedDuration={selectedDuration}
            timerSecondsLeft={timerSecondsLeft}
            isPhoneGrounded={isPhoneGrounded}
            isGraceActive={isGraceActive}
            graceSecondsLeft={graceSecondsLeft}
            soloViolations={soloViolations}
            soloViolationDuration={soloViolationDuration}
            onTogglePhoneLift={handleTogglePhoneLift}
            onEndSession={handleEndSoloSession}
          />
        )}

        {currentScreen === '04-solo-summary' && (
          <SoloSummaryScreen
            selectedDuration={selectedDuration}
            streakDays={6}
            onNewFocus={() => setCurrentScreen('02-solo-select')}
            showToast={showToast}
          />
        )}

        {currentScreen === '05-group-lobby' && (
          <GroupLobbyScreen
            roomPin={roomPin}
            participants={lobbyParticipants}
            isHostRole={isHostRole}
            showEmptyState={showEmptyState}
            onStartSession={() => {
              setCurrentScreen('06-group-active');
              showToast('🚀 Group focus session started! All peer sensors active.');
            }}
            showToast={showToast}
          />
        )}

        {currentScreen === '06-group-active' && (
          <GroupActiveScreen
            participants={lobbyParticipants}
            groupTimerSeconds={groupTimerSeconds}
            groupAlertVisible={groupAlertVisible}
            groupGraceSeconds={groupGraceSeconds}
            isHostRole={isHostRole}
            onEndSession={() => {
              setCurrentScreen('07-bill-allocation');
              showToast('Session ended! Proceeding to Host Bill Allocation.');
            }}
            showToast={showToast}
          />
        )}

        {currentScreen === '07-bill-allocation' && (
          <BillAllocationScreen
            totalBillAmount={totalBillAmount}
            billBreakdown={billBreakdown}
            hostOverrideMode={hostOverrideMode}
            onUpdateTotalBill={setTotalBillAmount}
            onToggleHostOverride={() => setHostOverrideMode((prev) => !prev)}
            onPublishBill={() => setCurrentScreen('08-vietqr-settlement')}
            showToast={showToast}
          />
        )}

        {currentScreen === '08-vietqr-settlement' && (
          <VietQRSettlementScreen
            billBreakdown={billBreakdown}
            showToast={showToast}
          />
        )}

        {currentScreen === '09-activation' && (
          <ActivationScreen showToast={showToast} />
        )}

        {currentScreen === '10-hardware-diagnostics' && (
          <HardwareDiagnosticsScreen showToast={showToast} />
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
      />
    </div>
  );
}

export { InteractivePrototype };

declare global {
  interface Window {
    InteractivePrototype?: typeof InteractivePrototype;
  }
}

if (typeof window !== 'undefined') {
  window.InteractivePrototype = InteractivePrototype;
  const mount = () => {
    const rootEl = document.getElementById('root');
    if (rootEl && !rootEl.hasChildNodes()) {
      const root = createRoot(rootEl);
      root.render(React.createElement(InteractivePrototype));
    }
  };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}
