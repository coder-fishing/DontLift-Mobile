# DontLift

DontLift giúp bạn giảm việc sử dụng điện thoại khi học, làm việc hoặc gặp gỡ bạn bè. Bạn bắt đầu phiên tập trung, đặt điện thoại úp xuống và xem kết quả khi kết thúc. Với chế độ nhóm, mọi người tham gia cùng một phòng để theo dõi vi phạm và chia hóa đơn.

Mã nguồn ứng dụng Android/iOS nằm trong [dontlift-mobile/](dontlift-mobile/).

## Tính năng

- **Solo:** bộ đếm thời gian, phát hiện trạng thái điện thoại, ghi nhận vi phạm và tổng kết phiên.
- **Phòng nhóm:** tạo phòng, tham gia bằng PIN hoặc QR, quản lý phòng chờ và theo dõi phiên chung.
- **Kết thúc phiên:** yêu cầu rời sớm, biểu quyết kết thúc và tổng hợp kết quả.
- **Chia hóa đơn:** Host công bố phần chia; thành viên dùng VietQR để chuyển khoản trực tiếp.
- **Lịch sử và hồ sơ:** xem phiên trước, cập nhật hồ sơ và tùy chọn phản hồi.
- **Premium và OCR:** tích hợp dịch vụ ngoài để mua quyền có thời hạn và gợi ý số tiền trên hóa đơn.

Các phần trên có mã nguồn trong repository. Điều này chưa xác nhận mọi dịch vụ đã được triển khai hoặc mọi luồng đã được kiểm thử trên thiết bị thật.

## Chạy dự án

Chuẩn bị Node.js, pnpm và Expo Go tương thích với Expo trong [package.json](dontlift-mobile/package.json). Manifest hiện khai báo Expo `~58.0.22`. Hướng dẫn phát triển dùng Node 24; tooling trong `functions/` khai báo Node 22.

Chạy trong PowerShell tại thư mục gốc repository:

```powershell
cd dontlift-mobile
pnpm install
```

Nếu chưa có `.env.local`, tạo từ mẫu:

```powershell
Copy-Item .env.example .env.local
```

Điền cấu hình Firebase Web App của đúng project được nhóm cho phép sử dụng. Firebase Authentication cần bật Email/Password; Firestore cần Rules phù hợp với phiên bản ứng dụng.

