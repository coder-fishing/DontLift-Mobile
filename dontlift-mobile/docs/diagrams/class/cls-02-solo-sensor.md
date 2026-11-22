# CLS-02 — Hợp đồng Solo và cảm biến

Tên module hiển thị là nhóm chức năng để trình bày; classifyPhoneOrientation và createSoloSessionController là hàm thực tế, không phải class triển khai.

```mermaid
classDiagram
    class AccelerometerSample {
        +number x
        +number y
        +number z
    }
    class PhoneDownEngine {
        <<module>>
        +classifyPhoneOrientation(sample) PhoneOrientation
    }
    class GracePeriodEngine {
        +observe(orientation, nowUtcMs) GracePeriodSnapshot
        +markConfirmed(eventId, confirmedAtUtcMs) void
        +restoreActiveViolation(violation) void
        +markEnded() void
        +snapshot(nowUtcMs) GracePeriodSnapshot
    }
    class GracePeriodSnapshot {
        +PhoneOrientation orientation
        +number candidateStartedAtUtcMs
        +ActiveViolation activeViolation
        +boolean shouldConfirm
        +boolean shouldEndViolation
    }
    class SoloSessionRepositoryPort {
        <<interface>>
        +startOrResume(input) Promise
        +cancelActive(input) Promise
    }
    class SoloControllerFactory {
        <<module>>
        +createSoloSessionController(repository) object
    }
    PhoneDownEngine ..> AccelerometerSample : đọc
    GracePeriodEngine --> GracePeriodSnapshot : tạo
    SoloControllerFactory ..> SoloSessionRepositoryPort : phụ thuộc port
```

Nguồn đối chiếu: [feature-specification.md](../../feature-specification.md), [decisions/ADR-008-platform-session-lifecycle.md](../../decisions/ADR-008-platform-session-lifecycle.md).
