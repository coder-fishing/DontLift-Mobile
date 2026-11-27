import { useEffect, useRef } from 'react';
import type { RegistrationProfile } from '../auth/auth-controller';
import { createProfileRepository } from './profile-repository';

type ProfileRepository = ReturnType<typeof createProfileRepository>;

export function useCanonicalProfile({
  profile,
  repository,
  acceptCanonicalProfile,
}: {
  profile: RegistrationProfile;
  repository: ProfileRepository;
  acceptCanonicalProfile: (profile: RegistrationProfile) => void;
}) {
  const projection = useRef<{ uid: string; uri?: string; premiumExpiresAtUtcMs?: number | null; initialized: boolean }>(
    { uid: profile.uid, uri: profile.avatarUri ?? undefined, premiumExpiresAtUtcMs: profile.premiumExpiresAtUtcMs, initialized: false },
  );

  useEffect(() => repository.listen(profile.uid, (canonical, fromCache) => {
    if (fromCache) return;
    acceptCanonicalProfile(canonical);
    const avatarUri = canonical.avatarUri ?? undefined;
    const premiumExpiresAtUtcMs = canonical.premiumExpiresAtUtcMs;
    const previous = projection.current;
    if (previous.uid !== profile.uid || !previous.initialized || previous.uri !== avatarUri
      || previous.premiumExpiresAtUtcMs !== premiumExpiresAtUtcMs) {
      projection.current = { uid: profile.uid, uri: avatarUri, premiumExpiresAtUtcMs, initialized: true };
      void repository.syncProfileToRooms(profile.uid, avatarUri, premiumExpiresAtUtcMs);
    }
  }, () => undefined), [repository, profile.uid, acceptCanonicalProfile]);

  useEffect(() => {
    if (!profile.premiumExpiresAtUtcMs) return undefined;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = profile.premiumExpiresAtUtcMs! - Date.now();
      if (remaining <= 0) {
        if (profile.isPremium) acceptCanonicalProfile({ ...profile, isPremium: false });
      } else timer = setTimeout(check, Math.min(remaining, 86400000));
    };
    check();
    return () => clearTimeout(timer);
  }, [profile, acceptCanonicalProfile]);
}
