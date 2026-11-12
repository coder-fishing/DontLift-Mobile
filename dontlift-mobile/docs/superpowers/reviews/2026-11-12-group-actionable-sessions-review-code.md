# Review code — Group Actionable Sessions

**Target:** [Implementation Plan](../plans/2026-11-12-group-actionable-sessions.md) and its implementation in `src/features/history/group-history-repository.ts`, `src/app/index.tsx`, `src/components/GroupHomeDashboard.tsx`, `src/screens/GroupLobbyScreen.tsx`, and related tests.
**Baseline:** Latest human decision supersedes the original list layout: actionable sessions occupy the existing compact Recent list region, the History button remains in that header, and regular Recent rows return when there are no actions. The queue still uses bounded pagination and role-aware ordering.
**Scope:** Initial review findings were recorded without source changes. The latest user request authorized adjustments; resolved findings below now reflect matching code and tests.

## GAS-CODE-001

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Pagination discoverability
- **Location:** `src/components/GroupHomeDashboard.tsx`, action-section visibility condition around lines 83–85; `src/app/index.tsx`, `loadMoreActionableGroupSessions`.
- **Problem:** The action section is rendered only when there are items or a loading/error state. If the first room-index page contains no actionable sessions but `actionableHasMore` is true, the section is hidden, including its “Load more” control. An unresolved action on a later page then cannot be discovered from Group Home.
- **Recommendation:** Keep the “Needs attention” section visible when `actionableHasMore` is true, even when the current page has no action rows. Show a clear load-more affordance and preserve the current empty-page state until later pages are checked. Add a dashboard or integration test where page one has no action, page two has an unresolved action, and the user can load it.
- **Created At:** 2026-11-12, Asia/Saigon.
- **Updated By:** Codex, implementation follow-up.
- **Updated At:** 2026-11-12, Asia/Saigon.
- **Response:** The action region now occupies the shared session-list slot and remains visible whenever `actionableHasMore` is true, even with no rows on the current page. The dashboard test verifies that Load more stays reachable in this case.

## GAS-CODE-002

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Action ordering
- **Location:** `src/features/history/group-history-repository.ts`, `readActionablePage` merge/sort block around lines 390–397.
- **Problem:** The approved plan says rooms within the same action class are ordered by most recently updated. The implementation sorts by `endedAtUtcMs` or `startedAtUtcMs`, which is session chronology, not the latest room/bill update. An older session with a recently changed payment state can therefore appear below a newer session whose action has been pending longer.
- **Recommendation:** Include a safe last-updated timestamp in the live action projection and use it as the secondary sort key within each action class. Keep saved entries labelled as saved and use their last known timestamp only as an offline ordering hint. Add a test where an older session was updated more recently than a newer session.
- **Created At:** 2026-11-12, Asia/Saigon.
- **Updated By:** Codex, implementation follow-up.
- **Updated At:** 2026-11-12, Asia/Saigon.
- **Response:** Live action entries now carry the room's `updatedAt` timestamp and sort within each action class by that value, with session time as a fallback for saved/legacy entries. A focused repository test confirms a more recently updated older session sorts ahead of a newer session.

## Tự kiểm tra report

- Hai Issue ID được giữ nguyên và mỗi finding có đủ trường bắt buộc.
- GAS-CODE-001 có thay đổi tương ứng trong điều kiện hiển thị và dashboard test.
- GAS-CODE-002 có timestamp cập nhật trong action model, comparator và test thứ tự.
- Baseline được cập nhật theo quyết định mới về việc dùng chung vùng danh sách và giữ nút History.
