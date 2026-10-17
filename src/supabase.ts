/**
 * INFRASTRUCTURE: Supabase Gateway & Data Mappers
 * Tuân thủ Clean Architecture & SOLID:
 * - Single Responsibility: Chuyên trách kết nối, chuyển đổi thực thể (Mappers) và truy vấn Supabase
 * - Open/Closed & Dependency Inversion: Tách biệt Mappers thuần túy khỏi cơ chế truy vấn dữ liệu
 * - Single Source of Truth: Re-export Domain helpers từ src/domain/ thay vì sao chép logic tính toán
 */

import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { User, AttendanceRecord, StoreConfig } from './types/index.ts';

// Re-export Domain helpers để đảm bảo Single Source of Truth và không làm gãy import cũ (DRY)
export {
  deduplicateAndMergeOverlappingTurns,
  enrichAttendanceRecord,
  enrichUserWithAttendanceStats,
} from './domain/index.ts';

// ====================================================================
// 1. SUPABASE CLIENT & AUTH CONFIGURATION
// ====================================================================

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
);

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
// 2. IN-MEMORY CACHE SWR (GIẢM ĐỘ TRỄ TRUY VẤN DATABASE)
// ====================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let storeConfigCache: CacheEntry<Partial<StoreConfig>> | null = null;
let usersCache: CacheEntry<User[]> | null = null;
let attendanceCache: CacheEntry<AttendanceRecord[]> | null = null;

export function invalidateSupabaseCache(type?: 'all' | 'config' | 'users' | 'attendance'): void {
  if (!type || type === 'all') {
    storeConfigCache = null;
    usersCache = null;
    attendanceCache = null;
  } else if (type === 'config') storeConfigCache = null;
  else if (type === 'users') usersCache = null;
  else if (type === 'attendance') attendanceCache = null;
}

// ====================================================================
// 3. DATA MAPPERS (SRP: CHUYỂN ĐỔI DATABASE ROW <-> DOMAIN ENTITY)
// ====================================================================

export const StoreConfigMapper = {
  toDomain(row: any): Partial<StoreConfig> {
    return {
      storeName: row.store_name,
      storeAddress: row.store_address,
      wifiSsid: row.wifi_ssid,
      wifiBssid: row.wifi_bssid || undefined,
      allowedIps: Array.isArray(row.allowed_ips) ? row.allowed_ips : [],
      bypassIpCheck: Boolean(row.bypass_ip_check),
      requireWifi: Boolean(row.require_wifi),
      requireQr: Boolean(row.require_qr),
      requireGps: Boolean(row.require_gps),
      storeGps: {
        lat: row.store_lat ?? 21.0116,
        lng: row.store_lng ?? 105.8174,
        radiusMeters: row.store_radius_meters ?? 150,
      },
      qrRefreshSeconds: Number(row.qr_refresh_seconds) || 45,
      qrSecret: row.qr_secret || 'store_secret_qr_token_default',
      shifts: Array.isArray(row.shifts) ? row.shifts : [],
      autoEmailTime: row.auto_email_time || '21:00',
      managerEmail: row.manager_email || 'phamthanhcong0412@gmail.com',
      lastReportSentDate: row.last_report_sent_date || null,
    };
  },

  toRow(cfg: Partial<StoreConfig>): Record<string, any> {
    const row: Record<string, any> = {
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
    return row;
  },
};

export const UserMapper = {
  toDomain(row: any): User {
    return {
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
    };
  },

  toRow(user: User): Record<string, any> {
    return {
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
  },
};

export const AttendanceMapper = {
  toDomain(row: any): AttendanceRecord {
    return {
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
    };
  },

  toRow(rec: AttendanceRecord): Record<string, any> {
    return {
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
  },
};

// ====================================================================
// 4. SUPABASE CRUD & BATCH GATEWAY OPERATIONS
// ====================================================================

// --- STORE CONFIG ---
export async function fetchStoreConfigFromSupabase(forceRefresh = false): Promise<Partial<StoreConfig> | null> {
  if (!isSupabaseConfigured) return null;
  if (!forceRefresh && storeConfigCache && Date.now() - storeConfigCache.timestamp < 30000) {
    return storeConfigCache.data;
  }

  try {
    const { data, error } = await supabase
      .from('store_config')
      .select('*')
      .eq('id', 'config_default')
      .single();

    if (error || !data) return storeConfigCache?.data || null;

    const parsed = StoreConfigMapper.toDomain(data);
    storeConfigCache = { data: parsed, timestamp: Date.now() };
    return parsed;
  } catch (err) {
    console.error('Lỗi lấy store_config từ Supabase:', err);
    return storeConfigCache?.data || null;
  }
}

export async function saveStoreConfigToSupabase(cfg: Partial<StoreConfig>): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    storeConfigCache = null; // Invalidate cache
    const row = StoreConfigMapper.toRow(cfg);
    await supabase.from('store_config').upsert(row, { onConflict: 'id' });
  } catch (err) {
    console.error('Lỗi lưu store_config lên Supabase:', err);
  }
}

// --- USERS ---
export async function fetchUsersFromSupabase(forceRefresh = false): Promise<User[]> {
  if (!isSupabaseConfigured) return [];
  if (!forceRefresh && usersCache && Date.now() - usersCache.timestamp < 20000) {
    return usersCache.data;
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) return usersCache?.data || [];

    const mapped = data.map(UserMapper.toDomain);
    usersCache = { data: mapped, timestamp: Date.now() };
    return mapped;
  } catch (err) {
    console.error('Lỗi lấy danh sách users từ Supabase:', err);
    return usersCache?.data || [];
  }
}

