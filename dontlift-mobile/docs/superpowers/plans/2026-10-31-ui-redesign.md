# Kế hoạch triển khai redesign UI DontLift

> Người thực thi: dùng skill `qskill-executing-plans`, hoàn thành từng task và đánh dấu checkbox. Đọc source thực tế trước khi sửa; tài liệu này mô tả phạm vi, giao diện component và tiêu chí nghiệm thu, không chứa code triển khai.

**Mục tiêu:** Giao diện hiện đại, nhất quán, dễ sử dụng cho ứng dụng đặt điện thoại xuống để tập trung và kết nối nhóm; hỗ trợ iOS và Android.

**Kiến trúc:** Giữ controller/repository hiện có làm chủ nghiệp vụ và dữ liệu. Chuẩn hóa component dùng chung và theme trước, sau đó chuyển từng luồng sang thiết kế mới. Chất liệu glass thích ứng nền tảng; các màn hình sử dụng cùng hợp đồng component.

**Stack:** Expo 57, React Native, TypeScript, StyleSheet/NativeWind hiện có, Reanimated, expo-glass-effect, expo-blur, react-native-svg.

**Nguồn thiết kế:** `docs/product-design.md`, `design/concepts/concept-final/decision-packet.md`, yêu cầu redesign glass/iOS 26+ trong cuộc trao đổi ngày 2026-10-31. Các thay đổi thị giác và điều hướng dưới đây là đề xuất cần chốt bằng reference ở task 1, chưa thay thế tài liệu đã duyệt.

**Plan slug:** `2026-10-31-ui-redesign`.

## Ràng buộc chung

- DontLift là ứng dụng phone-down focus và trách nhiệm nhóm, không phải ứng dụng tập thể dục. Hình ảnh, nội dung và chuyển động phải phục vụ mục đích này.
- Giữ nguyên quy tắc cảm biến, grace period 3 giây, khôi phục nền, offline/outbox, phân quyền Host/Member, đối soát điểm, chia tiền và Premium theo các ADR hiện hành, đặc biệt ADR-025.
- Không thêm Zustand trong đợt redesign. Auth tiếp tục dùng `AuthSessionProvider`; SQLite/Firebase và repository vẫn là nguồn dữ liệu. Form và trạng thái mở panel giữ cục bộ.
- Không chuyển toàn bộ navigation sang Expo Router đồng thời với redesign. Giữ `ScreenId` và các guard hiện tại; migration routing/state là công việc riêng nếu sau này được yêu cầu.
- Không thay dependencies chỉ để đổi style. Nếu thật sự cần thêm thư viện, giải thích và đồng bộ cả hai lockfile theo AGENTS.md.
- Token là nguồn duy nhất cho màu, typography, spacing, radius, elevation và motion. Component đọc theme hiện tại, không khóa `Colors.light`.
- iOS 26+ dùng native glass khi API khả dụng; iOS cũ dùng blur; Android dùng blur có giới hạn hoặc nền có màu đủ độ tương phản. Không dựa chỉ vào số phiên bản OS. Tôn trọng Reduce Transparency và Reduce Motion.
- Glass dành cho navigation/điều khiển nổi; nội dung và dữ liệu dài dùng surface dễ đọc. Không lồng nhiều lớp glass.
- Target chạm tối thiểu 48dp cho action chính, tối thiểu 44dp cho action phụ; tương phản chữ thường tối thiểu 4.5:1. Hỗ trợ cỡ chữ hệ thống, safe area và bàn phím.
- Bản đề xuất dùng tiếng Việt nhất quán cho UI. Giữ nguyên tên sản phẩm, mã PIN, memo thanh toán và chuỗi thuộc hợp đồng nghiệp vụ.

## Phân chia file và trách nhiệm

