import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { User, AttendanceRecord, StoreConfig, ShiftTurn } from './types/index.ts';

// Lấy biến môi trường từ Vite
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
);

// Khởi tạo Supabase Client (nếu chưa có key thì dùng placeholder để không văng app)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export const BOOTSTRAPPED_ADMIN_EMAILS = [
  'phamthanhcong0412@gmail.com',
  'admin@chaomamnho.vn',
];

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return BOOTSTRAPPED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// ====================================================================
// TIỆN ÍCH TÍNH TOÁN & CHUẨN HÓA DỮ LIỆU CHẤM CÔNG (DOMAIN HELPERS)
// ====================================================================

export function deduplicateAndMergeOverlappingTurns(turns: ShiftTurn[]): ShiftTurn[] {
  if (!turns || turns.length <= 1) return turns || [];
  const valid = turns.filter((t) => t && t.checkInTime);
  const sorted = [...valid].sort(
    (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
  );

  const merged: ShiftTurn[] = [];
  for (const curr of sorted) {
    if (merged.length === 0) {
      merged.push({ ...curr });
      continue;
    }
    const last = merged[merged.length - 1];
    const lastOutMs = last.checkOutTime ? new Date(last.checkOutTime).getTime() : 0;
    const currInMs = new Date(curr.checkInTime).getTime();

    // Nếu thời điểm vào của lượt này nằm trong hoặc liền kề lượt trước (<= 60s)
    if (lastOutMs > 0 && currInMs <= lastOutMs + 60000) {
      const currOutMs = curr.checkOutTime ? new Date(curr.checkOutTime).getTime() : 0;
      if (currOutMs > lastOutMs) {
        last.checkOutTime = curr.checkOutTime;
        last.minutes = Math.max(1, Math.round((currOutMs - new Date(last.checkInTime).getTime()) / 60000));
      }
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

export function enrichAttendanceRecord(
  rec: AttendanceRecord,
  usersList?: User[]
): AttendanceRecord {
  const matchedUser = usersList?.find((u) => u.id === rec.userId);
  const hourlyRate = Number(rec.hourlyRate || matchedUser?.hourlyRate || 28000);
  const totalMinutes = Math.max(0, Number(rec.totalMinutes) || 0);
  const totalHours = Number((totalMinutes / 60).toFixed(2));
  const estimatedShiftPay = Math.round((totalMinutes / 60) * hourlyRate);

  return {
    ...rec,
    totalMinutes,
    totalHours,
    hourlyRate,
    estimatedShiftPay,
  };
}

export function enrichUserWithAttendanceStats(
  u: User,
  attendanceList: AttendanceRecord[]
): User {
  const userRecords = attendanceList
    .filter((r) => r.userId === u.id)
    .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());

  const totalMinutesWorked = userRecords.reduce((sum, r) => sum + (Number(r.totalMinutes) || 0), 0);
  const totalHoursWorked = Number((totalMinutesWorked / 60).toFixed(2));
  const totalDaysWorked = new Set(userRecords.map((r) => r.date)).size;
  const totalShifts = userRecords.length;
  const lateCount = userRecords.filter((r) => r.isLate).length;
  const hourlyRate = Number(u.hourlyRate) || 28000;
  const estimatedSalary = Math.round((totalMinutesWorked / 60) * hourlyRate);
  const activeShift = userRecords.find((r) => r.status === 'working');
  const currentStatus: 'working' | 'offline' = activeShift ? 'working' : 'offline';
  const lastCheckInTime = userRecords[0]?.checkInTime || u.lastCheckInTime || null;
  const lastCheckOutTime =
    userRecords.find((r) => r.checkOutTime)?.checkOutTime || u.lastCheckOutTime || null;

  const recentSummaryItems = userRecords.slice(0, 5).map((r) => {
    const inStr = new Date(r.checkInTime).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const outStr = r.checkOutTime
      ? new Date(r.checkOutTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Đang làm';
    const hrs = Number(((r.totalMinutes || 0) / 60).toFixed(2));
    return `${r.date}: ${inStr}-${outStr} (${hrs}h / ${r.totalMinutes || 0}p)`;
  });

  const recentAttendanceSummary =
    recentSummaryItems.length > 0
      ? recentSummaryItems.join(' | ').slice(0, 2000)
      : u.recentAttendanceSummary || 'Chưa có lịch sử chấm công';

  return {
    ...u,
    totalMinutesWorked,
    totalHoursWorked,
    totalDaysWorked,
    totalShifts,
    lateCount,
    estimatedSalary,
    currentStatus,
    lastCheckInTime,
    lastCheckOutTime,
    recentAttendanceSummary,
  };
}

// ====================================================================
// CÁC THAO TÁC CƠ SỞ DỮ LIỆU SUPABASE (CRUD & QUERY)
// ====================================================================

// 1. Quản lý cấu hình cửa hàng
export async function fetchStoreConfigFromSupabase(): Promise<Partial<StoreConfig> | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('store_config')
      .select('*')
      .eq('id', 'config_default')
      .single();

    if (error || !data) return null;

    return {
      storeName: data.store_name,
      storeAddress: data.store_address,
      wifiSsid: data.wifi_ssid,
      wifiBssid: data.wifi_bssid || undefined,
      allowedIps: Array.isArray(data.allowed_ips) ? data.allowed_ips : [],
      bypassIpCheck: Boolean(data.bypass_ip_check),
      requireWifi: Boolean(data.require_wifi),
      requireQr: Boolean(data.require_qr),
      requireGps: Boolean(data.require_gps),
      storeGps: {
        lat: data.store_lat ?? 21.0116,
        lng: data.store_lng ?? 105.8174,
        radiusMeters: data.store_radius_meters ?? 150,
      },
      qrRefreshSeconds: Number(data.qr_refresh_seconds) || 45,
      qrSecret: data.qr_secret || 'store_secret_qr_token_default',
      shifts: Array.isArray(data.shifts) ? data.shifts : [],
      autoEmailTime: data.auto_email_time || '21:00',
      managerEmail: data.manager_email || 'phamthanhcong0412@gmail.com',
      lastReportSentDate: data.last_report_sent_date || null,
    };
  } catch (err) {
    console.error('Lỗi lấy store_config từ Supabase:', err);
    return null;
  }
}

export async function saveStoreConfigToSupabase(cfg: Partial<StoreConfig>): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const row: any = {
      id: 'config_default',
      updated_at: new Date().toISOString(),
    };

    if (cfg.storeName !== undefined) row.store_name = cfg.storeName;
    if (cfg.storeAddress !== undefined) row.store_address = cfg.storeAddress;
    if (cfg.wifiSsid !== undefined) row.wifi_ssid = cfg.wifiSsid;
    if (cfg.wifiBssid !== undefined) row.wifi_bssid = cfg.wifiBssid;
    if (cfg.allowedIps !== undefined) row.allowed_ips = cfg.allowedIps;
    if (cfg.bypassIpCheck !== undefined) row.bypass_ip_check = cfg.bypassIpCheck;
    if (cfg.requireWifi !== undefined) row.require_wifi = cfg.requireWifi;
    if (cfg.requireQr !== undefined) row.require_qr = cfg.requireQr;
    if (cfg.requireGps !== undefined) row.require_gps = cfg.requireGps;
    if (cfg.storeGps?.lat !== undefined) row.store_lat = cfg.storeGps.lat;
    if (cfg.storeGps?.lng !== undefined) row.store_lng = cfg.storeGps.lng;
    if (cfg.storeGps?.radiusMeters !== undefined) row.store_radius_meters = cfg.storeGps.radiusMeters;
    if (cfg.qrRefreshSeconds !== undefined) row.qr_refresh_seconds = cfg.qrRefreshSeconds;
    if (cfg.qrSecret !== undefined) row.qr_secret = cfg.qrSecret;
    if (cfg.shifts !== undefined) row.shifts = cfg.shifts;
    if (cfg.autoEmailTime !== undefined) row.auto_email_time = cfg.autoEmailTime;
    if (cfg.managerEmail !== undefined) row.manager_email = cfg.managerEmail;
    if (cfg.lastReportSentDate !== undefined) row.last_report_sent_date = cfg.lastReportSentDate;

    await supabase.from('store_config').upsert(row, { onConflict: 'id' });
  } catch (err) {
    console.error('Lỗi lưu store_config lên Supabase:', err);
  }
}

