# CLS-03 — Cấu trúc đồng bộ dữ liệu

Sơ đồ trách nhiệm khái niệm tương ứng các module sync-worker, outbox-repository, firestore-solo-sync-port và group-violation-repository. Tên phương thức minh họa trách nhiệm, không phải API xuất chính xác.

```mermaid
classDiagram
    class LocalRepository {
        <<conceptual boundary>>
        ghiDuLieuVaOutbox()
    }
    class OutboxEvent {
        string eventId
        string eventType
        string actorUid
        string aggregateId
        string payloadJson
        string syncStatus
        number attemptCount
        number leaseExpiresAt
    }
    class SyncWorker {
        <<conceptual boundary>>
        claimAndSend()
        applyAcknowledgement()
    }
    class SoloFirestoreTransport {
        <<conceptual boundary>>
        createOrReplaySummary()
    }
    class GroupViolationTransport {
        <<conceptual boundary>>
        commitEligibleEvent()
    }
    LocalRepository --> OutboxEvent : ghi nguyên tử
    SyncWorker --> OutboxEvent : lease và retry
    SyncWorker ..> SoloFirestoreTransport : ADR-030
    SyncWorker ..> GroupViolationTransport : ADR-014 và ADR-015
```

Nguồn đối chiếu: [architecture.md](../../architecture.md), [decisions/ADR-030-solo-direct-summary-sync.md](../../decisions/ADR-030-solo-direct-summary-sync.md), [decisions/ADR-014-spark-group-violations.md](../../decisions/ADR-014-spark-group-violations.md).