| File/thư mục | Trách nhiệm |
|---|---|
| `src/constants/theme.ts`, `src/hooks/use-theme.ts` | Token semantic, theme sáng/tối |
| `src/components/Surface.tsx` | Surface nội dung, blur và native glass có fallback |
| `src/components/AppText.tsx`, `TextField.tsx`, `StatusBadge.tsx`, `StatePanel.tsx`, `ScreenContainer.tsx` | Typography, input, trạng thái, layout |
| `src/components/Skeleton.tsx` | Placeholder skeleton cho vùng dữ liệu đang tải |
| `src/components/PrimaryButton.tsx` | Button thống nhất, pending/disabled/pressed |
| `src/components/Header.tsx`, `BottomNav.tsx` | Điều hướng và hành động toàn app |
| `src/components/GlassCard.tsx`, `GlassPill.tsx` | Adapter tạm trong quá trình chuyển caller; xóa khi không còn caller |
| `src/features/solo/components/`, `src/features/rooms/components/` | UI riêng theo domain, không chứa sensor/persistence |
| `src/screens/` | Ghép component và kết nối các props nghiệp vụ hiện có |
| `src/app/index.tsx` | Tích hợp shell và navigation; không di chuyển controller trong đợt này |
| `design/concepts/redesign-2026-10/` | Reference và quyết định mới; giữ nguyên reference cũ |

## Task 1 — Chốt reference và trạng thái cần thiết kế

**File:** tạo `design/concepts/redesign-2026-10/design-brief.md`, `screen-state-matrix.md`, `reference-review.md` và ảnh/reference liên quan trong cùng thư mục.

- [ ] Nếu người dùng có thể chụp giao diện hiện tại, ưu tiên 5 màn: SoloSelect/Home, SoloTimer, GroupLobby, GroupActive và GroupSummary; thêm History/Payment nếu muốn redesign các luồng đó. Chụp cả trạng thái loading/error nếu có, ghi model thiết bị, kích thước màn hình và light/dark; che email, PIN, QR, tên thật và thông tin thanh toán.
- [ ] Nếu không có ảnh, dùng source và chạy app để tạo baseline; ảnh người dùng là hữu ích nhưng không bắt buộc.
- [ ] Ghi ma trận loading, empty, error, offline, pending sync, active session, Host/Member và phiên hết hạn cho từng luồng có liên quan.
- [ ] Tạo reference cho SoloSelect, SoloTimer, GroupLobby và navigation: màu tươi, trẻ trung (xanh cobalt/cyan làm màu hành động, mint cho trạng thái tích cực và coral/cam làm điểm nhấn có giới hạn), nền trung tính để giữ chữ dễ đọc, dark mode tương ứng, glass ở lớp điều khiển.
- [ ] Đưa hai đề xuất điều hướng ra so sánh: giữ Solo/Group/Pro/Account hoặc Focus/Group/History/Account và chuyển Premium vào Account. Chốt một phương án trong `reference-review.md`; trước khi chốt giữ navigation hiện tại.
- [ ] Chốt ngôn ngữ, palette, typography, radius, vị trí glass, mức animation và ví dụ skeleton bằng reference. Không dùng hình ảnh phòng gym hoặc thông điệp tập thể dục.

**Hoàn thành khi:** reference được người dùng duyệt; mọi màn hình hiện có có dòng trong ma trận. Không triển khai redesign hàng loạt trước mốc này.

## Task 2 — Token và theme sáng/tối

**File:** sửa `src/constants/theme.ts`, `src/hooks/use-theme.ts`, `src/app/_layout.tsx` khi cần kết nối theme; tạo `design/concepts/redesign-2026-10/tokens.md`.

- [ ] Giữ các key đang có để chuyển đổi dần; bổ sung semantic token cho surface, text, action, success, warning, danger, focus và disabled.
- [ ] Định nghĩa scale chữ, spacing, radius và shadow theo reference; timer/PIN dùng số có độ rộng ổn định.
- [ ] Theo theme hệ thống bằng hook hiện có; không thêm setting/persistence mới trong task này.
- [ ] Cập nhật màu StatusBar phù hợp với theme; kiểm tra nền màn hình và vùng safe area.

**Nghiệm thu:** đổi light/dark khi đang mở màn hình cập nhật đúng; chữ lớn không bị cắt; theme mới không phá caller chưa được migrate.

## Task 3 — Surface và fallback đa nền tảng

