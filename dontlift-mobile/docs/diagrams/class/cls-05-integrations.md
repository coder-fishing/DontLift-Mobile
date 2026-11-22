# CLS-05 — Ranh giới tích hợp dịch vụ

Sơ đồ phụ thuộc thành phần dưới ký pháp lớp, không phải mô hình kế thừa. Mã Express/PaddleOCR nằm ngoài repository mobile.

```mermaid
classDiagram
    class MobileApp {
        <<component>>
    }
    class FirebaseAuth {
        <<external service>>
    }
    class Firestore {
        <<external service>>
    }
    class ExpressAPI {
        <<external boundary>>
    }
    class PaddleOCR {
        <<external service>>
    }
    class Cloudinary {
        <<external service>>
    }
    class PayOS {
        <<external service>>
    }
    MobileApp ..> FirebaseAuth : SDK danh tính
    MobileApp ..> Firestore : transactions và listeners
    MobileApp ..> ExpressAPI : Firebase Bearer token
    ExpressAPI ..> Firestore : Admin xác minh và ghi theo quyền server
    ExpressAPI ..> PaddleOCR : OCR key server-only
    ExpressAPI ..> Cloudinary : private media
    ExpressAPI ..> PayOS : checkout và xác minh
```

Nguồn đối chiếu: [architecture.md](../../architecture.md), [api-contracts.md](../../api-contracts.md), [decisions/ADR-025-payos-expiring-premium.md](../../decisions/ADR-025-payos-expiring-premium.md).
