/**
 * SERVER STORAGE: json-repository
 * Quản lý đọc/ghi các file JSON trong thư mục data/ một cách an toàn và nhất quán (SRP)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { User, AttendanceRecord, StoreConfig, EmailLog } from '../../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// data/ nằm ở thư mục gốc của dự án
export const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const CONFIG_FILE = path.join(DATA_DIR, 'store_config.json');
export const USERS_FILE = path.join(DATA_DIR, 'users.json');
export const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
export const EMAIL_LOGS_FILE = path.join(DATA_DIR, 'email_logs.json');
export const COLLECTIONS_FILE = path.join(DATA_DIR, 'collections.json');

export const DEFAULT_CONFIG: StoreConfig = {
  storeName: 'Cháo Mầm Nhỏ Thái Thịnh',
  storeAddress: 'Thái Thịnh, Đống Đa, Hà Nội',
  wifiSsid: 'ChaoMamNho_ThaiThinh_5G',
  allowedIps: ['127.0.0.1', '::1', '14.161.45.88', '118.69.182.20'],
  bypassIpCheck: false,
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
};

export const DEFAULT_USERS: User[] = [
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

export function loadData<T>(filePath: string, fallback: T): T {
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

export function saveData<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error saving file ${filePath}:`, err);
  }
}

// In-memory data store
let storeConfig: StoreConfig = loadData<StoreConfig>(CONFIG_FILE, DEFAULT_CONFIG);
let users: User[] = loadData<User[]>(USERS_FILE, DEFAULT_USERS);
let attendance: AttendanceRecord[] = loadData<AttendanceRecord[]>(ATTENDANCE_FILE, []);
let emailLogs: EmailLog[] = loadData<EmailLog[]>(EMAIL_LOGS_FILE, []);
let customCollections: Record<string, any[]> = loadData<Record<string, any[]>>(COLLECTIONS_FILE, {});

export const db = {
  getConfig: () => storeConfig,
  setConfig: (cfg: StoreConfig) => {
    storeConfig = cfg;
    saveData(CONFIG_FILE, storeConfig);
    return storeConfig;
  },

  getUsers: () => users,
  setUsers: (uList: User[]) => {
    users = uList;
    saveData(USERS_FILE, users);
    return users;
  },

  getAttendance: () => attendance,
  setAttendance: (attList: AttendanceRecord[]) => {
    attendance = attList;
    saveData(ATTENDANCE_FILE, attendance);
    return attendance;
  },

  getEmailLogs: () => emailLogs,
  setEmailLogs: (logs: EmailLog[]) => {
    emailLogs = logs;
    saveData(EMAIL_LOGS_FILE, emailLogs);
    return emailLogs;
  },

  getCollections: () => customCollections,
  setCollections: (cols: Record<string, any[]>) => {
    customCollections = cols;
    saveData(COLLECTIONS_FILE, customCollections);
    return customCollections;
  },
};

export function ensureUsersHaveCredentials(): void {
  let modified = false;
  const currentUsers = db.getUsers();

  const ptcongAdmin = currentUsers.find(
    (u) => u.username?.toLowerCase() === 'ptcong' || u.id === 'user_admin_1'
  );
  if (!ptcongAdmin) {
    currentUsers.unshift(DEFAULT_USERS[0]);
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

  currentUsers.forEach((u, idx) => {
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
    db.setUsers(currentUsers);
  }
}
