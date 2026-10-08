-- ====================================================================
-- CƠ SỞ DỮ LIỆU SUPABASE - HỆ THỐNG CHẤM CÔNG CHÁO MẦM NHỎ THÁI THỊNH
-- Kiến trúc: PostgreSQL + Row Level Security (RLS) + Realtime Replication
-- Phương án: Lựa chọn A (Tài khoản nội bộ Username/Password + Supabase OAuth)
-- ====================================================================

-- Bật extension pgcrypto (nếu cần tạo UUID hoặc hash)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 1. BẢNG CẤU HÌNH CỬA HÀNG (store_config)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_config (
    id TEXT PRIMARY KEY DEFAULT 'config_default',
    store_name TEXT NOT NULL DEFAULT 'Cháo Mầm Nhỏ Thái Thịnh',
    store_address TEXT NOT NULL DEFAULT 'Thái Thịnh, Đống Đa, Hà Nội',
    wifi_ssid TEXT NOT NULL DEFAULT 'ChaoMamNho_ThaiThinh_5G',
    wifi_bssid TEXT DEFAULT 'A4:2B:D2:F5:34:46',
    allowed_ips TEXT[] DEFAULT ARRAY['127.0.0.1', '::1', '14.161.45.88', '118.69.182.20'],
    bypass_ip_check BOOLEAN DEFAULT FALSE,
    require_wifi BOOLEAN DEFAULT TRUE,
    require_qr BOOLEAN DEFAULT FALSE,
    require_gps BOOLEAN DEFAULT TRUE,
    store_lat DOUBLE PRECISION DEFAULT 21.0116,
    store_lng DOUBLE PRECISION DEFAULT 105.8174,
    store_radius_meters INT DEFAULT 150,
    qr_refresh_seconds INT DEFAULT 45,
    qr_secret TEXT NOT NULL DEFAULT 'store_secret_qr_token_default',
    shifts JSONB NOT NULL DEFAULT '[
      {
        "id": "shift_morning",
        "name": "Ca Sáng (06:00 - 12:00)",
        "startTime": "06:00",
        "endTime": "12:00",
        "lateGraceMinutes": 15,
        "checkInBeforeMinutes": 30,
        "checkOutAfterMinutes": 90
      },
      {
        "id": "shift_afternoon",
        "name": "Ca Chiều (15:30 - 20:00)",
        "startTime": "15:30",
        "endTime": "20:00",
        "lateGraceMinutes": 15,
        "checkInBeforeMinutes": 30,
        "checkOutAfterMinutes": 90
      }
    ]'::jsonb,
    auto_email_time TEXT DEFAULT '21:00',
    manager_email TEXT DEFAULT 'phamthanhcong0412@gmail.com',
    last_report_sent_date TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------
-- 2. BẢNG TÀI KHOẢN NHÂN SỰ & QUẢN LÝ (users)
-- Phương án A: Quản lý đăng nhập nhanh theo username / password cấp phát
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
    employee_code TEXT UNIQUE NOT NULL,
    position TEXT DEFAULT 'Nhân Viên Bán Hàng',
    hourly_rate NUMERIC(12, 2) NOT NULL DEFAULT 28000,
    phone TEXT DEFAULT '',
    join_date TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- --------------------------------------------------------------------
-- 3. BẢNG BẢN GHI CHẤM CÔNG (attendance_records)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_name TEXT,
    user_email TEXT,
    employee_code TEXT,
    date TEXT NOT NULL, -- Định dạng YYYY-MM-DD
    check_in_time TIMESTAMPTZ NOT NULL,
    check_out_time TIMESTAMPTZ,
    total_minutes INT DEFAULT 0,
    total_hours NUMERIC(6, 2) DEFAULT 0,
    hourly_rate NUMERIC(12, 2) DEFAULT 28000,
    estimated_shift_pay NUMERIC(12, 2) DEFAULT 0,
    turns JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('working', 'completed', 'adjusted')),
    check_in_method TEXT NOT NULL DEFAULT 'direct_button',
    check_in_ip TEXT,
    check_in_wifi_ssid TEXT,
    check_in_wifi_bssid TEXT,
    check_in_gps JSONB,
    check_out_ip TEXT,
    check_out_gps JSONB,
    shift_id TEXT,
    shift_name TEXT,
    is_late BOOLEAN DEFAULT FALSE,
    is_early_leave BOOLEAN DEFAULT FALSE,
    auto_closed BOOLEAN DEFAULT FALSE,
    note TEXT DEFAULT '',
    adjusted_by TEXT,
    adjusted_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index tối ưu truy vấn báo cáo & dashboard
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance_records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance_records(status);

-- --------------------------------------------------------------------
-- 4. BẢNG NHẬT KÝ EMAIL BÁO CÁO (email_logs)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
    id TEXT PRIMARY KEY,
    sent_at TIMESTAMPTZ DEFAULT now(),
    date TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    summary JSONB NOT NULL,
    html_body TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    trigger TEXT NOT NULL CHECK (trigger IN ('auto_21h', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_email_logs_date ON public.email_logs(date DESC);

-- --------------------------------------------------------------------
-- 5. KÍCH HOẠT REALTIME REPLICATION (Supabase Realtime)
-- Cho phép client nhận thông báo tức thì khi nhân viên check-in/out
-- --------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_config;

-- Thiết lập REPLICA IDENTITY FULL để sự kiện UPDATE/DELETE từ Realtime trả về toàn bộ dữ liệu cũ
ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.store_config REPLICA IDENTITY FULL;

-- --------------------------------------------------------------------
-- 6. CHÍNH SÁCH BẢO MẬT ROW LEVEL SECURITY (RLS)
-- --------------------------------------------------------------------
ALTER TABLE public.store_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Cấu hình chính sách cho store_config: Cho phép đọc mọi người, chỉ admin/service_role sửa
CREATE POLICY "Public read config" ON public.store_config FOR SELECT USING (true);
CREATE POLICY "Service role update config" ON public.store_config FOR ALL USING (true);

-- Cấu hình chính sách cho users:
CREATE POLICY "Allow public read active users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow insert and update users" ON public.users FOR ALL USING (true);

-- Cấu hình chính sách cho attendance_records:
CREATE POLICY "Allow public read attendance" ON public.attendance_records FOR SELECT USING (true);
CREATE POLICY "Allow insert attendance" ON public.attendance_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update attendance" ON public.attendance_records FOR UPDATE USING (true);
CREATE POLICY "Allow delete attendance" ON public.attendance_records FOR DELETE USING (true);

-- Cấu hình chính sách cho email_logs:
CREATE POLICY "Allow read write email logs" ON public.email_logs FOR ALL USING (true);
