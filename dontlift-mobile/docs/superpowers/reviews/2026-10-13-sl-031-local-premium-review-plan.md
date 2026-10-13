# Review kế hoạch — SL-031

**Target:** [Plan](../plans/2026-10-13-sl-031-local-premium.md).
**Baseline:** PR #24 review trên commit `1bc8e92`; tracked manifest/lockfiles và installed package state được kiểm tra trong workspace.
**Nguồn:** [PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24).
**Human authorization:** 2026-10-13, user trả lời "ok" cho bảng proposed corrections; chỉ plan corrections.
**Execution scope:** Không install package hoặc sửa app config; RESOLVED chỉ xác nhận plan ownership/test requirements đã được thêm.

## PR24-4255731329

- **Status:** RESOLVED
- **Severity:** High
- **Category:** SecureStore dependency/configuration ownership
- **Location:** SL-031 mục 3/5/6/7, SL-032 redemption recovery, và implementation-plan ownership.
- **Problem:** SL-031 yêu cầu lưu pending activation code bằng Expo SecureStore nhưng dependency không có trong manifest, lockfiles, hoặc installed top-level package; file boundary và native config ownership còn thiếu.
- **Recommendation:** Giao manifest, synchronized lockfiles và required Expo configuration cùng persistence/failure tests cho SL-031.
- **Created At:** 2026-10-13, theo PR review trên commit 1bc8e92.
- **Updated By:** Codex, theo human-approved corrections.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [Latest P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4255731329).
- **Response:** Workspace check confirmed `expo-secure-store` is absent from `package.json`, `package-lock.json`, `pnpm-lock.yaml`, and `node_modules`. SL-031 now owns SDK-compatible dependency selection, both lockfile updates, conditional Expo config, restart persistence, and SecureStore read/write/remove failure tests. SL-032 covers delayed deletion until redemption and durable local entitlement update. No package was installed or configuration changed.

## PR24-4256037251

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Entitlement SQLite migration ownership
- **Location:** SL-031 mục 3/5/6/7 và hard dependencies trong `docs/implementation-plan.md`.
- **Problem:** Local Premium repository ghi entitlement flag/code hash vào SQLite nhưng SL-031 không mở rộng migration runner, nên fresh install không có schema entitlement và activation không thể sống qua restart.
- **Recommendation:** Giao SL-031 versioned entitlement migration cùng fresh-install/upgrade coverage; phụ thuộc migration runner SL-003.
- **Created At:** 2026-10-13, theo PR review trên commit `d2fb0e1`.
- **Updated By:** Codex, trong đợt xử lý findings tiếp theo của PR #24.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256037251).
- **Response:** Finding được xác nhận theo kiến trúc §6.3 và ownership hiện có: SL-003 tạo migration runner, SL-006 mở rộng cho sessions nhưng chưa có entitlement migration. SL-031 nay phụ thuộc SL-003, mở rộng runner với versioned entitlement schema, và kiểm tra fresh install/upgrade từ profile/session schema, bảo toàn dữ liệu. Local Premium và Server Premium vẫn tách theo ADR-007; không thêm package hoặc sửa source trong lượt này.

## PR24-4256973579

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Migration producer ordering
- **Location:** SL-031 dependency header; index row.
- **Problem:** SL-031 yêu cầu entitlement migration sau profile/session schemas và upgrade từ cả hai nhưng thiếu SL-006 prerequisite.
- **Recommendation:** Thêm SL-006 để session schema tồn tại trước entitlement migration acceptance.
- **Created At:** 2026-10-13, review trên commit 17287f3.
- **Updated By:** Codex, theo yêu cầu tiếp tục sửa findings.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [Finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256973579).
- **Response:** Plan/index nay cùng thêm SL-006; profile/session-before-entitlement ordering giữ nguyên và DAG acyclic. D5 vẫn chặn activation contract; không cài package hoặc tạo migration source.

## Self-review

- Các findings chỉ resolved ở mức thiếu sót kế hoạch; chưa có evidence package/native runtime hoặc SQLite execution.
- ADR-007's sensitive pending-code boundary is preserved; Firebase tokens remain in native Auth SDK storage.
- D5 and the SL-031 execution gate remain in place.
