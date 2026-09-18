import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { GlassPill } from '../components/GlassPill';
import { PrimaryButton } from '../components/PrimaryButton';
import { Participant } from '../types';

interface GroupLobbyScreenProps {
  roomPin: string;
  participants: Participant[];
  isHostRole: boolean;
  showEmptyState: boolean;
  onStartSession: () => void;
}

export function GroupLobbyScreen({
  roomPin,
  participants,
  isHostRole,
  showEmptyState,
  onStartSession,
}: GroupLobbyScreenProps) {
  const [showRosterPreview, setShowRosterPreview] = useState<boolean>(false);

  return (
    <View style={styles.container}>
      {/* Room PIN Header */}
      <GlassCard style={styles.pinCard}>
        <View style={styles.pinRow}>
          <View>
            <Text style={styles.pinLabel}>GROUP ROOM LOBBY</Text>
            <Text style={styles.pinCode}>{roomPin}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Alert.alert('Copied', 'PIN #8821 copied to clipboard!')}
            style={styles.copyBtn}
          >
            <Text style={styles.copyBtnText}>📋 Copy PIN</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.membersReadyBar}>
          <View style={styles.greenPulse} />
          <Text style={styles.readyBarText}>4 of 5 Members Ready (Free Tier: 5 Max)</Text>
        </View>
      </GlassCard>

      {/* Participants List */}
      <View style={styles.rosterSection}>
        <Text style={styles.rosterHeader}>Connected Mesh Participants</Text>

        {showEmptyState ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📡</Text>
            <Text style={styles.emptyTitle}>Waiting for members to join</Text>
            <Text style={styles.emptySub}>Share PIN #8821 to arm collective focus.</Text>
          </GlassCard>
        ) : (
          participants.map((p) => (
            <GlassCard key={p.id} style={styles.participantRow}>
              <View style={styles.avatarBox}>
                <Text style={styles.avatarText}>{p.initials}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.pName}>{p.name}</Text>
                  {p.role === 'host' && (
                    <View style={styles.hostBadge}>
                      <Text style={styles.hostBadgeText}>HOST</Text>
                    </View>
                  )}
                  {p.isCurrentUser && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>YOU</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.pDevice}>{p.device}</Text>
              </View>

              <GlassPill style={styles.statusPill}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        p.status === 'Calibrating'
                          ? '#9333EA'
                          : p.status === 'Grounded' || p.status === 'Ready' || p.status === 'Armed & Ready'
                          ? '#10B981'
                          : '#EF4444',
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: p.status === 'Calibrating' ? '#9333EA' : '#065F46' },
                  ]}
                >
                  {p.status}
                </Text>
              </GlassPill>
            </GlassCard>
          ))
        )}

        {!showEmptyState && (
          <GlassCard style={styles.openSlotCard}>
            <View style={styles.openSlotIcon}>
              <Text style={{ fontSize: 16 }}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.openSlotTitle}>Slot #5 Open</Text>
              <Text style={styles.openSlotSub}>Awaiting invitee or guest</Text>
            </View>
            <TouchableOpacity
              onPress={() => Alert.alert('Share', 'Invite link ready!')}
              style={styles.shareBtn}
            >
              <Text style={styles.shareBtnText}>Invite</Text>
            </TouchableOpacity>
          </GlassCard>
        )}
      </View>

      {/* Roster Previews Accordion */}
      <GlassCard style={styles.previewAccordion}>
        <TouchableOpacity
          onPress={() => setShowRosterPreview(!showRosterPreview)}
          style={styles.accordionHeader}
        >
          <Text style={styles.accordionTitle}>🧪 Roster State Previews (Skeleton)</Text>
          <Text style={styles.accordionArrow}>{showRosterPreview ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showRosterPreview && (
          <View style={styles.skeletonBox}>
            <Text style={styles.skeletonNote}>Simulated P2P Peer Ingestion:</Text>
            <View style={styles.skeletonRow}>
              <View style={styles.skeletonAvatar} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={[styles.skeletonBar, { width: 80 }]} />
                <View style={[styles.skeletonBar, { width: 140 }]} />
              </View>
            </View>
          </View>
        )}
      </GlassCard>

      {/* Start Button or Waiting note */}
      {isHostRole ? (
        <PrimaryButton
          title="Start Group Session (Host)"
          onPress={onStartSession}
        />
      ) : (
        <GlassPill style={styles.waitingPill}>
          <Text style={styles.waitingText}>
            ⏳ Waiting for Host (Alex Rivers) to start the group session...
          </Text>
        </GlassPill>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  pinCard: {
    padding: 16,
    gap: 12,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  pinCode: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  copyBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  membersReadyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    padding: 10,
    borderRadius: 12,
  },
  greenPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  readyBarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  rosterSection: {
    gap: 8,
  },
  rosterHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  emptyEmoji: {
    fontSize: 24,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 11,
    color: '#64748B',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2563EB',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  hostBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  hostBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  youBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pDevice: {
    fontSize: 10,
    color: '#64748B',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  openSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderStyle: 'dashed',
    gap: 10,
  },
  openSlotIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openSlotTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  openSlotSub: {
    fontSize: 10,
    color: '#64748B',
  },
  shareBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  shareBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  previewAccordion: {
    padding: 12,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accordionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  accordionArrow: {
    fontSize: 10,
    color: '#64748B',
  },
  skeletonBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: 6,
  },
  skeletonNote: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skeletonAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  skeletonBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  waitingPill: {
    padding: 12,
    justifyContent: 'center',
  },
  waitingText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
});
