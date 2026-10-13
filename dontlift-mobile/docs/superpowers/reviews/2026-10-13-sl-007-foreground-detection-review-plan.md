# Review kế hoạch — SL-007

**Target:** [Plan](../plans/2026-10-13-sl-007-foreground-detection.md).
**Baseline:** ADR-002, Architecture §6.3/§8, migration runner SL-003 và quy tắc local persistence trong [AGENTS.md](../../../AGENTS.md#L32).
**Nguồn:** [PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24).
**Execution scope:** Chỉ cập nhật plan/index/report; không tạo SQLite tables hoặc chạy migration.

## PR24-4255952599

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Violation/outbox migration ownership
- **Location:** SL-007 mục 3/5/6/7 và dependency trong `docs/implementation-plan.md`.
- **Problem:** SL-007 ghi `violation_logs` cùng `sync_outbox` atomically nhưng chỉ giao repositories; chưa slice nào sau profile/session foundation tạo hai schema cần thiết, nên fresh install không có bảng để transaction ghi.
- **Recommendation:** Giao SL-007 versioned migrations cho violation/outbox schemas cùng fresh-install/upgrade coverage; phụ thuộc migration runner SL-003.
- **Created At:** 2026-10-13, theo PR review trên commit `d2fb0e1`.
- **Updated By:** Codex, trong đợt audit ownership của PR #24.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4255952599).
- **Response:** Finding được xác nhận theo architecture §6.3 và ADR-002: hiện chỉ có migrations cho profile/session, không có violation/outbox schema. SL-007 nay phụ thuộc SL-003, sở hữu versioned migrations cho cả hai tables, và test fresh install/upgrade giữ dữ liệu cũ trước khi kiểm chứng atomic repository writes. Không thay đổi đường syncEvents hoặc raw-sensor privacy.

## Self-review

- Finding chỉ resolved ở mức ownership trong plan; không claim migration đã chạy.
- Dependency graph không vòng lặp: SL-007 phụ thuộc SL-003 và SL-006.
