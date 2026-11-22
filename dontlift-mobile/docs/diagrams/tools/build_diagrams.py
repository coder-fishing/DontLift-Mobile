"""Build the report diagrams from explicit, reviewed models (Python stdlib only)."""
from pathlib import Path
from html import escape
import json
import textwrap

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT.parent
CATALOG = []


def put(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.rstrip() + '\n', encoding='utf-8')


def source_links(path, sources):
    import os
    return ', '.join(f'[{s}]({Path(os.path.relpath(DOCS / s, (ROOT / path).parent)).as_posix()})' for s in sources)


def diagram(folder, slug, title, code, note, sources):
    path = f'{folder}/{slug}.md'
    code = textwrap.dedent(code).strip()
    put(path, f'# {title}\n\n{note}\n\n```mermaid\n{code}\n```\n\nNguồn đối chiếu: {source_links(path, sources)}.\n')
    CATALOG.append({'path': path, 'title': title, 'kind': folder, 'sources': sources})


PRD = 'product-requirements.md'
SPEC = 'feature-specification.md'
API = 'api-contracts.md'
ARCH = 'architecture.md'
ADR = lambda n, name: f'decisions/ADR-{n:03}-{name}.md'
SOLO = ADR(30, 'solo-direct-summary-sync')
LIFE = ADR(8, 'platform-session-lifecycle')
SPARK = ADR(10, 'expo-go-firebase-js')
BILL = ADR(21, 'spark-default-bill')
OVERRIDE = ADR(22, 'spark-bill-overrides')
PAID = ADR(23, 'spark-manual-payment-status')
PREMIUM = ADR(25, 'payos-expiring-premium')
UC = []


def usecase(slug, title, actors, cases, associations, relations=(), sources=(PRD, SPEC), note=''):
    """Emit PlantUML and SVG from one semantic model; SVG is drawn locally, not by PlantUML."""
    folder = 'use-case'
    base = f'{folder}/{slug}'
    puml = ['@startuml', 'left to right direction', 'skinparam shadowing false', f'title {title}']
    for key, label in actors:
        puml.append(f'actor "{label}" as {key}')
    puml.append('rectangle "DontLift" {')
    for key, label in cases:
        puml.append(f'  usecase "{label}" as {key}')
    puml.append('}')
    for a, b in associations:
        puml.append(f'{a} -- {b}')
    for a, b, kind in relations:
        puml.append(f'{a} ..> {b} : <<{kind}>>')
    puml.append('@enduml')
    put(base + '.puml', '\n'.join(puml))
    count = len(cases)
    height = max(430, count * 100 + 185)
    width = 1260
    cy = {key: 155 + i * 100 for i, (key, _) in enumerate(cases)}
    ay = {key: 140 + i * ((height - 240) / max(1, len(actors)-1)) for i, (key, _) in enumerate(actors)}
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
           f'<title id="title">{escape(title)}</title><desc id="desc">Sơ đồ Use Case DontLift; nguồn mô hình đi kèm trong file PlantUML.</desc>',
           '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M1,1 L9,5 L1,9" fill="none" stroke="#334155"/></marker></defs>',
           '<style>text{font-family:Arial,sans-serif;fill:#172033;font-size:17px}.edge{fill:none;stroke:#64748b;stroke-width:1.5}.relation{fill:none;stroke:#334155;stroke-width:1.5;stroke-dasharray:6 4;marker-end:url(#arrow)}</style>',
           f'<rect width="{width}" height="{height}" fill="white"/>',
           f'<text x="630" y="34" text-anchor="middle" font-size="22">{escape(title)}</text>',
           f'<rect x="340" y="62" width="880" height="{height-90}" rx="5" fill="#f8fafc" stroke="#334155"/>',
           '<text x="780" y="88" text-anchor="middle">Hệ thống DontLift</text>']
    for a, b in associations:
        svg.append(f'<path class="edge" d="M180,{ay[a]+25} L420,{cy[b]}"/>')
    for index, (a, b, kind) in enumerate(relations):
        x = 1000 + index * 38
        svg.append(f'<path class="relation" d="M970,{cy[a]} C{x},{cy[a]} {x},{cy[b]} 970,{cy[b]}"/>')
        svg.append(f'<text x="{x+3}" y="{(cy[a]+cy[b])/2}" font-size="14">«{kind}»</text>')
    for key, label in actors:
        y = ay[key]
        svg.extend([f'<circle cx="160" cy="{y-30}" r="14" fill="white" stroke="#172033" stroke-width="2"/>',
                    f'<path d="M160,{y-16} v48 m-30,-30 h60 m-30,30 l-24,34 m24,-34 l24,34" stroke="#172033" stroke-width="2" fill="none"/>',
                    f'<text x="160" y="{y+92}" text-anchor="middle">{escape(label)}</text>'])
    for key, label in cases:
        svg.append(f'<ellipse cx="695" cy="{cy[key]}" rx="275" ry="36" fill="white" stroke="#334155" stroke-width="1.7"/>')
        svg.append(f'<text x="695" y="{cy[key]+6}" text-anchor="middle">{escape(label)}</text>')
    svg.append('</svg>')
    put(base + '.svg', '\n'.join(svg))
    path = base + '.md'
    rows = '\n'.join(f'| {key} | {label} |' for key, label in cases)
    put(path, f'# {title}\n\n{note}\n\n![{title}]({slug}.svg)\n\n[File PlantUML có thể chỉnh sửa]({slug}.puml). SVG được tạo cục bộ từ cùng mô hình tác nhân, Use Case và quan hệ; không phải ảnh xuất bởi PlantUML.\n\n| Mã | Use Case |\n|---|---|\n{rows}\n\nĐường liền biểu diễn tương tác. Mũi tên nét đứt `include` đi từ chức năng chính đến chức năng bắt buộc; `extend` đi từ phần mở rộng đến chức năng gốc. Điều kiện trước như đăng nhập không tự động được vẽ thành `include`.\n\nNguồn đối chiếu: {source_links(path, sources)}.\n')
    CATALOG.append({'path': path, 'title': title, 'kind': folder, 'sources': list(sources)})
    UC.extend((key, label, path) for key, label in cases)


usecase('uc-00-tong-quan', 'UC-00 — Tổng quan hệ thống', [('U','Người dùng'),('H','Host'),('M','Member')],
 [('G01','Quản lý tài khoản'),('G02','Tập trung cá nhân'),('G03','Tham gia phiên nhóm'),('G04','Điều phối phiên nhóm'),('G05','Chia hóa đơn'),('G06','Xem phần tiền và VietQR'),('G07','Xem lịch sử'),('G08','Mua Premium')],
 [('U','G01'),('U','G02'),('U','G07'),('U','G08'),('H','G04'),('H','G05'),('M','G03'),('M','G06')],
 note='Sơ đồ phân rã chức năng mức tổng quan. Host và Member là vai trò theo từng phòng, đều là người dùng; không có vai trò Admin hoặc chức năng chat trong phạm vi này.')
usecase('uc-01-tai-khoan', 'UC-01 — Tài khoản và hồ sơ', [('U','Người dùng'),('F','Firebase Auth')],
 [('AUTH01','Đăng ký'),('AUTH02','Đăng nhập'),('AUTH03','Đăng xuất'),('AUTH04','Cập nhật tên hiển thị'),('AUTH05','Cập nhật ảnh đại diện')],
 [('U',x) for x in ['AUTH01','AUTH02','AUTH03','AUTH04','AUTH05']]+[('F','AUTH01'),('F','AUTH02'),('F','AUTH03')],
 sources=(PRD,SPARK,API),note='Đăng nhập email/mật khẩu. Không đưa đăng nhập mạng xã hội hay khôi phục mật khẩu trong kế hoạch tương lai vào sơ đồ hiện tại.')
usecase('uc-02-solo', 'UC-02 — Tập trung cá nhân', [('U','Người dùng Solo')],
 [('SOLO01','Bắt đầu phiên cá nhân'),('SOLO02','Chọn đếm ngược hoặc bấm giờ'),('SOLO03','Ghi nhận vi phạm'),('SOLO04','Kết thúc và xem tổng kết'),('SOLO05','Xem lịch sử cá nhân')],
 [('U','SOLO01'),('U','SOLO04'),('U','SOLO05')], [('SOLO01','SOLO02','include')],sources=(PRD,SPEC,SOLO),
 note='Ghi nhận vi phạm là hành vi tự động có điều kiện trong phiên, không phải thao tác do người dùng chủ động gọi. Đồng bộ là xử lý nội bộ, được mô tả ở Sequence.')
usecase('uc-03-phong-cho', 'UC-03 — Quản lý phòng chờ', [('H','Host'),('M','Member')],
 [('ROOM01','Tạo phòng và mã mời'),('ROOM02','Tham gia bằng PIN hoặc QR'),('ROOM03','Xem phòng chờ'),('ROOM04','Rời phòng chờ'),('ROOM05','Loại thành viên khỏi phòng chờ'),('ROOM06','Bắt đầu phiên nhóm')],
 [('H',x) for x in ['ROOM01','ROOM03','ROOM04','ROOM05','ROOM06']]+[('M',x) for x in ['ROOM02','ROOM03','ROOM04']],
 sources=(PRD,ADR(26,'spark-lobby-leave-host-transfer'),ADR(27,'spark-lobby-member-removal')),
 note='Rời phòng chờ và loại thành viên chỉ áp dụng WAITING. Host rời phòng có thể chuyển quyền; loại thành viên không tạo lệnh cấm tham gia vĩnh viễn.')
usecase('uc-04-phien-nhom', 'UC-04 — Điều phối phiên nhóm', [('H','Host'),('M','Member')],
 [('GROUP01','Xem bảng điểm trực tiếp'),('GROUP02','Xin rời phiên sớm'),('GROUP03','Duyệt hoặc từ chối rời sớm'),('GROUP04','Đề xuất và bỏ phiếu kết thúc'),('GROUP05','Kết thúc phiên hoàn tất'),('GROUP06','Chốt điểm khi còn thiếu đồng bộ'),('GROUP07','Xem tổng kết và lịch sử nhóm')],
 [('H',x) for x in ['GROUP01','GROUP03','GROUP04','GROUP05','GROUP06','GROUP07']]+[('M',x) for x in ['GROUP01','GROUP02','GROUP04','GROUP07']],
 sources=(PRD,ADR(15,'spark-early-exit'),ADR(16,'spark-termination-vote'),ADR(18,'spark-host-finalization-override')),
 note='Bỏ phiếu hủy cần nhất trí của toàn bộ thành viên ACTIVE trong 30 giây. Hoàn tất phiên và hủy phiên có kết quả nghiệp vụ khác nhau.')
