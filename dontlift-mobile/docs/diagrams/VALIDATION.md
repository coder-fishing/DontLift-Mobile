# Kết quả kiểm tra bộ sơ đồ

## Bổ sung ngày 24/11/2026

- Bổ sung tiếp sơ đồ lớp tổng hợp `cls-06-toan-bo-he-thong`, gồm 31 kiểu dữ liệu, lớp và module chính; tổng bộ tài liệu hiện có 65 sơ đồ (6 sơ đồ lớp, 8 sơ đồ use case).
- Đã parse/render lại 57/57 Mermaid thành công. Xuất SVG và PNG gốc 5594 × 2022 cho sơ đồ lớp; đã mở ảnh kiểm tra bố cục và các quan hệ tổng thể.
- Đối chiếu các thuộc tính và phương thức với auth controller, Solo controller, grace engine, room listener, voting, bill repository/allocation, OCR, sync worker, history model và Premium API client.

Lần bổ sung use case trước đó trong cùng ngày:

- Thêm một sơ đồ tổng hợp đủ UC01–UC31, nâng tổng số sơ đồ lên 64 (8 sơ đồ use case).
- Kiểm tra đủ 31 định danh duy nhất trong SVG và PlantUML; có bảng đối chiếu mã nhóm cũ.
- Đã dựng lại 56/56 Mermaid thành công và cả 8 SVG use case bằng Chrome headless.
- Đã mở xem ảnh sơ đồ tổng hợp, kiểm tra nhãn, tác nhân, ranh giới và hướng mũi tên extend.
- Nguồn PlantUML mới vẫn chưa được chạy qua parser PlantUML; SVG được xuất từ cùng mô hình bố trí cục bộ.

## Lần kiểm tra ban đầu

Ngày kiểm tra: 22/11/2026. Phạm vi: tài liệu và sơ đồ trên nhánh `codex/dontlift-report-diagrams`.

## Kết quả

| Hạng mục | Kết quả |
|---|---|
| Danh mục và file sơ đồ | 63 sơ đồ, 7 nhóm, mỗi sơ đồ có Markdown riêng |
| Liên kết Markdown | Đã kiểm tra đích tồn tại, bao gồm tài liệu nguồn |
| Mermaid | 56/56 sơ đồ parse và render thành SVG thành công bằng Mermaid 11 trong Chrome headless |
| Use Case | 7/7 SVG có XML hợp lệ, đối chiếu số ellipse với nguồn PlantUML và các đầu mút quan hệ |
| Xem mẫu trực quan | Đã xem Use Case hóa đơn, ERD SQLite, Sequence Premium, Class Solo và Activity OCR |
| Git whitespace | Kiểm tra bằng `git diff --cached --check` trước commit |

## Cách chạy lại

Từ thư mục ứng dụng:

```powershell
python docs/diagrams/tools/build_diagrams.py
python docs/diagrams/tools/validate_diagrams.py
```

Kiểm tra dựng hình dùng Node.js, Chrome có sẵn và các gói `mermaid@11`, `playwright-core` cài trong một thư mục công cụ riêng. Không cài các gói này vào package.json của DontLift. Lệnh nhận đường dẫn tuyệt đối do người chạy lựa chọn:

```text
node docs/diagrams/tools/render_check.mjs <tool-node_modules> <chrome-executable> <preview-output-directory>
```

Script ghi SVG kiểm tra, một số ảnh PNG và results.json vào thư mục output, không ghi đè file ứng dụng.

## Giới hạn

- Chưa push lên GitHub trong công việc này. Dựng hình được kiểm tra bằng Mermaid 11 cục bộ; giao diện và phiên bản renderer của GitHub có thể khác.
- PlantUML là nguồn chỉnh sửa được; SVG được tạo từ cùng mô hình bằng Python, không chạy qua PlantUML renderer vì môi trường không có Java. Đã kiểm tra cú pháp khung và các endpoint, chưa kiểm tra bằng parser PlantUML.
- Chưa kiểm tra toàn bộ sơ đồ bằng mắt từng hình. Kiểm tra render tự động không chứng minh mọi quan hệ nghiệp vụ đều chính xác; mỗi sơ đồ có nguồn để người đọc đối chiếu.
- Không thay đổi logic ứng dụng nên không chạy bộ test chức năng mobile/backend. Sơ đồ không thay thế nghiệm thu cảm biến trên thiết bị, kiểm thử mất mạng hoặc giao dịch thật.
