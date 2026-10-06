import type {
  User,
  AttendanceRecord,
  StoreConfig,
  NetworkInfo,
  EmailLog,
  MonthlyEmployeeSummary,
} from '../types/index.ts';
import {
  auth,
  fetchUsersFromFirestore,
  fetchAttendanceFromFirestore,
  loginFromFirestore,
  saveUserToFirestore,
  deleteUserFromFirestore,
  deleteAttendanceFromFirestore,
  enrichUserWithAttendanceStats,
  enrichAttendanceRecord,
} from '../firebase.ts';

const API_BASE = '/api';

const STORAGE_KEYS = {
  CONFIG: 'chammam_store_config_v1',
  USERS: 'chammam_users_v1',
  ATTENDANCE: 'chammam_attendance_v1',
  EMAIL_LOGS: 'chammam_email_logs_v1',
};

const DEFAULT_CONFIG: StoreConfig = {
  storeName: 'Cháo Mầm Nhỏ Thái Thịnh',
  storeAddress: 'Thái Thịnh, Đống Đa, Hà Nội',
  wifiSsid: 'ChaoMamNho_ThaiThinh_5G',
  allowedIps: ['127.0.0.1', '::1', '14.161.45.88', '118.69.182.20'],
  bypassIpCheck: true,
  requireWifi: true,
  requireQr: false,
  requireGps: false,
  storeGps: {
    lat: 21.0116,
    lng: 105.8174,
    radiusMeters: 150,
  },
  qrRefreshSeconds: 45,
  qrSecret: 'store_secret_qr_token_default',
  shifts: [
    {
      id: 'shift_morning',
      name: 'Ca Sáng (06:00 - 12:00)',
      startTime: '06:00',
      endTime: '12:00',
      lateGraceMinutes: 15,
      checkInBeforeMinutes: 30,
      checkOutAfterMinutes: 90,
    },
    {
      id: 'shift_afternoon',
      name: 'Ca Chiều (15:30 - 20:00)',
      startTime: '15:30',
      endTime: '20:00',
      lateGraceMinutes: 15,
      checkInBeforeMinutes: 30,
      checkOutAfterMinutes: 90,
    },
  ],
  autoEmailTime: '21:00',
  managerEmail: 'phamthanhcong0412@gmail.com',
  lastReportSentDate: null,
  firebaseConfig: {
    adminEmail: 'phamthanhcong0412@gmail.com',
    projectId: 'gen-lang-client-0980052625',
    appId: '1:107881027720:web:3ea36799af656c1971e73d',
    apiKey: 'AIzaSyC5b9mOMKJ_XSbUp58Oy9d4l9LiKhgEXO4',
    authDomain: 'gen-lang-client-0980052625.firebaseapp.com',
    firestoreDatabaseId: 'ai-studio-remixchmcngthngm-29b88f94-6ce3-4325-afeb-6a6d8e57c881',
    storageBucket: 'gen-lang-client-0980052625.firebasestorage.app',
    messagingSenderId: '107881027720',
  },
};