usecase('uc-05-hoa-don', 'UC-05 — Hóa đơn và chuyển khoản', [('H','Host'),('M','Member'),('O','Dịch vụ OCR'),('B','Ứng dụng ngân hàng')],
 [('BILL01','Nhập tổng tiền hóa đơn'),('BILL02','Quét hóa đơn và xác nhận gợi ý'),('BILL03','Tính và công bố phần chia'),('BILL04','Điều chỉnh phần chia'),('BILL05','Xem phần tiền và ảnh hóa đơn'),('BILL06','Mở VietQR để chuyển khoản'),('BILL07','Xác nhận thành viên đã trả')],
 [('H',x) for x in ['BILL01','BILL02','BILL03','BILL04','BILL05','BILL07']]+[('M','BILL05'),('M','BILL06'),('O','BILL02'),('B','BILL06')],
 [('BILL02','BILL01','extend')],sources=(API,BILL,OVERRIDE,PAID),
 note='OCR là phần mở rộng tùy chọn khi nhập tổng tiền, dành cho Host Premium còn hạn. Chia tiền dựa trên điểm đã chốt; trạng thái đã trả do Host xác nhận thủ công.')
usecase('uc-06-premium', 'UC-06 — Mua Premium', [('U','Người dùng'),('P','payOS')],
 [('PREM01','Xem các gói Premium'),('PREM02','Tạo yêu cầu thanh toán'),('PREM03','Thanh toán gói Premium'),('PREM04','Kiểm tra trạng thái đơn'),('PREM05','Khôi phục hoặc hủy đơn đang chờ')],
 [('U',x) for x in ['PREM01','PREM02','PREM03','PREM04','PREM05']]+[('P','PREM03')],sources=(PREMIUM,API),
 note='Premium có thời hạn, không tự gia hạn. Webhook xác minh và cấp quyền là luồng kỹ thuật ở Sequence, không phải Use Case do payOS khởi tạo như người sử dụng DontLift.')

# Activity diagrams: flowcharts model UML activities, with explicit branches and terminal nodes.
def activity(slug, title, code, note, sources=(SPEC,API)):
    diagram('activity',slug,title,code,note,sources)

