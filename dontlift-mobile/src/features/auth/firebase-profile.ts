import type { Auth } from 'firebase/auth';
import { doc, getDocFromServer, runTransaction, serverTimestamp, type DocumentData, type Firestore } from 'firebase/firestore';
import type { RegistrationProfile, RegistrationRequest, RegistrationResponse } from './auth-controller';

export function readRegistrationProfile(uid: string, data: DocumentData): RegistrationProfile {
  const createdAt = data.createdAt;
  if (typeof data.displayName !== 'string' || !data.displayName.trim()
    || typeof data.email !== 'string' || !data.email.trim()
    || !createdAt || typeof createdAt.toMillis !== 'function') {
    throw new Error('The account profile is incomplete.');
  }
  const createdAtUtcMs: number = createdAt.toMillis();
  if (!Number.isFinite(createdAtUtcMs)) throw new Error('The account profile timestamp is invalid.');
  return { uid, email: data.email, displayName: data.displayName, isPremium: data.isPremium === true, createdAtUtcMs };
}

export async function completeRegistrationProfile(
  auth: Auth,
  firestore: Firestore,
  request: RegistrationRequest,
): Promise<RegistrationResponse> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('A signed-in email account is required.');
  const displayName = request.displayName.trim();
  if (request.version !== 1 || Array.from(displayName).length < 1 || Array.from(displayName).length > 40) {
    throw new Error('Enter a name from 1 to 40 characters.');
  }
  const reference = doc(firestore, 'users', user.uid);
  await runTransaction(firestore, async (transaction) => {
    if (auth.currentUser?.uid !== user.uid) throw new Error('Registration session changed.');
    const existing = await transaction.get(reference);
    // UID là khóa idempotency: retry hoặc hai thiết bị cùng tạo không ghi đè hồ sơ đã có.
    if (!existing.exists()) {
      transaction.set(reference, {
        displayName,
        email: user.email,
        isPremium: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });
  // Chỉ nhận hồ sơ đã được server xác nhận, gồm timestamp thật, rồi mới lưu bản chiếu SQLite.
  const snapshot = await getDocFromServer(reference);
  if (auth.currentUser?.uid !== user.uid || !snapshot.exists()) throw new Error('Registration session changed.');
  return { version: 1, requestId: request.requestId, profile: readRegistrationProfile(user.uid, snapshot.data()) };
}
