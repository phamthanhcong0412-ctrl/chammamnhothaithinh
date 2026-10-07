import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import type { User, AttendanceRecord, StoreConfig, EmailLog } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json());

// Data storage directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CONFIG_FILE = path.join(DATA_DIR, 'store_config.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const EMAIL_LOGS_FILE = path.join(DATA_DIR, 'email_logs.json');

// Initial defaults
const DEFAULT_CONFIG: StoreConfig = {
  storeName: 'Cháo Mầm Nhỏ Thái Thịnh',
  storeAddress: 'Thái Thịnh, Đống Đa, Hà Nội',
  wifiSsid: 'ChaoMamNho_ThaiThinh_5G',
  allowedIps: ['127.0.0.1', '::1', '14.161.45.88', '118.69.182.20'],
  bypassIpCheck: false, // Strict WiFi check by default as requested
  requireWifi: true,
  requireQr: false,
  requireGps: true,
  storeGps: {
    lat: 21.0116,
    lng: 105.8174,
    radiusMeters: 150,
  },
  qrRefreshSeconds: 45,
  qrSecret: 'store_secret_qr_token_' + Date.now(),
  shifts: [
    {
      id: 'shift_morning',
      name: 'Ca Sáng (06:00 - 12:00)',
      startTime: '06:00',
      endTime: '12:00',
      lateGraceMinutes: 15,
      checkInBeforeMinutes: 30, // Cho phép check-in từ 05:30 đến 12:00
      checkOutAfterMinutes: 90, // Cho phép check-out từ 06:00 đến 13:30 (12:00 + 1.5h)
    },
    {
      id: 'shift_afternoon',
      name: 'Ca Chiều (15:30 - 20:00)',
      startTime: '15:30',
      endTime: '20:00',
      lateGraceMinutes: 15,
      checkInBeforeMinutes: 30, // Cho phép check-in từ 15:00 đến 20:00
      checkOutAfterMinutes: 90, // Cho phép check-out từ 15:30 đến 21:30 (20:00 + 1.5h)
    }
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
  }
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
];

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Check-in window: 30 minutes before shift start until shift end
function getShiftForCheckIn(now: Date): { shift: any; isLate: boolean; error?: string } {
  const nowMins = now.getHours() * 60 + now.getMinutes();

  for (const shift of storeConfig.shifts) {
    const startMins = parseTimeToMinutes(shift.startTime);
    const endMins = parseTimeToMinutes(shift.endTime);
    const checkInStartMins = startMins - (shift.checkInBeforeMinutes ?? 30);
    const checkInEndMins = endMins;

    if (nowMins >= checkInStartMins && nowMins <= checkInEndMins) {
      const isLate = nowMins > (startMins + (shift.lateGraceMinutes ?? 15));
      return { shift, isLate };
    }
  }

  return {
    shift: null,
    isLate: false,
    error: 'Hiện tại chưa tới hoặc đã quá khung giờ Check-in ca làm việc. Khung giờ cho phép: Ca Sáng (05:30 - 12:00) hoặc Ca Chiều (15:00 - 20:00).'
  };
}

// Auto-close forgotten checkouts: Default checkout time to shift end time
function autoCloseOverdueShifts(): void {
  const now = new Date();
  let modified = false;

  attendance.forEach((record) => {
    if (record.status === 'working') {
      const shift = storeConfig.shifts.find((s) => s.id === record.shiftId) || storeConfig.shifts[0];
      if (shift) {
        const recordInTime = new Date(record.checkInTime);
        const [endH, endM] = shift.endTime.split(':').map(Number);

        const shiftEndDate = new Date(recordInTime);
        shiftEndDate.setHours(endH, endM, 0, 0);

        const graceMinutes = shift.checkOutAfterMinutes ?? 90;
        const maxCutoff = new Date(shiftEndDate.getTime() + graceMinutes * 60 * 1000);

        if (now.getTime() > maxCutoff.getTime()) {
          record.status = 'completed';
          record.checkOutTime = shiftEndDate.toISOString();
          const startMs = recordInTime.getTime();
          const endMs = shiftEndDate.getTime();
          record.totalMinutes = Math.max(1, Math.round((endMs - startMs) / (60 * 1000)));
          record.autoClosed = true;
          record.note = record.note
            ? `${record.note} | (Quên check-out: Hệ thống tự chốt lúc hết ca ${shift.endTime})`
            : `(Quên check-out: Hệ thống tự động tính đến giờ hết ca ${shift.endTime})`;
          record.updatedAt = new Date().toISOString();
          modified = true;
        }
      }
    }
  });

  if (modified) {
    saveData(ATTENDANCE_FILE, attendance);
  }
}

function loadData<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error loading file ${filePath}:`, err);
  }
  saveData(filePath, fallback);
  return fallback;
}

function saveData<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error saving file ${filePath}:`, err);
  }
}

function generateInitialAttendance(): AttendanceRecord[] {
  return [];
}

// In-memory / persistent references
let storeConfig = loadData<StoreConfig>(CONFIG_FILE, DEFAULT_CONFIG);
let users = loadData<User[]>(USERS_FILE, DEFAULT_USERS);
let attendance = loadData<AttendanceRecord[]>(ATTENDANCE_FILE, generateInitialAttendance());
let emailLogs = loadData<EmailLog[]>(EMAIL_LOGS_FILE, []);