activity('act-01-dang-ky','ACT-01 — Đăng ký và khởi tạo hồ sơ','''
flowchart TD
    A([Bắt đầu]) --> B[Nhập email, mật khẩu, tên]
    B --> C{Dữ liệu hợp lệ?}
    C -->|Không| D[Thông báo lỗi nhập liệu]
    D --> B
    C -->|Có| E[Firebase Auth tạo tài khoản]
    E --> F{Auth thành công?}
    F -->|Không| G[Thông báo lỗi an toàn]
    G --> Z([Kết thúc])
    F -->|Có| H[Transaction tạo hồ sơ nếu chưa có]
    H --> I{Server xác nhận hồ sơ?}
    I -->|Không| J[Giữ trạng thái cần hoàn tất hồ sơ]
    J --> K[Thử lại bootstrap, không tạo lại tài khoản]
    K --> H
    I -->|Có| L[Upsert hồ sơ vào SQLite]
    L --> M[Đi vào ứng dụng]
    M --> Z
''','Auth thành công nhưng hồ sơ chưa hoàn tất là tình huống phục hồi riêng; không ghi đè hồ sơ đã tồn tại.',(SPARK,))
activity('act-02-dang-nhap','ACT-02 — Đăng nhập','''
flowchart TD
    A([Bắt đầu]) --> B[Nhập email và mật khẩu]
    B --> C{Có mạng và dữ liệu hợp lệ?}
    C -->|Không| D[Hiển thị lỗi và cho nhập lại]
    D --> B
    C -->|Có| E[Firebase Auth xác thực]
    E --> F{Thành công?}
    F -->|Không| G[Thông báo đăng nhập thất bại]
    G --> B
    F -->|Có| H[Hoàn tất hoặc phục hồi hồ sơ]
    H --> I[Khởi tạo repository theo UID]
    I --> J[Khôi phục phiên và xử lý outbox phù hợp]
    J --> K([Màn hình chính])
''','SDK quản lý persistence và refresh token; ứng dụng không sao chép refresh token vào bảng riêng.',(SPARK,ARCH))
activity('act-03-solo','ACT-03 — Phiên tập trung cá nhân','''
flowchart TD
    A([Bắt đầu]) --> B[Chọn Countdown hoặc Stopwatch]
    B --> C{Cảm biến sẵn sàng và cấu hình hợp lệ?}
    C -->|Không| D[Thông báo và chờ điều chỉnh]
    D --> B
    C -->|Có| E[SQLite startOrResume theo người dùng]
    E --> F[Đặt điện thoại úp xuống]
    F --> G[Theo dõi cảm biến và lifecycle]
    G --> H{Đến hạn hoặc người dùng kết thúc?}
    H -->|Chưa| G
    H -->|Có| I[Chốt thời lượng và vi phạm]
    I --> J[Transaction lưu tổng kết và outbox]
    J --> K[Hiển thị kết quả cục bộ]
    K --> L{Có mạng?}
    L -->|Có| M[Đồng bộ lịch sử theo ADR-030]
    L -->|Không| N[Giữ outbox chờ gửi]
    M --> Z([Kết thúc])
    N --> Z
''','Countdown hiện kiểm tra 5–720 phút, theo bước 5 phút; Solo có thể hoàn tất khi không có mạng.',(PRD,SOLO))
activity('act-04-phat-hien-vi-pham','ACT-04 — Xác nhận vi phạm 3 giây','''
flowchart TD
    A([Có mẫu cảm biến]) --> B[Phân loại hướng điện thoại]
    B --> C{UNKNOWN?}
    C -->|Có| D[Không xác nhận từ mẫu chưa biết]
    C -->|Không| E{FACE_DOWN?}
    E -->|Không| F[Bắt đầu hoặc tiếp tục candidate]
    F --> G{Đủ 3000 ms?}
    G -->|Chưa| Z([Chờ mẫu hoặc tick tiếp theo])
    G -->|Đủ| H{Đã có vi phạm đang mở?}
    H -->|Chưa| I[Lưu vi phạm bằng eventId ổn định]
    H -->|Rồi| Z
    I --> Z
    E -->|Có| J{Candidate đã đủ 3000 ms?}
    J -->|Có| K[Xác nhận trước khi đóng vi phạm]
    J -->|Không| L[Hủy candidate chưa đủ hạn]
    K --> M[Đóng vi phạm và ghi thời lượng]
    L --> N{Có vi phạm đang mở?}
    N -->|Có| M
    N -->|Không| Z
    M --> Z
    D --> Z
''','Đã đọc GracePeriodEngine: mẫu FACE_DOWN đến sau hạn vẫn phải xác nhận vi phạm đủ điều kiện, không được hủy chỉ vì điện thoại vừa úp lại.',(SPEC,LIFE))
activity('act-05-phuc-hoi-chay-nen','ACT-05 — Phục hồi lifecycle','''
flowchart TD
    A([Phiên rời foreground]) --> B[Ghi candidate bền vững vào SQLite]
    B --> C[Theo dõi khoảng chờ trong giới hạn OS]
    C --> D{Ứng dụng còn thực thi?}
    D -->|Không| E[OS suspend hoặc dừng process]
    E --> F[Mở lại hoặc resume]
    D -->|Có| G[Nhận thời điểm quay lại hoặc đủ hạn]
    F --> H[Đối chiếu marker monotonic và UTC]
    G --> H
    H --> I{Có bất thường thời gian?}
    I -->|Có| J[Giữ dữ liệu cần kiểm tra, không suy diễn]
    I -->|Không| K{Elapsed ít nhất 3 giây?}
    K -->|Không| L[Hủy candidate]
    K -->|Có| M[Xác nhận một lần theo candidate UUID]
    M --> N[Lưu vi phạm và xử lý đồng bộ phù hợp]
    J --> Z([Kết thúc phục hồi])
    L --> Z
    N --> Z
''','Sơ đồ hợp đồng lifecycle ADR-008. Native background adapters là yêu cầu bản dựng phù hợp; không coi Expo Go là bằng chứng đã giám sát nền liên tục.',(LIFE,SPARK))
activity('act-06-tao-tham-gia-phong','ACT-06 — Tạo và tham gia phòng','''
flowchart TD
    A([Đã đăng nhập, có mạng]) --> B{Tạo hay tham gia?}
    B -->|Tạo| C[Host gửi yêu cầu tạo với requestId]
    C --> D{Quota và dữ liệu hợp lệ?}
    D -->|Không| E[Thông báo giới hạn hoặc lỗi]
    D -->|Có| F[Transaction giữ PIN và tạo phòng, membership]
    F --> G[Hiển thị PIN 8 chữ số và QR]
    B -->|Tham gia| H[Nhập PIN hoặc quét QR]
    H --> I[Phân tích lời mời]
    I --> J{WAITING và còn chỗ?}
    J -->|Không| E
    J -->|Có| K[Transaction tạo membership và cập nhật count]
    K --> L[Đăng ký listeners phòng chờ]
    G --> L
    L --> Z([Phòng chờ])
    E --> X([Kết thúc yêu cầu])
''','PIN mới 8 chữ số; lời mời 4 chữ số cũ được chấp nhận trong chuyển tiếp. Tạo/join không xếp hàng để phát lại khi offline.',(API,ADR(11,'spark-room-creation'),ADR(12,'spark-room-join')))
activity('act-07-roi-loai-phong-cho','ACT-07 — Rời hoặc loại thành viên phòng chờ','''
flowchart TD
    A([Phòng WAITING, có mạng]) --> B{Hành động?}
    B -->|Tự rời| C{Người rời là Host?}
    C -->|Không| D[Xóa membership của chính mình và giảm count]
    C -->|Có| E{Còn thành viên khác?}
    E -->|Có| F[Chọn người nhận theo joinedAt và UID]
    F --> G[Transaction chuyển Host, xóa người rời, giảm count]
    E -->|Không| H[Transaction hủy phòng và xóa Host cuối]
    B -->|Loại người khác| I{Caller là Host và đích là MEMBER?}
    I -->|Không| J[Từ chối]
    I -->|Có| K[Xác nhận loại, có thể tham gia lại]
    K --> L[Transaction xóa đích và giảm count]
    D --> M[Chờ server xác nhận rồi dọn cache]
    G --> M
    H --> M
    L --> N[Thiết bị đích xử lý listener server-confirmed]
    N --> Z([Cập nhật màn hình])
    M --> Z
    J --> Z
''','Quyền loại chỉ ở WAITING. Rules kiểm tra chuyển quyền nguyên tử, không chứng minh thuật toán chọn thành viên sớm nhất.',(ADR(26,'spark-lobby-leave-host-transfer'),ADR(27,'spark-lobby-member-removal')))
activity('act-08-phien-nhom','ACT-08 — Theo dõi phiên nhóm','''
flowchart TD
    A([Host bắt đầu từ WAITING]) --> B[Transaction chuyển ACTIVE]
    B --> C[Clients nhận snapshot đã commit]
    C --> D[Mỗi thiết bị theo dõi vi phạm độc lập]
    D --> E[Lưu sự kiện vào SQLite]
    E --> F{Có mạng?}
    F -->|Không| G[Giữ sự kiện cục bộ]
    F -->|Có| H[Transaction đồng bộ theo eventId và cutoff]
    H --> I[Listener cập nhật bảng điểm]
    G --> J{Phiên còn ACTIVE?}
    I --> J
    J -->|Có| D
    J -->|Không| K[Chốt dữ liệu theo cutoff chính thức]
    K --> Z([Đi vào luồng tổng kết phù hợp])
''','Điểm chia sẻ lấy từ Firestore; sự kiện đến muộn phải tuân thủ thời gian kết thúc/rời sớm và trạng thái chốt điểm.',(ADR(13,'spark-room-start'),ADR(14,'spark-group-violations'),ADR(15,'spark-early-exit')))
activity('act-09-roi-som','ACT-09 — Xin rời sớm','''
flowchart TD
    A([Member ACTIVE]) --> B[Gửi yêu cầu rời sớm]
    B --> C[Host nhận yêu cầu qua listener]
    C --> D{Host chấp thuận?}
    D -->|Không| E[Ghi quyết định từ chối]
    E --> F[Member tiếp tục phiên]
    D -->|Có| G[Transaction ghi cutoff và EARLY_EXIT]
    G --> H[Giảm số thành viên đang hoạt động]
    H --> I[Member dừng tích lũy vi phạm sau cutoff]
    I --> J[Đồng bộ sự kiện đủ điều kiện trước cutoff]
    J --> K[Giữ thành viên trong kết quả và chia hóa đơn]
    F --> Z([Kết thúc yêu cầu])
    K --> Z
''','Nếu việc rời làm phiếu kết thúc đang mở trở thành nhất trí hợp lệ, giao dịch xử lý trạng thái phòng theo ADR-016.',(ADR(15,'spark-early-exit'),ADR(16,'spark-termination-vote')))
activity('act-10-bieu-quyet','ACT-10 — Biểu quyết hủy phiên','''
flowchart TD
    A([Thành viên ACTIVE đề xuất]) --> B[Tạo phiếu và mốc thời gian server]
    B --> C[Thu thập phiếu của thành viên ACTIVE]
    C --> D{Đủ 100 phần trăm đồng ý trước hạn?}
    D -->|Có| E[Transaction chuyển CANCELLED]
    E --> F[Dừng phiên, lưu lịch sử phù hợp]
    F --> G[Không chia hóa đơn theo điểm]
    D -->|Chưa| H{Đã hết 30 giây?}
    H -->|Chưa| C
    H -->|Rồi| I[Phiếu không còn hiệu lực]
    I --> J[Phiên tiếp tục ACTIVE]
    G --> Z([Kết thúc])
    J --> Z
''','Hết hạn được kiểm tra theo thời gian server; không cần scheduler xóa phiếu.',(ADR(16,'spark-termination-vote'),))
activity('act-11-ket-thuc-chot-diem','ACT-11 — Hoàn tất và chốt điểm','''
flowchart TD
    A([Host xác nhận hoàn tất]) --> B[Transaction COMPLETED và PENDING]
    B --> C[Mỗi thành viên gửi sự kiện đủ điều kiện]
    C --> D[Kiểm tra outbox rồi ACK]
    D --> E{Còn thành viên chưa ACK?}
    E -->|Không| F[FINALIZED với ALL_SYNCED]
    E -->|Có| G{Host chọn chốt thiếu dữ liệu?}
    G -->|Không| H[Tiếp tục chờ kết nối và ACK]
    H --> C
    G -->|Có| I[Xác nhận cảnh báo dữ liệu đến muộn]
    I --> J[Transaction FINALIZED với HOST_OVERRIDE và audit]
    J --> K[Sự kiện muộn hợp lệ chỉ lưu lịch sử]
    F --> L[Cho phép tính hóa đơn]
    K --> L
    L --> Z([Điểm đã đóng băng])
''','ACK là lời xác nhận từ client. Danh sách chưa ACK trong audit là quan sát của Host, không phải roster đã được server xác minh đầy đủ.',(ADR(17,'spark-room-completion'),ADR(18,'spark-host-finalization-override')))
activity('act-12-ocr','ACT-12 — Quét hóa đơn và xác nhận','''
flowchart TD
    A([Host nhập hóa đơn]) --> B{Premium còn hạn?}
    B -->|Không| C[Nhập tay hoặc xem gói Premium]
    B -->|Có| D[Chụp ảnh hoặc chọn thư viện]
    D --> E{Hủy hoặc từ chối quyền?}
    E -->|Có| C
    E -->|Không| F[Kiểm tra JPEG, PNG, WEBP và giới hạn dung lượng]
    F --> G[Gửi yêu cầu nhận diện]
    G --> H{Có gợi ý phù hợp?}
    H -->|Không hoặc lỗi| C
    H -->|Có| I[Hiển thị số tiền, căn cứ và cảnh báo]
    I --> J{Host chấp nhận số tiền từ 1000 VND?}
    J -->|Không| C
    J -->|Có| K[Tải ảnh đã chấp nhận vào kho riêng tư]
    K --> L{Tải ảnh thành công?}
    L -->|Có| N[Điền số tiền và giữ evidencePath]
    L -->|Không| P[Giữ số tiền cũ và hiển thị lỗi lưu ảnh]
    P --> Q{Host chọn cách tiếp tục?}
    Q -->|Thử lại| K
    Q -->|Không kèm ảnh| R[Áp dụng gợi ý, không gắn ảnh]
    Q -->|Nhập tay| C
    N --> M[Xem trước phần chia, chưa tự công bố]
    R --> M
    C --> M
    M --> Z([Tiếp tục quy trình hóa đơn])
''','Luồng production qua Express; development có thể gọi PaddleOCR trong LAN. Lỗi và hủy không tự thay số tiền hiện có. Không lưu OCR thô.',(API,))
activity('act-13-chia-hoa-don','ACT-13 — Tính, điều chỉnh và công bố hóa đơn','''
flowchart TD
    A([COMPLETED và FINALIZED]) --> B[Host nhập tổng tiền và thông tin nhận]
    B --> C[Đọc điểm đóng băng của danh sách thành viên]
    C --> D{Tổng điểm bằng 0?}
    D -->|Có| E[Chia đều số tiền gốc]
    D -->|Không| F[40 phần trăm chia đều, 60 theo tỷ lệ điểm]
    E --> G[Tạo vector phần tiền chưa làm tròn]
    F --> G
    G --> H{Có override?}
    H -->|Có| I[Thay phần được chọn, giữ phần còn lại]
    I --> J{Tổng vector bằng hóa đơn?}
    J -->|Không| K[Yêu cầu sửa điều chỉnh]
    K --> I
    J -->|Có| L[Làm tròn và phân phối chênh lệch]
    H -->|Không| L
    L --> M[Kiểm tra không âm và tổng tiền chính xác]
    M --> N[Chuẩn bị manifest và stage từng nhóm share]
    N --> O[Transaction công bố con trỏ và receipt]
    O --> P[Thành viên xem kết quả đã công bố]
    P --> Z([Kết thúc])
''','Sơ đồ khái quát pipeline toán học dùng chung. Công bố mặc định và override có hợp đồng ghi phiên bản riêng; override bị khóa khi billPaidCount lớn hơn 0.',(BILL,OVERRIDE))
activity('act-14-vietqr-thanh-toan','ACT-14 — VietQR và xác nhận đã trả','''
flowchart TD
    A([Member mở phần tiền]) --> B[Đọc phiên bản bill và thông tin nhận còn hạn]
    B --> C{Phần tiền dương và chưa trả?}
    C -->|Không| D[Hiển thị không cần trả hoặc đã xác nhận]
    C -->|Có| E[Tạo VietQR đúng số tiền và nội dung]
    E --> F[Mở ngân hàng hỗ trợ hoặc hiển thị QR]
    F --> G[Người dùng thực hiện chuyển khoản ngoài ứng dụng]
    G --> H[Host đối chiếu giao dịch thực tế]
    H --> I{Host xác nhận đã nhận?}
    I -->|Không| J[Giữ trạng thái chưa xác nhận]
    I -->|Có| K[Transaction cập nhật share, receipt và paid count]
    K --> L[Khóa điều chỉnh sau khoản xác nhận đầu tiên]
    L --> Z([Cập nhật trạng thái cho nhóm])
    D --> Z
    J --> Z
''','Không có webhook ngân hàng cho luồng chia hóa đơn; mở ngân hàng hoặc quét QR không tự đổi trạng thái đã trả.',(PAID,API))
activity('act-15-premium','ACT-15 — Mua và cấp quyền Premium','''
flowchart TD
    A([Chọn gói]) --> B[Express xác minh Firebase ID token]
    B --> C[Tạo hoặc phục hồi đơn theo requestId]
    C --> D[payOS cung cấp checkout]
    D --> E[Người dùng thanh toán]
    E --> F{Nhận webhook hợp lệ?}
    F -->|Chưa| G[Giữ trạng thái đang chờ, cho kiểm tra lại]
    F -->|Có| H[Kiểm chữ ký và đọc giao dịch qua API payOS]
    H --> I{Đúng đơn, số tiền và trạng thái PAID?}
    I -->|Không| J[Không cấp quyền]
    I -->|Có| K[Transaction receipt và cộng thời hạn một lần]
    K --> L[Ứng dụng đọc premiumExpiresAt mới]
    L --> Z([Cập nhật quyền sử dụng])
    G --> Z
    J --> Z
''','Redirect chỉ phục vụ điều hướng. Webhook gửi lặp không được gia hạn lặp; mua không tự gia hạn định kỳ.',(PREMIUM,API))
activity('act-16-lich-su','ACT-16 — Tra cứu lịch sử','''
flowchart TD
    A([Mở lịch sử theo UID]) --> B[Đọc dữ liệu SQLite và cache]
    B --> C[Hiển thị danh sách phân trang]
    C --> D{Có mạng?}
    D -->|Có| E[Đọc lịch sử cá nhân và chỉ mục nhóm có quyền]
    E --> F[Hợp nhất tại repository, giữ dữ liệu pending]
    D -->|Không| G[Hiển thị dữ liệu cục bộ và trạng thái offline]
    F --> H[Chọn chi tiết phiên]
    G --> H
    H --> I[Phân biệt thống kê thiết bị và điểm nhóm đã chốt]
    I --> J{Mở thanh toán còn nợ?}
    J -->|Có| K[Xác minh lại membership, bill hiện tại và expiry]
    K --> L[Chỉ mở VietQR nếu đủ điều kiện]
    J -->|Không| Z([Kết thúc tra cứu])
    L --> Z
''','Không lưu thông tin ngân hàng hay QR trong lịch sử. Chỉ mục shared room hỗ trợ thành viên tìm lại phiên; tổng kết cục bộ không thay thế điểm nhóm.',(SOLO,ADR(24,'spark-group-history'),ADR(28,'shared-group-history-index')))

