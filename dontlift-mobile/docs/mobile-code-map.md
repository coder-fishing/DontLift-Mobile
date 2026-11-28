# Bản đồ mã nguồn mobile

Tài liệu này liệt kê mã nguồn trong src theo thứ tự thư mục từ lớn đến nhỏ. Mô tả vai trò được rút gọn để tra cứu nhanh; với các file có tên chuyên biệt, hãy xem phần export trong file để biết chi tiết hành vi.

## src/ (gốc)
- constants.ts — hằng số ứng dụng.
- global.css — CSS toàn cục/NativeWind.
- nativewind-env.d.ts, styles.d.ts — khai báo kiểu môi trường và style cho TypeScript.
- types.ts — kiểu dữ liệu dùng chung, gồm định danh màn hình.

## src/app/ — route và điều phối
- _layout.tsx — layout gốc và cấu hình Expo Router.
- index.tsx — màn hình gốc, khôi phục auth, khởi tạo dịch vụ và điều phối các luồng/màn hình.

## src/screens/ — màn hình ứng dụng
- BillAllocationScreen.tsx — phân bổ hóa đơn, chỉnh phần chia, scan/chứng từ.
- GroupActiveScreen.tsx — phiên nhóm đang chạy.
- GroupHistoryScreen.tsx — lịch sử nhóm và chi tiết thanh toán.
- GroupLobbyScreen.tsx — phòng chờ, thành viên, bắt đầu/rời phòng.
- GroupSummaryScreen.tsx — tổng kết phiên nhóm.
- HardwareDiagnosticsScreen.tsx — chẩn đoán phần cứng/cảm biến.
- HistoryPaymentScreen.tsx — thông tin thanh toán mở từ lịch sử.
- HistoryScreen.tsx — lịch sử phiên cá nhân.
- JoinRoomScreen.tsx — tham gia phòng bằng PIN/QR.
- LoginScreen.tsx — đăng nhập, đăng ký, hồ sơ ban đầu.
- PremiumScreen.tsx — gói Premium và quy trình thanh toán.
- ProfileScreen.tsx — xem/sửa hồ sơ và avatar.
- SettingsScreen.tsx — cài đặt ứng dụng/feedback.
- SettlementDetailsScreen.tsx — thông tin nhận tiền của Host.
- SoloSelectScreen.tsx — chọn thời lượng phiên cá nhân.
- SoloSummaryScreen.tsx — tổng kết phiên cá nhân và đồng bộ.
- SoloTimerScreen.tsx — phiên cá nhân đang chạy.
- VietQRSettlementScreen.tsx — QR chuyển khoản và trạng thái thanh toán.

## src/components/ — UI dùng lại
- AppBackground.tsx — nền ứng dụng.
- BottomNav.tsx — điều hướng dưới.
- ControlDeckDrawer.tsx — ngăn điều khiển.
- CustomDurationSlider.tsx — chọn thời lượng.
- GlassCard.tsx, GlassPill.tsx — khung và nhãn kiểu glass.
- GroupActionableSessionsSkeleton.tsx — trạng thái tải danh sách phiên nhóm.
- GroupHomeDashboard.tsx — dashboard nhóm.
- Header.tsx — header màn hình.
- PremiumAvatar.tsx — avatar có trạng thái Premium.
- PrimaryButton.tsx — nút chính nhiều biến thể.
- RoomInvitationQr.tsx — QR lời mời.
- RoomInviteCard.tsx — thẻ lời mời/thông tin phòng.
- RoomQrScanner.tsx — quét QR phòng.
- RoomRoster.tsx — danh sách thành viên.
- SensorAvailabilityPanel.tsx — trạng thái cảm biến.
- SoloTimerDial.tsx — mặt đồng hồ phiên cá nhân.

## src/constants/ — cấu hình
- theme.ts — màu và token giao diện.

## src/hooks/ — hook dùng chung
- use-color-scheme.ts — lấy chế độ sáng/tối.
- use-color-scheme.web.ts — phiên bản cho web.
- use-theme.ts — truy cập theme.

## src/features/ — nghiệp vụ theo miền