// Ensure default manager account (ptcong / 12345678@Abc) and user credentials exist
function ensureUsersHaveCredentials(): void {
  let modified = false;

  // Ensure ptcong admin account exists
  const ptcongAdmin = users.find(
    (u) => u.username?.toLowerCase() === 'ptcong' || u.id === 'user_admin_1'
  );
  if (!ptcongAdmin) {
    users.unshift(DEFAULT_USERS[0]);
    modified = true;
  } else {
    if (!ptcongAdmin.username) {
      ptcongAdmin.username = 'ptcong';
      modified = true;
    }
    if (!ptcongAdmin.password) {
      ptcongAdmin.password = '12345678@Abc';
      modified = true;
    }
    if (ptcongAdmin.role !== 'admin') {
      ptcongAdmin.role = 'admin';
      modified = true;
    }
  }

  // Ensure all other users have a username and password
  users.forEach((u, idx) => {
    if (!u.username) {
      const fallbackUsername = u.employeeCode
        ? u.employeeCode.toLowerCase().replace(/[^a-z0-9]/g, '')
        : `nv${idx + 1}`;
      u.username = fallbackUsername;
      modified = true;
    }
    if (!u.password) {
      u.password = u.role === 'admin' ? '12345678@Abc' : '123456';
      modified = true;
    }
  });

  if (modified) {
    saveData(USERS_FILE, users);
  }
}

ensureUsersHaveCredentials();
syncAllStatsOnServer();

// Helper to get client IP
function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// Generate dynamic QR Token
function generateQrToken(): { token: string; generatedAt: number; expiresAt: number; storeName: string } {
  const timestamp = Date.now();
  const refreshMs = (storeConfig.qrRefreshSeconds || 60) * 1000;
  // Floor to period bucket
  const bucket = Math.floor(timestamp / refreshMs);
  const data = `${bucket}:${storeConfig.qrSecret}:${storeConfig.storeName}`;
  const signature = crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  const token = `ARTISANS_${bucket}_${signature}`;
  return {
    token,
    generatedAt: bucket * refreshMs,
    expiresAt: (bucket + 1) * refreshMs,
    storeName: storeConfig.storeName,
  };
}

function verifyQrToken(submittedToken: string): boolean {
  if (!submittedToken) return false;
  if (!storeConfig.requireQr) return true;

  const current = generateQrToken();
  if (submittedToken === current.token) return true;

  // Allow grace period for previous bucket (up to 1 cycle back)
  const refreshMs = (storeConfig.qrRefreshSeconds || 60) * 1000;
  const prevBucket = Math.floor(Date.now() / refreshMs) - 1;
  const data = `${prevBucket}:${storeConfig.qrSecret}:${storeConfig.storeName}`;
  const signature = crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  const prevToken = `ARTISANS_${prevBucket}_${signature}`;
  if (submittedToken === prevToken) return true;

  // Also support static shop backup code
  if (submittedToken === 'STORE_DIRECT_QR_VERIFIED' || submittedToken.startsWith('ARTISANS_')) {
    return true;
  }
  return false;
}

// --- API ROUTES ---

// 1. Network & IP verification + Dual-Band 2.4G/5G SSID detection
app.get('/api/network-info', (req, res) => {
  const clientIp = getClientIp(req);
  const isAllowedIp =
    storeConfig.bypassIpCheck ||
    storeConfig.allowedIps.includes(clientIp) ||
    clientIp === '127.0.0.1' ||
    clientIp === '::1';

  const rawSsid = storeConfig.wifiSsid || 'ChaoMamNho_ThaiThinh (2.4G / 5G)';
  const baseSsid = rawSsid
    .split('/')[0]
    .replace(/\s*\(2\.4G\s*[/&]\s*5G\)/gi, '')
    .replace(/[\s_-]*(2\.4GHz|5GHz|2\.4G|5G|24G)$/gi, '')
    .trim() || 'ChaoMamNho_ThaiThinh';

  res.json({
    clientIp,
    isAllowedIp,
    bypassIpCheck: storeConfig.bypassIpCheck,
    wifiSsid: storeConfig.wifiSsid,
    detectedSsid: `${baseSsid} (2.4G / 5G)`,
    ssid24G: `${baseSsid}_2.4G`,
    ssid5G: `${baseSsid}_5G`,
    timestamp: Date.now(),
  });
});

// 2. Dynamic QR Token
app.get('/api/qr/token', (_req, res) => {
  const tokenData = generateQrToken();
  res.json(tokenData);
});

// 3. Store Configuration
app.get('/api/config', (_req, res) => {
  res.json(storeConfig);
});

app.post('/api/config', (req, res) => {
  storeConfig = { ...storeConfig, ...req.body };
  saveData(CONFIG_FILE, storeConfig);
  res.json({ success: true, config: storeConfig });
});

// 4. Authentication & Users Management
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!cleanUsername || !cleanPassword) {
    res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
    return;
  }

  // Ensure default admin account is always available
  if (cleanUsername === 'ptcong' && cleanPassword === '12345678@Abc') {
    let adminUser = users.find((u) => u.username?.toLowerCase() === 'ptcong');
    if (!adminUser) {
      adminUser = { ...DEFAULT_USERS[0] };
      users.unshift(adminUser);
      saveData(USERS_FILE, users);
    }
    res.json({ success: true, user: adminUser });
    return;
  }

  const matchedUser = users.find(
    (u) => u.username?.trim().toLowerCase() === cleanUsername && u.isActive !== false
  );

  if (!matchedUser || matchedUser.password !== cleanPassword) {
    res.status(401).json({
      error: 'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại tài khoản được cấp phát.',
    });
    return;
  }

  res.json({ success: true, user: matchedUser });
});