# Sequence diagrams: each uses actual trust boundaries rather than a fictional universal server.
def sequence(slug,title,code,note,sources=(API,ARCH)):
    diagram('sequence',slug,title,code,note,sources)

sequence('seq-01-dang-ky','SEQ-01 — Đăng ký và phục hồi hồ sơ','''
sequenceDiagram
    actor U as Người dùng
    participant A as Ứng dụng
    participant F as Firebase Auth
    participant D as Firestore và Rules
    participant L as SQLite
    U->>A: Gửi thông tin đăng ký
    A->>F: createUserWithEmailAndPassword
    F-->>A: Danh tính đã xác thực
    A->>D: Transaction đọc hồ sơ theo UID
    alt Chưa có hồ sơ
        A->>D: Tạo allowlist, Premium mặc định, server timestamp
    else Đã có hồ sơ
        D-->>A: Trả hồ sơ hiện hữu, không ghi đè
    end
    alt Server xác nhận thành công
        D-->>A: Hồ sơ chính thức
        A->>L: Upsert local profile
        A-->>U: Hoàn tất
    else Lỗi sau khi Auth đã thành công
        A-->>U: Cần thử lại hoàn tất hồ sơ
        Note over A,F: Không tạo tài khoản mới khi retry bootstrap
    end
''','Theo runtime Firebase JS SDK, không dùng callable bootstrap cũ.',(SPARK,))
sequence('seq-02-solo','SEQ-02 — Hoàn tất và đồng bộ Solo','''
sequenceDiagram
    actor U as Người dùng
    participant C as Solo controller
    participant L as SQLite và outbox
    participant W as Sync worker
    participant D as Firestore và Rules
    U->>C: Bắt đầu phiên
    C->>L: startOrResume
    L-->>C: Session ID ổn định
    Note over C,L: Theo dõi cảm biến và lưu vi phạm cục bộ
    U->>C: Kết thúc hoặc Countdown về 0
    C->>L: Transaction tổng kết và outbox
    C-->>U: Hiển thị tổng kết ngay
    W->>L: Claim mục đến hạn
    W->>D: Đọc users/uid/sessions/sessionId
    alt Chưa tồn tại
        W->>D: Create-only với payloadHash
        D-->>W: Commit
    else Hash giống nhau
        D-->>W: Idempotent success
    else Hash khác
        D-->>W: Conflict
    end
    W->>L: Ghi SYNCED hoặc FAILED tương ứng
''','Tổng kết cá nhân tự báo cáo; không dùng để cấp quyền, chia tiền hay sửa điểm nhóm.',(SOLO,))
sequence('seq-03-cam-bien','SEQ-03 — Cảm biến và vi phạm','''
sequenceDiagram
    participant S as Expo Sensors
    participant P as Phone-down engine
    participant G as GracePeriodEngine
    participant C as Detection controller
    participant L as SQLite
    S->>P: Mẫu x, y, z
    P-->>C: FACE_DOWN, LIFTED, INVALID hoặc UNKNOWN
    C->>G: observe và snapshot theo thời gian
    alt Candidate chưa đủ 3 giây và trở lại úp
        G-->>C: Hủy candidate
    else Đủ 3 giây
        G-->>C: shouldConfirm
        C->>L: Lưu eventId và thời điểm xác nhận
        L-->>C: Commit
        C->>G: markConfirmed
    end
    opt Có vi phạm đang mở và trở về FACE_DOWN
        G-->>C: shouldEndViolation
        C->>L: Kết thúc vi phạm, ghi thời lượng và outbox phù hợp
        C->>G: markEnded
    end
''','Dữ liệu cảm biến thô không rời thiết bị; snapshot trạng thái chưa biết không tự chứng minh vi phạm.',(SPEC,LIFE))
sequence('seq-04-lifecycle','SEQ-04 — Background và phục hồi','''
sequenceDiagram
    participant OS as Hệ điều hành
    participant A as Lifecycle adapter
    participant L as SQLite
    participant R as Recovery engine
    OS->>A: inactive hoặc background
    A->>L: Ghi candidate UUID và marker thời gian
    opt Bản dựng có native adapter theo ADR-008
        A->>OS: Đăng ký thời gian nền giới hạn
    end
    OS-->>A: Có thể suspend trước khi timer chạy
    Note over OS,L: Candidate đã bền vững, chưa là vi phạm xác nhận
    OS->>R: Resume hoặc khởi động lại
    R->>L: Đọc candidate chưa giải quyết
    R->>R: Đối chiếu monotonic, UTC và clock anomaly
    alt Elapsed hợp lệ dưới 3 giây
        R->>L: CANCELLED
    else Elapsed hợp lệ từ 3 giây
        R->>L: Confirm một lần theo UUID
    else Không suy ra được thời gian an toàn
        R->>L: NEEDS_REVIEW
    end
''','Đây là hợp đồng lifecycle; không khẳng định Expo Go thực thi native background task hoặc WorkManager.',(LIFE,SPARK))
sequence('seq-05-tao-phong','SEQ-05 — Tạo phòng trên Spark','''
sequenceDiagram
    actor H as Host
    participant A as Room repository
    participant D as Firestore transaction và Rules
    H->>A: Tạo phòng với requestId
    A->>D: Đọc receipt, quota, PIN reservation
    alt Request đã commit cùng payload
        D-->>A: Trả lại phòng cũ
    else PIN bị trùng
        D-->>A: Thử PIN khác trong giới hạn
    else Đủ quota và quyền
        A->>D: Tạo room WAITING, HOST member, PIN, receipt và usage
        D-->>A: Commit nguyên tử
    else Hết quota hoặc thiếu quyền
        D-->>A: Từ chối
    end
    A-->>H: PIN, QR hoặc lỗi rõ ràng
''','Không gọi createRoom Cloud Function trong luồng Spark hiện tại.',(ADR(11,'spark-room-creation'),API))
sequence('seq-06-join-start','SEQ-06 — Tham gia và bắt đầu nhóm','''
sequenceDiagram
    actor M as Member
    actor H as Host
    participant A as Clients
    participant D as Firestore và Rules
    M->>A: Nhập PIN hoặc quét QR
    A->>D: Transaction resolve lời mời và kiểm tra WAITING
    A->>D: Tạo member, tăng count, ghi receipt
    D-->>A: Commit hoặc từ chối capacity
    D-->>H: Listener cập nhật roster
    H->>A: Bắt đầu phiên
    A->>D: Transaction startRoom
    D-->>A: ACTIVE và thời gian server
    A-->>M: Khởi tạo theo dõi trên thiết bị
    A-->>H: Khởi tạo theo dõi trên thiết bị
''','Membership là subcollection members theo UID. Retry cùng request không tạo thêm thành viên.',(ADR(12,'spark-room-join'),ADR(13,'spark-room-start')))
sequence('seq-07-dong-bo-vi-pham','SEQ-07 — Đồng bộ vi phạm nhóm','''
sequenceDiagram
    participant C as Detection controller
    participant L as SQLite và outbox
    participant W as Group sync worker
    participant D as Firestore và Rules
    participant V as Clients trong phòng
    C->>L: Ghi sự kiện với eventId ổn định
    W->>L: Claim sự kiện đủ điều kiện
    W->>D: Transaction đọc room, member và event đích
    alt Event đã tồn tại cùng nội dung
        D-->>W: Kết quả cũ, không cộng lặp
    else Còn hợp lệ để cập nhật điểm
        W->>D: Ghi event và cập nhật aggregate nguyên tử
        D-->>V: Listener nhận điểm mới
    else Sau HOST_OVERRIDE nhưng event hợp lệ trước cutoff
        W->>D: Ghi history-only, excludedFromFinalScore
    else Ngoài cutoff hoặc không đủ quyền
        D-->>W: Từ chối theo hợp đồng
    end
    W->>L: ACK hoặc ghi trạng thái lỗi
''','Rules kiểm tra giao dịch và dữ liệu, không chứng minh cảm biến thực sự quan sát được sự kiện.',(ADR(14,'spark-group-violations'),ADR(15,'spark-early-exit'),ADR(18,'spark-host-finalization-override')))
sequence('seq-08-roi-som','SEQ-08 — Yêu cầu và duyệt rời sớm','''
sequenceDiagram
    actor M as Member
    actor H as Host
    participant D as Firestore và Rules
    participant L as SQLite của Member
    M->>D: Transaction tạo yêu cầu rời sớm
    D-->>H: Listener yêu cầu mới
    H->>D: Transaction approve hoặc deny
    alt Approve
        D->>D: Cập nhật EARLY_EXIT, cutoff và activeMemberCount
        D-->>M: Snapshot xác nhận rời sớm
        M->>L: Dừng tracking tại cutoff và lưu tổng kết phù hợp
        M->>D: Gửi nốt vi phạm đủ điều kiện trước cutoff
    else Deny
        D-->>M: Tiếp tục ACTIVE
    end
''','Thành viên rời sớm vẫn ở roster phục vụ tổng kết và chia tiền.',(ADR(15,'spark-early-exit'),))
sequence('seq-09-bieu-quyet','SEQ-09 — Biểu quyết kết thúc','''
sequenceDiagram
    actor I as Người đề xuất ACTIVE
    participant D as Firestore và Rules
    participant M as Các thành viên ACTIVE
    I->>D: Mở phiếu với thời điểm server
    D-->>M: Listener phiếu đang mở
    loop Trong 30 giây
        M->>D: Transaction ghi lựa chọn của chính mình
        D->>D: Kiểm tra active denominator và hạn phiếu
    end
    alt Toàn bộ ACTIVE đồng ý trước hạn
        D->>D: Commit CANCELLED cùng giao dịch quyết định
        D-->>M: Dừng phiên, bỏ luồng chia hóa đơn
    else Không đạt nhất trí trước hạn
        Note over D,M: Phiếu hết hiệu lực theo server time, không có scheduler
        D-->>M: Phiên tiếp tục ACTIVE
    end
''','Các nhánh là kết quả giao dịch do client khởi tạo và Rules kiểm tra; Firestore không tự chạy timer kết thúc phiếu.',(ADR(16,'spark-termination-vote'),))
sequence('seq-10-chot-diem','SEQ-10 — Hoàn tất, ACK và Host override','''
sequenceDiagram
    actor H as Host
    participant D as Firestore và Rules
    participant M as Mỗi thành viên
    participant L as SQLite của thành viên
    H->>D: completeRoom transaction
    D-->>M: COMPLETED, reconciliation PENDING, endedAt
    M->>L: Kiểm tra và gửi outbox đến cutoff
    M->>D: ACK sau kiểm tra cục bộ
    D->>D: Giảm pendingMemberCount nguyên tử
    alt ACK cuối cùng
        D->>D: FINALIZED với ALL_SYNCED
    else Host chọn override khi vẫn còn pending
        H->>H: Xác nhận cảnh báo và snapshot pending UIDs
        H->>D: Transaction chốt điểm và create-only audit
        D->>D: FINALIZED với HOST_OVERRIDE
        Note over D,M: Event muộn hợp lệ chỉ lưu lịch sử, không sửa điểm
    end
    D-->>H: Cho phép tính bill từ điểm đóng băng
''','Không có timeout tự chốt ALL_SYNCED. Rules không đọc SQLite và không chứng minh danh sách pending của Host đầy đủ.',(ADR(17,'spark-room-completion'),ADR(18,'spark-host-finalization-override')))
sequence('seq-11-ocr-production','SEQ-11 — PaddleOCR qua Express trong production','''
sequenceDiagram
    actor H as Host Premium
    participant A as Mobile
    participant E as Express API
    participant D as Firebase Admin và Firestore
    participant O as PaddleOCR
    H->>A: Chụp hoặc chọn ảnh
    A->>E: POST bills/scan, roomId, Bearer token và bytes
    E->>D: Xác minh token, expiry, Host, membership và FINALIZED
    alt Không đủ quyền hoặc ảnh sai
        E-->>A: Lỗi đã làm sạch
    else Đủ điều kiện
        E->>O: Multipart image và khóa server-only
        alt Dịch vụ phản hồi hợp lệ
            O-->>E: amount, suggested_amount, warnings và evidence
            E-->>A: Gợi ý VND, needs_confirmation
            A-->>H: Yêu cầu đối chiếu và xác nhận
        else Timeout hoặc lỗi
            E-->>A: Lỗi OCR, không tự retry
            A-->>H: Giữ số tiền hiện tại và cho nhập tay
        end
    end
''','Development gọi trực tiếp PaddleOCR qua LAN được mô tả ở sơ đồ triển khai riêng. OCR không tự điền hay công bố bill.',(API,))
sequence('seq-12-anh-minh-chung','SEQ-12 — Ảnh hóa đơn riêng tư','''
sequenceDiagram
    actor H as Host
    participant A as Mobile
    participant E as Express API
    participant C as Cloudinary private media
    participant D as Firestore
    actor M as Member
    H->>A: Chấp nhận gợi ý OCR
    A->>E: POST bills/evidence với ảnh và roomId
    E->>D: Xác minh Premium Host và room FINALIZED
    E->>C: Upload private media
    C-->>E: evidencePath
    E-->>A: evidencePath
    A->>D: Gắn path vào lần công bố bill
    M->>E: GET bills/evidence theo room và path
    E->>D: Kiểm tra membership và path đã công bố
    E->>C: Tạo URL tải riêng tư 5 phút
    E-->>M: URL có thời hạn
    M->>C: Xem ảnh
    Note over A,D: Không lưu URL ngắn hạn hoặc OCR thô trong Firestore
''','Tài nguyên chưa công bố có thể được Host yêu cầu xóa qua API; tài nguyên đã liên kết bill không được xóa bằng luồng này.',(API,))
sequence('seq-13-cong-bo-bill','SEQ-13 — Công bố phần chia theo từng đợt','''
sequenceDiagram
    actor H as Host
    participant A as Bill allocation và repository
    participant D as Firestore và Rules
    participant M as Member listeners
    H->>A: Xác nhận tổng tiền và preview
    A->>D: Đọc FINALIZED scores và settlement details
    A->>A: Tính integer shares và kiểm tra exact sum
    A->>D: Transaction tạo preparation manifest và khóa phòng
    loop Mỗi đợt tối đa 8 share
        A->>D: Stage shares với requestId
    end
    Note over D,M: Shares đang stage chưa hiển thị cho Member
    A->>D: Transaction publish metadata, manifest và immutable receipt
    D-->>M: Kết quả đã công bố
    alt Mất response hoặc khởi động lại
        A->>D: Đọc manifest và receipt cùng requestId
        D-->>A: Tiếp tục hoặc replay kết quả đã commit
    end
''','Rules xác minh quyền, trạng thái và cấu trúc; không xác minh toàn bộ phép chia hay tính đầy đủ roster.',(BILL,API))
sequence('seq-14-override-bill','SEQ-14 — Điều chỉnh phiên bản phần chia','''
sequenceDiagram
    actor H as Host
    participant A as Bill repository
    participant D as Firestore và Rules
    participant M as Member
    H->>A: Nhập FIXED_VND hoặc PERCENT_BPS
    A->>A: Thay raw shares được chọn, kiểm tra tổng và làm tròn
    A->>D: Kiểm tra billPaidCount bằng 0 và revision hiện tại
    A->>D: Stage bản override theo requestId
    A->>D: Publish revision và con trỏ override nguyên tử
    D-->>M: Listener đọc shares của revision đang công bố
    alt Khoản đã được đánh dấu trả hoặc revision thay đổi
        D-->>A: Reject, tải lại trạng thái
    end
''','Share ở bản cũ không được dùng để tạo QR hoặc xác nhận trả cho phiên bản mới.',(OVERRIDE,API))
sequence('seq-15-xac-nhan-tra','SEQ-15 — Xác nhận trả tiền thủ công','''
sequenceDiagram
    actor M as Member
    participant A as Mobile
    participant B as Ngân hàng
    actor H as Host
    participant D as Firestore và Rules
    M->>A: Mở phần tiền hiện tại còn nợ
    A->>D: Xác minh bill và settlement details còn hạn
    A-->>M: Hiển thị QR hoặc bank deep link
    M->>B: Thực hiện chuyển khoản ngoài DontLift
    H->>B: Đối chiếu tiền đã nhận
    H->>A: Xác nhận share đã trả
    A->>D: Transaction current share, receipt và billPaidCount
    alt Cùng request đã commit
        D-->>A: Replay, không tăng count lần nữa
    else Share dương hợp lệ chưa trả
        D-->>A: MARKED_AS_PAID và count tăng một
    end
    D-->>M: Listener trạng thái Host đã xác nhận
''','Không có callback ngân hàng tự động. Share bằng 0 hiển thị không cần thanh toán.',(PAID,API))
sequence('seq-16-premium','SEQ-16 — payOS và cấp quyền có thời hạn','''
sequenceDiagram
    actor U as Người dùng
    participant A as Mobile
    participant E as Express API
    participant P as payOS
    participant D as Firestore qua Admin
    U->>A: Chọn packageId
    A->>E: Tạo order với requestId và Firebase token
    E->>D: Reserve orderCode, giá lấy từ server
    E->>P: Tạo hoặc phục hồi payment link
    P-->>E: Checkout URL
    E-->>A: Thông tin order
    A-->>U: Mở checkout
    U->>P: Thanh toán
    P->>E: Webhook
    E->>E: Xác minh chữ ký
    E->>P: Đọc payment link bằng API đã xác thực
    P-->>E: Order, amount, link ID và trạng thái
    E->>D: Transaction receipt và gia hạn một lần
    A->>E: Kiểm tra trạng thái order
    E-->>A: Trạng thái và expiry được xác nhận
    Note over A,D: Redirect không cấp quyền, expiry chỉ server được ghi
''','Đơn khác nhau cộng nối thời hạn từ max(now, expiry cũ); webhook lặp không cộng lặp.',(PREMIUM,API))
sequence('seq-17-lich-su','SEQ-17 — Khôi phục lịch sử trên thiết bị','''
sequenceDiagram
    actor U as Người dùng
    participant A as History repository
    participant L as SQLite
    participant D as Firestore và Rules
    U->>A: Mở History
    A->>L: Đọc lịch sử owner, phân trang
    L-->>A: Local summary và cache
    A-->>U: Hiển thị ngay dữ liệu đang có
    opt Có kết nối
        A->>D: Đọc personal summaries và owner room index
        D-->>A: Chỉ các bản ghi có quyền
        A->>L: Cập nhật cache, giữ pending hoặc failed
        A-->>U: Cập nhật danh sách
    end
    U->>A: Mở chi tiết nhóm
    A->>D: Đọc room, membership và bill theo quyền hiện tại
    A-->>U: Phân biệt local stats và canonical score
''','Thông tin chuyển khoản cần đọc mới trước khi mở VietQR; không khôi phục QR từ lịch sử cục bộ.',(SOLO,ADR(24,'spark-group-history'),ADR(28,'shared-group-history-index')))
sequence('seq-18-roi-phong-cho','SEQ-18 — Chuyển Host khi rời phòng chờ','''
sequenceDiagram
    actor H as Host hiện tại
    participant A as Lobby repository
    participant D as Firestore và Rules
    participant M as Các thành viên
    H->>A: Xác nhận rời phòng WAITING
    A->>D: Đọc roster từ server
    A->>A: Chọn thành viên joinedAt sớm nhất, tie UID
    alt Có người nhận quyền
        A->>D: Transaction đọc lại count và recipient
        A->>D: Xóa Host cũ, đổi hostId, promote recipient, giảm count
    else Host là người cuối cùng
        A->>D: Transaction xóa membership và CANCELLED
    end
    D-->>A: Commit hoặc retry do thay đổi đồng thời
    D-->>M: Listener hostId, vai trò và count mới
    A-->>H: Dọn cache sau server success
''','Rules kiểm tra recipient đủ điều kiện và writes liên kết, không chứng minh thứ tự lựa chọn.',(ADR(26,'spark-lobby-leave-host-transfer'),))

