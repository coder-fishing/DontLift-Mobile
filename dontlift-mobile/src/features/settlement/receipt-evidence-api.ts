import type { Auth } from 'firebase/auth';
import type { ImageSourcePropType } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const maxImageBytes = 10 * 1024 * 1024;
const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function apiOrigin(): string {
  const value = process.env.EXPO_PUBLIC_PREMIUM_API_URL?.trim() ?? '';
  if (!value) throw new Error('Premium API is not configured for receipt evidence.');
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error('Set EXPO_PUBLIC_PREMIUM_API_URL to the Premium API origin.'); }
  const localHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '10.0.2.2'
    || /^10\.\d+\.\d+\.\d+$/.test(url.hostname) || /^192\.168\.\d+\.\d+$/.test(url.hostname)
    || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(url.hostname);
  if ((url.protocol !== 'https:' && !(__DEV__ && url.protocol === 'http:' && localHost))
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Premium API must be an HTTPS origin (local HTTP is development-only).');
  }
  return url.origin;
}

function evidenceUrl(roomId: string, path?: string): string {
  const query = new URLSearchParams({ roomId });
  if (path) query.set('path', path);
  return `${apiOrigin()}/v1/bills/evidence?${query.toString()}`;
}

async function currentUser(auth: Auth) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in again before saving or viewing receipt evidence.');
  return { user, token: await user.getIdToken() };
}

function errorMessage(code: unknown): string {
  if (code === 'premium-required') return 'Active Premium is required to save receipt evidence.';
  if (code === 'host-required') return 'Only the active Host can save receipt evidence.';
  if (code === 'failed-precondition' || code === 'not-found') return 'Receipt evidence is not available for this room or bill.';
  if (code === 'image-too-large' || code === 'invalid-image') return 'Choose a valid JPEG, PNG, or WebP image under 10 MB.';
  if (code === 'receipt-evidence-timeout') return 'Saving the receipt image took too long. Check your connection and retry.';
  return 'Could not save or load receipt evidence. Check the Premium API connection and try again.';
}

function errorForBody(body: unknown): Error {
  const code = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>).code : null;
  return new Error(errorMessage(code));
}

async function responseError(response: Response): Promise<Error> {
  return errorForBody(await response.json().catch(() => null));
}

function uploadResponseError(response: FileSystem.FileSystemUploadResult): Error {
  try { return errorForBody(JSON.parse(response.body)); }
  catch { return errorForBody(null); }
}

export function createReceiptEvidenceApi(auth: Auth) {
  return {
    async upload(roomId: string, uri: string, mimeType: string): Promise<string> {
      if (!extensions[mimeType]) throw new Error('Choose a JPEG, PNG, or WebP image for receipt evidence.');
      const file = await FileSystem.getInfoAsync(uri);
      if (!file.exists || file.size > maxImageBytes) throw new Error('Receipt evidence must be an image smaller than 10 MB.');
      const { user, token } = await currentUser(auth);
      let task: ReturnType<typeof FileSystem.createUploadTask> | undefined;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let response: FileSystem.FileSystemUploadResult | null | undefined;
      try {
        task = FileSystem.createUploadTask(evidenceUrl(roomId), uri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
        });
        response = await Promise.race([
          task.uploadAsync(),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              void task?.cancelAsync();
              reject(new Error('receipt-evidence-timeout'));
            }, 60_000);
          }),
        ]);
      } catch (error) {
        if (task) await task.cancelAsync().catch(() => undefined);
        if (error instanceof Error && error.message === 'receipt-evidence-timeout') throw error;
        throw new Error('Could not upload the receipt image to Cloudinary. Check the Premium API connection and retry.');
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
      if (!response || auth.currentUser?.uid !== user.uid) throw new Error('The upload was interrupted. Please sign in again and retry.');
      if (response.status < 200 || response.status >= 300) throw uploadResponseError(response);
      let body: unknown;
      try { body = JSON.parse(response.body); }
      catch { throw new Error('Premium API returned an unreadable receipt evidence response.'); }
      const path = body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).path : null;
      if (typeof path !== 'string' || !path.startsWith(`rooms/${roomId}/billEvidence/`)) {
        throw new Error('Premium API returned an invalid receipt evidence reference.');
      }
      return path;
    },

    async imageSource(roomId: string, path: string): Promise<ImageSourcePropType> {
      const { token } = await currentUser(auth);
      const response = await fetch(evidenceUrl(roomId, path), {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw await responseError(response);
      const body: unknown = await response.json();
      const record = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
      if (typeof record?.url !== 'string' || !Number.isSafeInteger(record.expiresAtUtcMs)
        || (record.expiresAtUtcMs as number) <= 0 || !record.url.startsWith('https://api.cloudinary.com/')) {
        throw new Error('Premium API returned an invalid private image link.');
      }
      return { uri: record.url };
    },

    async deleteUnpublished(roomId: string, path: string): Promise<void> {
      const { token } = await currentUser(auth);
      const response = await fetch(evidenceUrl(roomId, path), {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw await responseError(response);
    },
  };
}

export type ReceiptEvidenceApi = ReturnType<typeof createReceiptEvidenceApi>;