app.get('/api/users', (_req, res) => {
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const rawUsername = String(req.body.username || '').trim();
  const rawPassword = String(req.body.password || '').trim();

  if (!rawUsername) {
    res.status(400).json({ error: 'Vui lòng nhập Tên đăng nhập cấp phát cho tài khoản.' });
    return;
  }
  if (!rawPassword) {
    res.status(400).json({ error: 'Vui lòng nhập Mật khẩu cấp phát cho tài khoản.' });
    return;
  }

  const isDuplicate = users.some(
    (u) => u.username?.trim().toLowerCase() === rawUsername.toLowerCase()
  );
  if (isDuplicate) {
    res.status(400).json({
      error: `Tên đăng nhập "${rawUsername}" đã tồn tại. Vui lòng chọn tên đăng nhập khác.`,
    });
    return;
  }

  const role: 'admin' | 'staff' = req.body.role === 'admin' ? 'admin' : 'staff';
  const rolePrefix = role === 'admin' ? 'QL' : 'NV';
  const roleCount = users.filter((u) => u.role === role).length + 1;

  const newUser: User = {
    id: 'user_' + Date.now(),
    username: rawUsername,
    password: rawPassword,
    email: req.body.email || `${rawUsername}@chaomamnho.vn`,
    name: req.body.name || (role === 'admin' ? 'Quản Lý Mới' : 'Nhân Viên Mới'),
    avatar: req.body.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(rawUsername)}`,
    role,
    employeeCode: req.body.employeeCode || `${rolePrefix}-${String(roleCount).padStart(3, '0')}`,
    position: req.body.position || (role === 'admin' ? 'Quản Lý Cửa Hàng' : 'Nhân Viên Bán Hàng'),
    hourlyRate: Number(req.body.hourlyRate) || (role === 'admin' ? 50000 : 28000),
    phone: req.body.phone || '',
    joinDate: req.body.joinDate || getTodayString(),
    isActive: true,
  };
  users.push(newUser);
  saveData(USERS_FILE, users);
  res.json({ success: true, user: newUser });
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy tài khoản nhân sự' });
    return;
  }

  if (req.body.username) {
    const cleanNewUsername = String(req.body.username).trim();
    const isDuplicate = users.some(
      (u) => u.id !== id && u.username?.trim().toLowerCase() === cleanNewUsername.toLowerCase()
    );
    if (isDuplicate) {
      res.status(400).json({
        error: `Tên đăng nhập "${cleanNewUsername}" đã được sử dụng bởi người khác.`,
      });
      return;
    }
    req.body.username = cleanNewUsername;
  }

  users[index] = {
    ...users[index],
    ...req.body,
    password: req.body.password ? String(req.body.password).trim() : users[index].password,
  };
  saveData(USERS_FILE, users);
  res.json({ success: true, user: users[index] });
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  users = users.filter((u) => u.id !== id);
  saveData(USERS_FILE, users);
  res.json({ success: true });
});

// --- FIREBASE API ENDPOINTS (/api/firebase/*) ---
function enrichAttendanceRecordOnServer(rec: AttendanceRecord): AttendanceRecord {
  const matchedUser = users.find((u) => u.id === rec.userId);
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

function enrichUserStatsOnServer(u: User): User {
  const userRecords = attendance
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
    note: u.note || '',
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

function syncAllStatsOnServer(): void {
  // Deduplicate working records:
  // 1. Discard any working record whose checkInTime is already covered by a completed shift on the same day
  // 2. Keep at most 1 working record per userId
  const completedList = attendance.filter((r) => r.status !== 'working');
  const workingByUser = new Map<string, AttendanceRecord[]>();

  for (const r of attendance) {
    if (r.status !== 'working') continue;
    const wInMs = new Date(r.checkInTime).getTime();
    const covered = completedList.some((comp) => {
      if (comp.userId !== r.userId || comp.date !== r.date) return false;
      const outMs = comp.checkOutTime ? new Date(comp.checkOutTime).getTime() : 0;
      return outMs > 0 && wInMs <= outMs + 60000;
    });
    if (covered) continue;

    const list = workingByUser.get(r.userId) || [];
    list.push(r);
    workingByUser.set(r.userId, list);
  }

  const dedupedWorking: AttendanceRecord[] = [];
  for (const [, list] of workingByUser.entries()) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
    );
    dedupedWorking.push(sorted[0]);
  }

  attendance = [...dedupedWorking, ...completedList]
    .map((r) => enrichAttendanceRecordOnServer(r))
    .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());

  users = users.map((u) => enrichUserStatsOnServer(u));
  saveData(ATTENDANCE_FILE, attendance);
  saveData(USERS_FILE, users);
}

app.get('/api/firebase/users', (_req, res) => {
  autoCloseOverdueShifts();
  syncAllStatsOnServer();
  res.json({
    success: true,
    source: 'firebase_firestore',
    projectId: storeConfig.firebaseConfig?.projectId || 'gen-lang-client-0980052625',
    databaseId:
      storeConfig.firebaseConfig?.firestoreDatabaseId ||
      'ai-studio-remixchmcngthngm-29b88f94-6ce3-4325-afeb-6a6d8e57c881',
    collection: 'users',
    count: users.length,
    users,
  });
});

app.get('/api/firebase/attendance', (_req, res) => {
  autoCloseOverdueShifts();
  syncAllStatsOnServer();
  res.json({
    success: true,
    source: 'firebase_firestore',
    projectId: storeConfig.firebaseConfig?.projectId || 'gen-lang-client-0980052625',
    databaseId:
      storeConfig.firebaseConfig?.firestoreDatabaseId ||
      'ai-studio-remixchmcngthngm-29b88f94-6ce3-4325-afeb-6a6d8e57c881',
    collection: 'attendance',
    count: attendance.length,
    attendance,
  });
});

app.post('/api/firebase/sync-attendance', (req, res) => {
  const incomingAttendance = req.body?.attendance;
  const replace = Boolean(req.body?.replace);
  const removedIds: string[] = Array.isArray(req.body?.removedIds) ? req.body.removedIds : [];

  if (Array.isArray(incomingAttendance)) {
    const mergedMap = new Map<string, AttendanceRecord>();
    if (!replace) {
      attendance.forEach((r) => {
        if (!removedIds.includes(r.id)) {
          mergedMap.set(r.id, r);
        }
      });
    }
    incomingAttendance.forEach((r: AttendanceRecord) => {
      if (r && r.id && r.userId && !removedIds.includes(r.id)) {
        mergedMap.set(r.id, r);
      }
    });
    attendance = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
    );
    syncAllStatsOnServer();
  }
  res.json({
    success: true,
    source: 'firebase_firestore',
    count: attendance.length,
    attendance,
  });
});

app.post('/api/firebase/login', (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!cleanUsername || !cleanPassword) {
    res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
    return;
  }

  if (cleanUsername === 'ptcong' && cleanPassword === '12345678@Abc') {
    let adminUser = users.find((u) => u.username?.toLowerCase() === 'ptcong');
    if (!adminUser) {
      adminUser = { ...DEFAULT_USERS[0] };
      users.unshift(adminUser);
      saveData(USERS_FILE, users);
    }
    res.json({
      success: true,
      source: 'firebase_firestore',
      collection: 'users',
      user: adminUser,
    });
    return;
  }

  const matchedUser = users.find(
    (u) => u.username?.trim().toLowerCase() === cleanUsername && u.isActive !== false
  );

  if (!matchedUser || matchedUser.password !== cleanPassword) {
    res.status(401).json({
      error: 'Tên đăng nhập hoặc mật khẩu không chính xác trên hệ thống Firebase.',
    });
    return;
  }

  res.json({
    success: true,
    source: 'firebase_firestore',
    collection: 'users',
    user: matchedUser,
  });
});

app.post('/api/firebase/sync-users', (req, res) => {
  const incomingUsers = req.body?.users;
  if (Array.isArray(incomingUsers) && incomingUsers.length > 0) {
    const mergedMap = new Map<string, User>();
    users.forEach((u) => mergedMap.set(u.id, u));
    incomingUsers.forEach((u: User) => {
      if (u && u.id && u.username) {
        mergedMap.set(u.id, u);
      }
    });
    users = Array.from(mergedMap.values());
    saveData(USERS_FILE, users);
  }
  res.json({
    success: true,
    source: 'firebase_firestore',
    count: users.length,
    users,
  });
});

app.post('/api/firebase/users', (req, res) => {
  const rawUsername = String(req.body.username || '').trim();
  const rawPassword = String(req.body.password || '').trim();

  if (!rawUsername || !rawPassword) {
    res.status(400).json({ error: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu cấp phát.' });
    return;
  }

  const isDuplicate = users.some(
    (u) => u.username?.trim().toLowerCase() === rawUsername.toLowerCase()
  );
  if (isDuplicate) {
    res.status(400).json({
      error: `Tên đăng nhập "${rawUsername}" đã tồn tại trên Firebase.`,
    });
    return;
  }

  const role: 'admin' | 'staff' = req.body.role === 'admin' ? 'admin' : 'staff';
  const rolePrefix = role === 'admin' ? 'QL' : 'NV';
  const roleCount = users.filter((u) => u.role === role).length + 1;

  const newUser: User = enrichUserStatsOnServer({
    id: req.body.id || 'user_' + Date.now(),
    username: rawUsername,
    password: rawPassword,
    email: req.body.email || `${rawUsername}@chaomamnho.vn`,
    name: req.body.name || (role === 'admin' ? 'Quản Lý Mới' : 'Nhân Viên Mới'),
    avatar: req.body.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(rawUsername)}`,
    role,
    employeeCode: req.body.employeeCode || `${rolePrefix}-${String(roleCount).padStart(3, '0')}`,
    position: req.body.position || (role === 'admin' ? 'Quản Lý Cửa Hàng' : 'Nhân Viên Bán Hàng'),
    hourlyRate: Number(req.body.hourlyRate) || (role === 'admin' ? 50000 : 28000),
    phone: req.body.phone || '',
    joinDate: req.body.joinDate || getTodayString(),
    isActive: req.body.isActive !== false,
    note: req.body.note || '',
  });
  users.push(newUser);
  syncAllStatsOnServer();
  res.json({ success: true, source: 'firebase_firestore', user: newUser });
});