# State diagrams distinguish stored states from analytical/derived states.
def state(slug,title,code,note,sources=(SPEC,API)):
    diagram('state-machine',slug,title,code,note,sources)

state('stm-01-huong-dien-thoai','STM-01 — Phân loại hướng điện thoại','''
stateDiagram-v2
    [*] --> UNKNOWN
    UNKNOWN --> FACE_DOWN: Mẫu hợp lệ, z trên độ lớn không vượt -0.85
    UNKNOWN --> LIFTED: Mẫu hợp lệ nhưng không úp
    UNKNOWN --> INVALID: Không hữu hạn hoặc độ lớn ngoài khoảng
    FACE_DOWN --> LIFTED: Thay đổi hướng khỏi ngưỡng úp
    FACE_DOWN --> INVALID: Mẫu không hợp lệ
    LIFTED --> FACE_DOWN: Trở về ngưỡng úp
    LIFTED --> INVALID: Mẫu không hợp lệ
    INVALID --> FACE_DOWN: Mẫu hợp lệ và úp
    INVALID --> LIFTED: Mẫu hợp lệ nhưng không úp
    FACE_DOWN --> UNKNOWN: Không có mẫu
    LIFTED --> UNKNOWN: Không có mẫu
    INVALID --> UNKNOWN: Không có mẫu
''','Theo phone-down-engine.ts: độ lớn hợp lệ 0.65–1.35 g, z/magnitude ≤ -0.85 là FACE_DOWN. Không tự coi UNKNOWN là vi phạm.',(SPEC,))
state('stm-02-grace','STM-02 — Vòng đời xác nhận vi phạm','''
stateDiagram-v2
    state "Không có candidate" as Idle
    state "Đang chờ 3 giây" as Grace
    state "Vi phạm đang mở" as Open
    state "Đã đóng vi phạm" as Closed
    [*] --> Idle
    Idle --> Grace: INVALID hoặc LIFTED
    Grace --> Idle: FACE_DOWN trước 3 giây
    Grace --> Idle: UNKNOWN khi chưa có vi phạm mở
    Grace --> Open: Đủ hạn, lưu thành công rồi markConfirmed
    Open --> Open: Vẫn chưa FACE_DOWN
    Open --> Closed: FACE_DOWN, lưu thời điểm kết thúc
    Closed --> Idle: markEnded
''','Các nhãn Idle/Grace/Open/Closed là trạng thái phân tích của engine, không phải enum lưu trong SQLite. FACE_DOWN sau hạn cần xác nhận rồi đóng.',(SPEC,LIFE))
state('stm-03-lifecycle-candidate','STM-03 — Candidate lifecycle bền vững','''
stateDiagram-v2
    [*] --> PENDING: Rời foreground, commit candidate
    PENDING --> CANCELLED: Quay lại trước 3 giây
    PENDING --> CONFIRMED: Elapsed hợp lệ từ 3 giây
    PENDING --> NEEDS_REVIEW: Clock anomaly hoặc marker không an toàn
    CANCELLED --> [*]
    CONFIRMED --> [*]
    NEEDS_REVIEW --> [*]: Giữ bản ghi chờ xử lý phù hợp
''','Không vẽ NEEDS_REVIEW tự chuyển sang CONFIRMED khi chưa có hợp đồng xử lý. CONFIRMED liên kết cùng UUID với vi phạm để chống trùng.',(LIFE,))
state('stm-04-solo','STM-04 — Phiên Solo','''
stateDiagram-v2
    [*] --> ACTIVE: startOrResume hợp lệ, ghi SQLite
    ACTIVE --> ACTIVE: Resume cùng phiên đã lưu
    ACTIVE --> COMPLETED: Kết thúc và lưu summary với outbox
    ACTIVE --> CANCELLED: Hủy phiên qua controller
    COMPLETED --> [*]
    CANCELLED --> [*]
''','Sơ đồ luồng runtime Solo; schema hỗ trợ CREATED nhưng không coi đó là bước bắt buộc của startOrResume hiện tại. Trạng thái đồng bộ được vẽ riêng.',(PRD,SOLO))
state('stm-05-phong','STM-05 — Vòng đời phòng','''
stateDiagram-v2
    [*] --> WAITING: createRoom commit
    WAITING --> WAITING: Join, leave, transfer hoặc kick hợp lệ
    WAITING --> ACTIVE: Host startRoom
    WAITING --> CANCELLED: Host cuối cùng rời phòng chờ
    ACTIVE --> COMPLETED: Host completeRoom
    ACTIVE --> CANCELLED: Nhất trí ACTIVE trong 30 giây
    ACTIVE --> ABORTED: Client online xác nhận heartbeat quá 15 phút
    COMPLETED --> [*]
    CANCELLED --> [*]
    ABORTED --> [*]
''','Không có scheduler tự chuyển ABORTED trên Spark. Nếu mọi thiết bị offline, chuyển trạng thái chỉ xảy ra khi client đủ điều kiện kết nối lại.',(API,ADR(19,'spark-stale-room-abort'),ADR(26,'spark-lobby-leave-host-transfer')))
state('stm-06-reconciliation','STM-06 — Đối soát và chốt điểm','''
stateDiagram-v2
    state "PENDING" as Pending
    state "FINALIZED / ALL_SYNCED" as AllSynced
    state "FINALIZED / HOST_OVERRIDE" as Override
    [*] --> Pending: completeRoom
    Pending --> Pending: ACK hợp lệ, vẫn còn pending
    Pending --> AllSynced: ACK cuối cùng
    Pending --> Override: Host xác nhận cảnh báo và ghi audit
    AllSynced --> [*]
    Override --> [*]
''','ALL_SYNCED và HOST_OVERRIDE là finalizationReason; FINALIZED là reconciliationStatus. Điểm đã chốt không được sửa bởi sự kiện muộn.',(ADR(17,'spark-room-completion'),ADR(18,'spark-host-finalization-override')))
state('stm-07-outbox','STM-07 — Trạng thái hàng đợi đồng bộ','''
stateDiagram-v2
    [*] --> PENDING: Commit dữ liệu và outbox
    PENDING --> PENDING: Claim lease hoặc lỗi tạm thời và backoff
    PENDING --> PENDING: Lease hết hạn, worker claim lại
    PENDING --> SYNCED: Server xác nhận hoặc replay trùng hợp lệ
    PENDING --> FAILED: Lỗi vĩnh viễn hoặc xung đột nội dung
    FAILED --> PENDING: Retry có kiểm tra theo owner và sự kiện
    SYNCED --> [*]
''','Lease không tạo trạng thái SENDING mới. Không retry vô hạn lỗi schema/quyền; retry thủ công tuân thủ hợp đồng từng loại sự kiện.',(ARCH,SOLO))
state('stm-08-bill-payment','STM-08 — Công bố bill và trạng thái khoản trả','''
stateDiagram-v2
    state "Chưa công bố" as Draft
    state "Đang stage" as Staging
    state "Đã công bố, chưa có khoản xác nhận" as Published
    state "Đã có khoản xác nhận, khóa override" as Locked
    [*] --> Draft
    Draft --> Staging: Host chuẩn bị request
    Staging --> Staging: Retry theo manifest
    Staging --> Published: Publish nguyên tử
    Published --> Published: Override revision hợp lệ khi paid count bằng 0
    Published --> Locked: Khoản dương đầu tiên MARKED_AS_PAID
    Locked --> Locked: Xác nhận các khoản dương còn lại
''','Đây là trạng thái nghiệp vụ suy ra từ manifest, revision và billPaidCount; không phải một enum billStatus duy nhất. Share riêng đổi UNPAID sang MARKED_AS_PAID; share 0 không cần trả.',(BILL,OVERRIDE,PAID))
state('stm-09-premium','STM-09 — Quyền Premium theo thời gian','''
stateDiagram-v2
    state "Không có Premium còn hạn" as Free
    state "Premium còn hạn" as Premium
    [*] --> Free
    Free --> Premium: Server xác minh đơn PAID và commit expiry tương lai
    Premium --> Premium: Đơn PAID khác cộng nối thời hạn
    Premium --> Free: Thời gian hiện tại đạt premiumExpiresAt
    Free --> Free: Redirect hoặc webhook trùng không cấp thêm quyền
''','Trạng thái quyền được suy ra từ premiumExpiresAt; không cần scheduler đổi boolean khi hết hạn. Không dùng kích hoạt checksum offline cũ.',(PREMIUM,API))

