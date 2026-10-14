# Kế hoạch triển khai P6.1 — SL-002: Development runtime cho Firebase

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Human đã duyệt riêng Android development execution ngày 2026-10-14; không mở rộng sang production deployment, các slice khác hoặc nghiệm thu iOS chưa kiểm chứng.

**Mục tiêu:** Native Auth/Firestore/Functions runtime trong Development Build dùng Firebase cloud config hiện có đã được human chọn; Functions region `asia-southeast1`. Emulator là mode lựa chọn rõ ràng; callable handshake chỉ nghiệm thu sau backend bootstrap SL-003.

**Slice:** SL-002. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED AND COMPLETE FOR ANDROID DEVELOPMENT — iOS device verification remains deferred; full cross-platform verification is not claimed.
**Approval evidence:** Human đã chọn React Native Firebase, reuse `.env.local` và `firebase-config/` để Android/iOS cùng dùng database hiện có; tạm hoãn kiểm thử iOS khi không có Mac/iPhone; ngày 2026-10-14 trả lời “ok run” sau đề xuất hoàn thiện Firebase runtime. Quyết định này supersede emulator-only scope của draft; không phê duyệt toàn bộ P6.0 hoặc production.
**Trạng thái implementation quan sát:** Android development scope COMPLETE: APK build/cài/mở thành công; native Auth/Firestore/Functions clients khởi tạo đúng cloud project; Firestore probe trả `server-reached-access-denied` khi signed-out, xác nhận server reachability và Rules production chặn unauthenticated read như dự kiến. 24 focused tests, 25 full Jest tests và TypeScript pass. Probe ban đầu trả `invalid-argument` do fixture ID khớp reserved pattern `__.*__`; source/test đã sửa. Database `(default)` Standard/Singapore đã được xác nhận trong Cloud Console. iOS device verification deferred và Emulator Suite vẫn UNVERIFIED; full cross-platform verification chưa được claim. Evidence ở `docs/firebase-emulators.md`.
**Baseline execution:** feature/sl-002-native-firebase-runtime tại 786261c069f32f9ae335f57ba92074a25e9a3f2d. Baseline authoring ban đầu: 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-002-native-firebase-runtime`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-002-native-firebase-runtime]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** ADR-001/006; ARCH §11.
**Phụ thuộc bắt buộc:** [SL-001](./2026-10-13-sl-001-test-foundation.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** Firebase runtime adapter sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** Deploy production, toàn bộ callable, billing và provision ngoài quyền đã được cấp.

## 2. Blocker, risk và quyết định cần duyệt

- **D1 development:** Human đã chọn bộ Firebase config hiện có cho development. Native project phải khớp expected project từ env. Production vẫn cần project/config riêng theo ADR-006; release chưa cấu hình phải fail closed.
- **E1 Android:** Có physical Android device, Android SDK và JDK của Android Studio. Native integration evidence phải lấy từ APK có đầy đủ SDK.
- **E1 deferred/unverified:** iOS Pods/build/run tạm hoãn theo lựa chọn human; actual Emulator Suite và metadata edition/location cloud chưa có evidence. ADR-006 quy định Standard/Singapore; Functions region client không chứng minh location database thực tế.

**Rủi ro cụ thể:** JDK 25 cần native-access flag cho tiến trình build; Windows dùng persistent pnpm hoisted layout để tránh CMake long paths. iOS config inspection không thay thế actual device evidence.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `firestore.emulator.rules` | SL-002 tạo local deny-by-default Rules cho Emulator Suite; slice đọc resource sở hữu phần allowlist mở rộng. |
| `functions/tests/helpers/rules-emulator.cjs` | Đường dẫn helper dùng về sau, được backend bootstrap SL-003 tạo; SL-002 không phụ thuộc backend chưa có. |
| `package-lock.json` | Ownership cùng package.json: giữ đồng bộ npm dependency resolution khi manifest thay đổi, theo AGENTS. |
| `pnpm-lock.yaml` | Ownership cùng package.json: giữ đồng bộ pnpm dependency resolution; không commit một lockfile lệch manifest. |
| `app.json` | Configuration theo quyền và version thực tế; đọc trước chỉnh. |
| `pnpm-workspace.yaml` | Hoisted layout ổn định cho pnpm/native Windows build; quyết định install-script allowance rõ ràng. |
| `assets/splashscreen.xml` | Drawable splash không logo để thay tham chiếu template ảnh bị thiếu; branding cuối chưa được nghiệm thu. |
| `package.json` | Configuration theo quyền và version thực tế; đọc trước chỉnh. |
| `src/features/auth/firebase-adapters.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/auth/firebase-runtime-config.ts` | Kiểm tra platform/mode/project, production isolation và explicit emulator host/ports. |
| `src/app/_layout.tsx` | Caller startup thực tế; native init và safe development diagnostics, không implement auth journey. |
| `firebase.emulator.json` | Configuration theo quyền và version thực tế; đọc trước chỉnh. |
| `docs/firebase-emulators.md` | Evidence hoặc hướng dẫn thực thi sau approval; không được ghi claimed pass thiếu bằng chứng. |
| `__tests__/native-firebase-runtime.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |
| `__tests__/native-firebase-adapters.test.ts` | Native client boundary, emulator routing, timeout/offline và diagnostics không leak. |

