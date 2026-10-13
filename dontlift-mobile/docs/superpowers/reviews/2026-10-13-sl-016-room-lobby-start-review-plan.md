# Review kế hoạch — SL-016

**Target:** [Plan](../plans/2026-10-13-sl-016-room-lobby-start.md).
**Baseline:** Architecture/ADRs/API/PRD/AGENTS đã duyệt; tracked code tại d38a6c4. Backlog và implementation plan vẫn DRAFT.
**Nguồn:** [PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24), reviewed commit d38a6c4.
**Human authorization:** 2026-10-13, user trả lời "ok" cho bảng phương án sửa năm findings; chỉ plan corrections.
**Execution scope:** Không source/test/config implementation edits, không install/deploy. RESOLVED là plan omission đã sửa, không implementation PASS hoặc GitHub thread-resolution claim.

## PR24-4255429688

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Security Rules ownership
- **Location:** SL-016 mục 3/5/6/7, liên quan 002/003/012/029/037
- **Problem:** Membership listener không có Rules owner/test; profile editing 029 quá muộn.
- **Recommendation:** Room/member Rules và client-SDK emulator tests trước lobby integration; local policy source và canonical promotion có owner.
- **Created At:** 2026-10-13, theo PR review.
- **Updated By:** Codex, theo human-approved corrections.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [Original finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4255429688).
- **Response:** Đã thêm Task 0/files/cases: allowed member query, anonymous/outsider/cross-room denial, create/update/delete authoritative mutation deny, server-only paths deny và regression. 002 default-deny, 003 harness, 012 Solo rules, 029 profile extension; 037 re-verifies canonical file sau authorization. D1/D3/runtime vẫn blocked.

## PR24-4255731325

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Firestore subcollection Rules ownership
- **Location:** Index Rules inventory; SL-017/018/019/023/024 resource owners; SL-020/025–028/036 direct-read acceptance; SL-037 canonical promotion.
- **Problem:** SL-016 only covered room/member reads; separate room subcollections do not inherit those Rules and required client reads remained denied by default.
- **Recommendation:** Assign Rules and Emulator Suite coverage to each resource producer, retain server write authority, and cover consumer reads.
- **Created At:** 2026-10-13, theo PR review trên commit 1bc8e92.
- **Updated By:** Codex, theo human-approved corrections.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [Latest P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4255731325).
- **Response:** Index now maps users/profile and Solo history, room/member, violations/leaderboard, D3-gated early-exit/votes, settlement details, bill shares, D4-gated group-history queries, and D6-gated advanced leaderboard resources to owners. Producer plans specify member allow/outsider and cross-room deny, server-only writes and Emulator Suite client-SDK tests. Consumer plans SL-020/025–028 assert authorized reads. SL-037 re-tests merged policy. D3/D4/D6 remain blockers; no unknown path or direct write permission is assumed.

## Self-review

- Original comment identities giữ nguyên; Responses đối chiếu owner/tasks/acceptance trong plan và index đã sửa.
- Product behavior, ADRs, stable IDs và blockers không bị đổi thành approval tự động.
- Runtime/device/provisioning evidence vẫn unverified; không source hoặc resource mutation trong corrections.