# Class diagrams: conceptual domain types versus concrete service contracts are explicitly separated.
diagram('class','cls-01-domain','CLS-01 — Mô hình miền tổng quan','''
classDiagram
    class User {
        +string uid
        +string displayName
        +Date premiumExpiresAt
    }
    class SoloSession {
        +string id
        +string userId
        +SoloSessionMode mode
        +number durationSeconds
        +string startedAt
    }
    class Room {
        +string id
        +string hostId
        +string status
        +string reconciliationStatus
    }
    class RoomMember {
        +string uid
        +string role
        +string status
        +number penaltyScore
    }
    class Violation {
        +string eventId
        +string userId
        +number durationSeconds
    }
    class BillShare {
        +string uid
        +number shareVnd
    }
    User "1" --> "0..*" SoloSession : sở hữu
    User "1" --> "0..*" RoomMember : tham gia qua
    Room "1" *-- "1..*" RoomMember : roster theo phiên
    Room "1" --> "0..*" Violation : có sự kiện nhóm
    SoloSession "1" --> "0..*" Violation : có sự kiện cá nhân
    RoomMember "1" --> "0..*" BillShare : theo phiên bản bill
''','Mô hình khái niệm, không khẳng định các entity đều là class có constructor. Violation thuộc ngữ cảnh Solo hoặc nhóm; không bắt buộc thuộc cả hai.',(SPEC,API))
diagram('class','cls-02-solo-sensor','CLS-02 — Hợp đồng Solo và cảm biến','''
classDiagram
    class AccelerometerSample {
        +number x
        +number y
        +number z
    }
    class PhoneDownEngine {
        <<module>>
        +classifyPhoneOrientation(sample) PhoneOrientation
    }
    class GracePeriodEngine {
        +observe(orientation, nowUtcMs) GracePeriodSnapshot
        +markConfirmed(eventId, confirmedAtUtcMs) void
        +restoreActiveViolation(violation) void
        +markEnded() void
        +snapshot(nowUtcMs) GracePeriodSnapshot
    }
    class GracePeriodSnapshot {
        +PhoneOrientation orientation
        +number candidateStartedAtUtcMs
        +ActiveViolation activeViolation
        +boolean shouldConfirm
        +boolean shouldEndViolation
    }
    class SoloSessionRepositoryPort {
        <<interface>>
        +startOrResume(input) Promise
        +cancelActive(input) Promise
    }
    class SoloControllerFactory {
        <<module>>
        +createSoloSessionController(repository) object
    }
    PhoneDownEngine ..> AccelerometerSample : đọc
    GracePeriodEngine --> GracePeriodSnapshot : tạo
    SoloControllerFactory ..> SoloSessionRepositoryPort : phụ thuộc port
''','Tên module hiển thị là nhóm chức năng để trình bày; classifyPhoneOrientation và createSoloSessionController là hàm thực tế, không phải class triển khai.',(SPEC,LIFE))
diagram('class','cls-03-sync','CLS-03 — Cấu trúc đồng bộ dữ liệu','''
classDiagram
    class LocalRepository {
        <<conceptual boundary>>
        ghiDuLieuVaOutbox()
    }
    class OutboxEvent {
        string eventId
        string eventType
        string actorUid
        string aggregateId
        string payloadJson
        string syncStatus
        number attemptCount
        number leaseExpiresAt
    }
    class SyncWorker {
        <<conceptual boundary>>
        claimAndSend()
        applyAcknowledgement()
    }
    class SoloFirestoreTransport {
        <<conceptual boundary>>
        createOrReplaySummary()
    }
    class GroupViolationTransport {
        <<conceptual boundary>>
        commitEligibleEvent()
    }
    LocalRepository --> OutboxEvent : ghi nguyên tử
    SyncWorker --> OutboxEvent : lease và retry
    SyncWorker ..> SoloFirestoreTransport : ADR-030
    SyncWorker ..> GroupViolationTransport : ADR-014 và ADR-015
''','Sơ đồ trách nhiệm khái niệm tương ứng các module sync-worker, outbox-repository, firestore-solo-sync-port và group-violation-repository. Tên phương thức minh họa trách nhiệm, không phải API xuất chính xác.',(ARCH,SOLO,ADR(14,'spark-group-violations')))
diagram('class','cls-04-bill','CLS-04 — Kiểu dữ liệu tính hóa đơn','''
classDiagram
    class BillAllocationMember {
        +string uid
        +number penaltyScore
    }
    class BillShare {
        +string uid
        +number shareVnd
    }
    class BillAllocation {
        +number totalBillVnd
        +number sumShareVnd
    }
    class BillShareOverride {
        +string uid
        +string type
        +number value
    }
    class BillAllocationError {
        +string code
    }
    class AllocationModule {
        <<module>>
        integerArithmetic()
        deterministicResidualDistribution()
    }
    BillAllocation "1" *-- "1..*" BillShare : shares
    AllocationModule ..> BillAllocationMember : đầu vào
    AllocationModule ..> BillShareOverride : tùy chọn
    AllocationModule --> BillAllocation : kết quả
    AllocationModule ..> BillAllocationError : lỗi
''','Các type BillAllocationMember, BillShare, BillAllocation, BillShareOverride và BillAllocationError có trong bill-allocation.ts. Các thao tác trên AllocationModule mô tả thuật toán, không giả lập tên hàm xuất.',(BILL,OVERRIDE))
diagram('class','cls-05-integrations','CLS-05 — Ranh giới tích hợp dịch vụ','''
classDiagram
    class MobileApp {
        <<component>>
    }
    class FirebaseAuth {
        <<external service>>
    }
    class Firestore {
        <<external service>>
    }
    class ExpressAPI {
        <<external boundary>>
    }
    class PaddleOCR {
        <<external service>>
    }
    class Cloudinary {
        <<external service>>
    }
    class PayOS {
        <<external service>>
    }
    MobileApp ..> FirebaseAuth : SDK danh tính
    MobileApp ..> Firestore : transactions và listeners
    MobileApp ..> ExpressAPI : Firebase Bearer token
    ExpressAPI ..> Firestore : Admin xác minh và ghi theo quyền server
    ExpressAPI ..> PaddleOCR : OCR key server-only
    ExpressAPI ..> Cloudinary : private media
    ExpressAPI ..> PayOS : checkout và xác minh
''','Sơ đồ phụ thuộc thành phần dưới ký pháp lớp, không phải mô hình kế thừa. Mã Express/PaddleOCR nằm ngoài repository mobile.',(ARCH,API,PREMIUM))

