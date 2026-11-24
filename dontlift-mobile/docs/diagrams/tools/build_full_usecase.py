"""One report-ready use-case diagram, aligned with the 31 use-case specifications."""
from html import escape
from pathlib import Path
import textwrap

GROUPS = [
    ('Quản lý tài khoản', [
        (1, 'Đăng ký tài khoản', 'U', 'AUTH01'),
        (2, 'Đăng nhập', 'U', 'AUTH02'),
        (3, 'Đăng xuất', 'U', 'AUTH03'),
        (4, 'Cập nhật hồ sơ cá nhân', 'U', 'AUTH04, AUTH05'),
    ]),
    ('Tập trung cá nhân', [
        (5, 'Thiết lập và bắt đầu phiên tập trung', 'U', 'SOLO01, SOLO02'),
        (6, 'Kết thúc phiên và xem tổng kết', 'U', 'SOLO04'),
        (7, 'Xem lịch sử tập trung cá nhân', 'U', 'SOLO05'),
    ]),
    ('Quản lý phòng', [
        (8, 'Tạo phòng', 'H', 'ROOM01'),
        (9, 'Tham gia phòng bằng mã pin hoặc mã qr', 'M', 'ROOM02'),
        (10, 'Xem danh sách thành viên', 'HM', 'ROOM03'),
        (11, 'Rời phòng chờ', 'HM', 'ROOM04'),
        (12, 'Loại thành viên khỏi phòng chờ', 'H', 'ROOM05'),
        (13, 'Bắt đầu phiên tập trung nhóm', 'H', 'ROOM06'),
    ]),
    ('Hoạt động trong phiên', [
        (14, 'Theo dõi bảng điểm vi phạm', 'HM', 'GROUP01'),
        (15, 'Yêu cầu rời phiên sớm', 'M', 'GROUP02'),
        (16, 'Duyệt hoặc từ chối yêu cầu rời sớm', 'H', 'GROUP03'),
        (17, 'Đề xuất và biểu quyết kết thúc phiên', 'HM', 'GROUP04'),
        (18, 'Kết thúc phiên nhóm', 'H', 'GROUP05'),
        (19, 'Chốt điểm khi còn thành viên chưa đồng bộ', 'H', 'GROUP06'),
        (20, 'Xem tổng kết và lịch sử nhóm', 'HM', 'GROUP07'),
    ]),
    ('Hóa đơn và thanh toán', [
        (21, 'Nhập tổng tiền hóa đơn', 'H', 'BILL01'),
        (22, 'Nhận diện hóa đơn bằng AI và xác nhận số tiền', 'H', 'BILL02'),
        (23, 'Tính và công bố phần chia hóa đơn', 'H', 'BILL03'),
        (24, 'Điều chỉnh phần chia', 'H', 'BILL04'),
        (25, 'Xem phần tiền và ảnh hóa đơn', 'HM', 'BILL05'),
        (26, 'Mở mã qr hoặc ứng dụng ngân hàng để chuyển khoản', 'M', 'BILL06'),
        (27, 'Xác nhận thành viên đã thanh toán', 'H', 'BILL07'),
    ]),
    ('Quản lý gói premium', [
        (28, 'Xem các gói premium', 'U', 'PREM01'),
        (29, 'Tạo yêu cầu và thanh toán mua premium', 'U', 'PREM02, PREM03'),
        (30, 'Kiểm tra trạng thái đơn thanh toán', 'U', 'PREM04'),
        (31, 'Khôi phục hoặc hủy đơn đang chờ', 'U', 'PREM05'),
    ]),
]