**File:** tạo `src/components/Surface.tsx`; sửa `GlassCard.tsx`, `GlassPill.tsx`, `Header.tsx`, `BottomNav.tsx`.

**Hợp đồng:** `Surface({variant: 'content' | 'overlay', children, style, ...ViewProps})` trả về React element. `content` dùng nền semantic; `overlay` tự chọn chất liệu theo khả năng hệ thống và accessibility.

- [ ] Gom kiểm tra native glass đang lặp ở ba component về Surface.
- [ ] iOS có API glass dùng native effect; iOS không hỗ trợ dùng blur với tint đủ tương phản; Android cấu hình blur đúng SDK đang cài và dùng nền có màu nếu không khả dụng.
- [ ] Khi Reduce Transparency bật, dùng surface đặc. Không để fallback thành View trong suốt khiến chữ mất nền.
- [ ] Giữ padding, radius, hit area giống nhau giữa các nền tảng; adapter GlassCard chuyển sang content surface để không phủ Liquid Glass toàn bộ dữ liệu.

**Nghiệm thu:** ảnh so sánh iOS cũ/iOS 26+/Android; text vẫn đọc được trên nền sáng, tối và nhiều chi tiết; không double padding hoặc mất layout do wrapper thêm vào.

## Task 4 — Bộ component dùng chung

**File:** sửa `PrimaryButton.tsx`; tạo `AppText.tsx`, `TextField.tsx`, `StatusBadge.tsx`, `StatePanel.tsx`, `ScreenContainer.tsx`.

**Hợp đồng:** AppText nhận variant title/body/caption/metric và TextProps; PrimaryButton giữ props hiện tại, thêm loading; TextField nhận label/error/hint và TextInputProps; StatusBadge nhận label/tone; StatePanel nhận title/message/tone và action tùy chọn; ScreenContainer nhận children/scrollable và props layout; Skeleton nhận variant text/row/card/circle cùng kích thước cần thiết.

- [ ] Button có pressed, disabled, loading, icon và accessibilityState; pending không gửi lặp action.
- [ ] Input có label luôn thấy, helper/error, focus state, secure entry và keyboard phù hợp; lỗi gắn với trường tương ứng.
- [ ] Badge truyền nghĩa bằng chữ/icon cùng màu. StatePanel hiển thị hành động retry chỉ khi caller cung cấp.
- [ ] Skeleton dùng màu surface và highlight theo theme, không nhấp nháy mạnh; hỗ trợ Reduce Motion bằng placeholder tĩnh.
- [ ] Dùng skeleton ở vùng tải dữ liệu có bố cục dự đoán được như history, danh sách thành viên, summary/settlement và profile. Giữ spinner hoặc trạng thái pending trên nút cho thao tác gửi/lưu ngắn để không làm người dùng tưởng nội dung đã tải xong.
- [ ] ScreenContainer xử lý inset, padding và bàn phím, không bọc ScrollView bên ngoài FlatList.
- [ ] Chuyển một màn đơn giản sang bộ component để xác nhận hợp đồng trước khi migrate toàn app; bỏ props styling không có tác dụng sau khi kiểm tra caller.

**Nghiệm thu:** các trạng thái có ảnh mẫu; skeleton gần với bố cục thật, không làm nhảy layout khi dữ liệu về; tên dài/cỡ chữ lớn không mất nội dung; button disabled/pending không kích hoạt action.

## Task 5 — Shell, header và navigation

**File:** sửa `Header.tsx`, `BottomNav.tsx`, `src/app/index.tsx`, `src/constants.ts`, `src/types.ts` nếu phương án task 1 cần destination mới.

- [ ] Áp dụng navigation đã chốt, label rõ và active indicator thống nhất; giảm chiều cao header trang trí để tăng chỗ cho nội dung.
- [ ] Nếu chọn tab History, tạo `src/screens/HistoryHubScreen.tsx` cho hai điểm vào Solo/Group history hiện có, không hợp nhất repository.
- [ ] Màn active session giảm chrome theo reference nhưng vẫn có đường quay về và tiếp tục phiên; kiểm tra Android Back và guard settlement hiện tại.
- [ ] Giữ runtime session/listener sống khi chuyển màn; không gắn vòng đời sensor với component mới bị mount/unmount.

