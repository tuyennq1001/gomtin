# AGENTS & CODING RULES (QUY TẮC VẬN HÀNH & KỸ THUẬT CHO AI AGENT)

Tài liệu này là bộ quy tắc cốt lõi gồm 2 phần rõ rệt:
- **PHẦN 1: NGUYÊN TẮC KỸ THUẬT CHUNG (UNIVERSAL COMMON RULES)**: Bắt buộc tuân thủ trên mọi dự án phần mềm (Web, Mobile, Backend, Desktop, CLI... bất kể ngôn ngữ & framework). **Giữ nguyên 100% khi copy sang dự án mới hoặc đưa vào ChatGPT/Claude/Cursor/Antigravity/Copilot.**
- **PHẦN 2: QUY TẮC ĐẶC THÙ DỰ ÁN (PROJECT-SPECIFIC RULES)**: Tùy biến theo từng dự án cụ thể (Tech stack, môi trường Dev/Prod, command build/test, coding convention nội bộ).

---

# ==============================================================================
# PHẦN 1: QUY TẮC KỸ THUẬT CHUNG CHO MỌI DỰ ÁN (UNIVERSAL COMMON RULES)
# (Độc lập ngôn ngữ & nền tảng — Tái sử dụng nguyên vẹn cho bất kỳ dự án nào)
# ==============================================================================

## 1. Quy trình Git Branching & Quản lý PR (Git Automation Workflow)
- **Tuyệt đối không commit trực tiếp vào nhánh chính**: Không bao giờ commit lên `main` hoặc `master`.
- **Luôn tạo nhánh riêng biệt trước khi viết code**: Tự động tạo nhánh `feature/<tên-tính-năng>` hoặc `fix/<tên-lỗi>` từ nhánh chính trước khi thực hiện bất kỳ thay đổi nào.
- **Quy trình chuẩn 4 bước**:
  1. Viết code.
  2. Chạy toàn bộ bộ kiểm thử tự động (Unit / Integration Tests) — **PHẢI PASS 100%**.
  3. Chạy build/compile dự án — **PHẢI BUILD THÀNH CÔNG**.
  4. Chờ người dùng xác nhận trải nghiệm thực tế chạy đúng mong đợi ➔ **Mới tiến hành commit**.
- **Tiêu chuẩn Commit/PR**:
  - Tiêu đề tuân theo Conventional Commits (`feat(...)`, `fix(...)`), **tối đa ≤ 72 ký tự**.
  - Nội dung mô tả (Body) **ngắn gọn ≤ 5 dòng**. Nếu cần mô tả chi tiết, ghi ra file riêng và đính kèm link.
- **Chỉ Push & Merge khi được yêu cầu**:
  - Mặc định **không tự ý push** lên remote repository. Chỉ push và tạo PR (`gh pr create`) khi người dùng yêu cầu rõ ràng.
  - Chỉ merge PR (`gh pr merge`) vào nhánh chính khi người dùng trực tiếp xác nhận "OK" hoặc "Duyệt".

---

## 2. An toàn Thực thi Terminal & Script (Terminal Safety)
- **Không viết inline script dài trong `-c`**: Bất kỳ script nào (Bash, Python, Node...) nếu dài quá ~5 dòng, **bắt buộc phải ghi ra file script tạm**, cấp quyền và thực thi file đó, sau đó xóa file tạm đi.
- **Không pipe build output qua bộ lọc chặn (blocking filter)**: Tránh dùng `| grep ...` trực tiếp trên luồng build/compile vì dễ gây treo tiến trình (hang/freeze/timeout) nếu output không khớp pattern.
- **Giới hạn độ dài dòng lệnh**: Mỗi câu lệnh CLI không vượt quá ~2000 ký tự để tránh lỗi buffer overflow và timeout.

---

