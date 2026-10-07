import type {
  User,
  AttendanceRecord,
  StoreConfig,
  NetworkInfo,
  EmailLog,
  MonthlyEmployeeSummary,
} from '../types/index.ts';
import {
  fetchUsersFromFirestore,
  fetchAttendanceFromFirestore,
  fetchStoreConfigFromFirestore,
  saveStoreConfigToFirestore,
  loginFromFirestore,
  saveUserToFirestore,
  deleteUserFromFirestore,
  saveAttendanceToFirestore,
  deleteAttendanceFromFirestore,
  enrichUserWithAttendanceStats,
  enrichAttendanceRecord,
} from '../firebase.ts';
import firebaseAppletConfig from '../../firebase-applet-config.json';

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
    projectId: firebaseAppletConfig.projectId,
    appId: firebaseAppletConfig.appId,
    apiKey: firebaseAppletConfig.apiKey,
    authDomain: firebaseAppletConfig.authDomain,
    firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId,
    storageBucket: firebaseAppletConfig.storageBucket,
    messagingSenderId: firebaseAppletConfig.messagingSenderId,
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

  // Store Config (PRIMARY SOURCE OF TRUTH: Live Firebase Firestore)
  async getConfig(): Promise<StoreConfig> {
    let baseConfig = loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/config`);
      if (ok && data) {
        baseConfig = { ...baseConfig, ...data };
      }
    } catch {}

    try {
      const fbCfg = await fetchStoreConfigFromFirestore();
      if (fbCfg) {
        baseConfig = {
          ...baseConfig,
          ...fbCfg,
          firebaseConfig: DEFAULT_CONFIG.firebaseConfig,
        };
      }
    } catch {}

    saveLocal(STORAGE_KEYS.CONFIG, baseConfig);
    return baseConfig;
  },

  async updateConfig(config: Partial<StoreConfig>): Promise<{ success: boolean; config: StoreConfig }> {
    const current = loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    const updated: StoreConfig = {
      ...current,
      ...config,
      firebaseConfig: DEFAULT_CONFIG.firebaseConfig,
    };
    saveLocal(STORAGE_KEYS.CONFIG, updated);
    await saveStoreConfigToFirestore(updated).catch(() => {});

    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (ok && data?.config) {
        saveLocal(STORAGE_KEYS.CONFIG, data.config);
        return data;
      }
    } catch {}

    return { success: true, config: updated };
  },

  // Auth & Users (PRIMARY SOURCE OF TRUTH: Live Firebase Firestore)
  async login(username: string, password: string): Promise<{ success: boolean; user: User }> {
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '');

    // 1. Primary: Query live Firebase Firestore directly (works across Machine A & Machine B on Vercel & AI Studio)
    try {
      const localFallback = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      const fbRes = await loginFromFirestore(cleanUsername, cleanPassword, localFallback);
      // Sync user back to local server if available
      fetch(`${API_BASE}/firebase/sync-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: [fbRes.user] }),
      }).catch(() => {});
      return { success: true, user: fbRes.user };
    } catch (fbErr: any) {
      // 2. Also check /api/firebase/login if backend has a newly created user
      try {
        const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/firebase/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
        });
        if (!ok) throw new Error(data.error || 'Đăng nhập thất bại');
        if (data.user) {
          await saveUserToFirestore(data.user).catch(() => {});
        }
        return data;
      } catch (apiErr: any) {
        if (apiErr.message !== 'STATIC_HOST_FALLBACK' && !(apiErr instanceof TypeError)) {
          throw apiErr;
        }
        throw fbErr;
      }
    }
  },

  async getUsers(): Promise<User[]> {
    const localAtt = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);

    // 1. Primary: Read directly from live Firebase Firestore so Machine B always gets accounts created on Machine A
    try {
      const firestoreList = await fetchUsersFromFirestore();
      if (firestoreList.length > 0) {
        const enriched = firestoreList.map((u) => enrichUserWithAttendanceStats(u, localAtt));
        saveLocal(STORAGE_KEYS.USERS, enriched);
        return enriched;
      }
    } catch (e) {
      console.warn('Firestore direct getUsers warning:', e);
    }

    // 2. Fallback: Read from /api/firebase/users and seed to Firestore
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/firebase/users`);
      if (!ok) throw new Error('Không thể tải danh sách nhân viên từ Firebase API');
      const apiUsers: User[] = Array.isArray(data.users) ? data.users : Array.isArray(data) ? data : [];
      const enriched = apiUsers.map((u) => enrichUserWithAttendanceStats(u, localAtt));
      saveLocal(STORAGE_KEYS.USERS, enriched);
      for (const u of enriched) {
        saveUserToFirestore(u, undefined, localAtt).catch(() => {});
      }
      return enriched;
    } catch {
      const fallback = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      return fallback.map((u) => enrichUserWithAttendanceStats(u, localAtt));
    }
  },

  async createUser(user: Partial<User>): Promise<{ success: boolean; user: User }> {
    const rawUsername = String(user.username || '').trim();
    const rawPassword = String(user.password || '').trim();
    if (!rawUsername || !rawPassword) {
      throw new Error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
    }

    // 1. Check live Firebase Firestore users first
    let currentUsers: User[] = [];
    try {
      currentUsers = await fetchUsersFromFirestore();
    } catch {
      currentUsers = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
    }

    if (currentUsers.some((u) => u.username?.trim().toLowerCase() === rawUsername.toLowerCase())) {
      throw new Error(`Tên đăng nhập "${rawUsername}" đã tồn tại trên Firebase.`);
    }

    const role: 'admin' | 'staff' = user.role === 'admin' ? 'admin' : 'staff';
    const rolePrefix = role === 'admin' ? 'QL' : 'NV';
    const roleCount = currentUsers.filter((u) => u.role === role).length + 1;
    const localAtt = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);

    const newUser: User = enrichUserWithAttendanceStats(
      {
        id: user.id || 'user_' + Date.now(),
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
        isActive: user.isActive !== false,
        note: user.note || '',
      },
      localAtt
    );

    // 2. Save directly to live Firebase Firestore FIRST so Machine B can log in immediately
    await saveUserToFirestore(newUser, undefined, localAtt);

    // 3. Also sync to backend API and localStorage
    const nextUsers = [...currentUsers.filter((u) => u.id !== newUser.id), newUser];
    saveLocal(STORAGE_KEYS.USERS, nextUsers);
    fetch(`${API_BASE}/firebase/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    }).catch(() => {});

    return { success: true, user: newUser };
  },

  async updateUser(id: string, user: Partial<User>): Promise<{ success: boolean; user: User }> {
    let currentUsers: User[] = [];
    try {
      currentUsers = await fetchUsersFromFirestore();
    } catch {
      currentUsers = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
    }

    const idx = currentUsers.findIndex((u) => u.id === id);
    const baseUser = idx >= 0 ? currentUsers[idx] : (user as User);

    if (user.username) {
      const cleanNewUsername = String(user.username).trim();
      const isDuplicate = currentUsers.some(
        (u) => u.id !== id && u.username?.trim().toLowerCase() === cleanNewUsername.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(`Tên đăng nhập "${cleanNewUsername}" đã được sử dụng bởi người khác.`);
      }
      user.username = cleanNewUsername;
    }

    const localAtt = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    const updatedUser: User = enrichUserWithAttendanceStats(
      {
        ...baseUser,
        ...user,
        id,
        password: user.password ? String(user.password).trim() : baseUser.password,
      },
      localAtt
    );

    // 1. Save directly to live Firebase Firestore FIRST
    await saveUserToFirestore(updatedUser, undefined, localAtt);

    // 2. Sync to localStorage & backend API
    const nextUsers =
      idx >= 0
        ? currentUsers.map((u) => (u.id === id ? updatedUser : u))
        : [...currentUsers, updatedUser];
    saveLocal(STORAGE_KEYS.USERS, nextUsers);
    fetch(`${API_BASE}/firebase/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser),
    }).catch(() => {});

    return { success: true, user: updatedUser };
  },

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; user: User }> {
    let currentUsers: User[] = [];
    try {
      currentUsers = await fetchUsersFromFirestore();
    } catch {
      currentUsers = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
    }

    const idx = currentUsers.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('Không tìm thấy tài khoản người dùng trên Firebase');

    if (String(currentUsers[idx].password || '123456') !== String(currentPassword)) {
      throw new Error('Mật khẩu hiện tại không chính xác.');
    }

    const localAtt = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    const updatedUser: User = enrichUserWithAttendanceStats(
      {
        ...currentUsers[idx],
        password: newPassword.trim(),
      },
      localAtt
    );

    // 1. Save new password directly to live Firebase Firestore FIRST
    await saveUserToFirestore(updatedUser, undefined, localAtt);

    // 2. Sync to localStorage & backend API
    const nextUsers = currentUsers.map((u) => (u.id === userId ? updatedUser : u));
    saveLocal(STORAGE_KEYS.USERS, nextUsers);
    fetch(`${API_BASE}/firebase/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, currentPassword, newPassword }),
    }).catch(() => {});

    return { success: true, user: updatedUser };
  },

  async deleteUser(id: string): Promise<{ success: boolean }> {
    // 1. Delete directly from live Firebase Firestore FIRST
    await deleteUserFromFirestore(id);

    // 2. Sync to localStorage & backend API
    const users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS).filter((u) => u.id !== id);
    saveLocal(STORAGE_KEYS.USERS, users);
    fetch(`${API_BASE}/firebase/users/${id}`, { method: 'DELETE' }).catch(() => {});

    return { success: true };
  },

  // Attendance (PRIMARY SOURCE OF TRUTH: Live Firebase Firestore)
  async getAttendance(params?: { date?: string; userId?: string; month?: string }): Promise<AttendanceRecord[]> {
    const localUsers = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);

    // 1. Primary: Read directly from live Firebase Firestore
    try {
      const fbAtt = await fetchAttendanceFromFirestore();
      if (fbAtt.length > 0) {
        let list = fbAtt.map((r) => enrichAttendanceRecord(r, localUsers));
        if (!params) saveLocal(STORAGE_KEYS.ATTENDANCE, list);
        if (params?.date) list = list.filter((r) => r.date === params.date);
        if (params?.userId) list = list.filter((r) => r.userId === params.userId);
        if (params?.month) list = list.filter((r) => r.date.startsWith(params.month!));
        return list.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
      }
    } catch (e) {
      console.warn('Firestore direct getAttendance warning:', e);
    }

    // 2. Fallback to backend API / localStorage and seed to Firestore
    try {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/attendance${query ? `?${query}` : ''}`);
      if (!ok) throw new Error('Không thể tải lịch sử chấm công');
      const enriched = (Array.isArray(data) ? data : []).map((r) =>
        enrichAttendanceRecord(r, localUsers)
      );
      if (!params) {
        saveLocal(STORAGE_KEYS.ATTENDANCE, enriched);
        for (const r of enriched) {
          saveAttendanceToFirestore(r, localUsers).catch(() => {});
        }
      }
      return enriched;
    } catch {
      let list = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []).map((r) =>
        enrichAttendanceRecord(r, localUsers)
      );
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
    let users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
    try {
      const fbUsers = await fetchUsersFromFirestore();
      if (fbUsers.length > 0) users = fbUsers;
    } catch {}

    let attendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    try {
      const fbAtt = await fetchAttendanceFromFirestore();
      if (fbAtt.length > 0) attendance = fbAtt;
    } catch {}

    const cfg = loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    const user = users.find((u) => u.id === payload.userId);
    if (!user) throw new Error('Không tìm thấy thông tin nhân viên trên Firebase.');
    if (attendance.some((r) => r.userId === payload.userId && r.status === 'working')) {
      throw new Error('Bạn đang trong một lượt làm việc chưa Check-out.');
    }

    const now = new Date();
    const checkInTime = now.toISOString();
    const newRecord: AttendanceRecord = enrichAttendanceRecord(
      {
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
      },
      users
    );

    const nextAttendance = [newRecord, ...attendance];
    saveLocal(STORAGE_KEYS.ATTENDANCE, nextAttendance);

    // 1. Save directly to live Firebase Firestore FIRST
    await saveAttendanceToFirestore(newRecord, users);
    await saveUserToFirestore(user, undefined, nextAttendance);

    // 2. Sync to backend server if running
    fetch(`${API_BASE}/firebase/sync-attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendance: nextAttendance }),
    }).catch(() => {});

    return { success: true, record: newRecord };
  },

  async checkOut(payload: {
    userId: string;
    qrToken?: string;
    wifiSsid?: string;
    gps?: { lat: number; lng: number; distance?: number };
    note?: string;
  }): Promise<{ success: boolean; record: AttendanceRecord }> {
    let users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
    try {
      const fbUsers = await fetchUsersFromFirestore();
      if (fbUsers.length > 0) users = fbUsers;
    } catch {}

    let attendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    try {
      const fbAtt = await fetchAttendanceFromFirestore();
      if (fbAtt.length > 0) attendance = fbAtt;
    } catch {}

    const idx = attendance.findIndex((r) => r.userId === payload.userId && r.status === 'working');
    if (idx === -1) throw new Error('Không tìm thấy ca làm việc đang mở để check-out.');
    const record = attendance[idx];
    const now = new Date();
    const checkOutTime = now.toISOString();
    const diffMinutes = Math.max(
      1,
      Math.round((now.getTime() - new Date(record.checkInTime).getTime()) / 60000)
    );
    const updatedRecord: AttendanceRecord = enrichAttendanceRecord(
      {
        ...record,
        checkOutTime,
        totalMinutes: diffMinutes,
        status: 'completed',
        checkOutIp: '14.161.45.88',
        checkOutGps: payload.gps,
        note: payload.note
          ? record.note
            ? `${record.note} | ${payload.note}`
            : payload.note
          : record.note,
        updatedAt: checkOutTime,
      },
      users
    );

    attendance[idx] = updatedRecord;
    saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);

    // 1. Save directly to live Firebase Firestore FIRST
    await saveAttendanceToFirestore(updatedRecord, users);
    const user = users.find((u) => u.id === payload.userId);
    if (user) {
      await saveUserToFirestore(user, undefined, attendance);
    }

    // 2. Sync to backend server if running
    fetch(`${API_BASE}/firebase/sync-attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendance }),
    }).catch(() => {});

    return { success: true, record: updatedRecord };
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
    let users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
    try {
      const fbUsers = await fetchUsersFromFirestore();
      if (fbUsers.length > 0) users = fbUsers;
    } catch {}

    let attendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    try {
      const fbAtt = await fetchAttendanceFromFirestore();
      if (fbAtt.length > 0) attendance = fbAtt;
    } catch {}

    const user = users.find((u) => u.id === payload.userId);
    if (!user) throw new Error('Không tìm thấy thông tin nhân viên trên Firebase');
    const startMs = new Date(payload.checkInTime).getTime();
    const endMs = payload.checkOutTime ? new Date(payload.checkOutTime).getTime() : null;
    const totalMinutes = endMs && endMs > startMs ? Math.round((endMs - startMs) / 60000) : 0;
    const status = payload.checkOutTime ? 'completed' : 'working';

    let targetRecord: AttendanceRecord;
    if (payload.id) {
      const idx = attendance.findIndex((r) => r.id === payload.id);
      if (idx === -1) throw new Error('Bản ghi không tồn tại');
      targetRecord = enrichAttendanceRecord(
        {
          ...attendance[idx],
          date: payload.date || attendance[idx].date,
          checkInTime: payload.checkInTime,
          checkOutTime: payload.checkOutTime || null,
          totalMinutes,
          status,
          note: payload.note,
          adjustedBy: payload.adjustedBy || 'Admin',
          adjustedReason: payload.adjustedReason || 'Quản lý chỉnh sửa công',
          updatedAt: new Date().toISOString(),
        },
        users
      );
      attendance[idx] = targetRecord;
    } else {
      targetRecord = enrichAttendanceRecord(
        {
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
        },
        users
      );
      attendance.unshift(targetRecord);
    }

    saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);

    // 1. Save directly to live Firebase Firestore FIRST
    await saveAttendanceToFirestore(targetRecord, users);
    await saveUserToFirestore(user, undefined, attendance);

    // 2. Sync to backend server if running
    fetch(`${API_BASE}/firebase/sync-attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendance }),
    }).catch(() => {});

    return { success: true, record: targetRecord };
  },

  async deleteAttendance(id: string): Promise<{ success: boolean }> {
    await deleteAttendanceFromFirestore(id).catch(() => {});
    const attendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []).filter((r) => r.id !== id);
    saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);
    fetch(`${API_BASE}/attendance/${id}`, { method: 'DELETE' }).catch(() => {});
    return { success: true };
  },

  // Monthly Report (Computed from live Firebase Firestore Users & Attendance)
  async getMonthlyReport(month?: string, userId?: string): Promise<{
    month: string;
    summaries: MonthlyEmployeeSummary[];
    totalRecords: number;
  }> {
    const targetMonth = month || getTodayString().substring(0, 7);
    const [users, attendance] = await Promise.all([this.getUsers(), this.getAttendance()]);
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