| Biến | Mục đích |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_RUNTIME_MODE` | `cloud` hoặc `emulator` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Project phát triển |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Web App API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase Web App ID |
| `EXPO_PUBLIC_FIREBASE_PRODUCTION_PROJECT_ID` | Project production riêng cho release |
| `EXPO_PUBLIC_PREMIUM_API_URL` | API HTTPS cho Premium và hóa đơn |
| `EXPO_PUBLIC_RECEIPT_SCAN_API_URL` | Endpoint OCR nội bộ, chỉ dùng khi phát triển |

Không đưa khóa Firebase Admin, payOS hoặc Cloudinary vào biến `EXPO_PUBLIC_*`. Không commit `.env.local`.

Khởi động:

```powershell
pnpm run dev
```

Quét QR bằng Expo Go. Điện thoại và máy tính cần cùng mạng LAN. Nếu LAN bị chặn, chạy `pnpm run dev:tunnel`. Sau khi đổi biến môi trường, dùng `pnpm run start:clear`.

| Lệnh trong thư mục ứng dụng | Mục đích |
| --- | --- |
| `pnpm run android` | Chạy native Android, cần Android SDK |
| `pnpm run ios` | Chạy native iOS trên macOS |
| `pnpm run web` | Mở mục tiêu web để hỗ trợ phát triển |
| `pnpm run dev:emulator` | Chạy quy trình emulator qua PowerShell |

Web và Expo Go không thay thế kiểm thử cảm biến, background và khôi phục phiên trên thiết bị thật. Native build cần cấu hình công cụ và dịch vụ riêng.

## Bộ tài liệu dự án

| Nhóm | Tài liệu bắt đầu | Tham chiếu chi tiết |
| --- | --- | --- |
| README | Tài liệu này | Cài đặt, chạy và điều hướng |
| Architecture Documentation | [Kiến trúc](dontlift-mobile/docs/architecture.md) | [Kiến trúc kỹ thuật](dontlift-mobile/docs/software-architecture.md), [ADR](dontlift-mobile/docs/decisions/) |
| Product Documentation | [Sản phẩm](dontlift-mobile/docs/product-overview.md) | [Yêu cầu](dontlift-mobile/docs/product-requirements.md), [đặc tả](dontlift-mobile/docs/feature-specification.md) |
| API Documentation | [Hướng dẫn API](dontlift-mobile/docs/api-guide.md) | [Hợp đồng tích hợp](dontlift-mobile/docs/api-contracts.md) |
| Code Documentation | [Hướng dẫn mã nguồn](dontlift-mobile/docs/code-guide.md) | Module, luồng dữ liệu và quy ước bảo trì |
| User Documentation | [Hướng dẫn sử dụng](dontlift-mobile/docs/user-guide.md) | Solo, nhóm, hóa đơn và xử lý sự cố |
| Development Communication & Knowledge Transfer | [Phối hợp và bàn giao](dontlift-mobile/docs/development-handover.md) | Onboarding, quyết định, review và bàn giao |

Tài liệu giữ lại kiến thức khi thành viên chuyển công việc. Người mới có thể tự tìm hiểu luồng chính trước khi hỏi người phụ trách. Khi sửa lỗi, nhóm có nơi đối chiếu hành vi và lý do thiết kế. Các tham chiếu đến mã nguồn và quyết định đã duyệt cũng giúp AI coding agents làm việc với ngữ cảnh rõ ràng hơn.

## Cấu trúc

```text
dontlift-mobile/
├── src/
│   ├── app/          # Entry Expo Router và điều phối ứng dụng
│   ├── screens/      # Màn hình
│   ├── components/   # Giao diện dùng chung
│   ├── features/     # Auth, Solo, nhóm, sync và hóa đơn
│   ├── constants/    # Theme và hằng số
│   ├── hooks/        # React hooks dùng chung
│   └── types/        # Kiểu dữ liệu dùng chung
├── functions/        # syncEvents và kiểm thử Firebase
├── __tests__/        # Kiểm thử ứng dụng
├── docs/             # Tài liệu, ADR, kế hoạch và review
├── design/           # Thiết kế và tham chiếu
├── scripts/          # Công cụ phát triển
└── firestore.rules   # Phân quyền và kiểm tra giao dịch
```

Stack chính gồm React Native, Expo, React, TypeScript, Firebase JS SDK và SQLite. Phiên bản cụ thể nằm trong manifest và lockfile.

## Kiểm tra chất lượng

Chạy trong `dontlift-mobile/`:

```powershell
pnpm exec tsc --noEmit
pnpm run lint
pnpm test -- --runInBand
```

Kiểm thử Firebase cần Java và dependency tooling:

```powershell
pnpm --dir functions install
pnpm --dir functions run test:emulators
```

Đây là hướng dẫn chạy, không phải báo cáo các kiểm tra đã đạt. Với thay đổi cảm biến và vòng đời phiên, kiểm tra thêm trên Android/iOS thật.

## Đóng góp và bảo trì

Đọc [AGENTS.md](dontlift-mobile/AGENTS.md) trước khi sửa mã. Khi tài liệu mâu thuẫn, ưu tiên quyết định con người mới hơn và ADR đã chấp nhận theo thứ tự trong AGENTS.md. Một số tài liệu ban đầu còn mô tả kiến trúc mục tiêu cũ.

Mỗi thay đổi cần mô tả vấn đề, hành vi sau khi sửa, kết quả kiểm tra và phần chưa xác minh. Ghi quyết định kiến trúc vào ADR để người tiếp theo hiểu lý do.

Repository có [LICENSE](dontlift-mobile/LICENSE) theo MIT với thông tin bản quyền Expo. Nhóm cần rà soát thông tin và phạm vi giấy phép của sản phẩm trước khi phát hành.