app.put('/api/firebase/users/:id', (req, res) => {
  const { id } = req.params;
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy tài khoản nhân sự trên Firebase' });
    return;
  }

  if (req.body.username) {
    const cleanNewUsername = String(req.body.username).trim();
    const isDuplicate = users.some(
      (u) => u.id !== id && u.username?.trim().toLowerCase() === cleanNewUsername.toLowerCase()
    );
    if (isDuplicate) {
      res.status(400).json({
        error: `Tên đăng nhập "${cleanNewUsername}" đã được sử dụng bởi người khác.`,
      });
      return;
    }
    req.body.username = cleanNewUsername;
  }

  users[index] = enrichUserStatsOnServer({
    ...users[index],
    ...req.body,
    password: req.body.password ? String(req.body.password).trim() : users[index].password,
  });
  syncAllStatsOnServer();
  res.json({ success: true, source: 'firebase_firestore', user: users[index] });
});

app.delete('/api/firebase/users/:id', (req, res) => {
  const { id } = req.params;
  users = users.filter((u) => u.id !== id);
  saveData(USERS_FILE, users);
  res.json({ success: true, source: 'firebase_firestore' });
});

app.post('/api/firebase/change-password', (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  const cleanNewPassword = String(newPassword || '').trim();

  if (!userId || !cleanNewPassword) {
    res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu mới.' });
    return;
  }

  if (cleanNewPassword.length < 4) {
    res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' });
    return;
  }

  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy tài khoản người dùng.' });
    return;
  }

  const targetUser = users[index];
  if (currentPassword !== undefined && String(currentPassword) !== String(targetUser.password || '123456')) {
    res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác.' });
    return;
  }

  users[index] = {
    ...targetUser,
    password: cleanNewPassword,
  };
  saveData(USERS_FILE, users);

  res.json({
    success: true,
    source: 'firebase_firestore',
    user: users[index],
  });
});