**Nghiệm thu:** từ mọi destination đều đi tới được luồng hiện có; Back đúng; đổi tab không hủy/khởi tạo lại session; Profile vẫn mở được Premium.

## Task 6 — Solo: chọn phiên, đang tập trung, tổng kết

**File:** sửa `SoloSelectScreen.tsx`, `SoloTimerScreen.tsx`, `SoloSummaryScreen.tsx`, `SensorAvailabilityPanel.tsx`; tạo `src/features/solo/components/TimerDial.tsx`, `SessionMetric.tsx`.

**Hợp đồng:** TimerDial nhận displayedSeconds/progress/status; chỉ render, không tạo timer nghiệp vụ. SessionMetric nhận label/value/tone.

- [ ] SoloSelect ưu tiên thời lượng, mode và Start; phiên đang chạy có Resume rõ ràng. History là action phụ.
- [ ] Sensor thiếu/quyền bị từ chối giữ đúng chặn bắt đầu và action khắc phục; không dùng animation để che trạng thái lỗi.
- [ ] SoloTimer có timer lớn, trạng thái phone-down, grace và violation phân biệt rõ; giảm chuyển động trong phiên vì người dùng cần đặt máy xuống.
- [ ] Giữ tách biệt hoàn thành/lưu phiên với hủy; không đổi semantics của callback hiện tại.
- [ ] Summary ưu tiên thời gian tập trung và kết quả; ghi rõ lưu local/thời điểm sync, retry không tạo summary trùng.
- [ ] Khi khôi phục session hoặc tải dữ liệu summary, dùng skeleton theo đúng bố cục cuối; khi đang hoàn tất/lưu session vẫn giữ pending feedback của action.

**Nghiệm thu:** countdown, stopwatch, grace dưới/trên 3 giây, mất sensor, background/recovery, finish lỗi lưu và pending sync vẫn biểu diễn đúng.

## Task 7 — Group: tạo/tham gia và lobby

**File:** sửa `GroupLobbyScreen.tsx`, `JoinRoomScreen.tsx`, `RoomInvitationQr.tsx`; tạo `src/features/rooms/components/MemberRow.tsx`.

**Hợp đồng:** MemberRow nhận displayName/role/status/isSelf và trailing content tùy chọn; không tự lấy dữ liệu.

- [ ] Khi chưa có phòng, phân biệt rõ Create và Join; khi đã có phòng ưu tiên PIN/QR và danh sách thành viên.
- [ ] Form PIN, scanner và thông báo lỗi có hierarchy thống nhất; giữ hỗ trợ invitation hiện tại, bao gồm PIN legacy.
- [ ] Host có Start với pending state; Member thấy trạng thái chờ, không thấy action Host.
- [ ] Hiển thị mất kết nối, room đầy và quota rõ ràng; QR có nền trắng và quiet zone.
- [ ] Khi chờ listener tải roster, hiển thị skeleton các dòng thành viên; giữ trạng thái pending trên nút tạo/tham gia.

**Nghiệm thu:** PIN sai, quyền camera bị từ chối, join pending, share invitation, tên thành viên dài và chuyển trạng thái phòng không mất đường thao tác.

## Task 8 — Group đang hoạt động và kết thúc

**File:** sửa `GroupActiveScreen.tsx`, `GroupSummaryScreen.tsx`; tái sử dụng MemberRow/StatePanel/StatusBadge.

- [ ] Ưu tiên thời gian và trạng thái chính; leaderboard dễ đọc, không animation đổi vị trí liên tục gây phân tâm.
- [ ] Early exit và vote nằm trong khu vực rõ ràng; giữ xác nhận, thời hạn vote và điều kiện theo role.
- [ ] Summary phân biệt đang chờ sync với điểm đã khóa; Host override có giải thích hậu quả trước xác nhận.
- [ ] Khi chờ snapshot/reconciliation, dùng skeleton cho timer/roster/summary; không thay cảnh báo offline hoặc lỗi bằng skeleton vô hạn.
- [ ] Chỉ mở settlement khi guard nghiệp vụ hiện có cho phép; không dùng nút nhìn enabled nhưng bị chặn âm thầm.

