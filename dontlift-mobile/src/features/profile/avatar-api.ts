import type { Auth } from 'firebase/auth';
import * as FileSystem from 'expo-file-system/legacy';

export type AvatarApiResult = { version: 1; url: string; publicId: string; cleanupPending: boolean };

function apiOrigin(baseUrl = process.env.EXPO_PUBLIC_PREMIUM_API_URL ?? ''): string {
  if (!/^https:\/\/[^/?#]+/.test(baseUrl) && !( __DEV__ && /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(baseUrl))) {
    throw new Error('Avatar upload is unavailable. Please try again later.');
  }
  return baseUrl.replace(/\/$/, '');
}

function parseResponse(value: unknown, uid: string): AvatarApiResult {
  if (!value || typeof value !== 'object') throw new Error('Could not confirm the avatar update. Please retry.');
  const result = value as Record<string, unknown>;
  if (result.version !== 1 || typeof result.url !== 'string' || !result.url.startsWith('https://')
    || typeof result.publicId !== 'string' || !result.publicId.startsWith(`avatars/${uid}/`)
    || (result.cleanupPending !== undefined && typeof result.cleanupPending !== 'boolean')) {
    throw new Error('Could not confirm the avatar update. Please retry.');
  }
  return { version: 1, url: result.url, publicId: result.publicId, cleanupPending: result.cleanupPending === true };
}

async function readResponse(result: FileSystem.FileSystemUploadResult): Promise<unknown> {
  let body: unknown;
  try { body = JSON.parse(result.body); } catch { throw new Error('Avatar service returned an unreadable response. Please retry.'); }
  if (result.status < 200 || result.status >= 300) {
    const code = body && typeof body === 'object' && 'code' in body ? String((body as { code: unknown }).code) : '';
    if (code === 'invalid-image') throw new Error('Choose a JPEG, PNG, or WebP image under 5 MB.');
    if (code === 'unavailable') throw new Error('Avatar service is unavailable. Please retry later.');
    throw new Error('Could not update the avatar. Check your connection and retry.');
  }
  return body;
}

export function createAvatarApi(auth: Auth, baseUrl?: string) {
  async function tokenFor(uid: string) {
    const user = auth.currentUser;
    if (!user || user.uid !== uid) throw new Error('Your sign-in changed. Sign in again before updating your photo.');
    const token = await user.getIdToken();
    if (auth.currentUser?.uid !== uid) throw new Error('Your sign-in changed. Sign in again before updating your photo.');
    return token;
  }
  return {
    async upload(uid: string, uri: string, mimeType: string): Promise<AvatarApiResult> {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error('Choose a JPEG, PNG, or WebP image.');
      const token = await tokenFor(uid);
      const response = await FileSystem.uploadAsync(`${apiOrigin(baseUrl)}/v1/profile/avatar`, uri, {
        httpMethod: 'POST', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType, 'bypass-tunnel-reminder': '1' },
      });
      return parseResponse(await readResponse(response), uid);
    },
    async remove(uid: string): Promise<{ cleanupPending: boolean }> {
      const token = await tokenFor(uid);
      const response = await fetch(`${apiOrigin(baseUrl)}/v1/profile/avatar`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'bypass-tunnel-reminder': '1' },
      });
      let body: unknown;
      try { body = await response.json(); } catch { throw new Error('Avatar service returned an unreadable response. Please retry.'); }
      if (!response.ok) throw new Error('Could not remove the photo. Check your connection and retry.');
      if (!body || typeof body !== 'object' || (body as Record<string, unknown>).version !== 1
        || (body as Record<string, unknown>).removed !== true) throw new Error('Could not confirm photo removal. Please retry.');
      return { cleanupPending: (body as Record<string, unknown>).cleanupPending === true };
    },
  };
}
