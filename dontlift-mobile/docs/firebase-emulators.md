# Firebase development runtime — SL-002

## Scope đã được human duyệt ngày 2026-10-14

Android/iOS reuse native Firebase config hiện có và cùng target một cloud development project/database. Android được kiểm tra trên physical device; iOS run tạm hoãn khi chưa có Mac/iPhone. Production vẫn cần project và config riêng theo ADR-006; không tạo/deploy tài nguyên cloud trong SL-002.

Native SDK lấy credentials từ `firebase-config/google-services.json` hoặc `firebase-config/GoogleService-Info.plist`. `EXPO_PUBLIC_FIREBASE_PROJECT_ID` trong `.env.local` chỉ dùng để đối chiếu expected project; không dùng Android app ID trong env để khởi tạo iOS. Native Auth SDK sở hữu token/session persistence.

## Runtime và diagnostics

- `src/app/_layout.tsx` gọi `initializeFirebaseRuntime` khi startup native. Web tiếp tục prototype UI, không load native clients.
- Development mặc định là `cloud`. `EXPO_PUBLIC_FIREBASE_RUNTIME_MODE=emulator` yêu cầu explicit host/ports. Missing config không tự fallback cloud.
- `getApp().options.projectId` phải khớp expected project trước khi app tạo Auth/Firestore/Functions clients. Functions client dùng `asia-southeast1`; không gọi backend chưa có của SL-003.
- Release cần explicit cloud mode và `EXPO_PUBLIC_FIREBASE_PRODUCTION_PROJECT_ID` khác development project, cùng native config khớp. JS client guard không thay thế provisioning/build pipeline production còn deferred.
- Diagnostics development chỉ log platform/environment/mode/project/region và signed-in/out; không log API key, native config, UID, email hoặc token.
- Read-only probe dùng `getDocFromServer`: current user's `users/{uid}` nếu native SDK đã có session; nếu signed out, đọc ID fixture `users/sl002_connection_probe`, không tạo document/user hoặc đọc collection. Tránh document IDs khớp `__.*__` vì Firestore reserved pattern.
- `server-read-completed` hoặc `server-reached-access-denied` chứng minh có server response. Permission-denied không chứng minh đăng nhập thành công hay Rules cho phép user. Probe không deploy/sửa Rules hiện có.
- Timeout/network failure là UNVERIFIED; SDK read không có cancellation API nên request pending có thể kết thúc sau reconnect, nhưng không tạo queued write. Reload để thực hiện probe mới.
- Thay mode/host/config cần restart app. Full auth login/persistence journey và callable handshake chưa được kiểm chứng bởi SL-002.

## pnpm và Android Windows build

`pnpm-workspace.yaml` giữ `nodeLinker: hoisted` để CMake/Ninja không dùng `.pnpm` paths quá dài. Hai lockfile được giữ đồng bộ; không cần đổi sang npm để build. Không chạy Metro khi đang thay node_modules/dependencies.

Trong PowerShell tại `dontlift-mobile/`, dùng JDK/SDK đã cài và kiểm tra `java -version`, `adb devices -l` trước:

```powershell
$env:JAVA_HOME = "$env:ProgramFiles\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
$env:JAVA_TOOL_OPTIONS = '--enable-native-access=ALL-UNNAMED'
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec expo prebuild --platform android --clean --no-install
pnpm exec expo run:android --no-bundler
```

JDK native-access flag được kiểm chứng với Android Studio JBR 25; không cài/chỉnh JDK toàn hệ thống. Native module/config changes cần binary mới. Icon/splash native đang dùng cấu hình tối thiểu vì template image assets không tồn tại; chưa phải branding cuối cùng.

Sau khi app đã được cài, sửa JS/TS/UI chỉ cần Metro/Fast Refresh. USB setup không yêu cầu máy ảo hoặc LAN server:

```powershell
$env:Path = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:Path"
$env:NODE_OPTIONS = ($env:NODE_OPTIONS + ' --dns-result-order=ipv4first').Trim()
adb reverse tcp:8081 tcp:8081
pnpm exec expo start --dev-client --localhost
```

