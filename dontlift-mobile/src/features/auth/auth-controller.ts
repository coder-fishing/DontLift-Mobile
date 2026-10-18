import { validateRegistration } from './auth-validation';
import type { RegistrationFieldErrors, RegistrationInput } from './auth-validation';

export interface RegistrationProfile {
  uid: string;
  email: string;
  displayName: string;
  isPremium: boolean;
  createdAtUtcMs: number;
}

export interface RegistrationUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface RegistrationRequest {
  version: 1;
  requestId: string;
  displayName: string;
}

export interface RegistrationResponse {
  version: 1;
  requestId: string;
  profile: RegistrationProfile;
}

export interface RegistrationAuthPort {
  getCurrentUser(): RegistrationUser | null;
  onAuthStateChanged(listener: (user: RegistrationUser | null) => void): () => void;
  createAccount(email: string, password: string): Promise<RegistrationUser>;
  setDisplayName(user: RegistrationUser, displayName: string): Promise<void>;
  completeProfile(request: RegistrationRequest): Promise<RegistrationResponse>;
}

export interface RegistrationProfilePort {
  upsert(profile: RegistrationProfile): Promise<void>;
}

export type RegistrationResult =
  | { kind: 'completed'; profile: RegistrationProfile }
  | { kind: 'invalid'; fieldErrors: RegistrationFieldErrors }
  | { kind: 'needs-name' }
  | { kind: 'pending'; message: string }
  | { kind: 'failed'; message: string }
  | { kind: 'signed-out' };

type PendingCompletion = {
  uid: string;
  displayName: string;
  requestId: string;
};

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error) || typeof error.code !== 'string') {
    return undefined;
  }
  return error.code.replace(/^auth\//, '');
}

const GENERIC_REGISTRATION_ERROR = 'We could not create your account. Check your details and try again.';
const RETRYABLE_COMPLETION_ERROR = 'Your account was created, but setup is unfinished. Retry to complete your profile.';

export function createAuthController(
  auth: RegistrationAuthPort,
  profiles: RegistrationProfilePort,
  createRequestId: () => string,
  reportCompletionFailure?: (stage: 'auth-display-name' | 'firestore-profile' | 'local-profile', error: unknown) => void,
) {
  let pendingCompletion: PendingCompletion | undefined;

  async function finishProfile(user: RegistrationUser, displayName: string): Promise<RegistrationResult> {
    const pending = pendingCompletion?.uid === user.uid && pendingCompletion.displayName === displayName
      ? pendingCompletion
      : { uid: user.uid, displayName, requestId: createRequestId() };
    pendingCompletion = pending;

    let stage: 'firestore-profile' | 'local-profile' = 'firestore-profile';
    try {
      const response = await auth.completeProfile({
        version: 1,
        requestId: pending.requestId,
        displayName,
      });
      stage = 'local-profile';
      await profiles.upsert(response.profile);
      pendingCompletion = undefined;
      return { kind: 'completed', profile: response.profile };
    } catch (error) {
      reportCompletionFailure?.(stage, error);
      return { kind: 'pending', message: RETRYABLE_COMPLETION_ERROR };
    }
  }

  async function resumeProfileCompletion(displayNameInput?: string): Promise<RegistrationResult> {
    const user = auth.getCurrentUser();
    if (!user) return { kind: 'signed-out' };

    const displayName = displayNameInput?.trim() || user.displayName?.trim() || '';
    if (Array.from(displayName).length < 1 || Array.from(displayName).length > 40) {
      return { kind: 'needs-name' };
    }

    try {
      if (user.displayName !== displayName) await auth.setDisplayName(user, displayName);
    } catch (error) {
      reportCompletionFailure?.('auth-display-name', error);
      return { kind: 'pending', message: RETRYABLE_COMPLETION_ERROR };
    }

    return finishProfile(user, displayName);
  }

  return {
    onAuthStateChanged: auth.onAuthStateChanged,
    async register(input: RegistrationInput): Promise<RegistrationResult> {
      const fieldErrors = validateRegistration(input);
      if (Object.keys(fieldErrors).length > 0) return { kind: 'invalid', fieldErrors };

      const currentUser = auth.getCurrentUser();
      if (currentUser) return resumeProfileCompletion(input.displayName.trim());

      try {
        const user = await auth.createAccount(input.email.trim(), input.password);
        try {
          await auth.setDisplayName(user, input.displayName.trim());
        } catch (error) {
          reportCompletionFailure?.('auth-display-name', error);
          pendingCompletion = {
            uid: user.uid,
            displayName: input.displayName.trim(),
            requestId: createRequestId(),
          };
          return { kind: 'pending', message: RETRYABLE_COMPLETION_ERROR };
        }
        return finishProfile(user, input.displayName.trim());
      } catch (error) {
        if (errorCode(error) === 'email-already-in-use') {
          return { kind: 'failed', message: GENERIC_REGISTRATION_ERROR };
        }
        const code = errorCode(error);
        if (code === 'invalid-email') {
          return {
            kind: 'invalid',
            fieldErrors: { email: 'Enter a valid email address.' },
          };
        }
        if (code === 'weak-password') {
          return {
            kind: 'invalid',
            fieldErrors: { password: 'Choose a password accepted by your account provider.' },
          };
        }
        return { kind: 'failed', message: GENERIC_REGISTRATION_ERROR };
      }
    },
    resumeProfileCompletion,
  };
}