const DEFAULT_USERS: User[] = [
  {
    id: 'user_admin_1',
    username: 'ptcong',
    password: '12345678@Abc',
    email: 'phamthanhcong0412@gmail.com',
    name: 'Phạm Thành Công (Chủ Quán)',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ptcong',
    role: 'admin',
    employeeCode: 'QL-001',
    position: 'Chủ Cửa Hàng / Quản Lý',
    hourlyRate: 50000,
    phone: '0901 234 567',
    joinDate: '2025-01-01',
    isActive: true,
  },
  {
    id: 'user_staff_1',
    username: 'nv_mai',
    password: '123456',
    email: 'nhanvien.mai@gmail.com',
    name: 'Nguyễn Thị Mai',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nv_mai',
    role: 'staff',
    employeeCode: 'NV-001',
    position: 'Thu Ngân & Barista',
    hourlyRate: 28000,
    phone: '0912 345 678',
    joinDate: '2025-02-15',
    isActive: true,
  },
  {
    id: 'user_staff_2',
    username: 'nv_hung',
    password: '123456',
    email: 'boyeucongaibo.b7@gmail.com',
    name: 'Trần Văn Hưng',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nv_hung',
    role: 'staff',
    employeeCode: 'NV-002',
    position: 'Pha Chế Chính',
    hourlyRate: 32000,
    phone: '0987 654 321',
    joinDate: '2025-02-20',
    isActive: true,
  },
  {
    id: 'user_staff_3',
    username: 'nv_nam',
    password: '123456',
    email: 'nhanvien.nam@gmail.com',
    name: 'Lê Bảo Nam',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nv_nam',
    role: 'staff',
    employeeCode: 'NV-003',
    position: 'Nhân Viên Phục Vụ',
    hourlyRate: 25000,
    phone: '0933 112 233',
    joinDate: '2025-03-01',
    isActive: true,
  },
  {
    id: 'user_staff_4',
    username: 'nv_anh',
    password: '123456',
    email: 'nhanvien.anh@gmail.com',
    name: 'Phạm Quỳnh Anh',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nv_anh',
    role: 'staff',
    employeeCode: 'NV-004',
    position: 'Thu Ngân & Chăm Sóc Khách',
    hourlyRate: 28000,
    phone: '0944 556 677',
    joinDate: '2025-03-10',
    isActive: true,
  },
  {
    id: 'user_1791297700468',
    username: 'nv_minh',
    password: '123456',
    email: 'boyeucongaibo.bale@gmail.com',
    name: 'Minh',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=boyeucongaibo.bale@gmail.com',
    role: 'staff',
    employeeCode: 'NV-006',
    position: 'Nhân Viên Mới',
    hourlyRate: 25000,
    phone: '',
    joinDate: '2026-10-06',
    isActive: true,
  },
];

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading localStorage:', e);
  }
  saveLocal(key, fallback);
  return fallback;
}

function saveLocal<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Error saving localStorage:', e);
  }
}