Metro phải nghe `127.0.0.1:8081`; `/status` trả `packager-status:running`. IPv6-only `::1` không phù hợp với USB reverse setup này. Khi cache còn layout node_modules cũ, dừng Metro rồi khởi động lại cùng `--clear`. Chỉ chạy một Metro trên cổng 8081.

## iOS configuration

Bundle ID và plist hiện có được reuse. `expo-build-properties` cấu hình `ios.useFrameworks: static` theo [RNFirebase Expo installation](https://rnfirebase.io/#installation-for-expo-projects). Pod installation, Xcode/macOS build và actual iOS device runtime vẫn UNVERIFIED. Không suy iOS PASS từ Android hoặc unit fixtures.

## Local Emulator Suite baseline (optional mode)

`firebase.emulator.json` chỉ cấu hình Auth 9099, Firestore 8080 và local `firestore.emulator.rules` deny-by-default. Không có backend package/Functions discovery trước SL-003. Không có canonical aliases hoặc deployed Rules.

Khi có Firebase CLI/toolchain và human đã chọn verified development project ID:

```text
firebase emulators:start --config firebase.emulator.json --project <verified-development-project-id> --only auth,firestore
```

Đặt explicit mode/host/ports trong local env, restart app/Metro. Android USB có thể reverse Auth 9099 và Firestore 8080; Functions 5001 chỉ được verify sau backend bootstrap SL-003. Không dùng production project, không thêm allow-all để chứng minh kết nối. Mocked emulator routing tests không phải actual Emulator Suite evidence.

## Evidence — 2026-10-14

Baseline execution: `786261c069f32f9ae335f57ba92074a25e9a3f2d`, branch `feature/sl-002-native-firebase-runtime`.

| Check | Actual result |
|---|---|
| Configuration RED trước implementation | 11 cases fail vì behavior chưa được implement; runner hoạt động. |
| Focused config/adapter suite | PASS: 24 cases, 2 suites. |
| Full Jest suite | PASS: 25 cases, 3 suites, exit 0. |
| `pnpm exec tsc --noEmit` | PASS, exit 0. |
| Android prebuild sau thêm Functions/iOS config | PASS, exit 0. |
| Android APK mới | PASS: build thành công và APK cài/mở được trên Samsung SM-S731B qua USB. |
| Native Firebase initialization | PASS: Android log xác nhận `development`, `cloud`, project `august-monument-508716-u0`, Auth/Firestore/Functions clients initialized, signed-out. |
| Firestore cloud server probe | PASS: Android device returned `server-reached-access-denied` / `permission-denied` while signed-out. This confirms cloud Firestore server reachability; the deny is expected under production-mode Rules and does not verify authenticated access. |
| Existing native project/package matching | PASS: Android JSON, iOS plist và `.env.local` cùng project; package/bundle IDs khớp app config. Không log credentials. |
| Firebase Console database inspection | PASS: human screenshot confirms `(default)`, Standard edition, `asia-southeast1` (Singapore). |
| Actual Auth login/persistence, callable handshake | Không thuộc acceptance hiện tại; SL-003/004 tiếp tục nghiệm thu. |
| Actual Firestore edition/location | PASS: Standard, `asia-southeast1` (Singapore), confirmed in Cloud Console. |
| Actual Emulator Suite integration | UNVERIFIED; local baseline và unit routing đã chuẩn bị. |
| iOS Pods/build/device | DEFERRED/UNVERIFIED theo lựa chọn human. |

Android app/build, native client initialization, cloud database edition/location, và server reachability đã được kiểm chứng. Probe ban đầu lỗi vì fixture ID khớp reserved pattern `__.*__`; ID đã được sửa và lần chạy mới chứng minh server reached, Rules từ chối signed-out read như dự kiến. Emulator Suite chưa chạy thực tế; iOS device verification deferred theo lựa chọn human. Android development scope đã hoàn thành; full cross-platform verification vẫn deferred cho iOS.
