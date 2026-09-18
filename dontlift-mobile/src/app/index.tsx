import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenId, Participant, BillParticipantShare } from '../types';
import { INITIAL_PARTICIPANTS } from '../constants';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { ControlDeckDrawer } from '../components/ControlDeckDrawer';

// 10 Core Screens
import { LoginScreen } from '../screens/LoginScreen';
import { SoloSelectScreen } from '../screens/SoloSelectScreen';
import { SoloTimerScreen } from '../screens/SoloTimerScreen';
import { SoloSummaryScreen } from '../screens/SoloSummaryScreen';
import { GroupLobbyScreen } from '../screens/GroupLobbyScreen';
import { GroupActiveScreen } from '../screens/GroupActiveScreen';
import { BillAllocationScreen } from '../screens/BillAllocationScreen';
import { VietQRSettlementScreen } from '../screens/VietQRSettlementScreen';
import { ActivationScreen } from '../screens/ActivationScreen';
import { HardwareDiagnosticsScreen } from '../screens/HardwareDiagnosticsScreen';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  // Navigation & Drawer
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('02-solo-select');
  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);
  const [isHostRole, setIsHostRole] = useState<boolean>(true);
  const [showEmptyState, setShowEmptyState] = useState<boolean>(false);

  // Solo State
  const [selectedDuration, setSelectedDuration] = useState<number>(25);
  const [soloSecondsLeft, setSoloSecondsLeft] = useState<number>(25 * 60);
  const [isSoloRunning, setIsSoloRunning] = useState<boolean>(false);
  const [isPhoneGrounded, setIsPhoneGrounded] = useState<boolean>(true);
  const [isGraceActive, setIsGraceActive] = useState<boolean>(false);
  const [graceSeconds, setGraceSeconds] = useState<number>(3);
  const [violationsCount, setViolationsCount] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(6);

  // Group State
  const [participants, setParticipants] = useState<Participant[]>(INITIAL_PARTICIPANTS);
  const [groupTimerSeconds, setGroupTimerSeconds] = useState<number>(13 * 60 + 40); // 13:40
  const [groupAlertVisible, setGroupAlertVisible] = useState<boolean>(true);
  const [groupGraceSeconds, setGroupGraceSeconds] = useState<number>(2);

  // Bill State
  const [totalBillAmount, setTotalBillAmount] = useState<number>(550000);
  const [hostOverrideMode, setHostOverrideMode] = useState<boolean>(false);

  // Solo Timer effect
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isSoloRunning && soloSecondsLeft > 0) {
      timer = setInterval(() => {
        setSoloSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsSoloRunning(false);
            setCurrentScreen('04-solo-summary');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSoloRunning, soloSecondsLeft]);

  // Grace timer effect
  useEffect(() => {
    let graceTimer: ReturnType<typeof setInterval> | null = null;
    if (isGraceActive && graceSeconds > 0) {
      graceTimer = setInterval(() => {
        setGraceSeconds((prev) => {
          if (prev <= 1) {
            setIsGraceActive(false);
            setViolationsCount((v) => v + 1);
            Alert.alert('⚠️ Violation Recorded', 'Grace window elapsed. +10 penalty points logged.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (graceTimer) clearInterval(graceTimer);
    };
  }, [isGraceActive, graceSeconds]);

  // 40/60 Bill Split calculation
  const billBreakdown: BillParticipantShare[] = useMemo(() => {
    const N = participants.length || 1;
    const baseSharePool = totalBillAmount * 0.4;
    const penaltySharePool = totalBillAmount * 0.6;
    const basePerPerson = Math.round(baseSharePool / N);
    const totalViolations = participants.reduce((sum, p) => sum + p.lifts, 0);

    return participants.map((p) => {
      let penaltyShare = 0;
      if (totalViolations > 0) {
        penaltyShare = Math.round((p.lifts / totalViolations) * penaltySharePool);
      }
      return {
        ...p,
        baseShare: basePerPerson,
        penaltyShare,
        totalShare: basePerPerson + penaltyShare,
      };
    });
  }, [participants, totalBillAmount]);

  // Solo handlers
  const handleStartSolo = (mins: number) => {
    setSelectedDuration(mins);
    setSoloSecondsLeft(mins * 60);
    setIsSoloRunning(true);
    setIsPhoneGrounded(true);
    setIsGraceActive(false);
    setViolationsCount(0);
    setCurrentScreen('03-solo-timer');
  };

  const handleTogglePhoneLift = () => {
    if (isPhoneGrounded) {
      setIsPhoneGrounded(false);
      setIsGraceActive(true);
      setGraceSeconds(3);
    } else {
      setIsPhoneGrounded(true);
      if (isGraceActive) {
        setIsGraceActive(false);
        Alert.alert('✅ Re-grounded', 'Phone placed back face-down in time. 0 penalty points.');
      }
    }
  };

  const handleEndSoloSession = () => {
    setIsSoloRunning(false);
    setIsPhoneGrounded(true);
    setIsGraceActive(false);
    setCurrentScreen('04-solo-summary');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#EEF2FF" />

      {/* Header */}
      <Header
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        onOpenDrawer={() => setDrawerVisible(true)}
      />

      {/* Main Body */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {currentScreen === '01-login' && (
          <LoginScreen onAuthenticated={() => setCurrentScreen('02-solo-select')} />
        )}

        {currentScreen === '02-solo-select' && (
          <SoloSelectScreen
            selectedDuration={selectedDuration}
            onSelectDuration={setSelectedDuration}
            onStartSession={handleStartSolo}
          />
        )}

        {currentScreen === '03-solo-timer' && (
          <SoloTimerScreen
            selectedDuration={selectedDuration}
            secondsLeft={soloSecondsLeft}
            isPhoneGrounded={isPhoneGrounded}
            isGraceActive={isGraceActive}
            graceSeconds={graceSeconds}
            violationsCount={violationsCount}
            onTogglePhoneLift={handleTogglePhoneLift}
            onEndSession={handleEndSoloSession}
          />
        )}

        {currentScreen === '04-solo-summary' && (
          <SoloSummaryScreen
            selectedDuration={selectedDuration}
            streakDays={streakDays}
            onNewFocus={() => setCurrentScreen('02-solo-select')}
          />
        )}

        {currentScreen === '05-group-lobby' && (
          <GroupLobbyScreen
            roomPin="#8821"
            participants={participants}
            isHostRole={isHostRole}
            showEmptyState={showEmptyState}
            onStartSession={() => setCurrentScreen('06-group-active')}
          />
        )}

        {currentScreen === '06-group-active' && (
          <GroupActiveScreen
            participants={participants}
            groupTimerSeconds={groupTimerSeconds}
            groupAlertVisible={groupAlertVisible}
            groupGraceSeconds={groupGraceSeconds}
            isHostRole={isHostRole}
            onEndSession={() => setCurrentScreen('07-bill-allocation')}
          />
        )}

        {currentScreen === '07-bill-allocation' && (
          <BillAllocationScreen
            totalBillAmount={totalBillAmount}
            billBreakdown={billBreakdown}
            hostOverrideMode={hostOverrideMode}
            onUpdateTotalBill={setTotalBillAmount}
            onToggleHostOverride={() => setHostOverrideMode(!hostOverrideMode)}
            onPublishBill={() => setCurrentScreen('08-vietqr-settlement')}
          />
        )}

        {currentScreen === '08-vietqr-settlement' && (
          <VietQRSettlementScreen billBreakdown={billBreakdown} />
        )}

        {currentScreen === '09-activation' && <ActivationScreen />}

        {currentScreen === '10-hardware-diagnostics' && <HardwareDiagnosticsScreen />}
      </ScrollView>

      {/* 5-Tab Bottom Navigation Bar */}
      <BottomNav
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
      />

      {/* Prototype Control Deck Modal */}
      <ControlDeckDrawer
        visible={drawerVisible}
        currentScreen={currentScreen}
        isHostRole={isHostRole}
        showEmptyState={showEmptyState}
        onClose={() => setDrawerVisible(false)}
        onNavigate={(screen) => setCurrentScreen(screen)}
        onToggleHostRole={() => setIsHostRole(!isHostRole)}
        onToggleEmptyState={() => setShowEmptyState(!showEmptyState)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2FF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
});
