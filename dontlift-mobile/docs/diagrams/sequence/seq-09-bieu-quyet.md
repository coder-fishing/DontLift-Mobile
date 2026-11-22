# SEQ-09 — Biểu quyết kết thúc

Các nhánh là kết quả giao dịch do client khởi tạo và Rules kiểm tra; Firestore không tự chạy timer kết thúc phiếu.

```mermaid
sequenceDiagram
    actor I as Người đề xuất ACTIVE
    participant D as Firestore và Rules
    participant M as Các thành viên ACTIVE
    I->>D: Mở phiếu với thời điểm server
    D-->>M: Listener phiếu đang mở
    loop Trong 30 giây
        M->>D: Transaction ghi lựa chọn của chính mình
        D->>D: Kiểm tra active denominator và hạn phiếu
    end
    alt Toàn bộ ACTIVE đồng ý trước hạn
        D->>D: Commit CANCELLED cùng giao dịch quyết định
        D-->>M: Dừng phiên, bỏ luồng chia hóa đơn
    else Không đạt nhất trí trước hạn
        Note over D,M: Phiếu hết hiệu lực theo server time, không có scheduler
        D-->>M: Phiên tiếp tục ACTIVE
    end
```

Nguồn đối chiếu: [decisions/ADR-016-spark-termination-vote.md](../../decisions/ADR-016-spark-termination-vote.md).
