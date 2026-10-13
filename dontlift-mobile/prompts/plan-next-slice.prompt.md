# P6.1 — Lập kế hoạch triển khai slice DontLift

## 1. METADATA

- **Role:** PRIMARY — kỹ sư lập kế hoạch mobile/backend.
- **Skills:** `$brainstorming` primary; `$qskill-write-ba-plan` để viết hành vi bằng tiếng Việt; `$react-native-expert` cho native/mobile; `$ui-ux-pro-max` cho UX/accessibility theo accepted design; `$firebase-auth-basics`, `$firebase-firestore`, `$firebase-security-rules-auditor` theo đúng boundary. Đọc skill trước khi áp dụng, báo unavailable; không invent Functions skill.
- **Interaction Mode:** khảo sát → draft → human review → approved plan; không tự implement.
- **Output Mode:** kế hoạch riêng từng slice, không implementation code/signatures.
- **Approval Gate:** human duyệt scope, non-goals, acceptance, dependencies và quyết định còn thiếu trước P6.2.
- **Canonical Output:** mục lục/trạng thái ở `dontlift-mobile/docs/implementation-plan.md`; mỗi plan ở `dontlift-mobile/docs/superpowers/plans/YYYY-MM-DD-sl-NNN-<slug>.md`.
- **Chế độ mặc định:** lập kế hoạch một slice. **Batch draft** chỉ khi human yêu cầu lập riêng cho nhiều/toàn bộ slice; không gộp thành mega-plan hoặc tự execute batch.

## 2. WHEN TO USE

Dùng sau P6.0 để biến một slice có ranh giới rõ thành tasks, files, behavior, test cases và verification có thể review. Dùng lại cho Auth, Solo, Group, settlement, supporting hoặc Premium; không hardcode một feature.

Nếu backlog chưa approved nhưng human chỉ định rõ author draft, có thể lưu draft để review theo quyền đó. Ghi provenance và DRAFT, không suy thành approval backlog. Không chạy lại P6.0 hoặc P6.2 tự động.

## 3. INPUTS

Đường dẫn tương đối repository root có `dontlift-mobile/`; xác nhận app root/baseline trước đọc.

- Human priority, slice ID hoặc tập IDs, mode single/batch, external prerequisites và approval evidence.
- Applicable AGENTS/override và `docs/implementation-slices.md` nếu có. File thiếu thì báo; không tạo backlog để giả approval. Khi có quyền draft rõ, dùng đề xuất được human chỉ định và ghi nguồn.
- PRD, Feature Spec, Product Design/Design Brief, Architecture, API contracts và accepted ADRs trong `dontlift-mobile/docs/`.
- Read-only `design/concepts/concept-final/` và `prototype/`: screen/component/styles/states tương ứng.
- Source `src/`, package/config/backend/tests thật, implementation-plan index và plans có sẵn.
- Current runtime/test/device evidence; code/decisions từ Git ref khác phải ghi provenance, không coi đã merged.

Không đọc/in credentials hoặc dùng node_modules/ignored artifacts thay package manifest và tracked source để kết luận hiện trạng.

## 4. TASK

### A. Xác nhận baseline và scope

1. Ghi branch/commit/worktree changes, actual input paths và slice release.
2. Read source/docs liên quan; phân biệt prototype, implementation và verified completion.
3. Single mode: chọn một slice với human. Batch mode: giữ từng ID/scope riêng; ownership shared và dependency rõ.
4. Đọc lại previous decisions/plans; preserve stable IDs, không renumber theo priority.
5. Gap về contract/design/default/policy là blocker cụ thể. Tiếp tục draft phần độc lập khi được yêu cầu, nhưng không fabricate decision để đủ plan.

### B. Thiết kế skeleton hành vi

1. Ghi goal, actor/trigger/outcome, scope, non-goals, source refs và implementation status.
2. Đề xuất files/units theo repo convention; ghi planned Create/Modify, responsibility, inputs/outputs bằng lời. Existing prerequisite units phải reuse.
3. Backend: accepted wire envelopes, Auth-derived identity, role/ownership/lifecycle, schema bounds, transaction/idempotency/receipt, safe errors/logs và Rules query compatibility.
4. Cloud Functions/Admin SDK: đối chiếu current official Firebase docs và SDK/runtime thực tế; Auth/Firestore skills không thay toàn bộ Functions guide.
5. Mobile: native lifecycle/sensor boundaries, SQLite atomicity, sync/reconciliation, SDK session ownership; không copy prototype mock into production.
6. UI: accepted visual hierarchy, field validation, loading/empty/error/offline/syncing, recovery, labels/safe areas/touch targets. Không regenerate design system hoặc đưa unrelated web stack.
7. Theme consumers: dùng semantic tokens; nếu app-level provider đã có thì reuse, không tạo state song song hoặc color literals bypass theme. Slice migrate theme phải sở hữu root integration và inventory screens/components cùng producer prerequisites, có rendered-state verification; producer sửa consumer sau migration vẫn giữ contract này.

