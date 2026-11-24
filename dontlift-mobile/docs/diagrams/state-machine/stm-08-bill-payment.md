# STM-08 — Công bố bill và trạng thái khoản trả

Đây là trạng thái nghiệp vụ suy ra từ manifest, revision và billPaidCount; không phải một enum billStatus duy nhất. Share riêng đổi UNPAID sang MARKED_AS_PAID; share 0 không cần trả.

```mermaid
stateDiagram-v2
    state "Chưa công bố" as Draft
    state "Đang stage" as Staging
    state "Đã công bố, chưa có khoản xác nhận" as Published
    state "Đã có khoản xác nhận, khóa override" as Locked
    [*] --> Draft
    Draft --> Staging: Host chuẩn bị request
    Staging --> Staging: Retry theo manifest
    Staging --> Published: Publish nguyên tử
    Published --> Published: Override revision hợp lệ khi paid count bằng 0
    Published --> Locked: Khoản dương đầu tiên MARKED_AS_PAID
    Locked --> Locked: Xác nhận các khoản dương còn lại
```

Nguồn đối chiếu: [decisions/ADR-021-spark-default-bill.md](../../decisions/ADR-021-spark-default-bill.md), [decisions/ADR-022-spark-bill-overrides.md](../../decisions/ADR-022-spark-bill-overrides.md), [decisions/ADR-023-spark-manual-payment-status.md](../../decisions/ADR-023-spark-manual-payment-status.md).
