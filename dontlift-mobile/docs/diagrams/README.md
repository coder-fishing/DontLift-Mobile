# Bộ sơ đồ phân tích và thiết kế DontLift

Đối chiếu ngày 22/11/2026. Bộ sơ đồ phục vụ đồ án **Xây dựng ứng dụng đa nền tảng DontLift tích hợp AI nhận diện hóa đơn**. Tổng cộng **65 sơ đồ**, chia theo loại; mỗi sơ đồ nằm trong một file Markdown riêng.

Bổ sung ngày 24/11/2026: [một sơ đồ tổng hợp đủ UC01–UC31](use-case/uc-07-toan-bo-31-use-case.md), có bảng đối chiếu mã cũ và thống nhất với danh sách đặc tả trong báo cáo.

Cùng ngày bổ sung [sơ đồ lớp tổng hợp toàn hệ thống](class/cls-06-toan-bo-he-thong.md), nối 31 kiểu dữ liệu, lớp và module chính. Cả hai sơ đồ tổng hợp có bản SVG để phóng to và PNG để chèn báo cáo.

## Xem trên GitHub

Mở file `.md` để GitHub dựng hình trong khối `mermaid`. File Use Case nhúng SVG có sẵn, kèm nguồn `.puml`. Không cần cài tiện ích để xem trên GitHub. File `.mmd` độc lập không phải định dạng xem chính của bộ này.

| Loại | Số sơ đồ | Danh mục |
|---|---:|---|
| use-case | 8 | [Mở thư mục](use-case/README.md) |
| activity | 16 | [Mở thư mục](activity/README.md) |
| sequence | 18 | [Mở thư mục](sequence/README.md) |
| state-machine | 9 | [Mở thư mục](state-machine/README.md) |
| class | 6 | [Mở thư mục](class/README.md) |
| erd | 5 | [Mở thư mục](erd/README.md) |
| architecture | 3 | [Mở thư mục](architecture/README.md) |

## Phạm vi và cách đọc

- Nguồn ưu tiên: quyết định được chấp nhận mới nhất, hợp đồng API hiện hành, kiến trúc, PRD rồi đặc tả. Các phần tài liệu cũ nhắc native Firebase, Cloud Functions bắt buộc hoặc checksum Premium không được dùng như runtime hiện tại.
- Đây là mô hình phân tích và thiết kế được đối chiếu tài liệu và một số module mã nguồn; không phải chứng nhận tất cả dịch vụ đã triển khai hoặc kiểm thử thiết bị đã đạt.
- Activity dùng flowchart Mermaid mô tả luồng hoạt động, không phải xuất UML Activity chuyên biệt. Sequence và State dùng ký pháp tương ứng của Mermaid.
- Use Case có tác nhân, ranh giới hệ thống, liên kết, `include`/`extend` có hướng khi phù hợp. SVG và PlantUML được tạo từ cùng dữ liệu; SVG được vẽ cục bộ bằng Python, không phải output của PlantUML renderer.
- Class gồm cả mô hình khái niệm và hợp đồng TypeScript. File ghi rõ chỗ nào là tên module/trách nhiệm minh họa, tránh hiểu nhầm mọi thành phần đều là class triển khai.
- ERD nghiệp vụ, SQLite và Firestore được tách riêng. Firestore là NoSQL; đường containment và tham chiếu không có ý nghĩa ràng buộc khóa ngoại SQL. ERD SQLite phân biệt liên kết logic với FK thực sự được khai báo.

## Những quy tắc cần giữ khi đưa vào báo cáo

1. Cảm biến xử lý tại thiết bị; khoảng chờ xác nhận là 3 giây. Không giám sát bằng camera hoặc khóa OS.
2. Solo lưu cục bộ và đồng bộ lịch sử theo ADR-030. Lịch sử tự báo cáo không quyết định điểm nhóm hoặc phần tiền.
3. Phòng dùng Firestore transactions và Security Rules trong các ngoại lệ Spark được phê duyệt. Membership nằm trong `rooms/{roomId}/members/{uid}`.
4. ACK đồng bộ là client attestation. Host có thể chốt thiếu dữ liệu với audit theo ADR-018; điểm đã chốt không bị sửa bởi vi phạm muộn.
5. Host tính phần chia theo 40/60 và làm tròn xác định; Rules không chứng minh toàn bộ phép tính hoặc danh sách thành viên đầy đủ.
6. OCR chỉ gợi ý tổng tiền và cần Host xác nhận. Ảnh được chấp nhận có thể lưu riêng tư qua Express/Cloudinary; raw OCR và URL tải ngắn hạn không được lưu lâu dài.
7. VietQR phục vụ chuyển khoản trực tiếp. Host xác nhận đã trả; đây không phải xác minh ngân hàng tự động.
8. Premium có hạn qua payOS/Express; quyền dựa trên `premiumExpiresAt`, không dựa trên redirect hoặc mã checksum cũ.

## Đối chiếu và tái tạo

- [Danh mục máy đọc được](catalog.json): từng sơ đồ và tài liệu nguồn.
- [Danh sách Use Case](use-case/catalog.md): mã và tên chức năng chi tiết.
- [Nguồn và giới hạn](SOURCES.md): nơi kiểm tra khi có thay đổi.
- [Kết quả kiểm tra](VALIDATION.md): kiểm tra cú pháp, dựng hình và giới hạn xác minh.
- Chạy `python docs/diagrams/tools/build_diagrams.py` từ thư mục `dontlift-mobile` để tái tạo bộ sơ đồ.
- Chạy `python docs/diagrams/tools/validate_diagrams.py` để kiểm tra liên kết nội bộ, cấu trúc file, PlantUML/SVG và độ bao phủ danh mục. Kiểm tra này không thay thế parser Mermaid hoặc nghiệm thu nghiệp vụ.
- `tools/render_check.mjs` dùng Mermaid và playwright-core cài trong thư mục công cụ riêng, cùng Chrome có sẵn để parse và dựng hình. Không cần thêm dependency vào ứng dụng. Tham số lần lượt là đường dẫn `node_modules` công cụ, Chrome executable và thư mục ảnh kiểm tra.

## Gợi ý bố cục báo cáo

Phân tích tác nhân và Use Case → sơ đồ lớp miền → Activity theo chức năng → State Machine → Sequence → ERD và kiến trúc. Chọn sơ đồ tổng quan cho thân báo cáo; đưa các nhánh phục hồi, đồng bộ và tích hợp chi tiết vào phụ lục khi cần.
