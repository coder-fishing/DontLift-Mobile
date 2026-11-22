# SEQ-01 — Đăng ký và phục hồi hồ sơ

Theo runtime Firebase JS SDK, không dùng callable bootstrap cũ.

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant A as Ứng dụng
    participant F as Firebase Auth
    participant D as Firestore và Rules
    participant L as SQLite
    U->>A: Gửi thông tin đăng ký
    A->>F: createUserWithEmailAndPassword
    F-->>A: Danh tính đã xác thực
    A->>D: Transaction đọc hồ sơ theo UID
    alt Chưa có hồ sơ
        A->>D: Tạo allowlist, Premium mặc định, server timestamp
    else Đã có hồ sơ
        D-->>A: Trả hồ sơ hiện hữu, không ghi đè
    end
    alt Server xác nhận thành công
        D-->>A: Hồ sơ chính thức
        A->>L: Upsert local profile
        A-->>U: Hoàn tất
    else Lỗi sau khi Auth đã thành công
        A-->>U: Cần thử lại hoàn tất hồ sơ
        Note over A,F: Không tạo tài khoản mới khi retry bootstrap
    end
```

Nguồn đối chiếu: [decisions/ADR-010-expo-go-firebase-js.md](../../decisions/ADR-010-expo-go-firebase-js.md).