# ER diagrams distinguish relationships enforced by SQLite from conceptual NoSQL links.
diagram('erd','erd-01-nghiep-vu','ERD-01 — Thực thể nghiệp vụ','''
erDiagram
    USER ||--o{ SOLO_SESSION : owns
    USER ||--o{ MEMBERSHIP : participates
    ROOM ||--|{ MEMBERSHIP : contains
    ROOM ||--o{ GROUP_VIOLATION : records
    MEMBERSHIP ||--o{ GROUP_VIOLATION : generates
    SOLO_SESSION ||--o{ SOLO_VIOLATION : records
    ROOM ||--o{ BILL_VERSION : publishes
    BILL_VERSION ||--|{ BILL_SHARE : contains
    MEMBERSHIP ||--o{ BILL_SHARE : receives
    BILL_SHARE ||--o| PAYMENT_CONFIRMATION : confirmed_by_host
    USER ||--o{ PREMIUM_ORDER : purchases
    USER {
        string uid PK
        timestamp premiumExpiresAt
    }
    ROOM {
        string roomId PK
        string hostId FK
        string status
        string reconciliationStatus
    }
    MEMBERSHIP {
        string roomId PK
        string uid PK
        string role
        int penaltyScore
    }
    BILL_SHARE {
        string roomId PK
        string version PK
        string uid PK
        int shareVnd
    }
''','Mô hình logic phục vụ báo cáo. BILL_VERSION và PAYMENT_CONFIRMATION là khái niệm nghiệp vụ; cách lưu vật lý là manifest, shares và command receipts, không mặc định có bảng SQL cùng tên.',(SPEC,API))
diagram('erd','erd-02-sqlite-core','ERD-02 — SQLite: phiên và đồng bộ','''
erDiagram
    LOCAL_PROFILES ||..o{ SESSIONS : user_id_logical
    SESSIONS ||..o{ VIOLATION_LOGS : session_id_logical
    SESSIONS ||..o{ LIFECYCLE_CANDIDATES : session_id_logical
    SESSIONS o|..o{ SYNC_OUTBOX : optional_session_id
    LOCAL_PROFILES {
        TEXT uid PK
        TEXT email
        TEXT display_name
        INTEGER created_at_utc_ms
        INTEGER premium_expires_at_utc_ms
        TEXT avatar_uri
        TEXT avatar_public_id
    }
    SESSIONS {
        TEXT id PK
        TEXT user_id
        TEXT mode
        TEXT status
        INTEGER duration_seconds
        TEXT started_at
        TEXT completed_at
        TEXT synced_at
    }
    VIOLATION_LOGS {
        TEXT event_id PK
        TEXT session_id
        TEXT room_id
        TEXT user_id
        TEXT started_at
        TEXT confirmed_at
        TEXT ended_at
        INTEGER duration_seconds
        TEXT sync_status
    }
    LIFECYCLE_CANDIDATES {
        TEXT id PK
        TEXT session_id
        TEXT user_id
        INTEGER transition_at_utc_ms
        INTEGER transition_at_monotonic_ms
        TEXT process_instance_id
        TEXT state
        INTEGER resolved_at_utc_ms
    }
    SYNC_OUTBOX {
        TEXT event_id PK
        TEXT actor_uid
        TEXT event_type
        TEXT aggregate_type
        TEXT aggregate_id
        TEXT session_id
        TEXT payload_json
        TEXT sync_status
        INTEGER attempt_count
        INTEGER next_attempt_at
        INTEGER lease_expires_at
        TEXT last_error_code
    }
''','Đối chiếu migrations.ts; chỉ liệt kê các cột chính để dễ đọc. Nét đứt là liên kết logic theo ID, không khẳng định có FOREIGN KEY. Một phiên GROUP có ngữ cảnh phòng; outbox có thể không gắn session_id.',(ARCH,SOLO))
diagram('erd','erd-03-sqlite-history','ERD-03 — SQLite: phòng và lịch sử','''
erDiagram
    ROOMS ||--o{ ROOM_MEMBERS : declared_foreign_key
    LOCAL_PROFILES ||..o{ SOLO_HISTORY_CACHE : owner_logical
    LOCAL_PROFILES ||..o{ GROUP_HISTORY : owner_logical
    LOCAL_PROFILES ||..o{ GROUP_ROOM_HISTORY_CACHE : owner_logical
    ROOMS {
        TEXT room_id PK
        TEXT host_uid
        TEXT pin
        TEXT status
        TEXT created_at
        TEXT updated_at
        TEXT reconciliation_status
        INTEGER pending_member_count
        TEXT finalization_reason
    }
    ROOM_MEMBERS {
        TEXT room_id PK,FK
        TEXT uid PK
        TEXT display_name
        TEXT role
        TEXT status
        TEXT joined_at
        TEXT sync_acknowledged_at
    }
    SOLO_HISTORY_CACHE {
        TEXT user_id PK
        TEXT session_id PK
        INTEGER duration_seconds
        INTEGER lift_count
        INTEGER violation_duration_seconds
        INTEGER penalty_score
        TEXT started_at
        TEXT completed_at
    }
    GROUP_HISTORY {
        TEXT actor_uid PK
        TEXT room_id PK
        INTEGER completed_at_utc_ms
        TEXT summary_json
        TEXT detail_json
        TEXT sync_status
        TEXT source
        INTEGER terminal_confirmed
    }
    GROUP_ROOM_HISTORY_CACHE {
        TEXT actor_uid PK
        TEXT room_id PK
        INTEGER completed_at_utc_ms
        TEXT summary_json
        TEXT detail_json
    }
    APP_SETTINGS {
        TEXT key PK
        TEXT value
    }
''','Chỉ rooms → room_members được vẽ như FK khai báo. History là projection theo owner; không buộc tồn tại một room cache cục bộ tương ứng. APP_SETTINGS độc lập.',(ARCH,ADR(24,'spark-group-history'),ADR(28,'shared-group-history-index')))
diagram('erd','erd-04-firestore-room','ERD-04 — Firestore: phòng và thành viên','''
erDiagram
    USERS ||..o{ ROOMS : hostId_reference
    ROOMS ||--o{ MEMBERS : subcollection
    USERS ||..o{ MEMBERS : uid_reference
    ROOMS ||--o{ VIOLATIONS : subcollection
    MEMBERS ||..o{ VIOLATIONS : userId_reference
    ROOMS ||--o{ EARLY_EXIT_REQUESTS : subcollection
    ROOMS ||--o{ TERMINATION_VOTES : subcollection
    ROOMS ||--o{ RECONCILIATION_AUDITS : subcollection
    USERS {
        string uid PK
        string displayName
        timestamp premiumExpiresAt
    }
    ROOMS {
        string roomId PK
        string hostId
        string pin
        string status
        int participantCount
        int activeMemberCount
        string reconciliationStatus
        int pendingMemberCount
        string finalizationReason
    }
    MEMBERS {
        string uid PK
        string role
        string status
        int liftCount
        int violationDurationSeconds
        int penaltyScore
    }
    VIOLATIONS {
        string eventId PK
        string userId
        timestamp startedAt
        timestamp endedAt
        int durationSeconds
        boolean excludedFromFinalScore
    }
''','ERD thích nghi cho NoSQL: PK là document ID trong collection cha, không phải khóa SQL toàn cục. Nét liền là chứa subcollection; nét đứt là tham chiếu logic. Không dùng participantIds làm nguồn membership.',(API,ARCH))
diagram('erd','erd-05-firestore-bill-premium','ERD-05 — Firestore: hóa đơn, lịch sử và Premium','''
erDiagram
    USERS ||--o{ PERSONAL_SESSIONS : users_uid_sessions
    USERS ||--o{ ROOM_HISTORY_INDEX : owner_room_index
    ROOMS ||--o{ BILL_SHARES : default_shares
    ROOMS ||--o{ BILL_OVERRIDES : versioned_manifests
    BILL_OVERRIDES ||--o{ OVERRIDE_SHARES : subcollection
    ROOMS ||--o{ BILL_COMMANDS : publication_receipts
    ROOMS ||--o{ BILL_OVERRIDE_COMMANDS : override_receipts
    ROOMS ||--o| SETTLEMENT_DETAILS : current_document
    USERS ||..o{ PREMIUM_ORDERS : owner_reference
    ROOMS {
        string roomId PK
        int billRevision
        string billOverrideRequestId
        int billPaidCount
    }
    BILL_SHARES {
        string uid PK
        int shareVnd
        string paymentStatus
    }
    OVERRIDE_SHARES {
        string uid PK
        int shareVnd
        string paymentStatus
    }
    SETTLEMENT_DETAILS {
        string id PK
        string bankId
        string accountNumber
        timestamp expiresAt
    }
    PREMIUM_ORDERS {
        string orderId PK
        string ownerUid
        int amountVnd
        string status
    }
''','Các nhãn PERSONAL_SESSIONS và ROOM_HISTORY_INDEX đại diện đường dẫn cá nhân, không phải collection gốc. Chi tiết path/field theo api-contracts; chỉ trích các trường chính. Premium orders do backend quản lý; ảnh Cloudinary không nằm trong Firestore.',(API,PREMIUM,SOLO))