// 2. Quản lý tài khoản nhân sự (Users)
export async function fetchUsersFromSupabase(): Promise<User[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      username: row.username,
      password: row.password,
      email: row.email,
      name: row.name,
      avatar: row.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(row.username)}`,
      role: row.role as 'admin' | 'staff',
      employeeCode: row.employee_code,
      position: row.position,
      hourlyRate: Number(row.hourly_rate) || 28000,
      phone: row.phone || '',
      joinDate: row.join_date,
      isActive: Boolean(row.is_active),
      note: row.note || '',
    }));
  } catch (err) {
    console.error('Lỗi lấy danh sách users từ Supabase:', err);
    return [];
  }
}

export async function saveUserToSupabase(user: User): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const row = {
      id: user.id,
      username: user.username,
      password: user.password || '123456',
      email: user.email || `${user.username}@chaomamnho.vn`,
      name: user.name,
      avatar: user.avatar || null,
      role: user.role,
      employee_code: user.employeeCode,
      position: user.position || 'Nhân Viên Bán Hàng',
      hourly_rate: Number(user.hourlyRate) || 28000,
      phone: user.phone || '',
      join_date: user.joinDate || new Date().toISOString().slice(0, 10),
      is_active: user.isActive !== false,
      note: user.note || '',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('users').upsert(row, { onConflict: 'id' });
    if (error) throw error;
  } catch (err) {
    console.error('Lỗi lưu user lên Supabase:', err);
    throw err;
  }
}

export async function deleteUserFromSupabase(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
  } catch (err) {
    console.error('Lỗi xóa user trên Supabase:', err);
    throw err;
  }
}

export interface SupabaseSyncResult {
  syncedCount: number;
  timestamp: string;
}

export async function syncAllUsersToSupabase(usersList: User[]): Promise<SupabaseSyncResult> {
  if (!isSupabaseConfigured) {
    return { syncedCount: 0, timestamp: new Date().toISOString() };
  }
  await Promise.all(usersList.map((u) => saveUserToSupabase(u)));
  return {
    syncedCount: usersList.length,
    timestamp: new Date().toISOString(),
  };
}

export async function loginWithGoogleOAuth(): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase chưa được cấu hình.');
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

// 3. Đăng nhập theo Phương án A (Username / Password)
export async function loginFromSupabase(username: string, password: string): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  const cleanUsername = username.trim().toLowerCase();
  const cleanPassword = password.trim();

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('username', cleanUsername)
      .eq('password', cleanPassword)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      username: data.username,
      password: data.password,
      email: data.email,
      name: data.name,
      avatar: data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.username)}`,
      role: data.role as 'admin' | 'staff',
      employeeCode: data.employee_code,
      position: data.position,
      hourlyRate: Number(data.hourly_rate) || 28000,
      phone: data.phone || '',
      joinDate: data.join_date,
      isActive: Boolean(data.is_active),
      note: data.note || '',
    };
  } catch (err) {
    console.error('Lỗi đăng nhập Supabase:', err);
    return null;
  }
}

