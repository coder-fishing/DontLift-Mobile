# ACT-01 — Đăng ký và khởi tạo hồ sơ

Auth thành công nhưng hồ sơ chưa hoàn tất là tình huống phục hồi riêng; không ghi đè hồ sơ đã tồn tại.

```mermaid
flowchart TD
    A([Bắt đầu]) --> B[Nhập email, mật khẩu, tên]
    B --> C{Dữ liệu hợp lệ?}
    C -->|Không| D[Thông báo lỗi nhập liệu]
    D --> B
    C -->|Có| E[Firebase Auth tạo tài khoản]
    E --> F{Auth thành công?}
    F -->|Không| G[Thông báo lỗi an toàn]
    G --> Z([Kết thúc])
    F -->|Có| H[Transaction tạo hồ sơ nếu chưa có]
    H --> I{Server xác nhận hồ sơ?}
    I -->|Không| J[Giữ trạng thái cần hoàn tất hồ sơ]
    J --> K[Thử lại bootstrap, không tạo lại tài khoản]
    K --> H
    I -->|Có| L[Upsert hồ sơ vào SQLite]
    L --> M[Đi vào ứng dụng]
    M --> Z
```

Nguồn đối chiếu: [decisions/ADR-010-expo-go-firebase-js.md](../../decisions/ADR-010-expo-go-firebase-js.md).