export async function saveUserToSupabase(user: User): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    usersCache = null; // Invalidate cache
    const row = UserMapper.toRow(user);
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
    usersCache = null; // Invalidate cache
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
  const rows = usersList.map(UserMapper.toRow);
  const { error } = await supabase.from('users').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  usersCache = null;

  return {
    syncedCount: usersList.length,
    timestamp: new Date().toISOString(),
  };
}

// --- AUTHENTICATION ---
export async function loginWithGoogleOAuth(): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase chưa được cấu hình.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

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
    return UserMapper.toDomain(data);
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

  if (findError || !user) throw new Error('Không tìm thấy tài khoản người dùng.');
  if (user.password !== currentPassword) throw new Error('Mật khẩu hiện tại không chính xác.');

  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update({ password: newPassword, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (updateError || !updated) throw new Error('Không thể cập nhật mật khẩu trên Supabase.');
  usersCache = null;
  return UserMapper.toDomain(updated);
}

// --- ATTENDANCE RECORDS ---
export async function fetchAttendanceFromSupabase(options?: {
  forceRefresh?: boolean;
  limit?: number;
}): Promise<AttendanceRecord[]> {
  if (!isSupabaseConfigured) return [];
  const forceRefresh = options?.forceRefresh ?? false;
  if (!forceRefresh && attendanceCache && Date.now() - attendanceCache.timestamp < 15000) {
    return attendanceCache.data;
  }

  try {
    const limit = options?.limit ?? 300;
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .order('check_in_time', { ascending: false })
      .limit(limit);

    if (error || !data) return attendanceCache?.data || [];

    const mapped = data.map(AttendanceMapper.toDomain);
    attendanceCache = { data: mapped, timestamp: Date.now() };
    return mapped;
  } catch (err) {
    console.error('Lỗi lấy attendance từ Supabase:', err);
    return attendanceCache?.data || [];
  }
}

export async function saveAttendanceToSupabase(rec: AttendanceRecord): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    attendanceCache = null; // Invalidate cache
    const row = AttendanceMapper.toRow(rec);
    const { error } = await supabase.from('attendance_records').upsert(row, { onConflict: 'id' });
    if (error) throw error;
  } catch (err) {
    console.error('Lỗi lưu attendance lên Supabase:', err);
    throw err;
  }
}

export async function batchSaveAttendanceToSupabase(records: AttendanceRecord[]): Promise<void> {
  if (!isSupabaseConfigured || records.length === 0) return;
  try {
    attendanceCache = null; // Invalidate cache
    const rows = records.map(AttendanceMapper.toRow);
    const { error } = await supabase.from('attendance_records').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  } catch (err) {
    console.error('Lỗi batch lưu attendance lên Supabase:', err);
    throw err;
  }
}

export async function deleteAttendanceFromSupabase(recordId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    attendanceCache = null; // Invalidate cache
    const { error } = await supabase.from('attendance_records').delete().eq('id', recordId);
    if (error) throw error;
  } catch (err) {
    console.error('Lỗi xóa attendance trên Supabase:', err);
    throw err;
  }
}

export async function batchDeleteAttendanceFromSupabase(recordIds: string[]): Promise<void> {
  if (!isSupabaseConfigured || recordIds.length === 0) return;
  try {
    attendanceCache = null; // Invalidate cache
    const { error } = await supabase.from('attendance_records').delete().in('id', recordIds);
    if (error) throw error;
  } catch (err) {
    console.error('Lỗi batch xóa attendance trên Supabase:', err);
    throw err;
  }
}

// ====================================================================
// 5. REALTIME WEBSOCKETS SUBSCRIPTION
// ====================================================================

export function subscribeToRealtimeStoreData(callbacks: {
  onAttendanceChange?: () => void;
  onUsersChange?: () => void;
  onConfigChange?: () => void;
}): () => void {
  if (!isSupabaseConfigured) return () => {};

  let attTimer: any = null;
  let userTimer: any = null;
  let cfgTimer: any = null;

  const debouncedAtt = () => {
    if (attTimer) clearTimeout(attTimer);
    attTimer = setTimeout(() => callbacks.onAttendanceChange?.(), 250);
  };
  const debouncedUser = () => {
    if (userTimer) clearTimeout(userTimer);
    userTimer = setTimeout(() => callbacks.onUsersChange?.(), 250);
  };
  const debouncedCfg = () => {
    if (cfgTimer) clearTimeout(cfgTimer);
    cfgTimer = setTimeout(() => callbacks.onConfigChange?.(), 250);
  };

  const channel: RealtimeChannel = supabase
    .channel('chammam_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
      invalidateSupabaseCache('attendance');
      debouncedAtt();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
      invalidateSupabaseCache('users');
      debouncedUser();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'store_config' }, () => {
      invalidateSupabaseCache('config');
      debouncedCfg();
    })
    .subscribe();

  return () => {
    if (attTimer) clearTimeout(attTimer);
    if (userTimer) clearTimeout(userTimer);
    if (cfgTimer) clearTimeout(cfgTimer);
    supabase.removeChannel(channel);
  };
}
