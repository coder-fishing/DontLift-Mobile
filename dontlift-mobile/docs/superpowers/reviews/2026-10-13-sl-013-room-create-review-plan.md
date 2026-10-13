# Review kế hoạch — SL-013

**Target:** [Plan](../plans/2026-10-13-sl-013-room-create.md).
**Baseline:** SQLite migrations trong SL-003/SL-006, schema projections ở Architecture §6.3 và quy tắc bảo toàn dữ liệu trong [AGENTS.md](../../../AGENTS.md#L32).
**Nguồn:** [PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24).
**Execution scope:** Chỉ cập nhật kế hoạch và review report; không thêm migration vào source, không chạy test.

## PR24-4256037245

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Room/member SQLite migration ownership
- **Location:** SL-013 mục 3/5/6/7 và dependency của slice trong `docs/implementation-plan.md`.
- **Problem:** SL-013 cần cache room metadata, SL-014/SL-016 cần room/member projections bền vững, nhưng chưa có plan sở hữu migrations cho `rooms` và `room_members`; fresh install sẽ không có bảng để repository ghi.
- **Recommendation:** Giao SL-013 mở rộng migration runner có version từ SL-003, tạo schema room/member theo architecture, và kiểm tra fresh install cùng upgrade.
- **Created At:** 2026-10-13, theo PR review trên commit `d2fb0e1`.
- **Updated By:** Codex, trong đợt xử lý findings tiếp theo của PR #24.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256037245).
- **Response:** Finding được xác nhận: SL-003 tạo migration runner, SL-006 chỉ thêm session schema; không plan nào trước SL-013 tạo room/member tables. SL-013 nay phụ thuộc SL-003, sở hữu migration versioned cho `rooms` và `room_members`, và có fresh-install/upgrade tests xác nhận migration chạy trước projection writes, dữ liệu profile/session được giữ. SL-014/016 dùng lại schema này; không tạo database bootstrap thứ hai.

## PR24-4256751986

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Invitation producer ownership
- **Location:** SL-013 mục 3/5/6/7; SL-015 contract và acceptance; index US-06/07.
- **Problem:** Coverage ghi invitation ở SL-013 nhưng không có owner encode/render QR, nên two-device scan của SL-015 thiếu producer.
- **Recommendation:** Giao SL-013 encoder/render/dependency và SL-015 reuse canonical contract.
- **Created At:** 2026-10-13, review trên commit 8e75dd4.
- **Updated By:** Codex, theo yêu cầu tiếp tục sửa findings.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Response:** SL-013 nay sở hữu shared invitation contract, encoder, RoomInvitationQr, GroupLobby integration và manifest/hai lockfiles khi cần dependency. SL-015 dùng lại contract và nghiệm thu scan từ QR Host thật. D13 chặn scheme/payload chưa thống nhất. Tuân [AGENTS.md dòng 14–18](../../../AGENTS.md#L14-L18); [finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256751986). Chỉ resolved ownership ở plan level.

## PR24-4256751999

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Monthly quota decision gate
- **Location:** SL-013 trạng thái/blocker/tasks/acceptance; index D12.
- **Problem:** Timezone chỉ là risk dù quyết định này xác định usage bucket và thời điểm reset quota.
- **Recommendation:** Ghi explicit blocker trước execution, thêm rollover/server-clock/replay cases.
- **Created At:** 2026-10-13, review trên commit 8e75dd4.
- **Updated By:** Codex, theo yêu cầu tiếp tục sửa findings.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Response:** D12 xuất hiện trong trạng thái SL-013, blocker table/index row và task gate. Tests yêu cầu boundary theo timezone được duyệt, device timezone không đổi bucket, replay không double-count. Không chọn timezone thay human; [finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256751999).

## Self-review

- Đợt v0.11 đã kiểm tra dependency index và SL-013 cùng yêu cầu SL-006; upgrade fixture dùng output migration thật, giữ version/data cũ. Không thêm source hoặc test implementation.

- Finding chỉ resolved ở mức ownership của plan; chưa khẳng định migration hoặc test đã được implement.
- Schema chi tiết vẫn lấy từ Architecture §6.3; không sửa product behavior hoặc phê duyệt backlog P6.0.

## PR24-4259164391

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Session migration prerequisite
- **Location:** SL-013 dependency header, mục 3 và Task 1; `docs/implementation-plan.md` row SL-013 và shared ownership.
- **Problem:** Upgrade acceptance cần database đã có profile/session migrations nhưng SL-013 chưa phụ thuộc owner sessions migration SL-006; hai slice có thể tranh version sau profile và fixture không kiểm chứng output prerequisite thật.
- **Recommendation:** Thêm hard dependency SL-006, đồng bộ index, yêu cầu room migration theo sau sessions migration và upgrade fixture từ dependency thật.
- **Created At:** 2026-10-13, review trên commit `973d4a9`.
- **Updated By:** Codex.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P2 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4259164391).
- **Response:** Đã xác nhận SL-006 là owner sessions migration, trong khi SL-013 trước sửa chỉ yêu cầu SL-003/004. Header và index nay thêm SL-006; migration ownership/Task 1 yêu cầu version tiếp theo chưa dùng sau sessions migration, giữ version/data profile/session và fixture được tạo từ migrations thật. Chỉ resolved ở plan level; runtime migrations chưa được implement hoặc chạy.
