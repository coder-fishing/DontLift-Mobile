# Review kế hoạch — SL-035

**Target:** [Plan](../plans/2026-10-13-sl-035-free-tier-ads.md).
**Baseline:** Non-session placement targets are produced by SL-012, SL-013/016 and SL-029; D7 still blocks provider choices.
**Nguồn:** [PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24), reviewed commit `4e681b6`.
**Execution scope:** Chỉ sửa hard dependencies/index/report; không chọn provider hoặc cài SDK.

## PR24-4259477717

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** FR-06 ad placement coverage
- **Location:** D7, dependency header, file inventory, acceptance và `docs/implementation-plan.md`.
- **Problem:** Plan followed the lower-priority Profile placement and omitted Home/SoloSelect required by PRD FR-06; Home's producer SL-006 was not a dependency.
- **Recommendation:** Include Home and depend on its producer, or resolve the source conflict explicitly under D7.
- **Created At:** 2026-10-13, review trên commit `45d52aa`.
- **Updated By:** Codex.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P2 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4259477717).
- **Response:** SL-035 nay phụ thuộc SL-006, tích hợp banner vào `SoloSelectScreen` (Home) và kiểm tra đúng bốn placement FR-06: Home, Lobby, History, Settings; Profile bị bỏ khỏi inventory. D7 giữ blocker để xử lý rõ mâu thuẫn trong ví dụ US-18/Product Design với FR-06; kế hoạch tuân [AGENTS.md dòng 17–18](../../../AGENTS.md#L17-L18) về precedence PRD trên Product Design.

## PR24-4255952642

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Ads SDK dependency và native configuration ownership
- **Location:** SL-035 mục 2/3, Task 1/2 và mục 6/7.
- **Problem:** Sau khi D7 chọn provider, slice yêu cầu test-mode banner, placements và consent behavior nhưng danh sách file không giao manifest, native config hay hai lockfile.
- **Recommendation:** Giao provider SDK/adapter, `package.json`, `app.json`, hai lockfiles và test-mode verification cho SL-035; D7 tiếp tục chặn lựa chọn/config trước approval.
- **Created At:** 2026-10-13, theo PR review trên commit `bb406e4`.
- **Updated By:** Codex, theo human authorization cho các plan corrections trước đó.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4255952642); repository rule: [AGENTS.md](../../../AGENTS.md#L59).
- **Response:** SL-035 đã sở hữu provider adapter/dependency, manifest, synchronized lockfiles, conditional native config và Android/iOS test mode; D7 vẫn là blocker. Không package nào được chọn/cài ở lượt này.

## PR24-4256183843

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Ad placement screen producer dependencies
- **Location:** SL-035 required dependencies and implementation-plan row.
- **Problem:** SL-035 targets History, GroupLobby and Profile screens but could run before their producer/finalizer slices, allowing missing placement targets or later integration overwrites.
- **Recommendation:** Depend on the screen producers or move each placement into its producer. This correction keeps the centralized SL-035 owner and adds the relevant hard dependencies.
- **Created At:** 2026-10-13, PR #24 review on commit `4e681b6`.
- **Updated By:** Codex, after user requested continuing the corrections.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P2 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256183843).
- **Response:** SL-035 now depends on SL-012 (History), SL-013 and SL-016 (GroupLobby producer/finalizer), and SL-029 (Profile), alongside SL-030/031. D7 still blocks SDK/provider/placement/consent decisions.

## Self-review

- Dependency graph remains acyclic; SL-006, SL-012, SL-013/016 and SL-030/031 precede SL-035.
- D7 and test-mode/native evidence requirements remain; no SDK is selected or installed.
- Plan scope follows FR-06; any additional Profile placement needs an explicit decision under D7.
