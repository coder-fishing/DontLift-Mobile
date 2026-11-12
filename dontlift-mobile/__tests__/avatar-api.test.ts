import { createAvatarApi } from '../src/features/profile/avatar-api';

const mockUploadAsync = jest.fn();
jest.mock('expo-file-system/legacy', () => ({
  uploadAsync: (...args: unknown[]) => mockUploadAsync(...args),
  FileSystemUploadType: { BINARY_CONTENT: 0 },
}));

describe('profile avatar API client', () => {
  beforeEach(() => mockUploadAsync.mockReset());

  it('uploads raw image bytes with the signed-in token and validates UID-scoped metadata', async () => {
    mockUploadAsync.mockResolvedValue({ status: 200, body: JSON.stringify({ version: 1,
      url: 'https://res.cloudinary.com/demo/avatar.jpg', publicId: 'avatars/user-1/a1', cleanupPending: false }) });
    const auth = { currentUser: { uid: 'user-1', getIdToken: jest.fn().mockResolvedValue('firebase-token') } } as never;
    const api = createAvatarApi(auth, 'https://premium.example.test');
    await expect(api.upload('user-1', 'file:///photo.jpg', 'image/jpeg')).resolves.toMatchObject({
      url: 'https://res.cloudinary.com/demo/avatar.jpg', publicId: 'avatars/user-1/a1',
    });
    expect(mockUploadAsync).toHaveBeenCalledWith('https://premium.example.test/v1/profile/avatar', 'file:///photo.jpg', expect.objectContaining({
      httpMethod: 'POST', uploadType: 0, headers: expect.objectContaining({ Authorization: 'Bearer firebase-token', 'Content-Type': 'image/jpeg' }),
    }));
  });

  it('rejects mismatched public IDs and does not upload unsupported types', async () => {
    mockUploadAsync.mockResolvedValue({ status: 200, body: JSON.stringify({ version: 1,
      url: 'https://res.cloudinary.com/demo/avatar.jpg', publicId: 'avatars/other-user/a1' }) });
    const auth = { currentUser: { uid: 'user-1', getIdToken: jest.fn().mockResolvedValue('token') } } as never;
    const api = createAvatarApi(auth, 'https://premium.example.test');
    await expect(api.upload('user-1', 'file:///photo.gif', 'image/gif')).rejects.toThrow('JPEG, PNG, or WebP');
    await expect(api.upload('user-1', 'file:///photo.jpg', 'image/jpeg')).rejects.toThrow('Could not confirm');
  });
});
