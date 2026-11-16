import type { Auth } from 'firebase/auth';
import * as FileSystem from 'expo-file-system/legacy';

export type ReceiptScanResult = {
  version: 1;
  status: 'suggested' | 'needs_review';
  amount: number | null;
  suggested_amount: number | null;
  currency: 'VND';
  needs_confirmation: true;
  evidence: Record<string, unknown> | null;
  warnings: string[];
  timings_ms: Record<string, number>;
};

const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function localOcrUrl(baseUrl = process.env.EXPO_PUBLIC_RECEIPT_SCAN_API_URL?.trim() ?? ''): string | null {
  if (!baseUrl) return null;
  if (!__DEV__) throw new Error('Direct PaddleOCR access is available only in development builds.');
  let url: URL;
  try { url = new URL(baseUrl); }
  catch { throw new Error('Set EXPO_PUBLIC_RECEIPT_SCAN_API_URL to the local PaddleOCR /scan URL.'); }
  const host = url.hostname;
  const localHost = host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2'
    || /^10\.\d+\.\d+\.\d+$/.test(host) || /^192\.168\.\d+\.\d+$/.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);
  if (url.protocol !== 'http:' || !localHost || url.pathname !== '/scan' || url.search || url.hash) {
    throw new Error('The development PaddleOCR URL must be a local HTTP /scan endpoint.');
  }
  return url.toString().replace(/\/$/, '');
}

function apiOrigin(baseUrl = process.env.EXPO_PUBLIC_PREMIUM_API_URL ?? ''): string {
  if (!/^https:\/\/[^/?#]+/.test(baseUrl)
    && !(__DEV__ && /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(baseUrl))) {
    throw new Error('Receipt scanning is unavailable. Please try again later.');
  }
  return baseUrl.replace(/\/$/, '');
}

function validAmount(value: unknown): value is number | null {
  return value === null || (Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 999_999_999_999);
}

function checkedResult(value: unknown): ReceiptScanResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The scan service returned an unreadable scan result. Please retry.');
  const result = value as Record<string, unknown>;
  const evidenceValid = result.evidence === null
    || (typeof result.evidence === 'object' && !Array.isArray(result.evidence));
  const timings = result.timings_ms;
  if (result.version !== 1 || !['suggested', 'needs_review'].includes(String(result.status))
    || !validAmount(result.amount) || !validAmount(result.suggested_amount) || result.currency !== 'VND'
    || result.needs_confirmation !== true || !evidenceValid || !Array.isArray(result.warnings)
    || result.warnings.some(warning => typeof warning !== 'string')
    || !timings || typeof timings !== 'object' || Array.isArray(timings)
    || Object.values(timings).some(timing => typeof timing !== 'number' || !Number.isFinite(timing) || timing < 0)) {
    throw new Error('The scan service returned an unreadable scan result. Please retry.');
  }
  return {
    version: 1,
    status: result.status as ReceiptScanResult['status'],
    amount: result.amount,
    suggested_amount: result.suggested_amount,
    currency: 'VND',
    needs_confirmation: true,
    evidence: result.evidence as Record<string, unknown> | null,
    warnings: result.warnings as string[],
    timings_ms: timings as Record<string, number>,
  };
}

function errorMessage(status: number, code: unknown): string {
  if (status === 401 || code === 'unauthenticated') return 'Sign in again to scan this receipt.';
  if (code === 'premium-required') return 'Active Premium is required to scan receipts.';
  if (code === 'host-required') return 'Only the active Host can scan a receipt for this room.';
  if (code === 'failed-precondition') return 'Finish the room before scanning a receipt.';
  if (code === 'invalid-image' || code === 'image-too-large') return 'Choose a JPEG, PNG, or WebP image under 10 MB.';
  if (code === 'ocr-timeout') return 'Receipt scanning took too long. Please try again.';
  if (code === 'ocr-unavailable' || code === 'unavailable') return 'Receipt scanning is temporarily unavailable. You can enter the amount manually.';
  return 'Could not scan this receipt. Check your connection and try again.';
}

export function createReceiptScanApi(auth: Auth, baseUrl?: string) {
  return {
    async scan(roomId: string, uri: string, mimeType: string): Promise<ReceiptScanResult> {
      if (!supportedMimeTypes.has(mimeType)) throw new Error('Choose a JPEG, PNG, or WebP image.');
      if (!roomId || !uri) throw new Error('Choose a room and receipt image before scanning.');
      const paddleOcrUrl = localOcrUrl();
      if (__DEV__ && !paddleOcrUrl && !baseUrl) {
        throw new Error('Local PaddleOCR is not configured. Set EXPO_PUBLIC_RECEIPT_SCAN_API_URL and restart Expo with cache cleared.');
      }
      const user = auth.currentUser;
      if (!user) throw new Error('Sign in to scan a receipt.');
      const token = paddleOcrUrl ? null : await user.getIdToken();
      if (auth.currentUser?.uid !== user.uid) throw new Error('The signed-in account changed. Please retry.');

      let response: FileSystem.FileSystemUploadResult | null | undefined;
      let uploadTask: ReturnType<typeof FileSystem.createUploadTask> | undefined;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let didTimeout = false;
      const targetName = paddleOcrUrl ? 'PaddleOCR' : 'Premium API';
      try {
        const url = paddleOcrUrl ?? `${apiOrigin(baseUrl)}/v1/bills/scan?roomId=${encodeURIComponent(roomId)}`;
        const headers: Record<string, string> = paddleOcrUrl
          ? { 'bypass-tunnel-reminder': '1' }
          : { Authorization: `Bearer ${token}`, 'Content-Type': mimeType, 'bypass-tunnel-reminder': '1' };
        const options = {
            httpMethod: 'POST',
            uploadType: paddleOcrUrl ? FileSystem.FileSystemUploadType.MULTIPART : FileSystem.FileSystemUploadType.BINARY_CONTENT,
            ...(paddleOcrUrl ? { fieldName: 'image', mimeType } : {}),
            headers,
          } as const;
        const request = typeof FileSystem.createUploadTask === 'function'
          ? (uploadTask = FileSystem.createUploadTask(url, uri, options)).uploadAsync()
          : FileSystem.uploadAsync(url, uri, options);
        response = await Promise.race([
          request,
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              didTimeout = true;
              void uploadTask?.cancelAsync();
              reject(new Error('receipt-scan-timeout'));
            }, 45_000);
          }),
        ]);
      } catch {
        if (timeoutId) clearTimeout(timeoutId);
        if (uploadTask) await uploadTask.cancelAsync().catch(() => undefined);
        throw new Error(didTimeout
          ? `Receipt scan timed out after 45 seconds. Check that ${targetName} is running and the phone can reach its address, then retry.`
          : `Could not reach ${targetName}. Check that it is running and the phone can reach its address, then retry.`);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
      if (!response) throw new Error('Receipt scanning was cancelled. Please retry.');
      if (auth.currentUser?.uid !== user.uid) throw new Error('The signed-in account changed. Please retry.');

      let body: unknown;
      try { body = JSON.parse(response.body); }
      catch {
        if (response.status < 200 || response.status >= 300) throw new Error(errorMessage(response.status, null));
        throw new Error('The scan service returned an unreadable scan result. Please retry.');
      }
      if (response.status < 200 || response.status >= 300) {
        const code = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>).code : null;
        throw new Error(errorMessage(response.status, code));
      }
      return checkedResult(paddleOcrUrl && body && typeof body === 'object' && !Array.isArray(body)
        ? { version: 1, ...body }
        : body);
    },
  };
}

export type ReceiptScanApi = ReturnType<typeof createReceiptScanApi>;