### C. Viết tasks và acceptance

Mỗi task có files, unit nhận/trả bằng lời, behavior numbered theo execution order, branch/error outcomes, test cases cụ thể và commands/prerequisites.

- Khi hợp lý, test-first: viết failing case, chạy xác nhận failure đúng nghiệp vụ, implement minimal behavior, chạy pass, review và commit theo dated plan slug.
- Thiếu runner/toolchain không được tính là failing business test.
- Unit tests kiểm tra behavior/rule; Firebase integration dùng Emulator Suite cho allowed/denied/concurrent/replay.
- Offline kiểm tra commit/restart/reconnect/retry/duplicate delivery; sensor/lifecycle cần physical Android/iOS evidence.
- Bill kiểm tra integer/non-negative/exact total và deterministic residual.
- Undefined feature: task đầu chốt behavior với human; không claim execution-ready hoặc thêm test/schema giả.
- Không có full implementation/type/signature/test code; data shapes đã agreed viết bằng field tables, không code blocks.
- Mỗi slice có end-to-end demonstration riêng; không chỉ checklist generic "handle errors".

### D. Tự review và human gate

Kiểm coverage requirement/acceptance, scope overlap, ID links, dependency DAG, vocabulary/status/field consistency, actual source refs và blocker. Xóa vague placeholders, thay bằng missing decision rõ nếu thật sự chưa được accepted.

Trình bày kết quả: kế hoạch/paths, priorities, dependencies, readiness, differences từ version trước, remaining blockers và explicit approval request. Không đánh dấu approved hoặc execute P6.2.

## 5. CONSTRAINTS AND SOURCE PRECEDENCE

1. Newer explicit human-approved decisions.
2. Accepted ADRs trong `docs/decisions/`.
3. `docs/software-architecture.md`.
4. `docs/api-contracts.md` cho callable wire contracts.
5. `docs/product-requirements.md` cho scope và acceptance.
6. `docs/product-design.md` và accepted design decision packet cho UI.
7. `docs/feature-specification.md`.
8. `docs/project-context.md` và `docs/project-brief.md` là historical context.

Human priority quyết định thứ tự làm việc, không tự override accepted ADR. Prototype/concepts là read-only references theo design đã duyệt; actual implementation/evidence xác định hiện trạng và độ hoàn thành, không override target contracts; AI suggestions đứng sau các nguồn trên.

Respect repository precedence và report unresolved conflict; không dùng generic skill defaults thay Email/Password, Standard edition, React Native Firebase Development Build hoặc region accepted.

- Skills dùng để planning, không authorize provision/deploy/install/source edit trong P6.1.
- SDK owns Firebase tokens; SQLite domain/outbox là durable local-first authority; syncEvents owns authoritative event writes.
- Membership documents owns room access; Admin SDK bypass Rules nên callable vẫn tự authorize.
- Grace 3 giây theo ADR-008; Local/Server Premium riêng theo ADR-007.
- Integer VND/rounding theo ADR-005; không custody/automatic bank verification.
- Không làm post-MVP hoặc exclusions để lấp thiếu UI mock.
- Không invent credentials/resources/approval/test results; thiếu device/runtime thì ghi unverified.
- Không tự merge ref khác, đổi branch, hoặc replace approved plan.

## 6. EXPECTED OUTPUT

Single mode: một plan reviewable, đủ metadata, sources, goal/scope/non-goals, affected boundaries/files, dependency/blocker, ordered tasks/behavior, specific cases/commands, demonstration và approval gate.

Batch mode: một file riêng từng slice và index liên kết; mỗi plan có cùng metadata/status conventions nhưng nội dung behavior/tests riêng. Highlight blocked plans, shared ownership, conditional release dependencies; không báo tất cả plans execution-ready.

Không có evidence là UNVERIFIED. DRAFT không đồng nghĩa Approved hoặc Implemented. Approving one slice không approve toàn bộ batch.

## 7. SAVE / UPDATE + HUMAN REVIEW + VALIDATION

- Default pending approval: draft trong chat. **Chỉ lưu file draft trước approval khi human đã yêu cầu tạo/lưu draft**, ghi DRAFT và authorization provenance rõ; vẫn không tạo canonical P6.0 backlog nếu chưa được duyệt.
- Sau explicit plan approval: lưu/update đúng plan cùng approval date/evidence và index, preserve prior decisions/history.
- File slug giữ date + slice ID; future task commits dùng prefix slug và Plan/Task trailers. Authoring batch không tự thực hiện các task trong kế hoạch.
- Kiểm links resolve, đủ fields/tasks/cases, IDs unique/dependencies acyclic; source unaffected; undefined scope không bị tự lấp.
- Report paths và blockers, dừng để human review. Chỉ dùng executing-plans khi human yêu cầu implement plan đã approved; không tự chạy P6.2 hoặc provision/release.
