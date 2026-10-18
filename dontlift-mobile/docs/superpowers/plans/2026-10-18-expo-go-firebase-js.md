# Migration đã được duyệt: Expo Go + Firebase JS SDK + Cloud Spark

User approval: 2026-10-18, giữ project august-monument-508716-u0. Không commit khi chưa được yêu cầu.

1. Thay RN Firebase bằng Firebase JS SDK, giữ SDK-managed Auth persistence và các controller hiện có.
2. Tạo Web App config thực tế trong project, lưu ở .env.local; cloud mặc định.
3. Thay callable profile bằng create-only transaction, server timestamps và Rules khóa owner/field/Premium; giữ retry/recovery và SQLite projection.
4. Đổi pnpm run dev sang Expo Go LAN; giữ emulator tùy chọn riêng cho validation.
5. Loại bỏ code Functions đã được thay thế, cập nhật test/lockfiles và ghi ADR supersession.
6. Chạy typecheck, regression tests, local Rules/integration tests và bundle Android/iOS. Đọc Rules cloud hiện có trước khi deploy đúng project. Không tạo tài khoản cloud thử nghiệm.

Room realtime thuộc các slice room tiếp theo; không mở quyền room hoặc làm lại UI trong migration này.

## Validation 2026-10-18

- TypeScript: passed. Jest: 9 suites / 62 tests passed, including SL-006 SQLite/session regression.
- Auth/Firestore emulator: 8 integration/Rules tests passed using demo project; actual JS profile transaction tested, including concurrent retry and Premium preservation.
- Android and iOS Metro exports: passed. Live Expo Go Android manifest and dev bundle returned HTTP 200; bundle includes RN Auth persistence and no native Firebase imports.
- Existing cloud Rules backed up to ignored .expo storage; tested firestore.rules deployed to august-monument-508716-u0 and read-back matched source. Email/password provider confirmed enabled. No cloud test account created.
- No physical device connected: registration/login/restart/sensor behavior still needs a manual Expo Go check. Room remains prototype.
- expo install --check reports newer compatible SDK 57 patch versions; no SDK upgrade included.
- Lint had no existing configuration; Expo attempted automatic setup which failed. Those automatic dependency changes were reverted; no lint pass claimed. Clean pnpm dependency tree restored and validated afterward.
- No commit or push performed.

Live Android client later reported firebase-js / cloud / signed-out startup and server-reached-access-denied, confirming runtime/cloud reachability before login. Full registration/login/restart and physical sensor checks remain manual. Metro left running in Expo Go mode for the user.
