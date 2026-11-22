# STM-01 — Phân loại hướng điện thoại

Theo phone-down-engine.ts: độ lớn hợp lệ 0.65–1.35 g, z/magnitude ≤ -0.85 là FACE_DOWN. Không tự coi UNKNOWN là vi phạm.

```mermaid
stateDiagram-v2
    [*] --> UNKNOWN
    UNKNOWN --> FACE_DOWN: Mẫu hợp lệ, z trên độ lớn không vượt -0.85
    UNKNOWN --> LIFTED: Mẫu hợp lệ nhưng không úp
    UNKNOWN --> INVALID: Không hữu hạn hoặc độ lớn ngoài khoảng
    FACE_DOWN --> LIFTED: Thay đổi hướng khỏi ngưỡng úp
    FACE_DOWN --> INVALID: Mẫu không hợp lệ
    LIFTED --> FACE_DOWN: Trở về ngưỡng úp
    LIFTED --> INVALID: Mẫu không hợp lệ
    INVALID --> FACE_DOWN: Mẫu hợp lệ và úp
    INVALID --> LIFTED: Mẫu hợp lệ nhưng không úp
    FACE_DOWN --> UNKNOWN: Không có mẫu
    LIFTED --> UNKNOWN: Không có mẫu
    INVALID --> UNKNOWN: Không có mẫu
```

Nguồn đối chiếu: [feature-specification.md](../../feature-specification.md).
