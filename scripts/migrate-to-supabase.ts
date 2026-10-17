import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import type { User, AttendanceRecord, StoreConfig, EmailLog } from '../src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ Lỗi: Thiếu biến môi trường SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.');
  console.error('👉 Vui lòng cấu hình file .env trước khi chạy script migration:');
  console.error('   VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (hoặc VITE_SUPABASE_ANON_KEY)\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function readJsonFile<T>(filename: string, fallback: T): T {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Không thể đọc file ${filename}:`, err);
  }
  return fallback;
}

async function migrate() {
  console.log('\n🚀 BẮT ĐẦU CHUYỂN ĐỔI DỮ LIỆU SANG SUPABASE (CHÁO MẦM NHỎ THÁI THỊNH)...');
  console.log(`📡 Kết nối Supabase: ${supabaseUrl}`);

  // 1. Migrate Store Config
  const storeConfig = readJsonFile<StoreConfig | null>('store_config.json', null);
  if (storeConfig) {
    console.log('\n📦 1/4. Đang chuyển cấu hình cửa hàng (store_config)...');
    const configRow = {
      id: 'config_default',
      store_name: storeConfig.storeName || 'Cháo Mầm Nhỏ Thái Thịnh',
      store_address: storeConfig.storeAddress || 'Thái Thịnh, Đống Đa, Hà Nội',
      wifi_ssid: storeConfig.wifiSsid || 'ChaoMamNho_ThaiThinh_5G',
      wifi_bssid: storeConfig.wifiBssid || null,
      allowed_ips: storeConfig.allowedIps || [],
      bypass_ip_check: Boolean(storeConfig.bypassIpCheck),
      require_wifi: Boolean(storeConfig.requireWifi),
      require_qr: Boolean(storeConfig.requireQr),
      require_gps: Boolean(storeConfig.requireGps),
      store_lat: storeConfig.storeGps?.lat ?? 21.0116,
      store_lng: storeConfig.storeGps?.lng ?? 105.8174,
      store_radius_meters: storeConfig.storeGps?.radiusMeters ?? 150,
      qr_refresh_seconds: storeConfig.qrRefreshSeconds ?? 45,
      qr_secret: storeConfig.qrSecret || 'store_secret_qr_token_default',
      shifts: storeConfig.shifts || [],
      auto_email_time: storeConfig.autoEmailTime || '21:00',
      manager_email: storeConfig.managerEmail || 'phamthanhcong0412@gmail.com',
      last_report_sent_date: storeConfig.lastReportSentDate || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('store_config').upsert(configRow, { onConflict: 'id' });
    if (error) {
      console.error('❌ Lỗi lưu store_config:', error.message);
    } else {
      console.log('✅ Đã chuyển thành công store_config.');
    }
  }

  // 2. Migrate Users
  const users = readJsonFile<User[]>('users.json', []);
  if (users.length > 0) {
    console.log(`\n👥 2/4. Đang chuyển ${users.length} tài khoản nhân sự (users)...`);
    const userRows = users.map((u) => ({
      id: u.id,
      username: u.username,
      password: u.password || '123456',
      email: u.email || `${u.username}@chaomamnho.vn`,
      name: u.name,
      avatar: u.avatar || null,
      role: u.role || 'staff',
      employee_code: u.employeeCode,
      position: u.position || 'Nhân Viên Bán Hàng',
      hourly_rate: Number(u.hourlyRate) || 28000,
      phone: u.phone || '',
      join_date: u.joinDate || new Date().toISOString().split('T')[0],
      is_active: u.isActive !== false,
      note: u.note || '',
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('users').upsert(userRows, { onConflict: 'id' });
    if (error) {
      console.error('❌ Lỗi lưu users:', error.message);
    } else {
      console.log(`✅ Đã chuyển thành công ${users.length} tài khoản.`);
    }
  }

  // 3. Migrate Attendance Records
  const attendance = readJsonFile<AttendanceRecord[]>('attendance.json', []);
  if (attendance.length > 0) {
    console.log(`\n⏰ 3/4. Đang chuyển ${attendance.length} bản ghi chấm công (attendance_records)...`);
    const attendanceRows = attendance.map((r) => ({
      id: r.id,
      user_id: r.userId,
      user_name: r.userName || null,
      user_email: r.userEmail || null,
      employee_code: r.employeeCode || null,
      date: r.date,
      check_in_time: r.checkInTime,
      check_out_time: r.checkOutTime || null,
      total_minutes: Number(r.totalMinutes) || 0,
      total_hours: Number((((Number(r.totalMinutes) || 0) / 60)).toFixed(2)),
      hourly_rate: Number(r.hourlyRate) || 28000,
      estimated_shift_pay: Math.round(((Number(r.totalMinutes) || 0) / 60) * (Number(r.hourlyRate) || 28000)),
      turns: r.turns || [],
      status: r.status || 'completed',
      check_in_method: r.checkInMethod || 'direct_button',
      check_in_ip: r.checkInIp || null,
      check_in_wifi_ssid: r.checkInWifiSsid || null,
      check_in_wifi_bssid: r.checkInWifiBssid || null,
      check_in_gps: r.checkInGps || null,
      check_out_ip: r.checkOutIp || null,
      check_out_gps: r.checkOutGps || null,
      shift_id: r.shiftId || null,
      shift_name: r.shiftName || null,
      is_late: Boolean(r.isLate),
      is_early_leave: Boolean(r.isEarlyLeave),
      auto_closed: Boolean(r.autoClosed),
      note: r.note || '',
      adjusted_by: r.adjustedBy || null,
      adjusted_reason: r.adjustedReason || null,
      created_at: r.createdAt || r.checkInTime,
      updated_at: r.updatedAt || new Date().toISOString(),
    }));

    // Chia batch 50 bản ghi để an toàn
    const BATCH_SIZE = 50;
    let successCount = 0;
    for (let i = 0; i < attendanceRows.length; i += BATCH_SIZE) {
      const batch = attendanceRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('attendance_records').upsert(batch, { onConflict: 'id' });
      if (error) {
        console.error(`❌ Lỗi lưu batch ${i + 1} - ${i + batch.length}:`, error.message);
      } else {
        successCount += batch.length;
      }
    }
    console.log(`✅ Đã chuyển thành công ${successCount}/${attendance.length} bản ghi chấm công.`);
  }

  // 4. Migrate Email Logs
  const emailLogs = readJsonFile<EmailLog[]>('email_logs.json', []);
  if (emailLogs.length > 0) {
    console.log(`\n📧 4/4. Đang chuyển ${emailLogs.length} nhật ký gửi email (email_logs)...`);
    const emailRows = emailLogs.map((log) => ({
      id: log.id,
      sent_at: log.sentAt,
      date: log.date,
      recipient: log.recipient,
      subject: log.subject,
      summary: log.summary || {},
      html_body: log.htmlBody || '',
      status: log.status || 'sent',
      trigger: log.trigger || 'manual',
    }));

    const { error } = await supabase.from('email_logs').upsert(emailRows, { onConflict: 'id' });
    if (error) {
      console.error('❌ Lỗi lưu email_logs:', error.message);
    } else {
      console.log(`✅ Đã chuyển thành công ${emailLogs.length} nhật ký email.`);
    }
  }

  console.log('\n🎉 HOÀN TẤT CHUYỂN ĐỔI DỮ LIỆU SANG SUPABASE THÀNH CÔNG!\n');
}

migrate().catch((err) => {
  console.error('❌ Migration gặp sự cố không mong muốn:', err);
  process.exit(1);
});