## 3. Trung thực Dữ liệu & Phê duyệt Trước khi Code (Mandatory Approval)
- **Trung thực dữ liệu tuyệt đối (No Fake / Dummy Data)**: Tuyệt đối không tự ý bịa dữ liệu giả định, tên công ty giả, hoặc nhồi kết quả heuristic giả lập. Mọi dữ liệu hiển thị bắt buộc phải là dữ liệu thật 100% từ API chính thống hoặc nguồn đã kiểm chứng (trừ trường hợp kịch bản mock test được chỉ định rõ).
- **Bắt buộc chờ phê duyệt phương án trước khi sửa code**:
  1. AI phải giải thích nguyên nhân gốc rễ và trình bày phương án kỹ thuật rõ ràng.
  2. **CHỈ TIẾN HÀNH VIẾT CODE KHI NGƯỜI DÙNG XÁC NHẬN "OK" / DUYỆT TRỰC TIẾP** bằng lời nhắn trong chat.
  3. Tuyệt đối không tự động nhảy sang bước viết code / thực thi thay đổi khi người dùng chưa đồng ý.

---

## 4. Tiêu chuẩn Kỹ thuật Hiệu năng (Universal Performance Engineering)
*(Áp dụng cho mọi hệ thống: Frontend UI, Backend API, Mobile, Desktop, CLI)*
- **Cô lập State & Sự kiện tần số cao (State & Event Isolation)**:
  - Các sự kiện hoặc state biến động liên tục (hover chuột, con trỏ, vị trí scroll, sensors, keystrokes input...) **bắt buộc phải cô lập trong component/module con**. Tuyệt đối không đặt ở component cha vì sẽ kích hoạt re-render hoặc re-calculate toàn bộ cây view/component.
- **Cấm tính toán nặng trong Render Loop & Request Hot-Path**:
  - Không chạy sắp xếp (`sort`), lọc mảng lớn (`filter`), parse JSON nặng, hoặc các thuật toán tính toán phức tạp trực tiếp bên trong vòng lặp render giao diện hoặc hàm xử lý request chính.
  - Mọi phép tính nặng phải tính trước (pre-compute) và lưu cache bộ nhớ (in-memory cache / memoization). View/handler chỉ đóng vai trò đọc dữ liệu đã chuẩn bị.
- **Tối ưu cấp phát bộ nhớ & Giảm tải Garbage Collection (Allocation Optimization)**:
  - Tránh khởi tạo các đối tượng tốn kém tài nguyên (date formatters, regex parsers, database connections, crypto engines) lặp đi lặp lại trong vòng lặp kín hoặc từng item của danh sách. Bắt buộc tái sử dụng instance static/singleton hoặc object pool.
- **Ảo hóa & Phân trang dữ liệu lớn (Virtualization & Pagination)**:
  - Trên giao diện: Danh sách lớn bắt buộc phải dùng cơ chế ảo hóa (virtual list/lazy loading), chỉ render các phần tử thực sự nằm trong khung nhìn.
  - Dưới backend/DB: Luôn phân trang (pagination), stream hoặc chunking dữ liệu, tuyệt đối không tải hàng loạt triệu bản ghi vào RAM cùng lúc.
- **Gom cụm & Tiết chế luồng dữ liệu thời gian thực (Buffering & Throttling)**:
  - Dữ liệu từ luồng thời gian thực (WebSocket, Message Queue, Event Stream) không được bắn trực tiếp từng event đơn lẻ lên UI/Main Loop. Bắt buộc có cơ chế buffer gom batch và debounce/throttle (ví dụ: 0.5s – 1.0s) để giảm tải tần suất cập nhật.
- **Bất đồng bộ & Không chặn luồng chính (Non-blocking I/O)**:
  - Mọi thao tác I/O (đọc/ghi file, gọi network, truy vấn DB) tuyệt đối không chạy đồng bộ trên Main Thread / Event Loop chính.
  - Thao tác ghi đĩa/persistence lặp đi lặp lại phải được debounce và đẩy xuống background worker/thread.

---

## 5. Tư duy Triển khai Ngang (Horizontal Deployment Mindset)
Khi giải quyết bất kỳ lỗi hoặc phát triển tính năng nào, bắt buộc tự động rà soát đồng bộ theo 4 trục:
- **Trục Tính năng & Thành phần tương đồng (Feature Parity)**: Nếu sửa/thêm logic ở Module A, phải tự động quét toàn bộ codebase tìm các Module B, C có vai trò hoặc logic tương tự (ví dụ: danh sách chính ↔ danh sách phụ; chế độ xem bảng ↔ chi tiết modal; giỏ hàng ↔ thanh toán) để áp dụng đồng bộ.
- **Trục Đa Nền tảng / Đa Môi trường (Environment & Platform Parity)**: Đảm bảo tính năng hoạt động nhất quán trên mọi nền tảng được hỗ trợ (Desktop ↔ Mobile, Web Responsive, macOS ↔ iOS, Dark Mode ↔ Light Mode).
- **Trục Đầy đủ Trạng thái Dữ liệu (State Parity)**: Mọi thành phần hiển thị/xử lý dữ liệu phải đáp ứng trọn vẹn 4 trạng thái:
  1. `Loading`: Có skeleton/placeholder dự trù, không làm vỡ hoặc giật layout.
  2. `Empty`: Giao diện thông báo trạng thái trống thân thiện, có chỉ dẫn hành động.
  3. `Error`: Bắt lỗi lịch sự, có nút thử lại (Retry), không để crash ứng dụng.
  4. `Loaded`: Hiển thị dữ liệu chính xác.