def build(root):
    root = Path(root)
    folder = root / 'use-case'
    folder.mkdir(parents=True, exist_ok=True)
    slug = 'uc-07-toan-bo-31-use-case'
    cases = [row for _, rows in GROUPS for row in rows]
    assert [row[0] for row in cases] == list(range(1, 32))
    labels = {'U': 'Người dùng', 'H': 'Chủ phòng', 'M': 'Thành viên'}
    puml = ['@startuml', 'left to right direction', 'skinparam shadowing false',
            'title DontLift — Toàn bộ 31 use case']
    for key, label in labels.items():
        puml.append(f'actor "{label}" as {key}')
    puml.append('rectangle "Hệ thống DontLift" {')
    for group, rows in GROUPS:
        puml.append(f'  package "{group}" {{')
        for number, label, actors, old in rows:
            puml.append(f'    usecase "UC{number:02d}: {label}" as UC{number:02d}')
        puml.append('  }')
    puml.append('}')
    for number, _, actors, _ in cases:
        for actor in actors:
            puml.append(f'{actor} -- UC{number:02d}')
    puml.extend(['UC22 ..> UC21 : <<extend>>',
                 'note right of UC22 : Tùy chọn, chủ phòng premium còn hạn',
                 'legend bottom',
                 'Chủ phòng và thành viên là vai trò theo phòng của người dùng.',
                 'Đăng nhập là điều kiện trước, không tự động là include.',
                 'endlegend', '@enduml'])
    (folder / f'{slug}.puml').write_text('\n'.join(puml)+'\n', encoding='utf-8')

    # A single boundary, six sections; repeated actor glyphs denote the same actor.
    width = 1600
    top = 170
    layouts = []
    positions = {}
    for group, rows in GROUPS:
        size = 82 + len(rows) * 90
        layouts.append((top, size, group, rows))
        for index, row in enumerate(rows):
            positions[row[0]] = top + 83 + index * 90
        top += size + 20
    height = top + 125
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
           '<title id="title">DontLift — Toàn bộ 31 use case</title>',
           '<desc id="desc">31 use case đánh số UC01 đến UC31, chia sáu nhóm trong một ranh giới hệ thống. Tác nhân được lặp lại theo nhóm để giảm giao cắt.</desc>',
           '<defs><marker id="extend" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M1 1 L10 6 L1 11" fill="none" stroke="#222" stroke-width="1.5"/></marker></defs>',
           '<style>text{font-family:Arial,sans-serif;fill:#111}.edge{stroke:#555;stroke-width:1.4;fill:none}.actor{stroke:#222;stroke-width:2;fill:none}</style>',
           f'<rect width="{width}" height="{height}" fill="white"/>',
           '<text x="800" y="45" text-anchor="middle" font-size="28" font-weight="bold">Sơ đồ use case tổng hợp DontLift</text>',
           '<text x="800" y="80" text-anchor="middle" font-size="18">UC01–UC31 · người dùng, chủ phòng và thành viên</text>',
           f'<rect x="300" y="110" width="1000" height="{top-110}" fill="none" stroke="#222" stroke-width="2"/>',
           '<text x="800" y="144" text-anchor="middle" font-size="23">Hệ thống DontLift</text>']

    for y, size, group, rows in layouts:
        svg.append(f'<rect x="320" y="{y}" width="960" height="{size}" rx="7" fill="#fafafa" stroke="#bbb"/>')
        svg.append(f'<text x="800" y="{y+30}" text-anchor="middle" font-size="21" font-weight="bold">{escape(group)}</text>')
        actors = set(''.join(row[2] for row in rows))
        for actor in sorted(actors):
            x = 1450 if actor == 'M' else 150
            actor_y = y + size / 2
            # Host left, Member right; generic User appears only in user-wide sections.
            side = 1170 if actor == 'M' else 430
            anchor = x - 25 if actor == 'M' else x + 25
            for number, _, permitted, _ in rows:
                if actor in permitted:
                    svg.append(f'<path class="edge" d="M{anchor},{actor_y} L{side},{positions[number]}"/>')
            svg.extend([f'<circle class="actor" cx="{x}" cy="{actor_y-45}" r="17"/>',
                        f'<path class="actor" d="M{x},{actor_y-28} v62 m-33,-34 h66 m-33,34 l-27,40 m27,-40 l27,40"/>',
                        f'<text x="{x}" y="{actor_y+107}" text-anchor="middle" font-size="21">{labels[actor]}</text>'])
        for number, label, _, _ in rows:
            cy = positions[number]
            svg.append(f'<ellipse data-uc="UC{number:02d}" cx="800" cy="{cy}" rx="370" ry="33" fill="white" stroke="#333" stroke-width="1.7"/>')
            lines = textwrap.wrap(f'UC{number:02d}: {label}', width=56)
            svg.append(f'<text x="800" y="{cy-((len(lines)-1)*12)+6}" text-anchor="middle" font-size="19">')
            for index, line in enumerate(lines):
                svg.append(f'<tspan x="800" dy="{0 if index == 0 else 24}">{escape(line)}</tspan>')
            svg.append('</text>')
    a, b = positions[22], positions[21]
    svg.append(f'<path d="M1170,{a} C1260,{a} 1260,{b} 1170,{b}" fill="none" stroke="#222" stroke-width="1.6" stroke-dasharray="7 5" marker-end="url(#extend)"/>')
    svg.append(f'<text x="1200" y="{(a+b)/2+5}" text-anchor="middle" font-size="16">«extend»</text>')
    svg.append(f'<text x="800" y="{top+42}" text-anchor="middle" font-size="18">Tác nhân được lặp lại theo nhóm để dễ đọc, không phải các tài khoản khác nhau.</text>')
    svg.append(f'<text x="800" y="{top+75}" text-anchor="middle" font-size="18">UC22 mở rộng UC21 khi chủ phòng có premium còn hạn và chọn nhận diện hóa đơn.</text>')
    svg.append('</svg>')
    (folder / f'{slug}.svg').write_text('\n'.join(svg)+'\n', encoding='utf-8')

    table = '\n'.join(f'| UC{n:02d} | {label} | {", ".join(labels[a].lower() for a in actors)} | {old} |' for n,label,actors,old in cases)
    content = f'''# Sơ đồ use case tổng hợp UC01–UC31

Sơ đồ này thống nhất với danh sách và 31 đặc tả use case trong báo cáo. Mọi chức năng nằm trong **một ranh giới hệ thống DontLift**. Sáu khung bên trong chỉ nhóm chức năng để dễ theo dõi.

![Toàn bộ 31 use case DontLift]({slug}.svg)

[Mở ảnh SVG đầy đủ để phóng to]({slug}.svg) · [Ảnh PNG chèn vào báo cáo]({slug}.png) · [Nguồn PlantUML chỉnh sửa được]({slug}.puml)

## Tác nhân và quan hệ

- Người dùng thực hiện các chức năng tài khoản, tập trung cá nhân và premium.
- Chủ phòng và thành viên là vai trò của người dùng trong từng phòng; vẫn có các chức năng chung của người dùng. Tác nhân được vẽ lặp theo nhóm để giảm đường nối giao cắt.
- Mỗi ellipse là một use case, số hiệu UC01–UC31 giữ đúng danh sách đặc tả. UC04 gộp sửa tên và ảnh; UC05 bao gồm chọn bộ đếm; UC29 gộp tạo yêu cầu và thanh toán mua premium.
- Đường liền là liên kết tác nhân–use case. Mũi tên nét đứt UC22 → UC21 là `extend`: nhận diện hóa đơn là lựa chọn bổ sung khi nhập tổng tiền, có điều kiện premium còn hạn.
- Đăng nhập là điều kiện trước của các thao tác cần xác thực, không vẽ thành `include` cho mọi chức năng. Cảm biến và đồng bộ là xử lý bên trong, không thêm thành use case thứ 32.
- Đây là góc nhìn tác nhân con người. Firebase Auth, PaddleOCR, Cloudinary, payOS và ngân hàng được mô tả ở các sơ đồ tích hợp chi tiết đã có.

## Bảng đối chiếu với sơ đồ cũ

| Mã báo cáo | Use case | Tác nhân trực tiếp | Mã trong sơ đồ nhóm cũ |
|---|---|---|---|
{table}

`SOLO03` (ghi nhận vi phạm) là hành vi tự động trong phiên, thể hiện ở Activity/Sequence; không phải một mục người dùng chủ động gọi trong danh sách 31 use case. Các mã cũ được giữ làm tham chiếu lịch sử, không dùng thay mã UC01–UC31 trong sơ đồ này.

## Nguồn và giới hạn

Đối chiếu [PRD](../../product-requirements.md), [đặc tả](../../feature-specification.md), [API](../../api-contracts.md), [sơ đồ nhóm](README.md) và các quyết định kiến trúc hiện hành. Quyền trong phòng, xử lý chốt điểm và giới hạn OCR tuân thủ các hợp đồng tương ứng; không thêm chức năng từ ảnh tham khảo.

SVG và PlantUML được tạo từ cùng mô hình bằng [script](../tools/build_full_usecase.py). SVG được bố trí cục bộ để dễ đọc trên GitHub, không phải ảnh xuất bằng PlantUML renderer. Sơ đồ là mô hình chức năng, không chứng nhận mọi tích hợp đã triển khai.

PNG là bản xuất Chrome tại thời điểm kiểm tra. Khi sửa mô hình, chạy lại build, dùng `render_check.mjs` và thay PNG bằng ảnh `use-case--uc-07-toan-bo-31-use-case.png` trong thư mục output.
'''
    (folder / f'{slug}.md').write_text(content, encoding='utf-8')
    return {'path': f'use-case/{slug}.md', 'title': 'UC01–UC31 — Toàn bộ use case DontLift',
            'kind': 'use-case', 'sources': ['product-requirements.md','feature-specification.md','api-contracts.md']}


if __name__ == '__main__':
    print(build(Path(__file__).resolve().parents[1]))
