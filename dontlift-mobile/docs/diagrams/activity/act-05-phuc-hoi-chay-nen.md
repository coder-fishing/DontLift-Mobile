# ACT-05 — Phục hồi lifecycle

Sơ đồ hợp đồng lifecycle ADR-008. Native background adapters là yêu cầu bản dựng phù hợp; không coi Expo Go là bằng chứng đã giám sát nền liên tục.

```mermaid
flowchart TD
    A([Phiên rời foreground]) --> B[Ghi candidate bền vững vào SQLite]
    B --> C[Theo dõi khoảng chờ trong giới hạn OS]
    C --> D{Ứng dụng còn thực thi?}
    D -->|Không| E[OS suspend hoặc dừng process]
    E --> F[Mở lại hoặc resume]
    D -->|Có| G[Nhận thời điểm quay lại hoặc đủ hạn]
    F --> H[Đối chiếu marker monotonic và UTC]
    G --> H
    H --> I{Có bất thường thời gian?}
    I -->|Có| J[Giữ dữ liệu cần kiểm tra, không suy diễn]
    I -->|Không| K{Elapsed ít nhất 3 giây?}
    K -->|Không| L[Hủy candidate]
    K -->|Có| M[Xác nhận một lần theo candidate UUID]
    M --> N[Lưu vi phạm và xử lý đồng bộ phù hợp]
    J --> Z([Kết thúc phục hồi])
    L --> Z
    N --> Z
```

Nguồn đối chiếu: [decisions/ADR-008-platform-session-lifecycle.md](../../decisions/ADR-008-platform-session-lifecycle.md), [decisions/ADR-010-expo-go-firebase-js.md](../../decisions/ADR-010-expo-go-firebase-js.md).