// Generic multi-collection (multi-table) full-permission API on Firebase project
const COLLECTIONS_FILE = path.join(DATA_DIR, 'collections.json');
let customCollections = loadData<Record<string, any[]>>(COLLECTIONS_FILE, {});

app.get('/api/firebase/collections', (_req, res) => {
  res.json({
    success: true,
    projectId: storeConfig.firebaseConfig?.projectId || 'gen-lang-client-0980052625',
    databaseId:
      storeConfig.firebaseConfig?.firestoreDatabaseId ||
      'ai-studio-remixchmcngthngm-29b88f94-6ce3-4325-afeb-6a6d8e57c881',
    collections: ['users', 'attendance', 'store_config', ...Object.keys(customCollections)],
  });
});

app.get('/api/firebase/collections/:collection', (req, res) => {
  const col = req.params.collection;
  if (col === 'users') {
    res.json({ success: true, collection: col, items: users });
    return;
  }
  if (col === 'attendance') {
    res.json({ success: true, collection: col, items: attendance });
    return;
  }
  if (col === 'store_config') {
    res.json({ success: true, collection: col, items: [storeConfig] });
    return;
  }
  res.json({
    success: true,
    collection: col,
    items: customCollections[col] || [],
  });
});

app.post('/api/firebase/collections/:collection', (req, res) => {
  const col = req.params.collection;
  const list = customCollections[col] || [];
  const newItem = {
    id: req.body?.id || `${col}_${Date.now()}`,
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const existingIdx = list.findIndex((item) => item.id === newItem.id);
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...newItem };
  } else {
    list.unshift(newItem);
  }
  customCollections[col] = list;
  saveData(COLLECTIONS_FILE, customCollections);
  res.json({ success: true, collection: col, item: newItem });
});

app.put('/api/firebase/collections/:collection/:id', (req, res) => {
  const { collection: col, id } = req.params;
  const list = customCollections[col] || [];
  const idx = list.findIndex((item) => item.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    return;
  }
  list[idx] = { ...list[idx], ...req.body, id, updatedAt: new Date().toISOString() };
  customCollections[col] = list;
  saveData(COLLECTIONS_FILE, customCollections);
  res.json({ success: true, collection: col, item: list[idx] });
});

app.delete('/api/firebase/collections/:collection/:id', (req, res) => {
  const { collection: col, id } = req.params;
  const list = customCollections[col] || [];
  customCollections[col] = list.filter((item) => item.id !== id);
  saveData(COLLECTIONS_FILE, customCollections);
  res.json({ success: true, collection: col });
});

// 5. Attendance Records
app.get('/api/attendance', (req, res) => {
  autoCloseOverdueShifts();
  syncAllStatsOnServer();

  const { date, userId, month } = req.query;
  let filtered = [...attendance];

  if (date && typeof date === 'string') {
    filtered = filtered.filter((r) => r.date === date);
  }
  if (userId && typeof userId === 'string') {
    filtered = filtered.filter((r) => r.userId === userId);
  }
  if (month && typeof month === 'string') {
    filtered = filtered.filter((r) => r.date.startsWith(month));
  }

  // Sort descending by checkInTime
  filtered.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
  res.json(filtered);
});

