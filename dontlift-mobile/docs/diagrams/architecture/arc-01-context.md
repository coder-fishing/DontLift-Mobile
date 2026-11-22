# ARC-01 — Ngữ cảnh hệ thống

Các mũi tên thể hiện ranh giới tương tác. DontLift không giữ tiền chuyển giữa thành viên; payOS chỉ phục vụ mua Premium.

```mermaid
flowchart LR
    U[Người dùng Solo] --> A[Ứng dụng DontLift]
    H[Host] --> A
    M[Member] --> A
    A <--> F[Firebase Auth và Firestore]
    A --> E[Express API bên ngoài]
    E --> O[PaddleOCR]
    E --> C[Cloudinary private media]
    E <--> P[payOS]
    A --> B[Ứng dụng ngân hàng qua VietQR]
    P --> E
```

Nguồn đối chiếu: [architecture.md](../../architecture.md), [api-contracts.md](../../api-contracts.md).
