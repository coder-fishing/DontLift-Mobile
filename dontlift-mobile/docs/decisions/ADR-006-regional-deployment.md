# ADR-006: Firestore Standard và regional deployment tại Singapore

## Status

Accepted

## Context

DontLift nhắm tới người dùng Việt Nam và cần low-latency room listeners, callable Functions và frequent small writes. Firestore location không thể đổi sau provisioning. Functions và Firestore khác region làm tăng latency và network cost.

Dự án cần tách development data khỏi production nhưng chưa có nhu cầu staging environment riêng.

## Decision

- Dùng Cloud Firestore Standard edition.
- Provision Firestore tại `asia-southeast1` Singapore.
- Deploy Cloud Functions 2nd gen tại `asia-southeast1`; client Functions adapter khai báo cùng region.
- Dùng hai dedicated Firebase projects và aliases: `development` và `production`. Hai aliases không được cùng trỏ một project.
- Mỗi environment bật Email/Password Auth và có Android/iOS Firebase config riêng, được chọn bằng EAS environment-scoped file variables.
- EAS profiles là `development` cho internal Development Build và `production` cho store binary.
- Deployment order là Security Rules, Firestore indexes, Cloud Functions, Scheduled Functions/TTL policies, backend smoke checks, rồi EAS Build.
- Native module/config changes tạo binary mới; EAS Update chỉ dùng với compatible runtime.
- Scheduled Functions cung cấp stale-room, expired-vote, settlement-details và free-tier Solo-history cleanup.

Exact development/production project IDs chưa được provision. Theo human decision ngày 2026-09-23, executable `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json` và `eas.json` được defer thay vì trỏ DontLift vào unrelated Firebase project.

## Consequences

### Positive

- Database và compute colocated gần Việt Nam.
- Giảm command latency và cross-region traffic.
- Development không chạm production Auth hoặc data.
- Standard edition khớp native mobile SDK, realtime listeners và Security Rules.

### Negative

- Singapore Functions dùng Tier 2 pricing.
- Regional Firestore có availability thấp hơn multi-region, dù vẫn có regional SLA.
- Hai Firebase projects cần hai bộ mobile config và deployment discipline.
- Blaze plan và Cloud Scheduler jobs cần cho scheduled Functions.
- Production location decision là irreversible.

Không thể chạy deploy/build pipeline trước khi hai dedicated project IDs được cung cấp. Đây là external provisioning prerequisite, không phải lý do gộp environments.

## Alternatives considered

### Firestore multi-region tại Mỹ hoặc châu Âu

Loại vì xa người dùng chính và Functions/data latency cao hơn.

### Enterprise/MongoDB compatibility

Loại vì không có MongoDB workload và không mang lợi ích cho mobile Firebase contracts hiện tại.

### Một Firebase project cho mọi môi trường

Loại vì test có thể phá production data, Auth users hoặc Rules behavior.

### Development, staging và production ngay từ MVP

Loại theo YAGNI; staging chỉ được thêm khi release process chứng minh nhu cầu.

## Source

- PRD OQ-5 và NFR leaderboard latency/platform.
- Feature Spec Sections 4.2, 6 và 7.
- Human decision F-11 ngày 2026-09-23: reproducible two-project deployment contract; executable config deferred until exact DontLift project IDs exist.
- Firebase Firestore and Cloud Functions regional guidance.