### auth/ — xác thực
- auth-controller.ts — lệnh/nghiệp vụ đăng nhập và đăng ký.
- auth-session-controller.ts — trạng thái phiên và hồ sơ sau xác thực.
- auth-session.tsx — React context/hook phiên đăng nhập.
- auth-validation.ts — kiểm tra dữ liệu xác thực.
- firebase-adapters.ts — adapter nghiệp vụ với Firebase.
- firebase-auth-client.native.ts, firebase-auth-client.ts — cấu hình Firebase Auth theo môi trường.
- firebase-profile.ts — hồ sơ trên Firebase.
- firebase-runtime-config.ts — cấu hình Firebase runtime.
- local-profile-repository.ts — hồ sơ lưu cục bộ.

### bank-transfer/ — khởi chạy chuyển khoản
- bank-app-directory.ts — danh mục app ngân hàng.
- BankAppPicker.tsx — UI chọn app.
- BankTransferButton.tsx — nút chuyển khoản.
- deeplink.ts — deep link ngân hàng.

### history/ — lịch sử
- group-actionable-history.ts — xác định, sắp xếp và tải các phiên nhóm còn cần người dùng xử lý.
- group-history-authority.ts — đọc trạng thái phòng và thành viên nhất quán từ Firestore.
- group-history-cache.ts — lưu snapshot phòng vào cache lịch sử cục bộ theo tài khoản.
- group-history-detail.ts — đọc và cache chi tiết phiên nhóm, roster và hóa đơn.
- group-history-model.ts — kiểu dữ liệu, kiểm tra summary, cursor và gộp lịch sử nhóm.
- group-history-page.ts — đọc và phân trang lịch sử nhóm từ local, cloud và chỉ mục phòng.
- group-history-payment.ts — theo dõi trạng thái hóa đơn và thanh toán trong lịch sử nhóm.
- group-history-refresh-policy.ts — quyết định làm mới lịch sử sau khi mạng kết nối lại.
- group-history-repository.ts — API tổng hợp, kết nối các luồng đọc và đồng bộ lịch sử nhóm.
- group-history-support.ts — context và hàm hỗ trợ đọc/kiểm tra dữ liệu lịch sử nhóm.
- group-history-sync.ts — đồng bộ summary nhóm đang chờ trong outbox lên Firestore.
- group-summary-repository.ts — tạo, lưu và khôi phục summary phiên nhóm trong SQLite/outbox.
- history-controller.ts — điều phối tải, phân trang và trạng thái màn hình History cá nhân.
- history-model.ts — kiểu dữ liệu, kiểm tra và gộp các mục lịch sử Solo.
- history-payment-state.ts — kiểu trạng thái thanh toán và trạng thái khởi tạo.
- solo-history-repository.ts — đọc lịch sử Solo từ local/cloud và lưu cache SQLite.
- use-group-history-sync.ts — tự khôi phục và thử đồng bộ summary nhóm theo mạng/vòng đời app.
- use-group-lobby-dashboard.ts — tải lịch sử gần đây, roster xem trước và phiên cần xử lý cho Group Home.

### local/ — lưu trữ cục bộ
- database.ts — kết nối SQLite.
- migrations.ts — nâng cấp schema SQLite.

### premium/ — gói Premium
- premium-api.ts — API đơn hàng/quyền Premium.
- premium-entitlement.ts — kiểm tra entitlement/thời hạn.
- use-premium-avatar.ts — hook hiển thị avatar Premium.

### profile/ — hồ sơ
- avatar-api.ts — API ảnh đại diện.
- profile-repository.ts — đọc/cập nhật hồ sơ.
- profile-save-state.ts — trạng thái/quy tắc lưu hồ sơ.