- **Trục Ổn định Giao diện & Hợp đồng Dữ liệu (Contract & Layout Stability)**:
  - Trên UI: Giữ vững kích thước khung hình, triệt tiêu hiện tượng giật nhảy layout (Zero Layout Shift).
  - Trên Logic: Xử lý triệt để các trường hợp biên (`null/undefined`, chia cho 0 sinh ra `NaN/Inf`, lỗi tràn mảng `Index out of bounds`). Khi thiếu số liệu, hiển thị ký hiệu thay thế lịch sự (`-` hoặc `--`), tuyệt đối không làm crash hay hiển thị giá trị bất thường.

---

## 6. An toàn Concurrency & Kiểm thử Hồi quy (Concurrency & Test Guard)
- **Luồng UI vs Luồng Background**: Mọi cập nhật trạng thái hiển thị người dùng bắt buộc diễn ra trên Main/UI Thread. Mọi tính toán thuật toán nặng hoặc I/O bắt buộc đẩy sang Background Thread/Worker.
- **Kiểm thử hồi quy (Regression Testing Guard)**: Khi sửa đổi các hàm tính toán cốt lõi hoặc thuật toán quan trọng, bắt buộc phải chạy hoặc viết bổ sung Unit Test tương ứng để đảm bảo lỗi không bao giờ tái phát.

---

## 7. Nguyên Tắc 2 Môi Trường & Cổng Kiểm Soát Build Parity (Dev vs Prod Parity Gate)
- **Tách biệt tuyệt đối giữa Development và Production**:
  - Dữ liệu, cấu hình (Environment Variables / UserDefaults / DB / LocalStorage), bundle identifier/tên miền của bản Dev phải độc lập hoàn toàn với bản Production để tránh làm ô nhiễm hoặc mất dữ liệu người dùng thật khi debug.
- **Nhận diện Thị giác & Bảo vệ Môi trường (Visual Indicator & Update Isolation)**:
  - Bản Dev bắt buộc phải có dấu hiệu nhận diện trực quan rõ ràng (ví dụ: tiền tố/hậu tố tên `Dev`, badge `DEV`, icon khác màu hoặc banner cảnh báo) để người dùng/tester không bao giờ nhầm lẫn với bản Production.
  - Bản Dev **bắt buộc phải vô hiệu hóa tính năng Auto-Update** (dùng cờ biên dịch môi trường như `#if DEBUG` hoặc env `NODE_ENV === 'development'`). Tuyệt đối không để bản Dev tự động kiểm tra và tải bản cập nhật Production về ghi đè lên mã nguồn hoặc dữ liệu đang phát triển cục bộ.
- **Tiêu chuẩn Cập nhật Tự động Âm thầm (Silent Auto-Update Standard)**:
  - Ứng dụng Production phân phối người dùng cuối nên bật cơ chế kiểm tra định kỳ và **mặc định tải ngầm trong nền (Silent Background Download)** để không ngắt quãng luồng làm việc. Luôn cung cấp toggle trong phần Cài đặt để người dùng có thể chủ động bật/tắt.
- **Cổng Kiểm Soát Build Parity (Parity Gate)**:
  - Trước khi báo hoàn thành bất kỳ task nào, **bắt buộc phải build thành công 100% trên cả 2 môi trường (Development/Debug và Production/Release)** theo đúng command quy định tại Phần 2.
  - Tuyệt đối không được phép bàn giao khi chỉ một trong hai cấu hình biên dịch/build thành công.

---