**Nghiệm thu:** Host/Member, offline, early exit, vote timeout, pending reconciliation và override có trạng thái và action đúng.

## Task 9 — Thanh toán và chia hóa đơn

**File:** sửa `SettlementDetailsScreen.tsx`, `BillAllocationScreen.tsx`, `VietQRSettlementScreen.tsx`, `HistoryPaymentScreen.tsx`.

- [ ] Trình bày các bước sau tổng kết: thông tin nhận tiền, hóa đơn/phân bổ, thanh toán; Member chỉ thấy bước hợp lệ với quyền của mình.
- [ ] Tổng tiền và phần của người dùng nổi bật; lỗi số tiền nằm cạnh input; phân biệt chưa publish, đang gửi và đã xác nhận.
- [ ] Giữ trạng thái khóa override sau thanh toán, revision và receipt theo domain hiện có.
- [ ] QR nền trắng, amount/recipient/memo rõ; phần bằng 0, thông tin hết hạn và bill chưa xác nhận không xuất hiện QR trả tiền.
- [ ] Phân biệt Host đánh dấu đã trả với xác nhận tự động từ ngân hàng; không dùng lời hứa tự động đối soát.
- [ ] Khi tải bill, bank directory, payment details hoặc QR metadata, skeleton giữ chỗ cho vùng dữ liệu; lỗi/hết hạn chuyển sang StatePanel có hướng xử lý.

**Nghiệm thu:** dữ liệu hợp lệ/sai, offline, retry, pending publication, zero share và recipient hết hạn không gây thao tác thanh toán sai.

## Task 10 — Login, History, Account, Settings và Premium

**File:** sửa `LoginScreen.tsx`, `HistoryScreen.tsx`, `GroupHistoryScreen.tsx`, `ProfileScreen.tsx`, `SettingsScreen.tsx`, `PremiumScreen.tsx`, `HardwareDiagnosticsScreen.tsx`, `ControlDeckDrawer.tsx` nếu còn caller.

- [ ] Login thống nhất form, keyboard, loading và recovery state; không thêm tính năng auth ngoài phạm vi.
- [ ] History có list item rõ ngày/thời lượng/kết quả, empty và retry; giữ FlatList và pagination hiện có.
- [ ] History/profile/premium dùng skeleton cho lần tải dữ liệu ban đầu theo đúng khung nội dung; các thao tác đăng nhập/lưu/mua vẫn có trạng thái pending trên action.
- [ ] Profile và Settings nhóm nội dung theo nhiệm vụ; save pending/error rõ, thay đổi hiển thị tên vẫn theo repository hiện tại.
- [ ] Premium phản ánh gói có thời hạn và trạng thái đơn payOS theo ADR-025; không hồi sinh lifetime/activation code cũ.
- [ ] Diagnostics giải thích trạng thái sensor bằng ngôn ngữ người dùng; thông tin kỹ thuật đặt trong phần chi tiết.
- [ ] Kiểm tra caller của component cũ trước khi xóa; không duy trì hai hệ thống button/surface sau migration.

**Nghiệm thu:** toàn bộ màn hình trong ma trận task 1 dùng cùng hệ thống; nội dung không trộn tiếng Anh/Việt ngoài tên và chuỗi hợp đồng cần giữ.

## Task 11 — Motion và accessibility

**File:** tạo `src/hooks/use-motion-preference.ts`; cập nhật token motion và các component/màn hình đã migrate.

- [ ] Đọc Reduce Motion; microinteraction nút phản hồi nhanh, chuyển panel có hướng rõ; khi giảm chuyển động thì loại bỏ spring/scale không thiết yếu.
- [ ] Native glass dùng cơ chế animation phù hợp API đang cài; không áp dụng fade opacity chung nếu khiến glass mất render.
- [ ] Celebration ngắn chỉ khi hoàn tất phiên; không loop nền trong active session. Haptic tuân theo feedback-service và settings hiện có.
- [ ] Kiểm tra VoiceOver/TalkBack: thứ tự đọc, label, selected/disabled/busy và thông báo trạng thái; không đọc timer mỗi giây gây nhiễu.