diagram('architecture','arc-01-context','ARC-01 — Ngữ cảnh hệ thống','''
flowchart LR
    U[Người dùng Solo] --> A[Ứng dụng DontLift]
    H[Host] --> A
    M[Member] --> A
    A <--> F[Firebase Auth và Firestore]
    A --> E[Express API bên ngoài]
    E --> O[PaddleOCR]
    E --> C[Cloudinary private media]
    E <--> P[payOS]
    A --> B[Ứng dụng ngân hàng qua VietQR]
    P --> E
''','Các mũi tên thể hiện ranh giới tương tác. DontLift không giữ tiền chuyển giữa thành viên; payOS chỉ phục vụ mua Premium.',(ARCH,API))
diagram('architecture','arc-02-components','ARC-02 — Thành phần và quyền sở hữu dữ liệu','''
flowchart TB
    subgraph Device[Thiết bị Android hoặc iOS]
        UI[Expo Router và Screens]
        Domain[Controllers và nghiệp vụ]
        Sensor[Expo Sensors và lifecycle adapter]
        Repos[Repositories và subscriptions]
        Local[(SQLite và outbox)]
        Worker[Sync workers]
        UI --> Domain
        Sensor --> Domain
        Domain --> Repos
        Repos <--> Local
        Local <--> Worker
    end
    subgraph Firebase[Firebase Spark]
        Auth[Authentication]
        Rules[Security Rules]
        DB[(Firestore)]
        Rules --- DB
    end
    UI <--> Auth
    Repos <--> Rules
    Worker <--> Rules
    Domain --> API[Express API ngoài Firebase]
    API --> Admin[Firebase Admin]
    Admin --> DB
    API --> OCR[PaddleOCR]
    API --> Media[Cloudinary]
    API <--> Pay[payOS]
''','Admin bypass Rules nên Express phải tự xác minh quyền. Không biểu diễn Cloud Functions hoặc native Firestore disk cache như thành phần runtime bắt buộc hiện tại.',(ARCH,SPARK,API))
diagram('architecture','arc-03-deployment','ARC-03 — Development và production','''
flowchart TB
    subgraph Development[Môi trường phát triển]
        Expo[Expo Go trên điện thoại]
        Metro[Metro trên máy phát triển]
        LocalOCR[PaddleOCR qua LAN]
        Expo --> Metro
        Expo -->|Chỉ development| LocalOCR
    end
    subgraph Release[Hợp đồng bản phát hành]
        App[Android hoặc iOS build]
        Gateway[Express HTTPS gateway]
        OCR[PaddleOCR service]
        Media[Cloudinary private media]
        Pay[payOS và webhook]
        App --> Gateway
        Gateway --> OCR
        Gateway --> Media
        Gateway <--> Pay
    end
    Fire[(Firebase Auth và Firestore Spark)]
    Expo <--> Fire
    App <--> Fire
    Gateway --> Fire
''','Sơ đồ mô tả môi trường và hợp đồng triển khai, không xác nhận dịch vụ đã deploy. OCR trực tiếp bị vô hiệu trong release; kiểm chứng background cần thiết bị và bản dựng phù hợp.',(SPARK,API,PREMIUM))


def index():
    groups = {}
    for item in CATALOG:
        groups.setdefault(item['kind'], []).append(item)
    for folder, items in groups.items():
        put(f'{folder}/README.md', f'# Sơ đồ {folder}\n\n' + '\n'.join(f'- [{i["title"]}]({Path(i["path"]).name})' for i in items))
    rows = '\n'.join(f'| {kind} | {len(items)} | [Mở thư mục]({kind}/README.md) |' for kind, items in groups.items())
    put('README.md', f'''# Bộ sơ đồ phân tích và thiết kế DontLift

Đối chiếu ngày 22/11/2026. Bộ sơ đồ phục vụ đồ án **Xây dựng ứng dụng đa nền tảng DontLift tích hợp AI nhận diện hóa đơn**. Tổng cộng **{len(CATALOG)} sơ đồ**, chia theo loại; mỗi sơ đồ nằm trong một file Markdown riêng.

## Xem trên GitHub

Mở file `.md` để GitHub dựng hình trong khối `mermaid`. File Use Case nhúng SVG có sẵn, kèm nguồn `.puml`. Không cần cài tiện ích để xem trên GitHub. File `.mmd` độc lập không phải định dạng xem chính của bộ này.

| Loại | Số sơ đồ | Danh mục |
|---|---:|---|
{rows}

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
3. Phòng dùng Firestore transactions và Security Rules trong các ngoại lệ Spark được phê duyệt. Membership nằm trong `rooms/{{roomId}}/members/{{uid}}`.
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
''')
    put('use-case/catalog.md', '# Danh sách Use Case\n\nG01–G08 là nhóm chức năng tổng quan; các mã còn lại là Use Case chi tiết.\n\n| Mã | Chức năng | Sơ đồ |\n|---|---|---|\n' + '\n'.join(f'| {key} | {label} | [Mở]({Path(path).name}) |' for key,label,path in UC))
    put('catalog.json',json.dumps(CATALOG,ensure_ascii=False,indent=2))
    put('SOURCES.md','''# Nguồn đối chiếu và giới hạn

## Tài liệu

- [AGENTS](../../AGENTS.md): thứ tự ưu tiên tài liệu và giới hạn báo cáo triển khai.
- [PRD](../product-requirements.md), [đặc tả](../feature-specification.md), [kiến trúc hiện hành](../architecture.md), [API](../api-contracts.md).
- [Các ADR](../decisions/): 008 lifecycle; 010 Firebase JS/Expo Go; 011–019 phòng, vi phạm và chốt điểm; 020–023 hóa đơn và xác nhận trả; 024/028 lịch sử; 025/029 Premium; 026/027 phòng chờ; 030 Solo.
- [Kế hoạch OCR](../superpowers/plans/2026-11-14-ai-bill-scan-paddleocr.md) và hợp đồng API cập nhật mô tả private receipt media; phần PRD/spec nói không lưu ảnh là mô tả cũ hơn.

## Mã nguồn đối chiếu

- [Dependencies](../../package.json): React Native, Expo, Firebase JS SDK, Sensors, SQLite, Router.
- [SQLite migrations](../../src/features/local/migrations.ts): bảng, cột thêm sau migration, PK và FK thực tế.
- [Phân loại cảm biến](../../src/features/sensors/phone-down-engine.ts), [grace engine](../../src/features/solo/grace-period-engine.ts), [Solo controller](../../src/features/solo/session-controller.ts).
- [Bill allocation](../../src/features/settlement/bill-allocation.ts), [receipt scan API](../../src/features/settlement/receipt-scan-api.ts), [receipt evidence API](../../src/features/settlement/receipt-evidence-api.ts).
- [Group ranking](../../src/features/rooms/group-active-domain.ts), [Premium API client](../../src/features/premium/premium-api.ts).

## Giới hạn

Sơ đồ không khẳng định thành công về độ chính xác cảm biến, tốc độ đồng bộ, OCR hoặc thanh toán thật. Mã Express, PaddleOCR và cấu hình dịch vụ ở ngoài repository mobile chưa được kiểm tra đầy đủ trong công việc này. Class khái niệm và ERD logic phục vụ giải thích thiết kế, không thay thế schema vật lý hoàn chỉnh. Bảng SQLite trong sơ đồ chỉ trích các cột chính; migrations là nguồn đầy đủ.

Không đưa các chức năng của ảnh tham khảo như Web3, quyên góp, chiến dịch và quản trị dự án vào DontLift. Ảnh chỉ cung cấp gợi ý loại sơ đồ.
''')


if __name__ == '__main__':
    index()
    print(f'Built {len(CATALOG)} diagrams in {ROOT}')