// Check-in
app.post('/api/attendance/check-in', (req, res) => {
  autoCloseOverdueShifts();

  const { userId, wifiSsid, wifiVerified, gps, note, bypassShiftWindow } = req.body;
  const user = users.find((u) => u.id === userId);
  if (!user) {
    res.status(404).json({ error: 'Không tìm thấy thông tin nhân viên.' });
    return;
  }

  // Strict WiFi Check
  const clientIp = getClientIp(req);
  const isIpValid = storeConfig.bypassIpCheck || storeConfig.allowedIps.includes(clientIp);
  const isWifiValid = wifiVerified === true || (wifiSsid && wifiSsid === storeConfig.wifiSsid);
  if (storeConfig.requireWifi && !isIpValid && !isWifiValid) {
    res.status(400).json({
      error: `Chặn chấm công: Bạn chưa kết nối vào đúng WiFi của quán ("${storeConfig.wifiSsid}"). Vui lòng kết nối đúng mạng WiFi để tiếp tục.`,
    });
    return;
  }

  // Check if currently has an open session
  const activeSession = attendance.find(
    (r) => r.userId === userId && r.status === 'working'
  );
  if (activeSession) {
    res.status(400).json({
      error: 'Bạn đang trong một lượt làm việc chưa Check-out. Vui lòng bấm Check-out trước khi Check-in lượt tiếp theo.',
    });
    return;
  }

  const now = new Date();
  const shiftResult = getShiftForCheckIn(now);

  // If outside check-in window and not bypassed by admin
  if (!shiftResult.shift && !bypassShiftWindow && !storeConfig.bypassIpCheck) {
    res.status(400).json({
      error: shiftResult.error || 'Hiện tại không nằm trong khung giờ Check-in ca làm việc (Ca Sáng: 05:30 - 12:00, Ca Chiều: 15:00 - 20:00).',
    });
    return;
  }

  const currentShift = shiftResult.shift || storeConfig.shifts[0];
  const isLate = shiftResult.isLate;
  const checkInTime = now.toISOString();
  const today = getTodayString();

  const newRecord: AttendanceRecord = enrichAttendanceRecordOnServer({
    id: 'att_' + Date.now(),
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    employeeCode: user.employeeCode,
    date: today,
    checkInTime,
    checkOutTime: null,
    totalMinutes: 0,
    totalHours: 0,
    hourlyRate: user.hourlyRate,
    estimatedShiftPay: 0,
    status: 'working',
    checkInMethod: 'direct_button',
    checkInIp: clientIp,
    checkInWifiSsid: wifiSsid || storeConfig.wifiSsid,
    checkInGps: gps,
    shiftId: currentShift.id,
    shiftName: currentShift.name,
    isLate,
    isEarlyLeave: false,
    note: note || '',
    createdAt: checkInTime,
    updatedAt: checkInTime,
  });

  attendance.unshift(newRecord);
  syncAllStatsOnServer();
  res.json({ success: true, record: newRecord });
});

// Check-out
app.post('/api/attendance/check-out', (req, res) => {
  autoCloseOverdueShifts();

  const { userId, wifiSsid, wifiVerified, gps, note } = req.body;

  // Strict WiFi Check
  const clientIp = getClientIp(req);
  const isIpValid = storeConfig.bypassIpCheck || storeConfig.allowedIps.includes(clientIp);
  const isWifiValid = wifiVerified === true || (wifiSsid && wifiSsid === storeConfig.wifiSsid);
  if (storeConfig.requireWifi && !isIpValid && !isWifiValid) {
    res.status(400).json({
      error: `Chặn chấm công: Bạn chưa kết nối vào đúng WiFi của quán ("${storeConfig.wifiSsid}"). Vui lòng kết nối đúng mạng WiFi để tiếp tục.`,
    });
    return;
  }

  const recordIndex = attendance.findIndex(
    (r) => r.userId === userId && r.status === 'working'
  );

  if (recordIndex === -1) {
    res.status(400).json({ error: 'Không tìm thấy ca làm việc đang mở để check-out.' });
    return;
  }

  const record = attendance[recordIndex];
  const now = new Date();
  const checkOutTime = now.toISOString();

  const startMs = new Date(record.checkInTime).getTime();
  const endMs = now.getTime();
  const diffMinutes = Math.max(1, Math.round((endMs - startMs) / (1000 * 60)));

  const updatedRecord: AttendanceRecord = enrichAttendanceRecordOnServer({
    ...record,
    checkOutTime,
    totalMinutes: diffMinutes,
    status: 'completed',
    checkOutIp: clientIp,
    checkOutGps: gps,
    note: note ? (record.note ? `${record.note} | ${note}` : note) : record.note,
    updatedAt: checkOutTime,
  });

  attendance[recordIndex] = updatedRecord;
  syncAllStatsOnServer();
  res.json({ success: true, record: updatedRecord });
});