## 8. Chuẩn Hóa Tự Động Phát Hành & Phân Phối (Release Automation & Distribution Guard)
- **Quy trình Phát hành Một Lệnh (Zero-Manual-Touch Release)**:
  - Toàn bộ các bước phát hành bản mới phải được tự động hóa hoàn toàn bằng script (ví dụ: `./release.sh <version> <build_number>`).
  - Script phải kiểm soát chặt chẽ theo luồng chuẩn: Kiểm tra môi trường (Preflight) ➔ Bump version ➔ Biên dịch bản tối ưu (Release) ➔ Kiểm thử khói (Smoke Test tự động mở app tối thiểu 3s để xác nhận không crash) ➔ Dọn dẹp dependencies ➔ Ký số bảo mật (Code-signing) ➔ Kiểm duyệt bảo mật (Notarization / Store verification) ➔ Ký số bản cập nhật (EdDSA / Checksum) ➔ Cập nhật kênh phân phối (Appcast / Feed XML) ➔ Commit, tag git và xuất bản Release (GitHub Releases / CDN).
- **Dọn dẹp Tài nguyên Phụ thuộc Trước khi Đóng gói (Dependency Clean Guard)**:
  - Trước khi ký số và đóng gói bản phát hành, phải tự động quét và loại bỏ toàn bộ các file rác, file `.zip`, script tạm hoặc helper nhị phân chưa được ký số từ các gói thư viện bên thứ ba (ví dụ: SPM helpers, unnotarized dependency bundles). Tránh tuyệt đối việc bị các hệ thống kiểm duyệt bảo mật (như Apple Notary Service hoặc Windows SmartScreen) từ chối vì file lạ nằm bên trong bundle.

---

# ==============================================================================
# PHẦN 2: QUY TẮC ĐẶC THÙ DỰ ÁN (PROJECT-SPECIFIC RULES: GOMTIN DESKTOP)
# ==============================================================================

## 1. Thông Tin Công Nghệ (Tech Stack & Environment)
- **Nền tảng / Ngôn ngữ**: Node.js 22+ (CommonJS, Zero runtime npm dependencies), macOS Apple Silicon (`arm64`) / Intel (`x64`)
- **Frameworks / Libraries chính**: Electron `45.4.1`, `electron-builder` `26.18.0`, `@electron/fuses` `1.8.0`
- **Cấu hình Package Manager**: `npm` (`package-lock.json` pinned)
- **Các dịch vụ chat hỗ trợ**: Facebook Messenger (`messenger`), Zalo Web (`zalo`), Telegram Web (`telegram`)

---

## 2. Cấu Hình 2 Môi Trường Biệt Lập (Dev vs Production)
- **Bản Phát triển (Development)**:
  - Display Name: `GomTin Dev`
  - Bundle Identifier: `com.tuyennq.gomtin.dev`
  - UserData độc lập: `~/Library/Application Support/GomTin Dev` (tự động migrate một lần từ `Messenger Dev` nếu có)
  - Icon riêng biệt: `build/icon-dev.png` (viền cam + badge `DEV` tròn nổi bật trên Dock)
  - Output build: `dist-dev/mac-arm64/GomTin Dev.app`
  - Nhận diện thị giác: Tiêu đề `[DEV] GomTin Dev`, badge capsule `DEV` cam trên sidebar/settings/overlay, tooltip tray `GomTin Dev`.
  - Auto-Update: **Vô hiệu hóa cứng** (`isDev === true` chặn mọi timer, mọi network request và mọi thao tác cập nhật trong `src/updater.js`).

- **Bản Sản phẩm (Production)**:
  - Display Name: `GomTin`
  - Bundle Identifier: `com.tuyennq.gomtin`
  - UserData: `~/Library/Application Support/GomTin` (tự động migrate một lần từ `Messenger` nếu có)
  - Icon chính thức: `build/icon.png` (Bóng chat gradient xanh-tím với chữ `G` trắng tối giản trên nền trắng macOS, độc lập nhận diện GomTin)
  - Output build: `dist/mac-arm64/GomTin.app`
  - Vị trí cài đặt cục bộ: `~/Applications/GomTin.app`
  - Auto-Update Production: Kiểm tra định kỳ + tải ngầm trong nền từ GitHub Releases `tuyennq1001/gomtin` (không cookie, xác thực `SHA256SUMS.txt` + macOS `codesign --verify --deep --strict`, swap nguyên tử có rollback), có toggle bật/tắt và nút kiểm tra ngay trong Cài đặt.
  - Bảo mật nhị phân: macOS Hardened Runtime + Electron Fuses (`EnableCookieEncryption`, `OnlyLoadAppFromAsar`, `EnableEmbeddedAsarIntegrityValidation`, tắt `RunAsNode` / `NodeOptions` / `NodeCliInspect`).

