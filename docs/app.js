'use strict';

(function () {
  const REPO = 'tuyennq1001/gomtin';
  const LATEST_PAGE_URL = `https://github.com/${REPO}/releases/latest`;
  const FALLBACK_VERSION = 'v1.0.0';
  const THEMES = ['blue', 'green', 'pink', 'orange', 'purple', 'red'];

  const CHAT_DATA = {
    vi: {
      messenger: {
        serviceTitle: 'Messenger',
        shortcut: '⌘1',
        pill: 'Đã chặn Bảng tin',
        threads: [
          {
            id: 'msg-1',
            initials: 'MA',
            avatarClass: 'avatar-pink',
            name: 'Minh Anh',
            status: 'Đang hoạt động',
            online: true,
            time: '11:42',
            unread: 0,
            snippet: 'Tối nay 7h hẹn ở quán cũ nhé!',
            messages: [
              { dir: 'in', text: 'Hôm nay tan làm đúng giờ không?', time: '11:40' },
              { dir: 'out', text: 'Có nha, xong nốt việc chiều nay là đi luôn 👍', time: '11:41' },
              { dir: 'in', text: 'Tối nay 7h hẹn ở quán cũ nhé! Mình giữ bàn sẵn rồi.', time: '11:42' },
            ],
          },
          {
            id: 'msg-2',
            initials: 'GĐ',
            avatarClass: 'avatar-orange',
            name: 'Nhóm Gia Đình',
            status: '5 thành viên',
            online: false,
            time: '11:15',
            unread: 2,
            snippet: 'Cuối tuần này có về ăn cơm không?',
            messages: [
              { dir: 'in', text: 'Mẹ mới nấu xong nồi canh chua ngon lắm 😄', time: '11:12' },
              { dir: 'in', text: 'Cuối tuần này có về ăn cơm không con?', time: '11:15' },
              { dir: 'out', text: 'Thứ Bảy con về sớm nhé cả nhà!', time: '11:16' },
            ],
          },
          {
            id: 'msg-3',
            initials: 'TK',
            avatarClass: 'avatar-blue',
            name: 'Tuấn Kiệt',
            status: 'Hoạt động 8 phút trước',
            online: false,
            time: '09:30',
            unread: 1,
            snippet: 'Gửi mình link ảnh hôm qua với',
            messages: [
              { dir: 'in', text: 'Ảnh chụp tối qua đẹp ghê, gửi mình link album với nhé!', time: '09:30' },
              { dir: 'out', text: 'Mình vừa gửi rồi đó, bấm vào sẽ tự mở trình duyệt xem ảnh gốc cho nét.', time: '09:31' },
            ],
          },
        ],
      },
      zalo: {
        serviceTitle: 'Zalo',
        shortcut: '⌘2',
        pill: 'Tài khoản độc lập',
        threads: [
          {
            id: 'zalo-1',
            initials: 'DA',
            avatarClass: 'avatar-blue',
            name: 'Nhóm Dự Án',
            status: '6 thành viên',
            online: true,
            time: '11:38',
            unread: 1,
            snippet: '2h chiều mình chốt nhanh 15 phút nha',
            messages: [
              {
                dir: 'in',
                text: 'Mọi người xem trước bản tóm tắt cho buổi họp chiều nay nhé.',
                time: '11:35',
                file: { ext: 'PDF', name: 'KeHoach_TuanNay.pdf', size: '1.4 MB' },
              },
              { dir: 'out', text: 'Mình đã tải về xem rồi, phần tiến độ rất rõ ràng!', time: '11:37' },
              { dir: 'in', text: 'Tuyệt, 2h chiều mình chốt nhanh 15 phút là xong.', time: '11:38' },
            ],
          },
          {
            id: 'zalo-2',
            initials: 'HN',
            avatarClass: 'avatar-green',
            name: 'Hải Nam',
            status: 'Đang hoạt động',
            online: true,
            time: '10:20',
            unread: 0,
            snippet: 'Chiều 2h họp nhanh 15 phút nha',
            messages: [
              { dir: 'in', text: 'Bạn rảnh lúc 2h chiều nay không? Mình trao đổi nhanh 15 phút.', time: '10:20' },
              { dir: 'out', text: 'Ok bạn, 2h mình vào đúng giờ nha.', time: '10:22' },
            ],
          },
          {
            id: 'zalo-3',
            initials: 'TH',
            avatarClass: 'avatar-purple',
            name: 'Thu Hà',
            status: 'Truy cập hôm qua',
            online: false,
            time: 'Hôm qua',
            unread: 0,
            snippet: 'Cảm ơn bạn, mình đã nhận được!',
            messages: [
              { dir: 'out', text: 'Mình vừa gửi lại bản cập nhật mới nhất qua Zalo nhé.', time: 'Hôm qua' },
              { dir: 'in', text: 'Cảm ơn bạn, mình đã nhận được rồi! 🙌', time: 'Hôm qua' },
            ],
          },
        ],
      },
      telegram: {
        serviceTitle: 'Telegram',
        shortcut: '⌘3',
        pill: '',
        threads: [
          {
            id: 'tg-1',
            initials: 'CM',
            avatarClass: 'avatar-cyan',
            name: 'Cộng đồng macOS',
            status: '1.280 thành viên',
            online: true,
            time: '11:25',
            unread: 0,
            snippet: 'Mẹo dùng phím tắt ⌘1…9 cực gọn',
            messages: [
              { dir: 'in', text: 'Chia sẻ nhanh: nhấn ⌘1, ⌘2, ⌘3 để nhảy qua lại giữa Messenger, Zalo và Telegram trong nháy mắt.', time: '11:25' },
              { dir: 'out', text: 'Gom hết về một cửa sổ gọn hẳn màn hình luôn ✨', time: '11:26' },
              { dir: 'in', text: 'Thử gạt công tắc “Tiết kiệm RAM” ở góc trên để cho Telegram nghỉ tạm khi không cần nhé!', time: '11:27' },
            ],
          },
          {
            id: 'tg-2',
            initials: 'TL',
            avatarClass: 'avatar-blue',
            name: 'Tin nhắn đã lưu',
            status: 'Ghi chú cá nhân',
            online: false,
            time: '08:40',
            unread: 0,
            snippet: 'Danh sách việc cần làm hôm nay',
            messages: [
              { dir: 'out', text: '1. Gửi báo cáo trước 11h\n2. Xem lại lịch hẹn chiều nay', time: '08:38' },
              { dir: 'out', text: '3. Mua cà phê hạt trên đường về ☕', time: '08:40' },
            ],
          },
          {
            id: 'tg-3',
            initials: 'ĐS',
            avatarClass: 'avatar-green',
            name: 'Nhóm Đọc Sách',
            status: '18 thành viên',
            online: false,
            time: 'Hôm qua',
            unread: 0,
            snippet: 'Tháng này cả nhóm đọc cuốn nào nhỉ?',
            messages: [
              { dir: 'in', text: 'Cuối tuần này hẹn nhau bàn về cuốn sách mới nha mọi người.', time: 'Hôm qua' },
              { dir: 'out', text: 'Mình chọn một phiếu cho cuốn về thói quen làm việc tập trung!', time: 'Hôm qua' },
            ],
          },
        ],
      },
    },
    en: {
      messenger: {
        serviceTitle: 'Messenger',
        shortcut: '⌘1',
        pill: 'News Feed Blocked',
        threads: [
          {
            id: 'msg-1',
            initials: 'MA',
            avatarClass: 'avatar-pink',
            name: 'Minh Anh',
            status: 'Active now',
            online: true,
            time: '11:42',
            unread: 0,
            snippet: 'Dinner at 7 PM at our usual spot?',
            messages: [
              { dir: 'in', text: 'Wrapping up work on time today?', time: '11:40' },
              { dir: 'out', text: 'Yep! Finishing one last task then heading over 👍', time: '11:41' },
              { dir: 'in', text: 'Dinner at 7 PM at our usual spot? I already booked a table.', time: '11:42' },
            ],
          },
          {
            id: 'msg-2',
            initials: 'FM',
            avatarClass: 'avatar-orange',
            name: 'Family Group',
            status: '5 members',
            online: false,
            time: '11:15',
            unread: 2,
            snippet: 'Coming over for dinner this weekend?',
            messages: [
              { dir: 'in', text: 'Just made your favorite soup 😄', time: '11:12' },
              { dir: 'in', text: 'Coming over for dinner this weekend?', time: '11:15' },
              { dir: 'out', text: 'Count me in for Saturday evening!', time: '11:16' },
            ],
          },
          {
            id: 'msg-3',
            initials: 'TK',
            avatarClass: 'avatar-blue',
            name: 'Tuan Kiet',
            status: 'Active 8m ago',
            online: false,
            time: '09:30',
            unread: 1,
            snippet: 'Could you share the photo album link?',
            messages: [
              { dir: 'in', text: 'Great shots from yesterday — mind sharing the album link?', time: '09:30' },
              { dir: 'out', text: 'Just sent it! External links open cleanly in your default browser.', time: '09:31' },
            ],
          },
        ],
      },
      zalo: {
        serviceTitle: 'Zalo',
        shortcut: '⌘2',
        pill: 'Separate Account',
        threads: [
          {
            id: 'zalo-1',
            initials: 'PT',
            avatarClass: 'avatar-blue',
            name: 'Project Team',
            status: '6 members',
            online: true,
            time: '11:38',
            unread: 1,
            snippet: 'Quick 15-min sync at 2 PM',
            messages: [
              {
                dir: 'in',
                text: 'Sharing the summary doc before our afternoon sync.',
                time: '11:35',
                file: { ext: 'PDF', name: 'Weekly_Plan.pdf', size: '1.4 MB' },
              },
              { dir: 'out', text: 'Downloaded and reviewed — timeline looks crystal clear!', time: '11:37' },
              { dir: 'in', text: 'Awesome, let’s do a quick 15-min sync at 2 PM.', time: '11:38' },
            ],
          },
          {
            id: 'zalo-2',
            initials: 'HN',
            avatarClass: 'avatar-green',
            name: 'Hai Nam',
            status: 'Active now',
            online: true,
            time: '10:20',
            unread: 0,
            snippet: 'Free for a quick check-in at 2?',
            messages: [
              { dir: 'in', text: 'Are you free around 2 PM for a quick 15-min review?', time: '10:20' },
              { dir: 'out', text: 'Sounds good, see you at 2!', time: '10:22' },
            ],
          },
          {
            id: 'zalo-3',
            initials: 'TH',
            avatarClass: 'avatar-purple',
            name: 'Thu Ha',
            status: 'Seen yesterday',
            online: false,
            time: 'Yesterday',
            unread: 0,
            snippet: 'Thanks, received it!',
            messages: [
              { dir: 'out', text: 'Just sent over the updated file here on Zalo.', time: 'Yesterday' },
              { dir: 'in', text: 'Thanks so much, got it! 🙌', time: 'Yesterday' },
            ],
          },
        ],
      },
      telegram: {
        serviceTitle: 'Telegram',
        shortcut: '⌘3',
        pill: '',
        threads: [
          {
            id: 'tg-1',
            initials: 'MC',
            avatarClass: 'avatar-cyan',
            name: 'macOS Community',
            status: '1,280 members',
            online: true,
            time: '11:25',
            unread: 0,
            snippet: 'Tip: switch accounts with ⌘1…9',
            messages: [
              { dir: 'in', text: 'Quick tip: press ⌘1, ⌘2, ⌘3 to jump between Messenger, Zalo, and Telegram instantaneously.', time: '11:25' },
              { dir: 'out', text: 'Having all chats in one calm window keeps my desktop spotless ✨', time: '11:26' },
              { dir: 'in', text: 'Try flipping “Save RAM” in the top-right to put Telegram to sleep without logging out!', time: '11:27' },
            ],
          },
          {
            id: 'tg-2',
            initials: 'SM',
            avatarClass: 'avatar-blue',
            name: 'Saved Messages',
            status: 'Personal notes',
            online: false,
            time: '08:40',
            unread: 0,
            snippet: 'Today’s checklist',
            messages: [
              { dir: 'out', text: '1. Send weekly summary before 11 AM\n2. Review slides for Thursday', time: '08:38' },
              { dir: 'out', text: '3. Pick up coffee beans on the way home ☕', time: '08:40' },
            ],
          },
          {
            id: 'tg-3',
            initials: 'BC',
            avatarClass: 'avatar-green',
            name: 'Book Club',
            status: '18 members',
            online: false,
            time: 'Yesterday',
            unread: 0,
            snippet: 'What should we read next month?',
            messages: [
              { dir: 'in', text: 'Let’s pick our next book this weekend!', time: 'Yesterday' },
              { dir: 'out', text: 'Voting for a book on deep work and focus!', time: 'Yesterday' },
            ],
          },
        ],
      },
    },
  };

  const STRINGS = {
    vi: {
      pageTitle: 'GomTin — Trung tâm nhắn tin tập trung & riêng tư cho macOS',
      navFeatures: 'Tính năng',
      navSecurity: 'Riêng tư & Phím tắt',
      navInstall: 'Cài đặt',
      navFaq: 'Hỏi đáp',
      navDownload: 'Tải bản mới nhất',
      heroEyebrow: 'macOS (Apple Silicon) • Messenger, Zalo & Telegram • Miễn phí & Mã nguồn mở',
      heroTitleLine1: 'Gom mọi tin nhắn vào một nơi',
      heroTitleLine2: 'tập trung và riêng tư',
      heroSubtitle: 'Ứng dụng nhắn tin gọn nhẹ cho macOS. Mở song song Facebook Messenger, Zalo Web và Telegram Web tới 9 tài khoản tách biệt, tắt tài khoản tiết kiệm RAM không cần đăng xuất, chặn Bảng tin Facebook và bảo vệ bằng Touch ID.',
      heroDownload: 'Tải cho macOS (.zip)',
      heroGithub: 'Mã nguồn GitHub',
      trustOpenSource: 'Mã nguồn mở Apache-2.0 • Không thu thập dữ liệu',
      trustIsolation: 'Tách biệt từng tài khoản • Không đọc tin nhắn',
      trustIntegrity: 'Khóa Touch ID • Cập nhật kiểm tra toàn vẹn',
      paletteTry: 'Thử 6 bảng màu Pastel:',
      previewBlurBtn: 'Làm mờ riêng tư',
      previewDndActive: 'Đang bật Chế độ Tập trung — Thông báo tạm dừng & âm thanh tab đã tắt tiếng',
      chatSearchPlaceholder: 'Tìm kiếm đoạn chat…',
      chatInputPlaceholder: (name) => `Nhắn tin cho ${name}… (nhấn Enter gửi thử)`,
      paneTgRamLabel: 'Tiết kiệm RAM',
      tgSleepTitle: 'Telegram đang tạm nghỉ — Đã giải phóng RAM',
      tgSleepBody: 'Tiến trình chạy ngầm đã được tắt để máy nhẹ hơn. Phiên đăng nhập vẫn được giữ nguyên trên máy — bật lại là vào chat ngay không cần quét mã QR.',
      tgWakeBtn: 'Bật lại tài khoản ngay',
      paneSetTitle: 'Cài đặt nhúng GomTin',
      paneSetSub: 'Tài khoản • Lịch tập trung • Giao diện • Cập nhật',
      rowChipOn: 'Đang chạy',
      rowChipOff: 'Đang ngủ (0 MB RAM)',
      rowToggleSleep: 'Tắt để tiết kiệm RAM',
      rowToggleWake: 'Bật lại tài khoản',
      previewBlurNote: 'Màn hình riêng tư đang làm mờ đoạn chat khi bạn rời cửa sổ',
      lockTitle: 'GomTin đang được khóa',
      lockDesc: 'Tự động khóa khi gập máy, khóa màn hình hoặc không thao tác sau 1–60 phút.',
      lockTouchIdBtn: 'Mở khóa bằng Touch ID',
      featEyebrow: 'Ưu điểm nổi bật',
      featTitle: 'Tất cả kênh trò chuyện, gọn gàng và tiết kiệm tài nguyên',
      featDesc: 'Thiết kế dành cho nhu cầu làm việc tập trung hằng ngày trên macOS — không quảng cáo, không theo dõi và không làm nặng máy.',
      f1Title: '3 nền tảng, tối đa 9 tài khoản',
      f1Desc: 'Chạy song song Facebook Messenger, Zalo Web và Telegram Web trên thanh bên gọn 58px. Mỗi tài khoản lưu phiên đăng nhập tách biệt và chuyển tức thì bằng phím tắt ⌘1…9.',
      f2Title: 'Tắt tài khoản tiết kiệm RAM',
      f2Desc: 'Gạt tắt bất kỳ tài khoản nào trong Cài đặt để dừng hẳn tiến trình chạy ngầm và giải phóng RAM ngay, nhưng vẫn giữ nguyên đăng nhập trên máy. Bật lại là dùng tiếp liền.',
      f3Title: 'Chặn xao nhãng & Lịch tập trung',
      f3Desc: 'Tự động chặn Bảng tin Facebook, Watch, Reels, Marketplace và ẩn thanh điều hướng phía trên. Hỗ trợ tạm dừng thông báo và đặt Lịch tập trung theo tuần kèm tắt tiếng tự động.',
      f4Title: 'Khóa Touch ID & Màn hình riêng tư',
      f4Desc: 'Khóa ứng dụng bằng mật khẩu kèm Touch ID khi mở máy, gập nắp hoặc sau 1–60 phút không thao tác. Hỗ trợ làm mờ màn hình khi rời cửa sổ và Phiên tạm thời (tự xóa đăng nhập khi đóng).',
      f5Title: 'Giao diện gọn nhẹ & 6 bảng màu Pastel',
      f5Desc: '6 bảng màu Pastel tinh chọn, chế độ Sáng / Tối / Theo hệ thống, song ngữ Tiếng Việt & English cùng trang Cài đặt nhúng gọn trong một cửa sổ duy nhất.',
      f6Title: 'Tự động cập nhật an toàn',
      f6Desc: 'Tự kiểm tra bản mới từ GitHub Releases, xác thực chữ ký ứng dụng và mã kiểm tra toàn vẹn trước khi cài, tự khôi phục nếu gặp lỗi. Bạn luôn có thể bật hoặc tắt trong Cài đặt.',
      secEyebrow: 'Riêng tư & Điều khiển',
      secTitle: 'Cam kết bảo vệ quyền riêng tư & Phím tắt macOS',
      secCardTitle: 'Cách GomTin bảo vệ dữ liệu của bạn',
      secItem1Title: 'Không đọc tin nhắn hay mật khẩu:',
      secItem1Desc: 'Mỗi tài khoản chạy trong một môi trường tách biệt hoàn toàn với hệ thống; ứng dụng không can thiệp nội dung trò chuyện, chỉ lấy duy nhất số tin chưa đọc để hiện chấm báo.',
      secItem2Title: 'Mã hóa đăng nhập & bảo vệ tệp ứng dụng:',
      secItem2Desc: 'Dữ liệu đăng nhập được mã hóa an toàn trên máy Mac, còn tệp ứng dụng được khóa toàn vẹn để ngăn chỉnh sửa trái phép.',
      secItem3Title: 'Chống phần mềm khác đọc lén phiên chat:',
      secItem3Desc: 'Ứng dụng tự từ chối khởi chạy nếu phát hiện các tham số gỡ lỗi hoặc can thiệp đường truyền bất thường từ bên ngoài.',
      secItem4Title: 'Khóa quyền theo đúng trang chính chủ:',
      secItem4Desc: 'Thông báo, tải tệp, camera, micro và chia sẻ màn hình chỉ cấp đúng cho Messenger, Zalo hoặc Telegram; mọi đường dẫn ngoài đều mở bằng trình duyệt mặc định.',
      secItem5Title: 'Không theo dõi, không quảng cáo, mã nguồn mở:',
      secItem5Desc: 'Không thu thập hành vi sử dụng, không gửi dữ liệu về bên thứ ba và công khai 100% mã nguồn trên GitHub để ai cũng có thể kiểm chứng.',
      keyCardTitle: 'Phím tắt thao tác nhanh',
      keyToggleWin: 'Ẩn / hiện cửa sổ GomTin toàn hệ thống',
      keySwitchAcc: 'Chuyển nhanh tài khoản 1 đến 9',
      keyLock: 'Khóa ứng dụng ngay lập tức',
      keySidebar: 'Ẩn / hiện thanh bên trái',
      keySettings: 'Mở Cài đặt nhúng',
      keyHome: 'Quay về trang chủ dịch vụ hiện tại',
      keyReload: 'Tải lại trang trò chuyện hiện tại',
      instEyebrow: 'Cài đặt nhanh chóng',
      instTitle: 'Cài đặt GomTin trên macOS',
      instDesc: 'Tải trực tiếp từ GitHub Releases hoặc chạy một dòng lệnh tự động kiểm tra tệp an toàn trước khi cài.',
      termLabel: 'Cài đặt nhanh bằng 1 dòng lệnh (tự kiểm tra toàn vẹn & chữ ký ứng dụng):',
      copyCmd: 'Sao chép',
      copiedCmd: 'Đã sao chép',
      termNote: 'Cài vào ~/Applications/GomTin.app và giữ nguyên toàn bộ phiên đăng nhập khi chạy lại để cập nhật.',
      orManual: 'Hoặc tải file .zip thủ công từ GitHub Releases',
      step1Title: 'Tải gói .zip chính thức',
      step1Desc: 'Tải phiên bản mới nhất cho máy Mac chip Apple Silicon (M1–M4), có kèm tệp mã kiểm tra toàn vẹn nếu bạn muốn đối chiếu.',
      step1Link: 'Tải GomTin (.zip) ➔',
      step2Title: 'Giải nén vào Applications',
      step2Desc: 'Giải nén tệp .zip và kéo GomTin.app vào thư mục Applications (hoặc ~/Applications). Nếu dùng Mac chip Intel, bạn có thể tự biên dịch cục bộ bằng ./scripts/build-local.sh --install.',
      step3Title: 'Thêm tài khoản & tùy biến',
      step3Desc: 'Mở GomTin, nhấn dấu + trên thanh bên để thêm Messenger, Zalo hoặc Telegram, chọn bảng màu Pastel yêu thích và bật khóa Touch ID nếu cần.',
      faqEyebrow: 'Giải đáp thắc mắc',
      faqTitle: 'Câu hỏi thường gặp',
      q1: 'GomTin có đọc tin nhắn, mật khẩu hay dữ liệu đăng nhập của tôi không?',
      a1: 'Không bao giờ. Mỗi tài khoản chạy trong một môi trường tách biệt riêng trên máy của bạn; ứng dụng không chèn mã đọc tin nhắn hay mật khẩu và không gửi dữ liệu sử dụng ra bất kỳ máy chủ bên thứ ba nào. Toàn bộ mã nguồn và cam kết riêng tư đều công khai trên GitHub để bạn dễ dàng kiểm chứng.',
      q2: 'Tắt tài khoản để tiết kiệm RAM có làm tôi bị đăng xuất không?',
      a2: 'Không. Khi bạn gạt tắt một tài khoản trong Cài đặt, GomTin chỉ dừng hẳn tiến trình chạy ngầm để giải phóng bộ nhớ nhưng vẫn giữ nguyên dữ liệu đăng nhập đã mã hóa trên máy. Khi cần dùng lại, chỉ cần gạt bật là Messenger, Zalo hoặc Telegram mở lại ngay mà không cần đăng nhập lại.',
      q3: 'Khóa ứng dụng, Touch ID và Màn hình riêng tư bảo vệ như thế nào?',
      a3: 'Khi bật khóa ứng dụng, GomTin che kín toàn bộ nội dung chat, ẩn thanh bên, tạm giữ thông báo và khóa các thao tác mở rộng cho đến khi bạn mở khóa bằng mật khẩu hoặc Touch ID. Ứng dụng tự động khóa khi bạn khóa màn hình macOS, gập máy hoặc không thao tác sau 1, 5, 15 hay 60 phút.',
      q4: 'Tính năng tự động cập nhật hoạt động ra sao và có an toàn không?',
      a4: 'GomTin tự kiểm tra phiên bản mới từ GitHub Releases mà không gửi kèm thông tin cá nhân, tải bản cập nhật về, đối chiếu mã kiểm tra toàn vẹn và chữ ký ứng dụng trên macOS rồi mới thay thế an toàn (tự khôi phục bản cũ nếu có sự cố). Bạn luôn có thể tắt tự động cập nhật trong mục Cài đặt → Giao diện.',
      q5: 'GomTin có hỗ trợ cả Apple Silicon (M1–M4) và Mac Intel không?',
      a5: 'Gói tải sẵn trên GitHub Releases hiện ưu tiên bản chạy gốc cho máy Mac chip Apple Silicon (M1–M4). Nếu bạn dùng Mac chip Intel hoặc muốn tự biên dịch từ mã nguồn, chỉ cần tải kho mã nguồn về và chạy lệnh ./scripts/build-local.sh --install để hệ thống tự kiểm thử và cài đặt bản tương thích với máy của bạn.',
      ctaTitle: 'Sẵn sàng giữ góc làm việc gọn gàng với GomTin?',
      ctaDesc: 'Miễn phí, mã nguồn mở Apache-2.0, không quảng cáo và không thu thập dữ liệu. Tải về cho macOS và gom trọn Messenger, Zalo, Telegram vào một cửa sổ thanh lịch.',
      ctaDownload: 'Tải GomTin cho macOS',
      ctaStar: '⭐ Tặng sao trên GitHub',
      footerTagline: 'GomTin — Trung tâm nhắn tin tập trung & riêng tư cho macOS',
      footerCreditPrefix: 'Phát triển bởi',
      footerLicensePrefix: 'Giấy phép mã nguồn mở',
      footerReleases: 'Phiên bản',
      footerPrivacy: 'Quyền riêng tư',
      footerIssues: 'Báo lỗi & Góp ý',
      nowTime: 'Vừa xong',
      titleByPane: {
        messenger: 'GomTin — Facebook Messenger',
        zalo: 'GomTin — Zalo Web',
        telegram: 'GomTin — Telegram Web',
        settings: 'GomTin — Cài đặt',
      },
      releaseMetaLoaded: (ver, mb) => `Phiên bản mới nhất: ${ver} • macOS Apple Silicon (.zip, ${mb} MB) • Kèm tệp kiểm tra toàn vẹn`,
      downloadWithVer: (ver) => `Tải ${ver} cho macOS (.zip)`,
    },
    en: {
      pageTitle: 'GomTin — Distraction-Free, Privacy-First Desktop Chat Hub for macOS',
      navFeatures: 'Features',
      navSecurity: 'Privacy & Shortcuts',
      navInstall: 'Install',
      navFaq: 'FAQ',
      navDownload: 'Download Latest',
      heroEyebrow: 'macOS (Apple Silicon) • Messenger, Zalo & Telegram • Free & Open Source',
      heroTitleLine1: 'Every chat in one calm place,',
      heroTitleLine2: 'focused and private',
      heroSubtitle: 'A lightweight, private chat hub for macOS. Run Facebook Messenger, Zalo Web, and Telegram Web side by side across up to 9 separate accounts, pause accounts to save RAM without logging out, block Facebook News Feed, and lock with Touch ID.',
      heroDownload: 'Download for macOS (.zip)',
      heroGithub: 'View on GitHub',
      trustOpenSource: 'Open Source Apache-2.0 • No Tracking',
      trustIsolation: 'Fully Isolated Accounts • Never Reads Chats',
      trustIntegrity: 'Touch ID Lock • Verified Safe Updates',
      paletteTry: 'Try 6 Pastel themes:',
      previewBlurBtn: 'Privacy Blur',
      previewDndActive: 'Focus Mode Active — Notifications paused & tab audio muted',
      chatSearchPlaceholder: 'Search conversations…',
      chatInputPlaceholder: (name) => `Message ${name}… (press Enter to test)`,
      paneTgRamLabel: 'Save RAM',
      tgSleepTitle: 'Telegram is sleeping — RAM freed',
      tgSleepBody: 'Its background process has been stopped to free up memory while keeping your login safe on disk. Wake it anytime without re-scanning a QR code.',
      tgWakeBtn: 'Wake Account Now',
      paneSetTitle: 'Embedded GomTin Settings',
      paneSetSub: 'Accounts • Focus Schedule • Appearance • Updates',
      rowChipOn: 'Running',
      rowChipOff: 'Sleeping (0 MB RAM)',
      rowToggleSleep: 'Turn Off to Save RAM',
      rowToggleWake: 'Wake Account',
      previewBlurNote: 'Privacy Screen blurs your chats whenever you leave the window',
      lockTitle: 'GomTin is Locked',
      lockDesc: 'Locks automatically on launch, screen lock, sleep, or after 1–60 minutes idle.',
      lockTouchIdBtn: 'Unlock with Touch ID',
      featEyebrow: 'Key Highlights',
      featTitle: 'All your chats, calm by design and light on memory',
      featDesc: 'Crafted for daily deep work on macOS — no ads, no tracking, and no bloated background tabs.',
      f1Title: '3 Services, up to 9 Accounts',
      f1Desc: 'Run Facebook Messenger, Zalo Web, and Telegram Web on a tidy 58px sidebar rail. Each account keeps its own login and switches instantly with ⌘1…9.',
      f2Title: 'Save RAM Without Logging Out',
      f2Desc: 'Toggle any account off in Settings to stop its background process and reclaim memory right away while keeping your encrypted login intact on disk.',
      f3Title: 'Distraction-Free & Focus Schedule',
      f3Desc: 'Blocks Facebook News Feed, Watch, Reels, Marketplace, and hides the top navigation bar. Includes Do Not Disturb and weekly Focus schedules with automatic tab muting.',
      f4Title: 'Touch ID Lock & Privacy Screen',
      f4Desc: 'Protect chats with password + Touch ID lock on launch, sleep, screen lock, or idle timeout (1–60 min). Supports unfocused blur and temporary sessions that clear on quit.',
      f5Title: 'Clean UI & 6 Pastel Themes',
      f5Desc: '6 handpicked pastel themes, System / Light / Dark modes, Vietnamese & English localization, and single-window embedded Settings.',
      f6Title: 'Safe Automatic Updates',
      f6Desc: 'Checks GitHub Releases automatically, verifies the app signature and integrity checksum before installing, and rolls back safely if anything fails. Toggle anytime in Settings.',
      secEyebrow: 'Privacy & Controls',
      secTitle: 'Built for Privacy & Native macOS Shortcuts',
      secCardTitle: 'How GomTin Protects Your Data',
      secItem1Title: 'Never reads your messages or passwords:',
      secItem1Desc: 'Every account runs in its own isolated space; GomTin never inspects chat contents and only reads the unread counter to display badges.',
      secItem2Title: 'Encrypted logins & tamper-resistant app bundle:',
      secItem2Desc: 'Your login cookies are encrypted on your Mac and the app bundle is integrity-locked against unauthorized modification.',
      secItem3Title: 'Blocks external snooping into chat sessions:',
      secItem3Desc: 'Packaged builds refuse to launch if invoked with external debugging or network-interception flags.',
      secItem4Title: 'Permissions locked to each official service:',
      secItem4Desc: 'Notifications, downloads, camera, mic, and screen sharing are granted strictly to Messenger, Zalo, or Telegram; external links always open in your default browser.',
      secItem5Title: 'No tracking, no ads, 100% open source:',
      secItem5Desc: 'Zero usage analytics or third-party data sharing, with all source code publicly verifiable on GitHub.',
      keyCardTitle: 'Quick Keyboard Shortcuts',
      keyToggleWin: 'Show / hide GomTin window globally',
      keySwitchAcc: 'Switch instantly between accounts 1–9',
      keyLock: 'Lock the app immediately',
      keySidebar: 'Toggle the left sidebar rail',
      keySettings: 'Open embedded Settings',
      keyHome: 'Return to current service home',
      keyReload: 'Reload the active chat view',
      instEyebrow: 'Quick Installation',
      instTitle: 'Install GomTin on macOS',
      instDesc: 'Download directly from GitHub Releases or run the one-line installer with automatic integrity checks.',
      termLabel: 'One-line Terminal install (verifies integrity & app signature):',
      copyCmd: 'Copy',
      copiedCmd: 'Copied',
      termNote: 'Installs to ~/Applications/GomTin.app and keeps all existing chat sessions intact when re-run to update.',
      orManual: 'Or download the .zip archive manually from GitHub Releases',
      step1Title: 'Download the official .zip',
      step1Desc: 'Grab the latest macOS Apple Silicon (M1–M4) release along with the optional checksum file for manual verification.',
      step1Link: 'Download GomTin (.zip) ➔',
      step2Title: 'Unzip to Applications',
      step2Desc: 'Extract the archive and drag GomTin.app into Applications (or ~/Applications). On Intel Macs, build locally with ./scripts/build-local.sh --install.',
      step3Title: 'Add Accounts & Personalize',
      step3Desc: 'Launch GomTin, click + on the sidebar to add Messenger, Zalo, or Telegram, pick your pastel theme, and enable Touch ID lock if desired.',
      faqEyebrow: 'Answers',
      faqTitle: 'Frequently Asked Questions',
      q1: 'Does GomTin ever read my messages, passwords, or logins?',
      a1: 'Never. Each account runs in an isolated space on your Mac; GomTin does not inspect your messages or passwords and sends zero usage data to third-party servers. Everything is open source on GitHub for full transparency.',
      q2: 'Does turning an account off to save RAM log me out?',
      a2: 'No. Toggling an account off in Settings stops its background process to free RAM immediately while keeping your encrypted login saved on your Mac. Turning it back on restores Messenger, Zalo, or Telegram right away.',
      q3: 'What do App Lock, Touch ID, and Privacy Screen protect?',
      a3: 'When locked, GomTin hides all chat screens, hides the sidebar, holds notifications, and blocks extra tools until unlocked with your password or Touch ID. It locks automatically on macOS screen lock, sleep, or after 1, 5, 15, or 60 minutes idle.',
      q4: 'How does the built-in auto-updater stay safe?',
      a4: 'GomTin checks GitHub Releases without sending personal cookies, verifies both the integrity checksum and macOS app signature before replacing the app, and restores the previous version if anything goes wrong. You can turn it off anytime in Settings → Appearance.',
      q5: 'Does GomTin support both Apple Silicon (M1–M4) and Intel Macs?',
      a5: 'Prebuilt archives on GitHub Releases currently target Apple Silicon (M1–M4). On Intel Macs, or if you prefer building from source, clone the repository and run ./scripts/build-local.sh --install.',
      ctaTitle: 'Ready for a calmer chat workspace on macOS?',
      ctaDesc: 'Free, open-source under Apache-2.0, ad-free and no tracking. Bring Messenger, Zalo, and Telegram together in one tidy window.',
      ctaDownload: 'Download GomTin for macOS',
      ctaStar: '⭐ Star on GitHub',
      footerTagline: 'GomTin — Distraction-Free, Privacy-First Desktop Chat Hub for macOS',
      footerCreditPrefix: 'Built by',
      footerLicensePrefix: 'Licensed under',
      footerReleases: 'Releases',
      footerPrivacy: 'Privacy Policy',
      footerIssues: 'Issues & Feedback',
      nowTime: 'Just now',
      titleByPane: {
        messenger: 'GomTin — Facebook Messenger',
        zalo: 'GomTin — Zalo Web',
        telegram: 'GomTin — Telegram Web',
        settings: 'GomTin — Settings',
      },
      releaseMetaLoaded: (ver, mb) => `Latest release: ${ver} • macOS Apple Silicon (.zip, ${mb} MB) • Checksum included`,
      downloadWithVer: (ver) => `Download ${ver} for macOS (.zip)`,
    },
  };

  const root = document.documentElement;
  let currentLang = root.getAttribute('lang') === 'en' ? 'en' : 'vi';
  let currentTheme = THEMES.includes(root.getAttribute('data-theme')) ? root.getAttribute('data-theme') : 'blue';
  let currentMode = root.getAttribute('data-mode') === 'light' ? 'light' : 'dark';
  let activePane = 'messenger';
  const activeThreadByService = { messenger: 0, zalo: 0, telegram: 0 };
  const extraMessages = {}; // threadId -> [{ dir: 'out', text, time }]
  let tgSleeping = false;
  let dndActive = false;
  let blurActive = false;
  let lockActive = false;
  let latestRelease = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function dict() {
    return STRINGS[currentLang] || STRINGS.vi;
  }

  function applyTheme(theme) {
    if (!THEMES.includes(theme)) return;
    currentTheme = theme;
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('gomtin-home-theme', theme); } catch {}
    $$('.swatch-btn').forEach((btn) => {
      btn.setAttribute('aria-checked', String(btn.dataset.themeChoice === theme));
    });
  }

  function applyMode(mode) {
    currentMode = mode === 'light' ? 'light' : 'dark';
    root.setAttribute('data-mode', currentMode);
    try { localStorage.setItem('gomtin-home-mode', currentMode); } catch {}
    const sun = $('#mode-icon-sun');
    const moon = $('#mode-icon-moon');
    if (sun && moon) {
      sun.hidden = currentMode === 'light';
      moon.hidden = currentMode === 'dark';
    }
  }

  function renderChatWorkspace() {
    const workspace = $('#chat-workspace');
    const sleepView = $('#tg-sleep-view');
    const settingsPane = $('#settings-pane');

    if (activePane === 'settings') {
      if (workspace) workspace.hidden = true;
      if (sleepView) sleepView.hidden = true;
      if (settingsPane) settingsPane.hidden = false;
      return;
    }

    if (settingsPane) settingsPane.hidden = true;

    if (activePane === 'telegram' && tgSleeping) {
      if (workspace) workspace.hidden = true;
      if (sleepView) sleepView.hidden = false;
      return;
    }

    if (sleepView) sleepView.hidden = true;
    if (workspace) workspace.hidden = false;

    const svcData = (CHAT_DATA[currentLang] || CHAT_DATA.vi)[activePane];
    if (!svcData) return;

    const svcTitle = $('#chat-service-title');
    const svcShortcut = $('#chat-shortcut-chip');
    const svcPill = $('#chat-service-pill');
    const ramWrap = $('#tg-ram-toggle-wrap');
    if (svcTitle) svcTitle.textContent = svcData.serviceTitle;
    if (svcShortcut) svcShortcut.textContent = svcData.shortcut;

    if (activePane === 'telegram') {
      if (svcPill) svcPill.hidden = true;
      if (ramWrap) ramWrap.hidden = false;
    } else {
      if (ramWrap) ramWrap.hidden = true;
      if (svcPill) {
        svcPill.hidden = !svcData.pill;
        svcPill.textContent = svcData.pill;
      }
    }

    const threadIdx = activeThreadByService[activePane] || 0;
    const activeThread = svcData.threads[threadIdx] || svcData.threads[0];

    // Render thread list using safe DOM APIs
    const listEl = $('#chat-thread-list');
    if (listEl) {
      listEl.textContent = '';
      svcData.threads.forEach((th, idx) => {
        const extras = extraMessages[th.id] || [];
        const lastExtra = extras[extras.length - 1];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `thread-item${idx === threadIdx ? ' active' : ''}`;
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', String(idx === threadIdx));

        const avatar = document.createElement('span');
        avatar.className = `chat-avatar ${th.avatarClass}`;
        avatar.textContent = th.initials;

        const body = document.createElement('div');
        body.className = 'thread-body';

        const top = document.createElement('div');
        top.className = 'thread-top';
        const name = document.createElement('span');
        name.className = 'thread-name';
        name.textContent = th.name;
        const time = document.createElement('span');
        time.className = 'thread-time';
        time.textContent = lastExtra ? dict().nowTime : th.time;
        top.append(name, time);

        const bottom = document.createElement('div');
        bottom.className = 'thread-bottom';
        const snippet = document.createElement('span');
        snippet.className = 'thread-snippet';
        snippet.textContent = lastExtra ? lastExtra.text : th.snippet;
        bottom.appendChild(snippet);
        if (th.unread > 0 && idx !== threadIdx) {
          const badge = document.createElement('span');
          badge.className = 'thread-unread';
          badge.textContent = String(th.unread);
          bottom.appendChild(badge);
        }

        body.append(top, bottom);
        btn.append(avatar, body);
        btn.addEventListener('click', () => {
          activeThreadByService[activePane] = idx;
          renderChatWorkspace();
        });
        listEl.appendChild(btn);
      });
    }

    // Active peer header
    const activeAvatar = $('#chat-active-avatar');
    const activeName = $('#chat-active-name');
    const activeStatus = $('#chat-active-status');
    const activeDot = $('#chat-active-dot');
    if (activeAvatar) {
      activeAvatar.className = `chat-avatar ${activeThread.avatarClass}`;
      activeAvatar.textContent = activeThread.initials;
    }
    if (activeName) activeName.textContent = activeThread.name;
    if (activeStatus) activeStatus.textContent = activeThread.status;
    if (activeDot) activeDot.hidden = !activeThread.online;

    const inputEl = $('#chat-input');
    if (inputEl) inputEl.placeholder = dict().chatInputPlaceholder(activeThread.name);

    // Render messages
    const msgBox = $('#chat-messages');
    if (msgBox) {
      msgBox.textContent = '';
      const allMsgs = activeThread.messages.concat(extraMessages[activeThread.id] || []);
      allMsgs.forEach((m) => {
        const row = document.createElement('div');
        row.className = `msg-row ${m.dir}`;

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = m.text;

        if (m.file) {
          const card = document.createElement('div');
          card.className = 'msg-file-card';
          const icon = document.createElement('span');
          icon.className = 'msg-file-icon';
          icon.textContent = m.file.ext;
          const meta = document.createElement('div');
          meta.className = 'msg-file-meta';
          const fname = document.createElement('strong');
          fname.textContent = m.file.name;
          const fsize = document.createElement('span');
          fsize.textContent = m.file.size;
          meta.append(fname, fsize);
          card.append(icon, meta);
          bubble.appendChild(card);
        }

        const ts = document.createElement('span');
        ts.className = 'msg-time';
        ts.textContent = m.time === '__now__' ? dict().nowTime : m.time;

        row.append(bubble, ts);
        msgBox.appendChild(row);
      });
      msgBox.scrollTop = msgBox.scrollHeight;
    }
  }

  function updateReleaseCopy() {
    const d = dict();
    const versionPill = $('#header-version-pill');
    const heroDlLabel = $('#hero-download-label');
    const releaseMeta = $('#release-meta-line');
    const stepDlLink = $('#step-download-link');

    if (latestRelease) {
      if (versionPill) versionPill.textContent = latestRelease.tag;
      if (heroDlLabel) heroDlLabel.textContent = d.downloadWithVer(latestRelease.tag);
      if (releaseMeta && latestRelease.sizeMb) {
        releaseMeta.textContent = d.releaseMetaLoaded(latestRelease.tag, latestRelease.sizeMb);
      }
      if (stepDlLink && latestRelease.assetName) {
        stepDlLink.textContent = `${latestRelease.assetName} ➔`;
      }
      $$('.js-download-link').forEach((el) => {
        el.setAttribute('href', latestRelease.downloadUrl || LATEST_PAGE_URL);
      });
      $$('.js-checksum-link').forEach((el) => {
        el.setAttribute('href', latestRelease.checksumUrl || latestRelease.releaseUrl || LATEST_PAGE_URL);
      });
    } else {
      if (versionPill) versionPill.textContent = FALLBACK_VERSION;
      if (heroDlLabel) heroDlLabel.textContent = d.heroDownload;
      if (releaseMeta) releaseMeta.textContent = d.instDesc;
      if (stepDlLink) stepDlLink.textContent = d.step1Link;
    }
  }

  function updateTelegramSleepUI() {
    const d = dict();
    const toggle = $('#preview-tg-sleep-toggle');
    const railItem = $('[data-pane-item="telegram"]');
    const railTag = $('#rail-tg-sleep');
    const settingsChip = $('#settings-tg-chip');
    const settingsBtn = $('#settings-tg-toggle-btn');

    if (toggle) toggle.checked = tgSleeping;
    if (railItem) railItem.classList.toggle('is-sleeping', tgSleeping);
    if (railTag) railTag.hidden = !tgSleeping;
    if (settingsChip) {
      settingsChip.textContent = tgSleeping ? d.rowChipOff : d.rowChipOn;
      settingsChip.classList.toggle('is-sleep', tgSleeping);
    }
    if (settingsBtn) {
      settingsBtn.textContent = tgSleeping ? d.rowToggleWake : d.rowToggleSleep;
    }
    renderChatWorkspace();
  }

  function selectPane(pane) {
    activePane = pane;
    const d = dict();
    $$('[data-pane-item]').forEach((item) => {
      const isMatch = item.dataset.paneItem === pane;
      item.classList.toggle('active', isMatch);
      const tab = item.querySelector('[role="tab"]');
      if (tab) tab.setAttribute('aria-selected', String(isMatch));
    });
    const settingsBtn = $('#preview-settings-btn');
    if (settingsBtn) settingsBtn.classList.toggle('active', pane === 'settings');

    const titleEl = $('#preview-title-text');
    if (titleEl && d.titleByPane[pane]) {
      titleEl.textContent = d.titleByPane[pane];
    }
    renderChatWorkspace();
  }

  function applyLang(lang) {
    currentLang = lang === 'en' ? 'en' : 'vi';
    root.setAttribute('lang', currentLang);
    try { localStorage.setItem('gomtin-home-lang', currentLang); } catch {}
    const d = dict();
    document.title = d.pageTitle;
    const langLabel = $('#lang-toggle-label');
    if (langLabel) langLabel.textContent = currentLang.toUpperCase();

    $$('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (Object.prototype.hasOwnProperty.call(d, key)) {
        el.textContent = d[key];
      }
    });

    selectPane(activePane);
    updateTelegramSleepUI();
    updateReleaseCopy();
  }

  // Event Bindings
  const langToggle = $('#lang-toggle');
  if (langToggle) {
    langToggle.addEventListener('click', () => {
      applyLang(currentLang === 'vi' ? 'en' : 'vi');
    });
  }

  const modeToggle = $('#mode-toggle');
  if (modeToggle) {
    modeToggle.addEventListener('click', () => {
      applyMode(currentMode === 'dark' ? 'light' : 'dark');
    });
  }

  $$('.swatch-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeChoice));
  });

  $$('[data-pane]').forEach((btn) => {
    btn.addEventListener('click', () => {
      lockActive = false;
      const lockOverlay = $('#mock-lock-overlay');
      const lockBtn = $('#preview-lock-btn');
      if (lockOverlay) lockOverlay.hidden = true;
      if (lockBtn) lockBtn.setAttribute('aria-pressed', 'false');
      selectPane(btn.dataset.pane);
    });
  });

  const composer = $('#chat-composer');
  if (composer) {
    composer.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#chat-input');
      if (!input) return;
      const text = input.value.trim();
      if (!text || activePane === 'settings') return;
      const svcData = (CHAT_DATA[currentLang] || CHAT_DATA.vi)[activePane];
      if (!svcData) return;
      const th = svcData.threads[activeThreadByService[activePane] || 0];
      if (!th) return;
      if (!extraMessages[th.id]) extraMessages[th.id] = [];
      extraMessages[th.id].push({ dir: 'out', text, time: '__now__' });
      input.value = '';
      renderChatWorkspace();
    });
  }

  const tgSleepToggle = $('#preview-tg-sleep-toggle');
  if (tgSleepToggle) {
    tgSleepToggle.addEventListener('change', () => {
      tgSleeping = tgSleepToggle.checked;
      updateTelegramSleepUI();
    });
  }

  const tgWakeBtn = $('#tg-wake-btn');
  if (tgWakeBtn) {
    tgWakeBtn.addEventListener('click', () => {
      tgSleeping = false;
      updateTelegramSleepUI();
    });
  }

  const settingsTgToggleBtn = $('#settings-tg-toggle-btn');
  if (settingsTgToggleBtn) {
    settingsTgToggleBtn.addEventListener('click', () => {
      tgSleeping = !tgSleeping;
      updateTelegramSleepUI();
    });
  }

  const dndBtn = $('#preview-dnd-btn');
  if (dndBtn) {
    dndBtn.addEventListener('click', () => {
      dndActive = !dndActive;
      dndBtn.setAttribute('aria-pressed', String(dndActive));
      const iconOn = $('#preview-dnd-on');
      const iconOff = $('#preview-dnd-off');
      const banner = $('#mock-dnd-banner');
      if (iconOn) iconOn.hidden = dndActive;
      if (iconOff) iconOff.hidden = !dndActive;
      if (banner) banner.hidden = !dndActive;
    });
  }

  const blurBtn = $('#preview-blur-btn');
  if (blurBtn) {
    blurBtn.addEventListener('click', () => {
      blurActive = !blurActive;
      blurBtn.setAttribute('aria-pressed', String(blurActive));
      const stage = $('#mock-stage');
      const badge = $('#mock-blur-badge');
      if (stage) stage.classList.toggle('is-blurred', blurActive);
      if (badge) badge.hidden = !blurActive;
    });
  }

  const lockBtn = $('#preview-lock-btn');
  const unlockBtn = $('#preview-unlock-btn');
  function setLockState(locked) {
    lockActive = locked;
    const overlay = $('#mock-lock-overlay');
    if (overlay) overlay.hidden = !locked;
    if (lockBtn) lockBtn.setAttribute('aria-pressed', String(locked));
  }
  if (lockBtn) lockBtn.addEventListener('click', () => setLockState(!lockActive));
  if (unlockBtn) unlockBtn.addEventListener('click', () => setLockState(false));

  // Copy 1-line install command
  const copyBtn = $('#copy-install-btn');
  let copyResetTimer = null;
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const cmd = $('#install-cmd') ? $('#install-cmd').textContent.trim() : '';
      if (!cmd) return;
      try {
        await navigator.clipboard.writeText(cmd);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = cmd;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(ta);
      }
      const defIcon = $('#copy-icon-default');
      const doneIcon = $('#copy-icon-done');
      const txt = $('#copy-btn-text');
      if (defIcon) defIcon.hidden = true;
      if (doneIcon) doneIcon.hidden = false;
      if (txt) txt.textContent = dict().copiedCmd;
      clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => {
        if (defIcon) defIcon.hidden = false;
        if (doneIcon) doneIcon.hidden = true;
        if (txt) txt.textContent = dict().copyCmd;
      }, 2000);
    });
  }

  // Fetch real latest release metadata from GitHub API (graceful fallback if offline/rate-limited)
  async function loadLatestRelease() {
    if (typeof fetch !== 'function') return;
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || typeof data.tag_name !== 'string') return;
      const assets = Array.isArray(data.assets) ? data.assets : [];
      const macArmZip = assets.find((a) => typeof a.name === 'string' && /mac-arm64\.zip$/i.test(a.name))
        || assets.find((a) => typeof a.name === 'string' && /\.zip$/i.test(a.name));
      const checksumAsset = assets.find((a) => a && a.name === 'SHA256SUMS.txt');

      latestRelease = {
        tag: data.tag_name,
        releaseUrl: typeof data.html_url === 'string' ? data.html_url : LATEST_PAGE_URL,
        assetName: macArmZip ? macArmZip.name : '',
        downloadUrl: macArmZip && typeof macArmZip.browser_download_url === 'string'
          ? macArmZip.browser_download_url
          : (typeof data.html_url === 'string' ? data.html_url : LATEST_PAGE_URL),
        checksumUrl: checksumAsset && typeof checksumAsset.browser_download_url === 'string'
          ? checksumAsset.browser_download_url
          : (typeof data.html_url === 'string' ? data.html_url : LATEST_PAGE_URL),
        sizeMb: macArmZip && Number.isFinite(macArmZip.size)
          ? (macArmZip.size / (1024 * 1024)).toFixed(1)
          : '',
      };
      updateReleaseCopy();
    } catch {
      // Offline or GitHub API rate-limited: static fallback links remain valid.
    }
  }

  // Initialize UI
  applyTheme(currentTheme);
  applyMode(currentMode);
  applyLang(currentLang);
  loadLatestRelease();
})();