### rooms/ — phòng và phiên nhóm
- completed-group-violation-sync-retry.ts — thử đồng bộ lại vi phạm hoàn tất.
- early-exit-cleanup-retry.ts — thử dọn yêu cầu rời sớm.
- early-exit-listener.ts — lắng nghe yêu cầu rời sớm.
- early-exit-repository.ts — thao tác yêu cầu rời sớm.
- early-exit-sync-retry.ts — thử đồng bộ sự kiện rời sớm.
- group-active-domain.ts — quy tắc phiên nhóm đang chạy.
- group-capture-work.ts — theo dõi ghi nhận dữ liệu phiên.
- group-terminal-navigation.ts — điều hướng sau phiên nhóm.
- group-violation-repository.ts — ghi nhận vi phạm nhóm.
- lobby-leave-repository.ts — rời phòng chờ.
- room-completion-repository.ts — hoàn tất phiên/phòng.
- room-create-error.ts — chuyển lỗi tạo phòng thành thông báo.
- room-invite-contract.ts — cấu trúc lời mời.
- room-invite-parser.ts — phân tích PIN/QR lời mời.
- room-listener.ts — lắng nghe phòng/thành viên.
- room-liveness-repository.ts — heartbeat và tình trạng hoạt động.
- room-lobby-projection.ts — dữ liệu hiển thị lobby.
- room-repository.ts — tạo/tham gia/bắt đầu phòng.
- termination-vote-listener.ts — lắng nghe biểu quyết kết thúc.
- termination-vote-repository.ts — quản lý phiếu kết thúc phiên.

### sensors/ — cảm biến
- phone-down-engine.ts — suy luận điện thoại úp/xuống.
- sensor-adapter.ts — đọc cảm biến thiết bị.
- sensor-availability.ts — kiểm tra cảm biến khả dụng.
- use-sensor-availability.ts — hook trạng thái cảm biến.

### settings/ — cài đặt và phản hồi
- feedback-service.ts — điều phối âm thanh/rung.
- native-feedback.ts — adapter âm thanh/rung native.
- settings-repository.ts — lưu/đọc cài đặt.

### settlement/ — hóa đơn và thanh toán
- bank-directory.ts — danh mục ngân hàng.
- bill-allocation.ts — công thức chia tiền.
- bill-repository.ts — tạo/công bố/chỉnh hóa đơn.
- group-connectivity.ts — trạng thái kết nối luồng nhóm.
- payment-status-domain.ts — quy tắc trạng thái thanh toán.
- payment-status-repository.ts — cập nhật trạng thái thanh toán.
- published-bill-listener.ts — lắng nghe hóa đơn đã công bố.
- published-bill-navigation.ts — quyết định điều hướng tới hóa đơn.
- published-bill-state.ts — chọn trạng thái hóa đơn.
- receipt-evidence-api.ts — lưu/đọc chứng từ hóa đơn.
- receipt-scan-api.ts — nhận diện nội dung hóa đơn.
- settlement-details-repository.ts — thông tin nhận tiền Host.
- vietqr-payload.ts — tạo dữ liệu VietQR.
- components/AiBillScanCard.tsx — thẻ UI kết quả quét/đề xuất số tiền.

### solo/ — phiên cá nhân
- background-recovery.ts — khôi phục phiên sau khi chạy nền.
- foreground-detection-controller.ts — phát hiện trạng thái khi app foreground.
- grace-period-engine.ts — tính thời gian ân hạn.
- local-session-repository.ts — lưu phiên cục bộ.
- session-completion-controller.ts — hoàn tất phiên.
- session-controller.ts — điều phối phiên.
- session-lifecycle-controller.ts — xử lý vòng đời app/phiên.
- summary-service.ts — tạo dữ liệu tổng kết.
- violation-repository.ts — lưu vi phạm.
- hooks/use-solo-session-runtime.ts — nối nghiệp vụ phiên/cảm biến với React UI.

### sync/ — đồng bộ
- firestore-solo-sync-port.ts — adapter đồng bộ phiên lên Firestore.
- outbox-repository.ts — hàng đợi sự kiện chờ gửi.
- sync-events-port.ts — giao diện cổng đồng bộ.
- sync-worker.ts — gửi và retry sự kiện.

## src/types/
- firebase-auth.d.ts — bổ sung khai báo kiểu Firebase Auth.

Hậu tố thường gợi ý vai trò: repository là lưu/truy vấn; controller điều phối; listener theo dõi thay đổi; domain giữ quy tắc nghiệp vụ; api giao tiếp dịch vụ. Hãy mở file tương ứng để xác nhận chi tiết trước khi chỉnh sửa.

