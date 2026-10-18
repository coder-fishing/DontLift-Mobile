# Expo Go và Firebase Cloud

## Chạy mặc định

Tại D:\DontLift-Mobile\dontlift-mobile, dùng Node 24, cài dependency bằng pnpm install rồi chạy pnpm run dev. Quét QR bằng Expo Go tương thích Expo SDK 57. Điện thoại và máy tính cần cùng mạng LAN; nếu mạng chặn kết nối LAN, dùng pnpm run dev:tunnel.

Không cần adb, cáp USB, Android Studio hoặc Java để chạy Expo Go với Firebase Cloud. Sensor, SQLite và các Expo native library dùng bản đã có sẵn trong Expo Go.

Copy .env.example sang .env.local và lấy Firebase Web App config từ đúng project. Migration đã cấu hình local cho project august-monument-508716-u0, Web App DontLift Expo Go. Không commit .env.local hay service-account credentials.

Auth phải bật Email/Password. Firestore Rules trong firestore.rules phải được deploy tới đúng project; không mở test mode hoặc allow write toàn bộ. Lệnh deploy từ thư mục functions: pnpm exec firebase deploy --config ../firebase.json --only firestore:rules --project august-monument-508716-u0.

Tài khoản/dữ liệu tạo trong emulator không có trên cloud. Expo Go cũng có sandbox SQLite/Auth mới: đăng ký cloud hoặc đăng nhập lại tài khoản cloud hiện có.

## Optional: Emulator Suite

Java chỉ cần khi chọn emulator. Để kiểm thử tự động, cài dependency tooling bằng pnpm --dir functions install, rồi chạy pnpm --dir functions run test:emulators. Test luôn dùng project demo-dontlift-expo-go và kiểm tra cùng firestore.rules với cloud; không deploy hoặc ghi dữ liệu cloud.

Để thử Expo Go với emulator, đặt EXPO_PUBLIC_FIREBASE_EMULATOR_HOST bằng IP LAN của máy tính, AUTH_EMULATOR_PORT=9099 và FIRESTORE_EMULATOR_PORT=8080 (đều có prefix EXPO_PUBLIC_FIREBASE_). Chạy pnpm run dev:emulator. Script dùng project demo riêng; không cần Functions emulator. Không dùng 127.0.0.1 làm host trên điện thoại thật.

## Giới hạn

Firestore JS SDK trên React Native không có native persistent disk cache. SQLite giữ local profiles và Solo sessions. Room UI hiện là prototype, chưa đồng bộ nhiều máy. Expo Go không thay thế kiểm chứng native lifecycle/background hoặc build AAB trước khi phát hành.

Native android/ios folders from the previous development client are not used by Expo Go. Regenerate/review native projects from the new app config before a future store build; do not reuse an old APK as the Expo Go client.