**Nghiệm thu:** interaction không đợi hiệu ứng để thực thi; animation không ghi đè thời gian nghiệp vụ; chế độ giảm chuyển động vẫn truyền đạt đủ trạng thái.

## Task 12 — Nghiệm thu và cập nhật tài liệu

**File:** tạo `docs/reviews/2026-10-31-ui-redesign-validation.md`; cập nhật phần UI của `docs/product-design.md` sau khi thiết kế mới được duyệt.

- [ ] Chạy `pnpm exec tsc --noEmit` và `pnpm run lint`; chạy test hiện có liên quan đến flow đã chạm bằng `pnpm test -- --runInBand` hoặc tập test cụ thể.
- [ ] Chỉ thêm test cho hành vi mới cần bảo vệ: chọn surface theo khả năng/accessibility, button pending, navigation nếu đổi mapping; không tạo snapshot chỉ sao chép implementation.
- [ ] Kiểm tra iOS dưới 26 trong phạm vi deployment target, iOS 26+ và Android hiện hành; nếu target hỗ trợ Android cũ hơn 12, kiểm tra riêng fallback không blur.
- [ ] Chụp cùng màn hình ở light/dark, màn hẹp, text lớn, keyboard mở, reduced motion/transparency; kiểm tra contrast và hit area.
- [ ] Chụp trạng thái skeleton, loaded, empty và error cạnh nhau để xác nhận skeleton không thay nhầm trạng thái empty/lỗi/offline.
- [ ] Kiểm tra session trên máy thật: bắt đầu, đặt máy xuống, nhấc máy, background, quay lại, hoàn thành, offline rồi reconnect. Cảm biến không được xem là đạt chỉ bằng simulator.
- [ ] Đo cuộn và chuyển màn bằng bản build gần production trên thiết bị đã ghi rõ; giảm lớp blur nếu frame time tăng rõ khi mở navigation hoặc danh sách.
- [ ] Ghi kết quả đạt/chưa đạt, thiết bị, ảnh và blocker. Thiếu iPhone/máy Android thật phải ghi chưa kiểm chứng, không đánh dấu pass.
- [ ] Cập nhật reference mới, quyết định navigation và danh sách component; giữ reference cũ làm lịch sử.

**Hoàn thành khi:** toàn bộ task và trạng thái trong ma trận đã có bằng chứng kiểm tra, không còn caller của component đã bỏ, không thay đổi nghiệp vụ ngoài thiết kế được duyệt.

## Thứ tự và mốc review

1. Task 1 chốt reference trước khi triển khai UI.
2. Task 2–4 tạo nền dùng chung; task 5 tích hợp shell.
3. Task 6 là lát cắt đầu tiên để review trên máy thật; chỉnh hệ thống trước khi tiếp tục task 7–10.
4. Task 11 hoàn thiện motion; task 12 nghiệm thu toàn luồng. Accessibility cơ bản được thực hiện ngay trong từng task, không để đến cuối mới thêm.

Sau mỗi task triển khai: chạy kiểm tra phù hợp, review diff và commit riêng với subject `[2026-10-31-ui-redesign] <mô tả thay đổi>`; body chứa `Plan: docs/superpowers/plans/2026-10-31-ui-redesign.md` và `Task: <số>`. Chỉ stage file thuộc task.

## Ngoài phạm vi đợt này

- Thêm Zustand/TanStack Query hoặc thay storage.
- Di chuyển toàn bộ controller khỏi index.tsx, viết lại routing hoặc backend.
- Thêm tính năng tập thể dục, streak mới, khóa OS, quyền hạn mới hoặc thay cách tính điểm/tiền.
- Thêm tab History hoặc đổi ngôn ngữ trước khi phương án đó được chốt ở task 1.
