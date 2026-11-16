# Phối hợp phát triển và bàn giao kiến thức

Ngày cập nhật: 16/11/2026. Dành cho người mới, người bảo trì và AI coding agents.

## Mục lục

- [Onboarding](#onboarding)
- [Nơi lưu thông tin](#nơi-lưu-thông-tin)
- [Trao đổi thay đổi](#trao-đổi-thay-đổi)
- [Mẫu bàn giao](#mẫu-bàn-giao)
- [Việc cần xác nhận](#việc-cần-xác-nhận)

## Onboarding

1. Đọc [README](../../README.md) và chạy môi trường.
2. Đọc [AGENTS.md](../AGENTS.md) để nắm quy ước và thứ tự ưu tiên tài liệu.
3. Đọc [kiến trúc](architecture.md) và [hướng dẫn mã nguồn](code-guide.md).
4. Lần theo một luồng từ màn hình đến repository và Rules.
5. Chạy kiểm tra liên quan trước khi sửa.

Xin cấu hình và quyền truy cập qua kênh nội bộ của nhóm. Không đặt credentials vào tài liệu hoặc chat công khai.

## Nơi lưu thông tin

| Thông tin | Nơi lưu trong thư mục ứng dụng |
| --- | --- |
| Quyết định kiến trúc | `docs/decisions/` |
| Yêu cầu và nghiệm thu | `docs/product-requirements.md`, `docs/feature-specification.md` |
| Hợp đồng tích hợp | `docs/api-contracts.md` |
| Đề xuất và thiết kế | `docs/superpowers/specs/` |
| Kế hoạch thực hiện | `docs/superpowers/plans/` |
| Kết quả review | `docs/superpowers/reviews/` |
| Quy ước cho agent | `AGENTS.md` |

Kế hoạch hoặc review không tự trở thành quyết định đã chấp nhận. Ghi trạng thái và người duyệt khi nhóm thông qua thay đổi.

Khi mâu thuẫn, dùng thứ tự trong AGENTS.md. Ưu tiên quyết định con người mới hơn và ADR đã chấp nhận. Không dùng mô tả cũ để ghi đè quyết định mới.

## Trao đổi thay đổi

Trước khi làm, mô tả tình huống cụ thể, kết quả mong muốn và phạm vi ảnh hưởng. Liên kết yêu cầu hoặc ADR liên quan.

Khi gửi review, cung cấp:

- Vấn đề người dùng gặp và hành vi sau thay đổi.
- Module ảnh hưởng và lý do chọn cách xử lý.
- Kiểm tra đã chạy cùng kết quả thực tế.
- Phần chưa kiểm chứng và cách tái hiện.
- Cấu hình, migration hoặc bước triển khai cần thực hiện.

Theo AGENTS.md, nhánh dùng `feature/<slug>`, `fix/<slug>` hoặc `docs/<slug>`. Commit dùng dạng `type(scope): description`. Giữ mỗi thay đổi trong phạm vi đã thống nhất.

## Mẫu bàn giao

Sao chép mẫu vào issue, PR hoặc tài liệu bàn giao:

```markdown
## Mục tiêu
+ Vấn đề cần giải quyết và tiêu chí hoàn thành.

## Trạng thái
+ Phần đã làm, đang làm và chưa bắt đầu.

## Tham chiếu
+ Nhánh, commit, file chính, yêu cầu và ADR.

## Cách kiểm tra
+ Môi trường, lệnh hoặc thao tác, kết quả và bằng chứng.

## Việc còn lại
+ Việc tiếp theo, người phụ trách và điều kiện hoàn thành.

## Phụ thuộc
+ Lỗi còn mở, quyền truy cập, migration và dịch vụ ngoài.
```

Điền người phụ trách thực tế khi bàn giao. Repository chưa cung cấp danh sách vai trò để gán tên tại đây.

Với AI coding agents, cung cấp đường dẫn tài liệu có thẩm quyền và phạm vi được sửa. Yêu cầu nêu rõ điều đã kiểm tra, giả định và phần chưa xác minh.

## Việc cần xác nhận

- Một số mô tả ban đầu trong AGENTS.md và hướng dẫn emulator còn gọi ứng dụng là prototype.
- Hướng dẫn emulator cũ nhắc SDK 57; manifest hiện khai báo Expo 58.
- Premium trọn đời trong project-context đã được ADR-025 và ADR-029 thay thế.
- Cần xác nhận địa chỉ triển khai và người vận hành Express, OCR, payOS và Cloudinary.
- Cần lưu bằng chứng kiểm thử cảm biến, background và khôi phục phiên trên thiết bị thật trước phát hành.

Giữ các mục này trong báo cáo bàn giao đến khi người phụ trách xác nhận và cập nhật nguồn tương ứng.
