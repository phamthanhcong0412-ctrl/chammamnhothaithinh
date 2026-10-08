# Hệ Thống Chấm Công Thông Minh - Cháo Mầm Nhỏ Thái Thịnh

Hệ thống quản lý chấm công, tính lương và phân ca tự động dành riêng cho chuỗi/cửa hàng **Cháo Mầm Nhỏ Thái Thịnh** (Hà Nội).

---

## 🚀 Công Nghệ Sử Dụng

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS v4, Lucide Icons, Canvas Confetti.
- **Backend / Dev Server**: Node.js, Express, TSX, Vite Middleware.
- **Cơ Sở Dữ Liệu & Realtime**: **Supabase (PostgreSQL 15+)**
  - **Phương Án Lựa Chọn A**: Cấp phát tài khoản nội bộ (Username / Password) cho nhân viên & quản lý.
  - **Supabase Realtime Channel**: WebSockets hai chiều cập nhật tức thì trạng thái vào/ra ca làm việc.
  - **Row Level Security (RLS)**: Bảo vệ dữ liệu với phân quyền bảo mật cấp hàng.
  - **Admin OAuth**: Hỗ trợ đăng nhập một chạm qua Google Account dành riêng cho Quản lý / Chủ cửa hàng.
  - **Offline-First & Local Fallback**: Lưu trữ đệm `localStorage` và đồng bộ qua API nội bộ nếu mất mạng internet.

---

## 📂 Cấu Trúc Dự Án

```
├── data/                    # Dữ liệu cục bộ (JSON fallback: store_config, users, attendance)
├── scripts/
│   └── migrate-to-supabase.ts # Kịch bản đẩy dữ liệu mẫu lên Supabase Cloud
├── src/
│   ├── components/          # Giao diện (StaffAttendance, AdminDashboard, SettingsModal, v.v.)
│   ├── context/             # AppContext (Quản lý trạng thái, auth và Supabase Realtime)
│   ├── services/            # api.ts (Lớp giao tiếp dữ liệu Supabase + API)
│   ├── types/               # Type definitions TypeScript
│   └── supabase.ts          # Supabase Client SDK, Realtime Listener & Data Mappers
├── supabase/
│   └── schema.sql           # Script khởi tạo bảng, RLS, Indexes & Realtime publication
├── server.ts                # Express backend server (Dual-Band WiFi detection, cron 21:00, API)
├── package.json
└── vite.config.ts
```

---

## 🛠️ Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Cài đặt thư viện dependencies
```bash
npm install
```

### 2. Cấu hình biến môi trường
Tạo file `.env` từ `.env.example`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Khởi tạo Cơ sở dữ liệu Supabase
1. Mở trang quản trị dự án trên [Supabase Dashboard](https://supabase.com/dashboard).
2. Vào mục **SQL Editor**.
3. Sao chép và dán toàn bộ nội dung từ file [`supabase/schema.sql`](supabase/schema.sql) rồi nhấn **Run**.
4. Script sẽ tự động tạo:
   - Bảng `store_config`: Cấu hình cửa hàng, WiFi, GPS, ca làm việc.
   - Bảng `users`: Danh sách tài khoản nhân sự & quản lý.
   - Bảng `attendance_records`: Lịch sử các ca chấm công, đa lượt, GPS và tính lương.
   - Bảng `email_logs`: Nhật ký báo cáo email tự động lúc 21:00.
   - Kích hoạt **Realtime Replication** & **Replica Identity FULL**.
   - Thiết lập **Row Level Security (RLS)**.

### 4. Di trú (Migrate) dữ liệu lên Supabase
Chạy lệnh di trú dữ liệu mẫu từ thư mục `data/` lên Supabase:
```bash
npm run migrate:supabase
```

### 5. Khởi chạy ứng dụng
```bash
# Khởi chạy máy chủ phát triển (Dev server)
npm run dev

# Kiểm tra kiểu TypeScript
npm run lint

# Biên dịch Production Bundle
npm run build
```

---

## 🔒 Tài Khoản Mặc Định

| Vai trò | Tên đăng nhập | Mật khẩu mặc định | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Chủ quán / Admin** | `ptcong` | `12345678@Abc` | Phạm Thành Công - Quản lý toàn quyền |
| **Nhân viên (mẫu)** | `nv01` | `123456` | Cấp phát sẵn qua hệ thống quản lý nhân sự |