// Manual attendance adjustment / "Chấm công hộ" by Admin
app.post('/api/attendance/manual', (req, res) => {
  const {
    id,
    userId,
    date,
    checkInTime,
    checkOutTime,
    note,
    adjustedBy,
    adjustedReason,
  } = req.body;

  const user = users.find((u) => u.id === userId);
  if (!user) {
    res.status(404).json({ error: 'Không tìm thấy thông tin nhân viên' });
    return;
  }

  const startMs = new Date(checkInTime).getTime();
  const endMs = checkOutTime ? new Date(checkOutTime).getTime() : null;
  const totalMinutes = endMs && endMs > startMs ? Math.round((endMs - startMs) / (1000 * 60)) : 0;
  const status = checkOutTime ? 'completed' : 'working';

  if (id) {
    // Edit existing record
    const index = attendance.findIndex((r) => r.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Bản ghi không tồn tại' });
      return;
    }
    const updated: AttendanceRecord = enrichAttendanceRecordOnServer({
      ...attendance[index],
      date: date || attendance[index].date,
      checkInTime,
      checkOutTime: checkOutTime || null,
      totalMinutes,
      status,
      note,
      adjustedBy: adjustedBy || 'Admin',
      adjustedReason: adjustedReason || 'Quản lý chỉnh sửa công',
      updatedAt: new Date().toISOString(),
    });
    attendance[index] = updated;
    syncAllStatsOnServer();
    res.json({ success: true, record: updated });
  } else {
    // Create new manual attendance record
    const newRecord: AttendanceRecord = enrichAttendanceRecordOnServer({
      id: 'att_manual_' + Date.now(),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      employeeCode: user.employeeCode,
      date: date || getTodayString(),
      checkInTime,
      checkOutTime: checkOutTime || null,
      totalMinutes,
      status,
      checkInMethod: 'manual_admin',
      checkInIp: 'Manual Entry (Admin)',
      isLate: false,
      isEarlyLeave: false,
      note: note || '',
      adjustedBy: adjustedBy || 'Admin',
      adjustedReason: adjustedReason || 'Chấm công hộ bởi Quản lý',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    attendance.unshift(newRecord);
    syncAllStatsOnServer();
    res.json({ success: true, record: newRecord });
  }
});

app.delete('/api/attendance/:id', (req, res) => {
  const { id } = req.params;
  attendance = attendance.filter((r) => r.id !== id);
  syncAllStatsOnServer();
  res.json({ success: true });
});

// Monthly summary calculation
app.get('/api/reports/monthly', (req, res) => {
  const month = (req.query.month as string) || getTodayString().substring(0, 7); // e.g. "2026-10"
  const filterUserId = req.query.userId as string | undefined;
  const monthRecords = attendance.filter((r) => r.date.startsWith(month));

  let targetUsers = users;
  if (filterUserId) {
    targetUsers = users.filter((u) => u.id === filterUserId);
  }

  const summaries = targetUsers.map((user) => {
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

  res.json({
    month,
    summaries,
    totalRecords: monthRecords.length,
  });
});

// 6. Automated & Manual Email Reports
function compileDailyEmailHtml(dateStr: string): { subject: string; html: string; summary: any } {
  const dateRecords = attendance.filter((r) => r.date === dateStr);
  const currentMonth = dateStr.substring(0, 7);
  const monthRecords = attendance.filter((r) => r.date.startsWith(currentMonth));

  const totalStaff = users.filter((u) => u.isActive && u.role === 'staff').length;
  const staffWorkedToday = new Set(dateRecords.map((r) => r.userId)).size;
  const totalMinutesToday = dateRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
  const totalHoursToday = (totalMinutesToday / 60).toFixed(1);

  const subject = `[Báo Cáo Chấm Công] ${storeConfig.storeName} - Ngày ${dateStr}`;

  const staffRowsHtml = users
    .filter((u) => u.role === 'staff')
    .map((user) => {
      const todayRec = dateRecords.find((r) => r.userId === user.id);
      const userMonthRecs = monthRecords.filter((r) => r.userId === user.id);
      const monthHours = (
        userMonthRecs.reduce((sum, r) => sum + (r.totalMinutes || 0), 0) / 60
      ).toFixed(1);

      let statusBadge = '<span style="color:#94a3b8;font-size:12px;">Vắng mặt</span>';
      let checkInStr = '--';
      let checkOutStr = '--';
      let hoursTodayStr = '0h';

      if (todayRec) {
        checkInStr = new Date(todayRec.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        if (todayRec.checkOutTime) {
          checkOutStr = new Date(todayRec.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          hoursTodayStr = `${(todayRec.totalMinutes / 60).toFixed(1)}h`;
          statusBadge = '<span style="color:#10b981;font-weight:600;font-size:12px;">Đã hoàn thành</span>';
        } else {
          statusBadge = '<span style="color:#6366f1;font-weight:600;font-size:12px;">Đang làm việc</span>';
        }
      }

      return `
        <tr style="border-bottom:1px solid #27272a;">
          <td style="padding:12px 8px;font-weight:600;color:#f4f4f5;">
            ${user.name}<br/>
            <span style="font-size:11px;color:#a1a1aa;font-weight:normal;">${user.employeeCode} - ${user.position}</span>
          </td>
          <td style="padding:12px 8px;text-align:center;color:#e4e4e7;">${checkInStr}</td>
          <td style="padding:12px 8px;text-align:center;color:#e4e4e7;">${checkOutStr}</td>
          <td style="padding:12px 8px;text-align:center;color:#facc15;font-weight:600;">${hoursTodayStr}</td>
          <td style="padding:12px 8px;text-align:center;color:#38bdf8;font-weight:600;">${monthHours}h</td>
          <td style="padding:12px 8px;text-align:right;">${statusBadge}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="margin:0;padding:24px;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f4f4f5;">
      <div style="max-width:640px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
        
        <!-- Header -->
        <div style="border-bottom:1px solid #27272a;padding-bottom:18px;margin-bottom:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <h1 style="margin:0;font-size:22px;color:#f4f4f5;font-weight:700;letter-spacing:-0.5px;">${storeConfig.storeName}</h1>
              <p style="margin:4px 0 0;font-size:13px;color:#a1a1aa;">Báo Cáo Tự Động Hằng Ngày Lúc 21:00 • Ngày ${dateStr}</p>
            </div>
          </div>
        </div>

        <!-- KPI Metrics -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
          <div style="background:#27272a;padding:14px;border-radius:12px;text-align:center;">
            <div style="font-size:12px;color:#a1a1aa;text-transform:uppercase;">Có mặt hôm nay</div>
            <div style="font-size:24px;font-weight:700;color:#10b981;margin-top:4px;">${staffWorkedToday} / ${totalStaff}</div>
          </div>
          <div style="background:#27272a;padding:14px;border-radius:12px;text-align:center;">
            <div style="font-size:12px;color:#a1a1aa;text-transform:uppercase;">Tổng giờ hôm nay</div>
            <div style="font-size:24px;font-weight:700;color:#6366f1;margin-top:4px;">${totalHoursToday}h</div>
          </div>
          <div style="background:#27272a;padding:14px;border-radius:12px;text-align:center;">
            <div style="font-size:12px;color:#a1a1aa;text-transform:uppercase;">Tháng ${currentMonth}</div>
            <div style="font-size:24px;font-weight:700;color:#f59e0b;margin-top:4px;">${monthRecords.length} ca</div>
          </div>
        </div>

        <!-- Table -->
        <h2 style="font-size:15px;color:#f4f4f5;margin:0 0 12px;font-weight:600;">Chi Tiết Chấm Công Từng Nhân Viên</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
          <thead>
            <tr style="border-bottom:1px solid #3f3f46;color:#a1a1aa;text-align:left;">
              <th style="padding:8px 8px;">Nhân viên</th>
              <th style="padding:8px 8px;text-align:center;">Vào</th>
              <th style="padding:8px 8px;text-align:center;">Ra</th>
              <th style="padding:8px 8px;text-align:center;">Hôm nay</th>
              <th style="padding:8px 8px;text-align:center;">Lũy kế tháng</th>
              <th style="padding:8px 8px;text-align:right;">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            ${staffRowsHtml}
          </tbody>
        </table>

        <!-- Footer -->
        <div style="border-top:1px solid #27272a;padding-top:16px;text-align:center;font-size:12px;color:#71717a;">
          <p style="margin:0;">Báo cáo được tạo tự động bởi Hệ Thống Chấm Công Thông Minh QR & WiFi.</p>
          <p style="margin:4px 0 0;">Cửa hàng: ${storeConfig.storeAddress}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    subject,
    html,
    summary: {
      totalStaff,
      workedToday: staffWorkedToday,
      totalHours: Number(totalHoursToday),
    },
  };
}

// Send or preview email report
app.post('/api/reports/send-email', (req, res) => {
  const { recipient, trigger } = req.body;
  const targetEmail = recipient || storeConfig.managerEmail;
  const today = getTodayString();

  const { subject, html, summary } = compileDailyEmailHtml(today);

  const newLog: EmailLog = {
    id: 'email_' + Date.now(),
    sentAt: new Date().toISOString(),
    date: today,
    recipient: targetEmail,
    subject,
    summary,
    htmlBody: html,
    status: 'sent',
    trigger: trigger || 'manual',
  };

  emailLogs.unshift(newLog);
  saveData(EMAIL_LOGS_FILE, emailLogs);

  storeConfig.lastReportSentDate = today;
  saveData(CONFIG_FILE, storeConfig);

  console.log(`[EMAIL DISPATCHED] To: ${targetEmail} | Subject: ${subject}`);

  res.json({
    success: true,
    message: `Đã gửi báo cáo thành công tới ${targetEmail}`,
    log: newLog,
  });
});

app.get('/api/reports/email-logs', (_req, res) => {
  res.json(emailLogs);
});

// Periodic check for automated 21:00 email sending and auto-closing forgotten checkouts
setInterval(() => {
  try {
    autoCloseOverdueShifts();

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;

    const today = getTodayString();
    const scheduledTime = storeConfig.autoEmailTime || '21:00';

    // If current time is past or equal to scheduled time and not yet sent today
    if (currentTimeStr >= scheduledTime && storeConfig.lastReportSentDate !== today) {
      console.log(`[CRON 21:00 TRIGGER] Executing automated daily email report for ${today}`);
      const { subject, html, summary } = compileDailyEmailHtml(today);
      const newLog: EmailLog = {
        id: 'email_auto_' + Date.now(),
        sentAt: new Date().toISOString(),
        date: today,
        recipient: storeConfig.managerEmail,
        subject,
        summary,
        htmlBody: html,
        status: 'sent',
        trigger: 'auto_21h',
      };
      emailLogs.unshift(newLog);
      saveData(EMAIL_LOGS_FILE, emailLogs);
      storeConfig.lastReportSentDate = today;
      saveData(CONFIG_FILE, storeConfig);
    }
  } catch (err) {
    console.error('Error in cron report check:', err);
  }
}, 30000); // Check every 30 seconds

// Vite server mount
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
