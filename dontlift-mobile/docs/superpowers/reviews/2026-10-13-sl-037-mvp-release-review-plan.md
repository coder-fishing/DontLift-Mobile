# Review kế hoạch — SL-037

**Target:** [Plan](../plans/2026-10-13-sl-037-mvp-release.md).
**Baseline:** Architecture/ADRs/API/PRD/AGENTS đã duyệt; tracked code tại d38a6c4. Backlog và implementation plan vẫn DRAFT.
**Nguồn:** [PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24), reviewed commit d38a6c4.
**Human authorization:** 2026-10-13, user trả lời "ok" cho bảng phương án sửa năm findings; chỉ plan corrections.
**Execution scope:** Không source/test/config implementation edits, không install/deploy. RESOLVED là plan omission đã sửa, không implementation PASS hoặc GitHub thread-resolution claim.

## PR24-4255429701

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Deferred deployment configuration ownership
- **Location:** SL-037 mục 3/5/6/7; index
- **Problem:** Release không owner .firebaserc/firebase.json/firestore.indexes.json sau prerequisites.
- **Recommendation:** Release sở hữu conditional config creation/validation, explicit aliases, ordered deploy/smoke gates.
- **Created At:** 2026-10-13, theo PR review.
- **Updated By:** Codex, theo human-approved corrections.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [Original finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4255429701).
- **Response:** Đã thêm Task 0, canonical config/Rules/index inventory/docs/config tests ownership. Exact IDs và D1/E2/authorization trước executable config; tested Rules canonical re-verify; query inventory thật; deploy permission riêng. Chưa tạo actual config/resources hoặc deploy.

## PR24-4255731339

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Premium release dependency
- **Location:** SL-037 dependency list, release gate, and `docs/implementation-plan.md` dependency table.
- **Problem:** SL-037 could pass without SL-036 although accepted ADR-007 includes Advanced Penalty Leaderboard among Server Premium benefits.
- **Recommendation:** Make SL-036 a hard release dependency and retain D6 while its behavior remains undefined.
- **Created At:** 2026-10-13, theo PR review trên commit 1bc8e92.
- **Updated By:** Codex, theo human-approved corrections.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [Latest P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4255731339).
- **Response:** SL-037 now depends on SL-001–036 and lists D6 as a blocker; its release gate cannot pass until SL-036 is complete. SL-036 still cannot finalize its behavior before D6. The edge adds no cycle because SL-036 depends on SL-017 and SL-032. No release-scope behavior beyond ADR-007 was invented.

## Self-review

- Original comment identities giữ nguyên; Responses đối chiếu owner/tasks/acceptance trong plan và index đã sửa.
- Product behavior, ADRs, stable IDs và blockers không bị đổi thành approval tự động.
- Runtime/device/provisioning evidence vẫn unverified; không source hoặc resource mutation trong corrections.
