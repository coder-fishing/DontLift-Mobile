jest.mock('expo-file-system/legacy', () => ({
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  uploadAsync: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import { createReceiptScanApi } from '../src/features/settlement/receipt-scan-api';

const validResult = {
  version: 1,
  status: 'suggested',
  amount: 128000,
  suggested_amount: 128000,
  currency: 'VND',
  needs_confirmation: true,
  evidence: { label: 'Total', text: '128,000 VND' },
  warnings: [],
  timings_ms: { total: 120 },
};

function uploadResult(body: unknown, status = 200) {
  return { status, body: JSON.stringify(body) } as FileSystem.FileSystemUploadResult;
}

describe('receipt scan API', () => {
  const uploadAsync = jest.mocked(FileSystem.uploadAsync);
  const auth = { currentUser: { uid: 'user-a', getIdToken: jest.fn().mockResolvedValue('firebase-token') } };
  const baseUrl = 'https://premium.example.invalid';

  beforeEach(() => {
    jest.clearAllMocks();
    auth.currentUser = { uid: 'user-a', getIdToken: jest.fn().mockResolvedValue('firebase-token') };
  });

  test('uploads raw image bytes with Firebase authentication and returns a checked suggestion', async () => {
    uploadAsync.mockResolvedValue(uploadResult(validResult));
    const result = await createReceiptScanApi(auth as never, baseUrl).scan('room one', 'file:///receipt.jpg', 'image/jpeg');

    expect(result.suggested_amount).toBe(128000);
    expect(result.needs_confirmation).toBe(true);
    expect(uploadAsync).toHaveBeenCalledWith(
      'https://premium.example.invalid/v1/bills/scan?roomId=room%20one',
      'file:///receipt.jpg',
      expect.objectContaining({
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: expect.objectContaining({ Authorization: 'Bearer firebase-token', 'Content-Type': 'image/jpeg' }),
      }),
    );
  });

  test('rejects unsupported MIME types before network access', async () => {
    await expect(createReceiptScanApi(auth as never, baseUrl).scan('room', 'file:///receipt.heic', 'image/heic'))
      .rejects.toThrow('JPEG, PNG, or WebP');
    expect(uploadAsync).not.toHaveBeenCalled();
  });

  test('requires a signed-in user', async () => {
    await expect(createReceiptScanApi({ currentUser: null } as never, baseUrl).scan('room', 'file:///receipt.png', 'image/png'))
      .rejects.toThrow('Sign in');
    expect(uploadAsync).not.toHaveBeenCalled();
  });

  test.each([
    ['amount only', { ...validResult, suggested_amount: null }],
    ['suggested amount only', { ...validResult, amount: null }],
    ['no amount', { ...validResult, amount: null, suggested_amount: null, status: 'needs_review' }],
  ])('accepts valid response variant: %s', async (_label, body) => {
    uploadAsync.mockResolvedValue(uploadResult(body));
    const result = await createReceiptScanApi(auth as never, baseUrl).scan('room', 'file:///receipt.png', 'image/png');
    expect(result.amount).toBe(body.amount);
    expect(result.suggested_amount).toBe(body.suggested_amount);
    expect(result.needs_confirmation).toBe(true);
  });

  test('rejects malformed response data', async () => {
    uploadAsync.mockResolvedValue(uploadResult({ ...validResult, version: 2 }));
    await expect(createReceiptScanApi(auth as never, baseUrl).scan('room', 'file:///receipt.png', 'image/png'))
      .rejects.toThrow('unreadable scan result');
  });

  test('maps API errors to readable messages', async () => {
    uploadAsync.mockResolvedValue(uploadResult({ version: 1, code: 'premium-required' }, 403));
    await expect(createReceiptScanApi(auth as never, baseUrl).scan('room', 'file:///receipt.png', 'image/png'))
      .rejects.toThrow('Premium');
  });

  test('discards the upload result if the active account changes', async () => {
    uploadAsync.mockImplementation(async () => {
      auth.currentUser = { ...auth.currentUser, uid: 'user-b' };
      return uploadResult(validResult);
    });
    await expect(createReceiptScanApi(auth as never, baseUrl).scan('room', 'file:///receipt.png', 'image/png'))
      .rejects.toThrow('account changed');
  });
});