**Unit:** Firebase runtime adapter.
**Nhận:** Development project/config được human xác nhận, platform và emulator host.
**Trả:** Native Auth/Firestore client và Functions client initialization trên đúng môi trường hoặc configuration error rõ ràng.
**Đầu vào từ dependency:** capabilities/records/commands đã nghiệm thu theo các plan liên kết; chưa có dependency output thì không giả coi integration có thật.
**Đầu ra cho slice sau:** outcome và invariants trong mục tiêu/nghiệm thu dưới đây; tên internal unit là đề xuất, wire names chỉ dùng theo API/ADR đã duyệt.

## 4. Ràng buộc xuyên suốt

- Giữ approved architecture; newer human decisions và accepted ADR exceptions thắng prose cũ.
- Không sao chép Firebase token vào SQLite, AsyncStorage hoặc SecureStore; SDK quản lý session.
- Event offline-capable dùng SQLite domain record và sync_outbox trong một transaction; syncEvents là ingestion authority.
- Command lifecycle/vote/bill/payment không queue để replay muộn. Firestore cache không thay thế outbox.
- Membership authority là rooms/{roomId}/members/{uid}. Functions derive actor từ Auth và tự authorization; Admin SDK bypass Rules.
- Giữ 3-Second Grace Period ở cả foreground/background theo ADR-008.
- Local Premium không cấp server quota/capacity; chỉ verified Server Premium cấp server benefits.
- Bill dùng integer VND, deterministic residual và tổng exact theo ADR-005; VietQR non-custodial, không bank polling.
- UI dùng semantic tokens và accepted Liquid Acrylic; loading/empty/error/offline/syncing, labels, safe areas và touch targets được kiểm chứng khi phù hợp.
- Không thêm social login, analytics dashboards, kiosk, wallet, chat, AI coaching hoặc camera-based detection vào MVP.
- Native dependencies/build đã được human cho phép trong execution SL-002; không provision/deploy/publish hoặc thay credentials/project ngoài scope này.

### Ownership môi trường local

SL-002 sở hữu native Firebase dependencies/config, root manifest và hai lockfiles, Auth/Firestore emulator routing cùng `firestore.emulator.rules` deny-by-default. `firebase.emulator.json` ở giai đoạn này chỉ trỏ tài nguyên local đã tồn tại; không bắt Functions emulator discovery khi `functions/package.json` chưa được SL-003 tạo.

Không tạo backend manifest hoặc deploy canonical config tại đây. SL-003 thêm backend source/runtime vào emulator config rồi thu callable handshake. Canonical `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json` tiếp tục deferred tới SL-037 và các điều kiện D1/E2.