export async function changePasswordFromSupabase(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<User> {
  if (!isSupabaseConfigured) throw new Error('Supabase chưa được cấu hình.');

  const { data: user, error: findError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (findError || !user) {
    throw new Error('Không tìm thấy tài khoản người dùng.');
  }

  if (user.password !== currentPassword) {
    throw new Error('Mật khẩu hiện tại không chính xác.');
  }

  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update({ password: newPassword, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error('Không thể cập nhật mật khẩu trên Supabase.');
  }

  return {
    id: updated.id,
    username: updated.username,
    password: updated.password,
    email: updated.email,
    name: updated.name,
    avatar: updated.avatar,
    role: updated.role,
    employeeCode: updated.employee_code,
    position: updated.position,
    hourlyRate: Number(updated.hourly_rate),
    phone: updated.phone,
    joinDate: updated.join_date,
    isActive: Boolean(updated.is_active),
    note: updated.note,
  };
}

// 4. Quản lý bản ghi chấm công (Attendance Records)
export async function fetchAttendanceFromSupabase(): Promise<AttendanceRecord[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .order('check_in_time', { ascending: false });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name || 'Nhân Viên',
      userEmail: row.user_email || '',
      employeeCode: row.employee_code || 'NV-001',
      date: row.date,
      checkInTime: row.check_in_time,
      checkOutTime: row.check_out_time || null,
      totalMinutes: Number(row.total_minutes) || 0,
      totalHours: Number(row.total_hours) || 0,
      hourlyRate: Number(row.hourly_rate) || 28000,
      estimatedShiftPay: Number(row.estimated_shift_pay) || 0,
      turns: Array.isArray(row.turns) ? row.turns : [],
      status: row.status as 'working' | 'completed' | 'adjusted',
      checkInMethod: row.check_in_method || 'direct_button',
      checkInIp: row.check_in_ip || '',
      checkInWifiSsid: row.check_in_wifi_ssid || '',
      checkInWifiBssid: row.check_in_wifi_bssid || undefined,
      checkInGps: row.check_in_gps || undefined,
      checkOutIp: row.check_out_ip || undefined,
      checkOutGps: row.check_out_gps || undefined,
      shiftId: row.shift_id || 'shift_morning',
      shiftName: row.shift_name || 'Ca làm việc',
      isLate: Boolean(row.is_late),
      isEarlyLeave: Boolean(row.is_early_leave),
      autoClosed: Boolean(row.auto_closed),
      note: row.note || '',
      adjustedBy: row.adjusted_by || '',
      adjustedReason: row.adjusted_reason || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    console.error('Lỗi lấy attendance từ Supabase:', err);
    return [];
  }
}

export async function saveAttendanceToSupabase(rec: AttendanceRecord): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const row = {
      id: rec.id,
      user_id: rec.userId,
      user_name: rec.userName,
      user_email: rec.userEmail,
      employee_code: rec.employeeCode,
      date: rec.date,
      check_in_time: rec.checkInTime,
      check_out_time: rec.checkOutTime || null,
      total_minutes: Number(rec.totalMinutes) || 0,
      total_hours: Number(rec.totalHours) || 0,
      hourly_rate: Number(rec.hourlyRate) || 28000,
      estimated_shift_pay: Number(rec.estimatedShiftPay) || 0,
      turns: rec.turns || [],
      status: rec.status,
      check_in_method: rec.checkInMethod || 'direct_button',
      check_in_ip: rec.checkInIp || null,
      check_in_wifi_ssid: rec.checkInWifiSsid || null,
      check_in_wifi_bssid: rec.checkInWifiBssid || null,
      check_in_gps: rec.checkInGps || null,
      check_out_ip: rec.checkOutIp || null,
      check_out_gps: rec.checkOutGps || null,
      shift_id: rec.shiftId || null,
      shift_name: rec.shiftName || null,
      is_late: Boolean(rec.isLate),
      is_early_leave: Boolean(rec.isEarlyLeave),
      auto_closed: Boolean(rec.autoClosed),
      note: rec.note || '',
      adjusted_by: rec.adjustedBy || null,
      adjusted_reason: rec.adjustedReason || null,
      created_at: rec.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('attendance_records').upsert(row, { onConflict: 'id' });
    if (error) throw error;
  } catch (err) {
    console.error('Lỗi lưu attendance lên Supabase:', err);
    throw err;
  }
}

export async function deleteAttendanceFromSupabase(recordId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.from('attendance_records').delete().eq('id', recordId);
    if (error) throw error;
  } catch (err) {
    console.error('Lỗi xóa attendance trên Supabase:', err);
    throw err;
  }
}

// ====================================================================
// ĐĂNG KÝ REALTIME VỚI SUPABASE CHANNEL (WebSockets)
// ====================================================================

export function subscribeToRealtimeStoreData(callbacks: {
  onAttendanceChange?: () => void;
  onUsersChange?: () => void;
  onConfigChange?: () => void;
}): () => void {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  const channel: RealtimeChannel = supabase
    .channel('chammam_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attendance_records' },
      () => {
        callbacks.onAttendanceChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'users' },
      () => {
        callbacks.onUsersChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'store_config' },
      () => {
        callbacks.onConfigChange?.();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
