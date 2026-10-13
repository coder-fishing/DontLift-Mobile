# Review kế hoạch — SL-003

**Target:** [Plan](../plans/2026-10-13-sl-003-registration-profile.md).
**Baseline:** Architecture/ADRs/API/PRD/AGENTS đã duyệt; tracked code tại d38a6c4. Backlog và implementation plan vẫn DRAFT.
**Nguồn:** [PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24), reviewed commit d38a6c4.
**Human authorization:** 2026-10-13, user trả lời "ok" cho bảng phương án sửa năm findings; chỉ plan corrections.
**Execution scope:** Không source/test/config implementation edits, không install/deploy. RESOLVED là plan omission đã sửa, không implementation PASS hoặc GitHub thread-resolution claim.

## PR24-4255429680

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Persistence prerequisite ownership
- **Location:** SL-003 mục 3/5/6/7 và SL-006 shared foundation
- **Problem:** Registration cần SQLite nhưng chưa có dependency/database/migration/lockfile owner trước profile persistence.
- **Recommendation:** SL-003 sở hữu SQLite/root package/hai lockfiles/database readiness/migration; SL-006 mở rộng session schema.
- **Created At:** 2026-10-13, theo PR review.
- **Updated By:** Codex, theo human-approved corrections.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [Original finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4255429680).
- **Response:** Đã thêm Task 0A, files/acceptance cho fresh/reopen/migrate/rollback; chuyển bootstrap ownership về 003; 006 reuse, không dependency ngược. D2/profile schema và device evidence vẫn chưa giải quyết.

## PR24-4255429685

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Backend runtime prerequisite
- **Location:** SL-003 bootstrap và SL-002 client boundary
- **Problem:** First callable chưa có Functions/Admin package/runtime/lockfiles; native client runtime bị coi như backend đã có.
- **Recommendation:** Backend bootstrap trước callable trong 003; 002 chỉ nghiệm thu client; downstream backend verification nhận bootstrap 003.
- **Created At:** 2026-10-13, theo PR review.
- **Updated By:** Codex, theo human-approved corrections.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [Original finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4255429685).
- **Response:** Đã thêm Task 0B, backend manifest/hai lockfiles, supported runtime selection, Rules harness, entrypoint/discovery và emulator source wiring. Callable handshake chuyển sang 003; downstream test prerequisites đã sửa. Không install hay tạo actual backend config.

## PR24-4256183768

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Owner-read Rules prerequisite for login
- **Location:** SL-003 Task 0C/files; SL-004 login acceptance; resource ownership table in `docs/implementation-plan.md`.
- **Problem:** SL-003/004 fetch canonical `users/{uid}` on fresh devices, but the prior ownership table assigned all access to SL-029, which depends on SL-004; default-deny would route a valid login to profile recovery.
- **Recommendation:** SL-003 owns owner-only read Rules and client-SDK Emulator Suite cases; SL-004 verifies fresh login/restore consumes that read; SL-029 retains only edit allowlist Rules.
- **Created At:** 2026-10-13, PR #24 review on commit `4e681b6`.
- **Updated By:** Codex, after user requested continuing the corrections.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256183768); repository rule: [AGENTS.md](../../../AGENTS.md#L32-L33).
- **Response:** SL-003 now owns the owner-only read rule and client-SDK allow/deny tests before registration/login; SL-004 tests fresh-login profile fetch and cross-user denial; SL-029 remains the sole profile-edit allowlist owner. Default deny and server-owned entitlement fields remain protected.

## Self-review

- Original comment identity giữ nguyên; Response đối chiếu owner/tasks/acceptance trong plan đã sửa.
- Product behavior, ADRs, stable IDs và blockers không bị đổi thành approval tự động.
- Runtime/device/provisioning evidence vẫn unverified; không source hoặc resource mutation trong corrections.
