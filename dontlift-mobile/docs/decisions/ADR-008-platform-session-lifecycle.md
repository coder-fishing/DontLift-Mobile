# ADR-008: Platform lifecycle trong active session

## Status

Accepted

## Context

`Phone-Down Detection` áp dụng cùng `3-Second Grace Period` khi app chuyển `inactive` hoặc `background`, nhưng iOS và Android có execution windows khác nhau. Sensor polling không thể tiếp tục đáng tin cậy sau khi OS suspend process. Violation phải không bị mất, không bị ghi hai lần và không biến một background transition ngắn hơn 3 giây thành confirmed violation.

## Decision

Platform lifecycle adapter phát một domain transition duy nhất khi active session rời foreground.

1. Trước khi lifecycle callback kết thúc, app atomically ghi SQLite lifecycle candidate với UUID, session ID, transition UTC time, platform monotonic marker và `PENDING` state.
2. Grace-period engine bắt đầu tại transition time. Candidate là durable evidence, chưa phải confirmed `Violation Log`.
3. Nếu app trở lại foreground trước 3 giây, engine hủy candidate; không ghi violation.
4. Nếu condition kéo dài ít nhất 3 giây, engine atomically tạo `Violation Log` và matching `sync_outbox` event từ candidate UUID, rồi đánh dấu candidate confirmed. Repeated callbacks reuse cùng UUID.
5. Nếu OS suspend hoặc kill process trước callback 3 giây, startup/resume reconciliation tính elapsed từ platform monotonic marker khi còn hợp lệ; fallback sang UTC time với clock-anomaly guard. Elapsed dưới 3 giây hủy candidate; elapsed từ 3 giây trở lên confirm violation.

### iOS

- Lifecycle adapter gọi native `beginBackgroundTaskWithExpirationHandler` ngay sau khi durable candidate commit.
- App monitor `backgroundTimeRemaining` và gọi `endBackgroundTask` sau cancel, confirmation hoặc expiration handling.
- Expiration handler chỉ persist unresolved candidate state rồi kết thúc background task; nó không giữ process sống vô hạn và không gửi network request bắt buộc.
- Sensor polling dừng khi OS suspend. Durable candidate được reconcile khi app chạy lại.

### Android

- Lifecycle observer xử lý `ON_STOP`/background transition và persist candidate trước khi sensor polling dừng.
- WorkManager chỉ lên lịch deferred reconciliation/sync; nó không được giả định chạy đúng tại mốc 3 giây.
- Nếu WorkManager chạy, worker confirm candidate đủ grace và queue sync. Nếu không, startup/resume reconciliation thực hiện cùng idempotent logic.

## Consequences

### Positive

- Background transition ngắn vẫn giữ grace period.
- OS suspension không làm mất durable evidence.
- iOS background execution kết thúc đúng hạn.
- Android không phụ thuộc WorkManager timing để bảo đảm correctness.
- Candidate UUID ngăn duplicate violation sau nhiều lifecycle callbacks.

### Negative

- Cần native lifecycle adapters trong Expo Development Build.
- Resume reconciliation phải xử lý clock anomaly và device reboot.
- Confirmation có thể bị trì hoãn đến lần app chạy tiếp theo khi OS suspend sớm.

## Alternatives considered

### Ghi violation ngay khi background

Loại vì bỏ qua 3-Second Grace Period và tạo false positive cho transition ngắn.

### Chỉ dùng JavaScript timer

Loại vì timer không chạy đáng tin cậy khi OS suspend hoặc kill process.

### Yêu cầu WorkManager chạy đúng sau 3 giây

Loại vì WorkManager là deferred scheduler, không phải exact timer.

## Source

- PRD US-04 và OQ-3.
- Feature Spec Section 4.1.
- Human decision F-10 ngày 2026-09-23.
