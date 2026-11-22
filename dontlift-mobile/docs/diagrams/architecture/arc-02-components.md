# ARC-02 — Thành phần và quyền sở hữu dữ liệu

Admin bypass Rules nên Express phải tự xác minh quyền. Không biểu diễn Cloud Functions hoặc native Firestore disk cache như thành phần runtime bắt buộc hiện tại.

```mermaid
flowchart TB
    subgraph Device[Thiết bị Android hoặc iOS]
        UI[Expo Router và Screens]
        Domain[Controllers và nghiệp vụ]
        Sensor[Expo Sensors và lifecycle adapter]
        Repos[Repositories và subscriptions]
        Local[(SQLite và outbox)]
        Worker[Sync workers]
        UI --> Domain
        Sensor --> Domain
        Domain --> Repos
        Repos <--> Local
        Local <--> Worker
    end
    subgraph Firebase[Firebase Spark]
        Auth[Authentication]
        Rules[Security Rules]
        DB[(Firestore)]
        Rules --- DB
    end
    UI <--> Auth
    Repos <--> Rules
    Worker <--> Rules
    Domain --> API[Express API ngoài Firebase]
    API --> Admin[Firebase Admin]
    Admin --> DB
    API --> OCR[PaddleOCR]
    API --> Media[Cloudinary]
    API <--> Pay[payOS]
```

Nguồn đối chiếu: [architecture.md](../../architecture.md), [decisions/ADR-010-expo-go-firebase-js.md](../../decisions/ADR-010-expo-go-firebase-js.md), [api-contracts.md](../../api-contracts.md).
