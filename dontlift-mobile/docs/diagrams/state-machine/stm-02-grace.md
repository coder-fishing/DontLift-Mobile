# STM-02 — Vòng đời xác nhận vi phạm

Các nhãn Idle/Grace/Open/Closed là trạng thái phân tích của engine, không phải enum lưu trong SQLite. FACE_DOWN sau hạn cần xác nhận rồi đóng.

```mermaid
stateDiagram-v2
    state "Không có candidate" as Idle
    state "Đang chờ 3 giây" as Grace
    state "Vi phạm đang mở" as Open
    state "Đã đóng vi phạm" as Closed
    [*] --> Idle
    Idle --> Grace: INVALID hoặc LIFTED
    Grace --> Idle: FACE_DOWN trước 3 giây
    Grace --> Idle: UNKNOWN khi chưa có vi phạm mở
    Grace --> Open: Đủ hạn, lưu thành công rồi markConfirmed
    Open --> Open: Vẫn chưa FACE_DOWN
    Open --> Closed: FACE_DOWN, lưu thời điểm kết thúc
    Closed --> Idle: markEnded
```

Nguồn đối chiếu: [feature-specification.md](../../feature-specification.md), [decisions/ADR-008-platform-session-lifecycle.md](../../decisions/ADR-008-platform-session-lifecycle.md).
