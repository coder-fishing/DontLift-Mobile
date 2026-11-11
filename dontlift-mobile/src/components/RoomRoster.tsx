import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import type { RoomLobbyMember } from '../features/rooms/room-listener';

interface RoomRosterProps {
  members: RoomLobbyMember[];
  participantCount: number;
  isActive: boolean;
  hostUid: string;
  isLive?: boolean;
  onRemoveMember?: (uid: string, displayName: string) => void;
  removingMemberUid?: string;
}

export function RoomRoster({ members, participantCount, isActive, hostUid, isLive = false, onRemoveMember, removingMemberUid }: RoomRosterProps) {
  return (
    <View style={styles.container} accessibilityLabel="Room members">
      <View style={styles.headerRow}>
        <View style={styles.headingGroup}>
          <Ionicons name="people-outline" size={18} color={Colors.light.text} />
          <Text style={styles.heading}>{isActive ? 'SESSION MEMBERS' : 'MEMBERS'} · {participantCount}</Text>
        </View>
        <View style={styles.liveGroup}>
          <View style={[styles.liveDot, !isLive ? styles.offlineDot : null]} />
          <Text style={styles.live}>{isLive ? 'Live updates' : 'Saved list'}</Text>
        </View>
      </View>

      <View style={styles.capacity}>
        <View style={styles.capacityIcon}><Ionicons name="people" size={17} color={Colors.light.roomCapacityAccent} /></View>
        <Text style={styles.capacityText}>Room up to 5 members · <Text style={styles.premiumText}>Premium: unlimited</Text></Text>
      </View>

      <View style={styles.memberList}>
        {members.map(member => {
          const isHost = member.uid === hostUid;
          return (
            <View key={member.uid} style={[styles.row, isHost ? styles.hostRow : styles.memberRow]}>
              <MemberAvatar displayName={member.displayName} avatarUri={member.avatarUri} isHost={isHost} />
              <View style={styles.identity}>
                <Text numberOfLines={1} style={styles.member}>{member.displayName}</Text>
                <View style={[styles.roleBadge, isHost ? styles.hostBadge : styles.memberBadge]}>
                  <Ionicons name={isHost ? 'ribbon' : 'person-outline'} size={13} color={isHost ? Colors.light.roomHostAccent : Colors.light.roomMemberAccent} />
                  <Text style={[styles.roleText, isHost ? styles.hostAccent : styles.memberAccent]}>{isHost ? 'Host' : 'Member'}</Text>
                </View>
              </View>
              {onRemoveMember && !isHost ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${member.displayName} from room`}
                  accessibilityState={{ disabled: Boolean(removingMemberUid), busy: removingMemberUid === member.uid }}
                  disabled={Boolean(removingMemberUid)}
                  style={({ pressed }) => [styles.removeButton, pressed ? styles.pressed : null]}
                  onPress={() => onRemoveMember(member.uid, member.displayName)}
                >
                  {removingMemberUid === member.uid
                    ? <ActivityIndicator color={Colors.light.error} size="small" />
                    : <Ionicons name="person-remove-outline" size={19} color={Colors.light.error} />}
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MemberAvatar({ displayName, avatarUri, isHost }: { displayName: string; avatarUri?: string; isHost: boolean }) {
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  return (
    <View style={[styles.avatar, isHost ? styles.hostAvatar : styles.memberAvatar]}>
      {avatarUri && failedImageUri !== avatarUri ? (
        <Image
          source={{ uri: avatarUri }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={avatarUri}
          transition={0}
          style={styles.avatarImage}
          onError={() => setFailedImageUri(avatarUri)}
          accessibilityLabel={`${displayName}'s avatar`}
        />
      ) : (
        <Text style={[styles.initials, isHost ? styles.hostAccent : styles.memberAccent]}>
          {displayName.trim().slice(0, 2).toUpperCase() || '?'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 12 },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headingGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { color: Colors.light.text, fontSize: 13, fontWeight: '800' },
  liveGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.light.success },
  offlineDot: { backgroundColor: Colors.light.textSecondary },
  live: { color: Colors.light.roomSecondaryText, fontSize: 12, fontWeight: '600' },
  capacity: { minHeight: 48, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, backgroundColor: Colors.light.roomCapacitySurface },
  capacityIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.roomCapacityIconSurface },
  capacityText: { flex: 1, color: Colors.light.roomSecondaryText, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  premiumText: { color: Colors.light.roomPremiumAccent, fontWeight: '800' },
  memberList: { gap: 9 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 19 },
  hostRow: { backgroundColor: Colors.light.roomHostSurface },
  memberRow: { backgroundColor: Colors.light.roomMemberSurface },
  hostAvatar: { backgroundColor: Colors.light.roomHostAvatar },
  memberAvatar: { backgroundColor: Colors.light.roomMemberAvatar },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  initials: { fontSize: 13, fontWeight: '800' },
  hostAccent: { color: Colors.light.roomHostAccent },
  memberAccent: { color: Colors.light.roomMemberAccent },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  member: { flexShrink: 1, color: Colors.light.text, fontSize: 15, fontWeight: '700' },
  roleBadge: { flexShrink: 0, minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 8 },
  hostBadge: { backgroundColor: Colors.light.roomHostBadge },
  memberBadge: { backgroundColor: Colors.light.roomMemberBadge },
  roleText: { fontSize: 11, fontWeight: '700' },
  removeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: Colors.light.roomRemoveSurface },
  pressed: { opacity: 0.72 },
});