---

## 3. Lệnh Kiểm Thử & Biên Dịch (Parity Gate Commands)
Trước khi bàn giao task hoặc commit, bắt buộc chạy thành công các lệnh sau:
```bash
# 1. Chạy toàn bộ Unit, Route & Privacy Tests
npm test

# 2. Build Development (bắt buộc pass)
npm run build:dev

# 3. Build Production (bắt buộc pass)
npm run build:prod

# 4. Hoặc chạy toàn bộ Parity Gate + Smoke Test + Dependency Guard trong 1 lệnh:
./scripts/build-local.sh

# 5. Build, verify và cài đặt bản Production vào ~/Applications/GomTin.app:
./scripts/build-local.sh --install

# 6. Phát hành một lệnh (Parity Gate + gói zip + SHA256SUMS + tag + GitHub Release):
./scripts/release.sh <version> [--install]
```

---

## 4. Quy Ước Kiến Trúc & Bảo Mật Riêng
- **Cách ly tuyệt đối trang web chat**:
  - Mọi `WebContentsView` hiển thị Messenger / Zalo / Telegram chạy trong sandbox độc lập (`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`), **tuyệt đối không chạy `executeJavaScript`, không expose API ra `window` (`contextBridge`), không đọc nội dung tin nhắn/cookie/storage**.
  - Ngoại lệ duy nhất được phê duyệt: preload chỉ đọc tối giản `src/ui/chat-badge-preload.js` chỉ quan sát bộ đếm unread badge (Messenger/Zalo/Telegram) và gửi duy nhất một số nguyên hợp lệ (`-1..999`) qua kênh một chiều `chat:unread` (main process kiểm tra chặt `event.sender` thuộc `AccountView` đang sống). Chỉ được phép `insertCSS` (ẩn top bar cho Facebook Messenger và blur privacy screen).
  - Mọi guard điều hướng (`will-navigate`, `will-redirect`, `did-navigate`, `setWindowOpenHandler`, `did-create-window`), cấp quyền (`notifications`, `media`, `display-capture`, `clipboard-sanitized-write`, `fullscreen`) và tải tệp (`downloadTarget`) đều **khóa theo đúng `service` của tài khoản đó**.
- **UI nội bộ cách ly (Sidebar, Overlay, Settings Window)**:
  - Chỉ load file HTML cục bộ (`loadFile`), CSP chặt (`default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'`), khóa `will-navigate` và `setWindowOpenHandler`, IPC chỉ chấp nhận đúng `webContents` của chính view đó và đúng whitelist `ACTIONS`.
  - Giao diện theo ngôn ngữ **Soft Kawaii Glass** (đồng bộ Buzzy): 6 bảng màu pastel (`blue`, `green`, `pink`, `orange`, `purple`, `red`), chế độ `System / Light / Dark`, song ngữ `Tiếng Việt / English`, font `SF Pro Rounded` hỗ trợ đầy đủ dấu tiếng Việt Unicode.
  - Đảm bảo 4 trạng thái `Loading / Empty / Error / Loaded` và `Zero Layout Shift` (sidebar cố định `58px`).
- **Kiểm soát chặt kết nối mạng ngoài**:
  - Ứng dụng không có telemetry. Kết nối mạng duy nhất ngoài các trang chat là `src/updater.js` (chỉ chạy trên bản Production, tắt cứng trên bản Dev), chỉ gọi tới GitHub Releases của `tuyennq1001/gomtin` với `credentials: 'omit'` / `useSessionCookies: false` và bắt buộc đối chiếu SHA-256 (`test/privacy.test.js` kiểm tra tự động).
- **Quản lý tài khoản On/Off**:
  - Tắt tài khoản trong Settings sẽ hủy `WebContentsView` ngay để giải phóng RAM nhưng **giữ nguyên session partition trên đĩa**; bật lại sẽ khôi phục phiên đăng nhập ngay lập tức.