- [ ] Local Rules mặc định deny mọi client read/write; không thêm allow-all để chứng minh kết nối.
- [ ] Manifest native thay đổi → cả package-lock.json và pnpm-lock.yaml cùng được cập nhật và kiểm tra.
- [ ] Chưa có Functions package → native initialization vẫn kiểm chứng được; không claim callable chạy thành công.
- [ ] Helper/dependencies cho Rules tests được SL-003 cấp trước khi slice resource thực hiện emulator verification.

## 5. Các task thực hiện sau approval

### Task 1 — Boundary và quy tắc của Development runtime cho Firebase

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Development project/config được human xác nhận, platform và emulator host; trả Native Auth/Firestore client và Functions client initialization trên đúng môi trường hoặc configuration error rõ ràng. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [ ] Development mode → adapters dùng host và region đã chọn.
- [ ] Sai hoặc thiếu native config → không truy cập production.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Reuse cloud development config đã được human chọn; emulator chỉ dùng khi mode/host/ports được cấu hình rõ. Không tạo project, fallback environment hoặc dùng cùng project cho development và production.
2. Kết nối native modules và region asia-southeast1; chọn host phù hợp simulator/device.
3. Cấu hình iOS linkage theo phiên bản RNFirebase, đối chiếu SDK 57 docs; giữ secrets ngoài Git.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-002-native-firebase-runtime]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-002-native-firebase-runtime.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Release chưa cấu hình backend → báo lỗi an toàn, không tự dùng emulator.
- [ ] Host emulator trên thiết bị thật → kết nối được theo LAN/USB setup đã duyệt.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Tạo Development Build theo setup đã được duyệt; Expo Go không phải runtime kiểm chứng.
2. Mở app trên Android thật và kiểm tra diagnostics đúng project/mode/region; iOS build/run được human tạm hoãn và ghi UNVERIFIED.
3. Development read-only server probe: đọc current user document nếu có native session, hoặc ID fixture không tồn tại trong `users` khi signed out. Không tạo user/document, không đọc collection, không in document content. Permission-denied chỉ chứng minh server reached; lỗi/offline/timeout không báo authorized/success và có thể thử lại qua reload.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-002-native-firebase-runtime]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-002-native-firebase-runtime.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Development mode → adapters dùng host và region đã chọn.
- [ ] Sai hoặc thiếu native config → không truy cập production.
- [ ] Release chưa cấu hình backend → báo lỗi an toàn, không tự dùng emulator.
- [ ] Host emulator trên thiết bị thật → kết nối được theo LAN/USB setup đã duyệt.
- [ ] Chạy native Development Build Android dùng cloud config đã chọn → có evidence native Auth/Firestore/Functions initialization và Firestore server probe. Đây không phải nghiệm thu registration/login hoặc token persistence; Functions callable handshake thuộc SL-003.
- [ ] Actual Emulator Suite integration và iOS build/run vẫn UNVERIFIED; mocked routing không thay thế native evidence.
- [ ] Đọc project/region từ diagnostics an toàn → đúng environment; không in token/config bí mật.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

App focused tests: `pnpm test --runTestsByPath __tests__/native-firebase-runtime.test.ts __tests__/native-firebase-adapters.test.ts --runInBand`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế. Execution commands/device evidence ở `docs/firebase-emulators.md`.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Ngày 2026-10-14: configuration tests đã RED trước implementation rồi GREEN; 23 focused cases và TypeScript đạt. Device integration với APK mới chưa được tick trước khi có log thực tế.

## 8. Human review và bàn giao P6.2

Human đã duyệt execution scope mới của **SL-002** trong approval evidence phía trên. Duyệt một slice không duyệt tất cả 37. Chỉ gọi Android development milestone hoàn thành sau actual native evidence; full cross-platform SL-002 vẫn cần đóng iOS/native integration gaps hoặc approval riêng thay đổi acceptance.

Execution dùng qskill-executing-plans trên branch hiện tại. SL-003 nhận clients/config boundary và local emulator baseline; backend/helper/Functions discovery/callable handshake thuộc SL-003. Không tự bắt đầu slice tiếp theo.
