# ADR-006: Firestore Standard và regional deployment tại Singapore

## Status

Accepted

## Context

DontLift nhắm tới người dùng Việt Nam và cần low-latency room listeners, callable Functions và frequent small writes. Firestore location không thể đổi sau provisioning. Functions và Firestore khác region làm tăng latency và network cost.

Dự án cần tách development data khỏi production nhưng chưa có nhu cầu staging environment riêng.

## Decision

- Dùng Cloud Firestore Standard edition.
- Provision Firestore tại `asia-southeast1` Singapore.
- Deploy Cloud Functions 2nd gen tại `asia-southeast1`.
- Client Functions adapter khai báo cùng region, không dựa vào default.
- Dùng hai Firebase projects: development và production.
- Scheduled Functions cung cấp stale-room và expired-vote cleanup.
- EAS Build profiles chọn đúng Firebase project configuration.
- Native module/config changes tạo binary mới; EAS Update chỉ dùng với compatible runtime.

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
- Firebase Firestore and Cloud Functions regional guidance.