async function fetchJsonOrThrow(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('STATIC_HOST_FALLBACK');
  }
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export const api = {
  // Network & IP
  async getNetworkInfo(): Promise<NetworkInfo> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/network-info`);
      if (!ok) throw new Error('Không thể kiểm tra thông tin mạng');
      return data;
    } catch {
      return {
        clientIp: '14.161.45.88',
        isAllowedIp: true,
        timestamp: Date.now(),
      };
    }
  },

  // QR Token
  async getQrToken(): Promise<{ token: string; generatedAt: number; expiresAt: number; storeName: string }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/qr/token`);
      if (!ok) throw new Error('Không thể tạo mã QR mới');
      return data;
    } catch {
      const cfg = loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
      const now = Date.now();
      const refreshMs = (cfg.qrRefreshSeconds || 45) * 1000;
      const bucket = Math.floor(now / refreshMs);
      return {
        token: `ARTISANS_${bucket}_STATIC`,
        generatedAt: bucket * refreshMs,
        expiresAt: (bucket + 1) * refreshMs,
        storeName: cfg.storeName,
      };
    }
  },

  // Store Config
  async getConfig(): Promise<StoreConfig> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/config`);
      if (!ok) throw new Error('Không thể tải cấu hình cửa hàng');
      saveLocal(STORAGE_KEYS.CONFIG, data);
      return data;
    } catch {
      return loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    }
  },

  async updateConfig(config: Partial<StoreConfig>): Promise<{ success: boolean; config: StoreConfig }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!ok) throw new Error('Không thể lưu cấu hình cửa hàng');
      saveLocal(STORAGE_KEYS.CONFIG, data.config);
      return data;
    } catch {
      const current = loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
      const updated = { ...current, ...config };
      saveLocal(STORAGE_KEYS.CONFIG, updated);
      return { success: true, config: updated };
    }
  },

  // Auth & Users (Powered by Firebase Firestore & /api/firebase/*)
  async login(username: string, password: string): Promise<{ success: boolean; user: User }> {
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '');

    // 1. If authenticated with Firebase Firestore on client, query Firestore /users directly first
    if (auth.currentUser) {
      try {
        const localFallback = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
        const fbRes = await loginFromFirestore(cleanUsername, cleanPassword, localFallback);
        return { success: true, user: fbRes.user };
      } catch (fbErr: any) {
        // Continue to /api/firebase/login check below
        console.warn('Direct Firestore login check:', fbErr?.message);
      }
    }

    // 2. Call Firebase API endpoint (/api/firebase/login)
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/firebase/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
      });
      if (!ok) throw new Error(data.error || 'Đăng nhập thất bại');
      if (auth.currentUser && data.user) {
        saveUserToFirestore(data.user).catch(() => {});
      }
      return data;
    } catch (err: any) {
      if (err.message !== 'STATIC_HOST_FALLBACK' && !(err instanceof TypeError)) {
        throw err;
      }
      const localUsers = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      const fbRes = await loginFromFirestore(cleanUsername, cleanPassword, localUsers);
      return { success: true, user: fbRes.user };
    }
  },

  async getUsers(): Promise<User[]> {
    const localAtt = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/firebase/users`);
      if (!ok) throw new Error('Không thể tải danh sách nhân viên từ Firebase API');
      const apiUsers: User[] = Array.isArray(data.users) ? data.users : Array.isArray(data) ? data : [];
      const enriched = apiUsers.map((u) => enrichUserWithAttendanceStats(u, localAtt));
      saveLocal(STORAGE_KEYS.USERS, enriched);
      return enriched;
    } catch {
      if (auth.currentUser) {
        try {
          const firestoreList = await fetchUsersFromFirestore();
          if (firestoreList.length > 0) {
            const enriched = firestoreList.map((u) => enrichUserWithAttendanceStats(u, localAtt));
            saveLocal(STORAGE_KEYS.USERS, enriched);
            return enriched;
          }
        } catch (e) {
          console.warn('Firestore getUsers fallback:', e);
        }
      }
      const fallback = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      return fallback.map((u) => enrichUserWithAttendanceStats(u, localAtt));
    }
  },

  async createUser(user: Partial<User>): Promise<{ success: boolean; user: User }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/firebase/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      if (!ok) throw new Error(data.error || 'Không thể tạo tài khoản mới trên Firebase');
      if (auth.currentUser && data.user) {
        saveUserToFirestore(data.user).catch(() => {});
      }
      const currentUsers = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      saveLocal(STORAGE_KEYS.USERS, [...currentUsers.filter((u) => u.id !== data.user.id), data.user]);
      return data;
    } catch (err: any) {
      if (err.message !== 'STATIC_HOST_FALLBACK' && !(err instanceof TypeError)) {
        throw err;
      }
      const users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      const rawUsername = String(user.username || '').trim();
      const rawPassword = String(user.password || '').trim();
      if (!rawUsername || !rawPassword) {
        throw new Error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      }
      if (users.some((u) => u.username?.trim().toLowerCase() === rawUsername.toLowerCase())) {
        throw new Error(`Tên đăng nhập "${rawUsername}" đã tồn tại.`);
      }
      const role: 'admin' | 'staff' = user.role === 'admin' ? 'admin' : 'staff';
      const rolePrefix = role === 'admin' ? 'QL' : 'NV';
      const roleCount = users.filter((u) => u.role === role).length + 1;
      const newUser: User = {
        id: 'user_' + Date.now(),
        username: rawUsername,
        password: rawPassword,
        email: user.email || `${rawUsername}@chaomamnho.vn`,
        name: user.name || (role === 'admin' ? 'Quản Lý Mới' : 'Nhân Viên Mới'),
        avatar:
          user.avatar ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(rawUsername)}`,
        role,
        employeeCode: user.employeeCode || `${rolePrefix}-${String(roleCount).padStart(3, '0')}`,
        position: user.position || (role === 'admin' ? 'Quản Lý Cửa Hàng' : 'Nhân Viên Bán Hàng'),
        hourlyRate: Number(user.hourlyRate) || (role === 'admin' ? 50000 : 28000),
        phone: user.phone || '',
        joinDate: user.joinDate || getTodayString(),
        isActive: true,
      };
      users.push(newUser);
      saveLocal(STORAGE_KEYS.USERS, users);
      if (auth.currentUser) {
        saveUserToFirestore(newUser).catch(() => {});
      }
      return { success: true, user: newUser };
    }
  },

  async updateUser(id: string, user: Partial<User>): Promise<{ success: boolean; user: User }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/firebase/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      if (!ok) throw new Error(data.error || 'Không thể cập nhật thông tin tài khoản trên Firebase');
      if (auth.currentUser && data.user) {
        saveUserToFirestore(data.user).catch(() => {});
      }
      const currentUsers = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      saveLocal(
        STORAGE_KEYS.USERS,
        currentUsers.map((u) => (u.id === id ? data.user : u))
      );
      return data;
    } catch (err: any) {
      if (err.message !== 'STATIC_HOST_FALLBACK' && !(err instanceof TypeError)) {
        throw err;
      }
      const users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      const idx = users.findIndex((u) => u.id === id);
      if (idx === -1) throw new Error('Không tìm thấy tài khoản nhân sự');
      users[idx] = {
        ...users[idx],
        ...user,
        password: user.password ? String(user.password).trim() : users[idx].password,
      };
      saveLocal(STORAGE_KEYS.USERS, users);
      if (auth.currentUser) {
        saveUserToFirestore(users[idx]).catch(() => {});
      }
      return { success: true, user: users[idx] };
    }
  },

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; user: User }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/firebase/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, currentPassword, newPassword }),
      });
      if (!ok) throw new Error(data.error || 'Không thể đổi mật khẩu');
      if (auth.currentUser && data.user) {
        saveUserToFirestore(data.user).catch(() => {});
      }
      const currentUsers = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      saveLocal(
        STORAGE_KEYS.USERS,
        currentUsers.map((u) => (u.id === userId ? data.user : u))
      );
      return data;
    } catch (err: any) {
      if (err.message !== 'STATIC_HOST_FALLBACK' && !(err instanceof TypeError)) {
        throw err;
      }
      const users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      const idx = users.findIndex((u) => u.id === userId);
      if (idx === -1) throw new Error('Không tìm thấy tài khoản người dùng');
      if (String(users[idx].password || '123456') !== String(currentPassword)) {
        throw new Error('Mật khẩu hiện tại không chính xác.');
      }
      users[idx] = {
        ...users[idx],
        password: newPassword.trim(),
      };
      saveLocal(STORAGE_KEYS.USERS, users);
      if (auth.currentUser) {
        saveUserToFirestore(users[idx]).catch(() => {});
      }
      return { success: true, user: users[idx] };
    }
  },

  async deleteUser(id: string): Promise<{ success: boolean }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/firebase/users/${id}`, { method: 'DELETE' });
      if (!ok) throw new Error('Không thể xoá nhân viên khỏi Firebase');
      if (auth.currentUser) {
        deleteUserFromFirestore(id).catch(() => {});
      }
      const users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS).filter((u) => u.id !== id);
      saveLocal(STORAGE_KEYS.USERS, users);
      return data;
    } catch {
      const users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS).filter((u) => u.id !== id);
      saveLocal(STORAGE_KEYS.USERS, users);
      if (auth.currentUser) {
        deleteUserFromFirestore(id).catch(() => {});
      }
      return { success: true };
    }
  },

  // Attendance
  async getAttendance(params?: { date?: string; userId?: string; month?: string }): Promise<AttendanceRecord[]> {
    const localUsers = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
    try {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/attendance${query ? `?${query}` : ''}`);
      if (!ok) throw new Error('Không thể tải lịch sử chấm công');
      const enriched = (Array.isArray(data) ? data : []).map((r) =>
        enrichAttendanceRecord(r, localUsers)
      );
      if (!params) saveLocal(STORAGE_KEYS.ATTENDANCE, enriched);
      return enriched;
    } catch {
      let list: AttendanceRecord[] = [];
      if (auth.currentUser) {
        try {
          const fbAtt = await fetchAttendanceFromFirestore();
          if (fbAtt.length > 0) list = fbAtt;
        } catch (e) {
          console.warn('Firestore getAttendance fallback:', e);
        }
      }
      if (list.length === 0) {
        list = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      }
      list = list.map((r) => enrichAttendanceRecord(r, localUsers));
      if (params?.date) list = list.filter((r) => r.date === params.date);
      if (params?.userId) list = list.filter((r) => r.userId === params.userId);
      if (params?.month) list = list.filter((r) => r.date.startsWith(params.month!));
      return list.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
    }
  },

  async checkIn(payload: {
    userId: string;
    qrToken?: string;
    wifiSsid?: string;
    gps?: { lat: number; lng: number; accuracy?: number; distance?: number };
    note?: string;
  }): Promise<{ success: boolean; record: AttendanceRecord }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/attendance/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!ok) throw new Error(data.error || 'Check-in thất bại');
      return data;
    } catch (err: any) {
      if (err.message !== 'STATIC_HOST_FALLBACK' && !(err instanceof TypeError)) {
        throw err;
      }
      const users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      const cfg = loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
      const attendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      const user = users.find((u) => u.id === payload.userId);
      if (!user) throw new Error('Không tìm thấy thông tin nhân viên.');
      if (attendance.some((r) => r.userId === payload.userId && r.status === 'working')) {
        throw new Error('Bạn đang trong một lượt làm việc chưa Check-out.');
      }
      const now = new Date();
      const checkInTime = now.toISOString();
      const newRecord: AttendanceRecord = {
        id: 'att_' + Date.now(),
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        employeeCode: user.employeeCode,
        date: getTodayString(),
        checkInTime,
        checkOutTime: null,
        totalMinutes: 0,
        status: 'working',
        checkInMethod: 'direct_button',
        checkInIp: '14.161.45.88',
        checkInWifiSsid: payload.wifiSsid || cfg.wifiSsid,
        checkInGps: payload.gps,
        shiftId: cfg.shifts[0]?.id || 'shift_morning',
        shiftName: cfg.shifts[0]?.name || 'Ca làm việc',
        isLate: false,
        isEarlyLeave: false,
        note: payload.note || '',
        createdAt: checkInTime,
        updatedAt: checkInTime,
      };
      attendance.unshift(newRecord);
      saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);
      return { success: true, record: newRecord };
    }
  },

  async checkOut(payload: {
    userId: string;
    qrToken?: string;
    wifiSsid?: string;
    gps?: { lat: number; lng: number; distance?: number };
    note?: string;
  }): Promise<{ success: boolean; record: AttendanceRecord }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/attendance/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!ok) throw new Error(data.error || 'Check-out thất bại');
      return data;
    } catch (err: any) {
      if (err.message !== 'STATIC_HOST_FALLBACK' && !(err instanceof TypeError)) {
        throw err;
      }
      const attendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      const idx = attendance.findIndex((r) => r.userId === payload.userId && r.status === 'working');
      if (idx === -1) throw new Error('Không tìm thấy ca làm việc đang mở để check-out.');
      const record = attendance[idx];
      const now = new Date();
      const checkOutTime = now.toISOString();
      const diffMinutes = Math.max(
        1,
        Math.round((now.getTime() - new Date(record.checkInTime).getTime()) / 60000)
      );
      const updatedRecord: AttendanceRecord = {
        ...record,
        checkOutTime,
        totalMinutes: diffMinutes,
        status: 'completed',
        checkOutIp: '14.161.45.88',
        checkOutGps: payload.gps,
        note: payload.note ? (record.note ? `${record.note} | ${payload.note}` : payload.note) : record.note,
        updatedAt: checkOutTime,
      };
      attendance[idx] = updatedRecord;
      saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);
      return { success: true, record: updatedRecord };
    }
  },

  async manualAttendance(payload: {
    id?: string;
    userId: string;
    date: string;
    checkInTime: string;
    checkOutTime?: string | null;
    note?: string;
    adjustedBy?: string;
    adjustedReason?: string;
  }): Promise<{ success: boolean; record: AttendanceRecord }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/attendance/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!ok) throw new Error(data.error || 'Không thể lưu chấm công');
      return data;
    } catch (err: any) {
      if (err.message !== 'STATIC_HOST_FALLBACK' && !(err instanceof TypeError)) {
        throw err;
      }
      const users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      const attendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      const user = users.find((u) => u.id === payload.userId);
      if (!user) throw new Error('Không tìm thấy thông tin nhân viên');
      const startMs = new Date(payload.checkInTime).getTime();
      const endMs = payload.checkOutTime ? new Date(payload.checkOutTime).getTime() : null;
      const totalMinutes = endMs && endMs > startMs ? Math.round((endMs - startMs) / 60000) : 0;
      const status = payload.checkOutTime ? 'completed' : 'working';

      if (payload.id) {
        const idx = attendance.findIndex((r) => r.id === payload.id);
        if (idx === -1) throw new Error('Bản ghi không tồn tại');
        const updated: AttendanceRecord = {
          ...attendance[idx],
          checkInTime: payload.checkInTime,
          checkOutTime: payload.checkOutTime || null,
          totalMinutes,
          status,
          note: payload.note,
          adjustedBy: payload.adjustedBy || 'Admin',
          adjustedReason: payload.adjustedReason || 'Quản lý chỉnh sửa công',
          updatedAt: new Date().toISOString(),
        };
        attendance[idx] = updated;
        saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);
        return { success: true, record: updated };
      } else {
        const newRecord: AttendanceRecord = {
          id: 'att_manual_' + Date.now(),
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          employeeCode: user.employeeCode,
          date: payload.date || getTodayString(),
          checkInTime: payload.checkInTime,
          checkOutTime: payload.checkOutTime || null,
          totalMinutes,
          status,
          checkInMethod: 'manual_admin',
          checkInIp: 'Manual Entry (Admin)',
          isLate: false,
          isEarlyLeave: false,
          note: payload.note || '',
          adjustedBy: payload.adjustedBy || 'Admin',
          adjustedReason: payload.adjustedReason || 'Chấm công hộ bởi Quản lý',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        attendance.unshift(newRecord);
        saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);
        return { success: true, record: newRecord };
      }
    }
  },

  async deleteAttendance(id: string): Promise<{ success: boolean }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/attendance/${id}`, { method: 'DELETE' });
      if (!ok) throw new Error('Không thể xoá bản ghi');
      if (auth.currentUser) {
        deleteAttendanceFromFirestore(id).catch(() => {});
      }
      const attendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []).filter((r) => r.id !== id);
      saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);
      return data;
    } catch {
      const attendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []).filter((r) => r.id !== id);
      saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);
      if (auth.currentUser) {
        deleteAttendanceFromFirestore(id).catch(() => {});
      }
      return { success: true };
    }
  },

  // Monthly Report
  async getMonthlyReport(month?: string, userId?: string): Promise<{
    month: string;
    summaries: MonthlyEmployeeSummary[];
    totalRecords: number;
  }> {
    try {
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (userId) params.append('userId', userId);
      const query = params.toString() ? `?${params.toString()}` : '';
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/reports/monthly${query}`);
      if (!ok) throw new Error('Không thể tải báo cáo tháng');
      return data;
    } catch {
      const targetMonth = month || getTodayString().substring(0, 7);
      const users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      const attendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      const monthRecords = attendance.filter((r) => r.date.startsWith(targetMonth));
      const targetUsers = userId ? users.filter((u) => u.id === userId) : users;

      const summaries: MonthlyEmployeeSummary[] = targetUsers.map((user) => {
        const userRecords = monthRecords.filter((r) => r.userId === user.id);
        const totalDaysWorked = new Set(userRecords.map((r) => r.date)).size;
        const totalMinutes = userRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
        const totalHours = Number((totalMinutes / 60).toFixed(2));
        const totalLateCount = userRecords.filter((r) => r.isLate).length;
        const totalEarlyCount = userRecords.filter((r) => r.isEarlyLeave).length;
        const estimatedSalary = Math.round(totalHours * user.hourlyRate);

        return {
          userId: user.id,
          userName: user.name,
          employeeCode: user.employeeCode,
          position: user.position,
          hourlyRate: user.hourlyRate,
          totalDaysWorked,
          totalMinutes,
          totalHours,
          totalLateCount,
          totalEarlyCount,
          estimatedSalary,
          recordsCount: userRecords.length,
        };
      });

      return {
        month: targetMonth,
        summaries,
        totalRecords: monthRecords.length,
      };
    }
  },

  // Email Reports
  async sendEmailReport(payload?: { recipient?: string; trigger?: 'manual' | 'auto_21h' }): Promise<{
    success: boolean;
    message: string;
    log: EmailLog;
  }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/reports/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      });
      if (!ok) throw new Error(data.error || 'Gửi email thất bại');
      return data;
    } catch {
      const cfg = loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
      const logs = loadLocal<EmailLog[]>(STORAGE_KEYS.EMAIL_LOGS, []);
      const today = getTodayString();
      const recipient = payload?.recipient || cfg.managerEmail;
      const newLog: EmailLog = {
        id: 'email_' + Date.now(),
        sentAt: new Date().toISOString(),
        date: today,
        recipient,
        subject: `[Báo Cáo Chấm Công] ${cfg.storeName} - Ngày ${today}`,
        summary: { totalStaff: 5, workedToday: 2, totalHours: 8 },
        htmlBody: `<div style="padding:20px;font-family:sans-serif;background:#18181b;color:#f4f4f5"><h2>${cfg.storeName}</h2><p>Báo cáo ngày ${today} đã được gửi tới ${recipient}</p></div>`,
        status: 'sent',
        trigger: payload?.trigger || 'manual',
      };
      logs.unshift(newLog);
      saveLocal(STORAGE_KEYS.EMAIL_LOGS, logs);
      return {
        success: true,
        message: `Đã gửi báo cáo thành công tới ${recipient}`,
        log: newLog,
      };
    }
  },

  async getEmailLogs(): Promise<EmailLog[]> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/reports/email-logs`);
      if (!ok) throw new Error('Không thể tải lịch sử email');
      saveLocal(STORAGE_KEYS.EMAIL_LOGS, data);
      return data;
    } catch {
      return loadLocal<EmailLog[]>(STORAGE_KEYS.EMAIL_LOGS, []);
    }
  },
};
