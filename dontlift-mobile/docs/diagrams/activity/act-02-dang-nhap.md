# ACT-02 — Đăng nhập

SDK quản lý persistence và refresh token; ứng dụng không sao chép refresh token vào bảng riêng.

```mermaid
flowchart TD
    A([Bắt đầu]) --> B[Nhập email và mật khẩu]
    B --> C{Có mạng và dữ liệu hợp lệ?}
    C -->|Không| D[Hiển thị lỗi và cho nhập lại]
    D --> B
    C -->|Có| E[Firebase Auth xác thực]
    E --> F{Thành công?}
    F -->|Không| G[Thông báo đăng nhập thất bại]
    G --> B
    F -->|Có| H[Hoàn tất hoặc phục hồi hồ sơ]
    H --> I[Khởi tạo repository theo UID]
    I --> J[Khôi phục phiên và xử lý outbox phù hợp]
    J --> K([Màn hình chính])
```

Nguồn đối chiếu: [decisions/ADR-010-expo-go-firebase-js.md](../../decisions/ADR-010-expo-go-firebase-js.md), [architecture.md](../../architecture.md).
