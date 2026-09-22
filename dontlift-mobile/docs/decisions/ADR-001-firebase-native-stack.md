# ADR-001: Firebase native stack trong Expo Development Build

## Status

Accepted

## Context

DontLift target Android và iOS bằng React Native + Expo. PRD yêu cầu Firebase Authentication, Firestore realtime listeners, offline recovery và Expo Development Build. Firebase JS SDK chạy trong Expo Go nhưng Firestore trên React Native không có persistent offline cache. Auth token không được lưu thủ công trong plain storage.

## Decision

Dùng React Native Firebase trên Expo SDK 57 Development Build:

- Native Firebase Auth cho Email/Password MVP và SDK-managed token persistence.
- Native Firestore cho realtime listeners và native offline cache.
- Native Functions client cho callable commands.
- Không hỗ trợ Expo Go cho runtime tích hợp Firebase.
- Không sao chép ID token hoặc refresh token vào SQLite, AsyncStorage hay Expo SecureStore.

Firestore Standard là database edition cho mobile SDK, Security Rules và document/subcollection model.

## Consequences

### Positive

- Khớp offline semantics của PRD.
- Native auth persistence có một token lifecycle duy nhất.
- Có thể dùng Firebase native capabilities và realtime listeners.
- Không cần custom auth token storage adapter.

### Negative

- Cần Android/iOS Firebase configuration và Expo config plugins.
- Native dependency change cần build binary mới.
- Không chạy được trong Expo Go.
- Upgrade Expo, React Native Firebase và native toolchains phải được kiểm tra cùng nhau.

## Alternatives considered

### Firebase JS SDK

Loại vì React Native Firestore không có persistence và auth persistence cần thêm adapter, dù phương án này đơn giản hơn và hỗ trợ Expo Go/web.

### Custom REST client tới Firebase/Auth

Loại vì tự quản lý token, refresh, retries và realtime transport làm tăng rủi ro bảo mật và khối lượng code.

## Source

- PRD OQ-5, FR-02, FR-03 và NFR Platform/Token Security.
- Feature Spec Sections 1, 2 và 6.
- Expo SDK 57 Firebase integration guidance.
