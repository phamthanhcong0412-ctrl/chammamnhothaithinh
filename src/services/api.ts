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
  deduplicateAndMergeOverlappingTurns,
} from '../firebase.ts';
import firebaseAppletConfig from '../../firebase-applet-config.json';

const API_BASE = '/api';

const STORAGE_KEYS = {
  CONFIG: 'chammam_store_config_v2',
  USERS: 'chammam_users_v2',
  ATTENDANCE: 'chammam_attendance_v2',
  EMAIL_LOGS: 'chammam_email_logs_v2',
};

// Clean up legacy v1 local cache so removed local sample accounts never reappear
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('chammam_users_v1');
    window.localStorage.removeItem('chammam_attendance_v1');
  }
} catch {}

const DEFAULT_CONFIG: StoreConfig = {
  storeName: 'Cháo Mầm Nhỏ Thái Thịnh',
  storeAddress: 'Thái Thịnh, Đống Đa, Hà Nội',
  wifiSsid: 'ChaoMamNho_ThaiThinh_5G',
  wifiBssid: 'A4:2B:B0:C1:9E:58',
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

function parseHmToMins(timeStr: string, fallback: number): number {
  const parts = String(timeStr || '').split(':');
  if (parts.length !== 2) return fallback;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallback;
  return h * 60 + m;
}

export function evaluateShiftTiming(
  checkInIso: string,
  checkOutIso?: string | null,
  cfg?: StoreConfig | null
) {
  const activeCfg = cfg || loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const inDate = new Date(checkInIso);
  const inMins = inDate.getHours() * 60 + inDate.getMinutes();
  const isAfternoon = inMins >= 14 * 60;
  const shift =
    activeCfg.shifts?.find((s) => s.id === (isAfternoon ? 'shift_afternoon' : 'shift_morning')) ||
    activeCfg.shifts?.[0];

  const shiftId = shift?.id || (isAfternoon ? 'shift_afternoon' : 'shift_morning');
  const shiftName = shift?.name || (isAfternoon ? 'Ca Chiều (15:30 - 20:00)' : 'Ca Sáng (06:00 - 12:00)');
  const shiftStartMins = parseHmToMins(
    shift?.startTime || (isAfternoon ? '15:30' : '06:00'),
    isAfternoon ? 15 * 60 + 30 : 6 * 60
  );
  const shiftEndMins = parseHmToMins(
    shift?.endTime || (isAfternoon ? '20:00' : '12:00'),
    isAfternoon ? 20 * 60 : 12 * 60
  );
  const checkOutAfterMinutes = shift?.checkOutAfterMinutes ?? 90;

  // Store does NOT track or penalize late arrival / early leave
  return {
    shiftId,
    shiftName,
    isLate: false,
    lateMinutes: 0,
    isEarlyLeave: false,
    earlyLeaveMinutes: 0,
    shiftStartMins,
    shiftEndMins,
    checkOutAfterMinutes,
  };
}

export function consolidateCompletedShifts(
  records: AttendanceRecord[],
  users: User[]
): { consolidated: AttendanceRecord[]; removedIds: string[]; updatedRecords: AttendanceRecord[] } {
  const cfg = loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const todayStr = getTodayString();
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const rawWorking: AttendanceRecord[] = [];
  const completedByShift = new Map<string, AttendanceRecord[]>();
  const updatedRecords: AttendanceRecord[] = [];
  const removedIds: string[] = [];
  const seenIds = new Set<string>();

  for (const rawRec of records) {
    if (!rawRec || !rawRec.id) continue;
    if (seenIds.has(rawRec.id)) continue;
    seenIds.add(rawRec.id);

    let r: AttendanceRecord = {
      ...rawRec,
      isLate: false,
      isEarlyLeave: false,
    };
    if (r.status === 'working') {
      const timing = evaluateShiftTiming(r.checkInTime, null, cfg);
      const inDate = new Date(r.checkInTime);
      const inMins = inDate.getHours() * 60 + inDate.getMinutes();
      const isPastDay = r.date < todayStr;
      const isOverdueToday =
        r.date === todayStr &&
        inMins <= timing.shiftEndMins &&
        nowMins > timing.shiftEndMins + timing.checkOutAfterMinutes;

      if (isPastDay || isOverdueToday) {
        // Auto-close forgotten shift at official shift end time
        const autoOutDate = new Date(inDate);
        autoOutDate.setHours(Math.floor(timing.shiftEndMins / 60), timing.shiftEndMins % 60, 0, 0);
        const finalOutMs =
          autoOutDate.getTime() > inDate.getTime()
            ? autoOutDate.getTime()
            : inDate.getTime() + 60 * 1000;
        const autoOutIso = new Date(finalOutMs).toISOString();
        const autoMins = Math.max(1, Math.round((finalOutMs - inDate.getTime()) / 60000));
        r = enrichAttendanceRecord(
          {
            ...r,
            checkOutTime: autoOutIso,
            totalMinutes: autoMins,
            status: 'completed',
            shiftId: timing.shiftId,
            shiftName: timing.shiftName,
            isLate: false,
            isEarlyLeave: false,
            note: r.note ? `${r.note} • Tự chốt cuối ca` : 'Tự chốt cuối ca (Quên check-out)',
            updatedAt: new Date().toISOString(),
          },
          users
        );
        updatedRecords.push(r);
      } else {
        rawWorking.push(enrichAttendanceRecord(r, users));
        continue;
      }
    }

    const shiftId =
      r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning');
    const key = `${r.userId}_${r.date}_${shiftId}`;
    const list = completedByShift.get(key) || [];
    list.push(r);
    completedByShift.set(key, list);
  }

  const consolidatedCompleted: AttendanceRecord[] = [];

  for (const [, group] of completedByShift.entries()) {
    // Sort chronologically so earliest check-in is first
    const sorted = [...group].sort(
      (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
    );
    const base = sorted[0];

    // Collect all individual turns across records in this shift and merge any overlapping/duplicate timestamps
    const rawTurns: { checkInTime: string; checkOutTime: string | null; minutes: number; note?: string }[] = [];
    for (const item of sorted) {
      const itemTurns =
        Array.isArray(item.turns) && item.turns.length > 0
          ? item.turns
          : [
              {
                checkInTime: item.checkInTime,
                checkOutTime: item.checkOutTime,
                minutes: Number(item.totalMinutes) || 0,
                note: item.note || '',
              },
            ];
      for (const t of itemTurns) {
        rawTurns.push({
          checkInTime: t.checkInTime,
          checkOutTime: t.checkOutTime || null,
          minutes: Number(t.minutes) || 0,
          note: t.note || '',
        });
      }
    }

    const mergedTurns = deduplicateAndMergeOverlappingTurns(rawTurns);
    const totalMinutes = mergedTurns.reduce((sum, t) => sum + (Number(t.minutes) || 0), 0);

    let latestCheckOut = base.checkOutTime || null;
    for (const t of mergedTurns) {
      if (
        t.checkOutTime &&
        (!latestCheckOut || new Date(t.checkOutTime).getTime() > new Date(latestCheckOut).getTime())
      ) {
        latestCheckOut = t.checkOutTime;
      }
    }

    const earliestCheckIn = mergedTurns[0]?.checkInTime || base.checkInTime;
    const timing = evaluateShiftTiming(earliestCheckIn, latestCheckOut, cfg);

    const merged = enrichAttendanceRecord(
      {
        ...base,
        checkInTime: earliestCheckIn,
        checkOutTime: latestCheckOut,
        totalMinutes,
        turns: mergedTurns,
        shiftId: timing.shiftId,
        shiftName: timing.shiftName,
        isLate: false,
        isEarlyLeave: false,
        updatedAt: new Date().toISOString(),
      },
      users
    );

    consolidatedCompleted.push(merged);
    if (sorted.length > 1 || (Array.isArray(base.turns) && base.turns.length !== mergedTurns.length)) {
      updatedRecords.push(merged);
    }
    for (let i = 1; i < sorted.length; i++) {
      removedIds.push(sorted[i].id);
    }
  }

  // Deduplicate active `working` records:
  // 1. Discard any `working` record whose checkInTime was ALREADY covered by a completed shift on the same day
  // 2. Enforce strictly AT MOST 1 active `working` record per userId at any time
  const workingByUser = new Map<string, AttendanceRecord[]>();
  for (const w of rawWorking) {
    const wInMs = new Date(w.checkInTime).getTime();
    const alreadyCoveredByCompleted = consolidatedCompleted.some((comp) => {
      if (comp.userId !== w.userId || comp.date !== w.date) return false;
      const compOutMs = comp.checkOutTime ? new Date(comp.checkOutTime).getTime() : 0;
      return compOutMs > 0 && wInMs <= compOutMs + 60000;
    });

    if (alreadyCoveredByCompleted) {
      removedIds.push(w.id);
      continue;
    }

    const list = workingByUser.get(w.userId) || [];
    list.push(w);
    workingByUser.set(w.userId, list);
  }

  const working: AttendanceRecord[] = [];
  for (const [, userWorkingList] of workingByUser.entries()) {
    const sortedW = [...userWorkingList].sort(
      (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
    );
    working.push(sortedW[0]);
    for (let i = 1; i < sortedW.length; i++) {
      removedIds.push(sortedW[i].id);
    }
  }

  const all = [...working, ...consolidatedCompleted].sort(
    (a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
  );

  return { consolidated: all, removedIds, updatedRecords };
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

let cachedPublicIp: { ip: string; fetchedAt: number } | null = null;
const activeCheckActionLocks = new Set<string>();

async function detectClientPublicIp(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedPublicIp && Date.now() - cachedPublicIp.fetchedAt < 300000) {
    return cachedPublicIp.ip;
  }

  // 1. Try fast public IP endpoints directly from browser so Vercel & AI Studio get the real WiFi router IP
  const endpoints = [
    'https://api.ipify.org?format=json',
    'https://api64.ipify.org?format=json',
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data?.ip && typeof data.ip === 'string') {
          const cleanIp = data.ip.trim();
          cachedPublicIp = { ip: cleanIp, fetchedAt: Date.now() };
          return cleanIp;
        }
      }
    } catch {}
  }

  // 2. Fallback to Cloudflare trace
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/^ip=(.+)$/m);
      if (match && match[1]) {
        const cleanIp = match[1].trim();
        cachedPublicIp = { ip: cleanIp, fetchedAt: Date.now() };
        return cleanIp;
      }
    }
  } catch {}

  // 3. Fallback to backend /api/network-info
  try {
    const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/network-info`);
    if (ok && data?.clientIp) {
      cachedPublicIp = { ip: String(data.clientIp).trim(), fetchedAt: Date.now() };
      return cachedPublicIp.ip;
    }
  } catch {}

  return cachedPublicIp?.ip || '14.161.45.88';
}

export function isTimeInConfiguredShifts(nowDate: Date, cfg: StoreConfig): {
  inShiftWindow: boolean;
  allowedRangesText: string;
} {
  const nowMins = nowDate.getHours() * 60 + nowDate.getMinutes();
  const shifts = Array.isArray(cfg.shifts) && cfg.shifts.length > 0 ? cfg.shifts : DEFAULT_CONFIG.shifts;

  const ranges: string[] = [];
  let matched = false;

  for (const s of shifts) {
    const startMins = parseHmToMins(s.startTime, 6 * 60);
    const endMins = parseHmToMins(s.endTime, 12 * 60);
    const before = Number(s.checkInBeforeMinutes ?? 30);
    const after = Number(s.checkOutAfterMinutes ?? 90);
    const winStart = startMins - before;
    const winEnd = endMins + after;

    const fmt = (m: number) => {
      const norm = ((m % 1440) + 1440) % 1440;
      return `${String(Math.floor(norm / 60)).padStart(2, '0')}:${String(norm % 60).padStart(2, '0')}`;
    };
    ranges.push(`${s.name.split('(')[0].trim()} (${fmt(winStart)} - ${fmt(winEnd)})`);

    if (nowMins >= winStart && nowMins <= winEnd) {
      matched = true;
    }
  }

  return {
    inShiftWindow: matched,
    allowedRangesText: ranges.join(', '),
  };
}

export function isClientIpAllowedByConfig(clientIp: string, cfg: StoreConfig): boolean {
  if (!cfg.requireWifi) return true;
  if (cfg.bypassIpCheck) return true;
  const cleanClient = String(clientIp || '').trim();
  if (!cleanClient) return false;
  const allowedList = Array.isArray(cfg.allowedIps)
    ? cfg.allowedIps.map((ip) => String(ip).trim()).filter(Boolean)
    : [];
  return allowedList.includes(cleanClient);
}

export function deriveBssidFromNetworkIp(ip: string): string {
  const parts = String(ip || '14.161.45.88')
    .split('.')
    .map((n) => {
      const parsed = parseInt(n, 10);
      return Number.isNaN(parsed) ? 88 : parsed & 0xff;
    });
  while (parts.length < 4) parts.push(161);
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
  return `A4:2B:${hex(parts[0])}:${hex(parts[1])}:${hex(parts[2])}:${hex(parts[3])}`;
}

export function calculateGpsDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export const api = {
  // Network & IP
  async getNetworkInfo(forceRefresh = false): Promise<NetworkInfo> {
    const [clientIp, cfg] = await Promise.all([
      detectClientPublicIp(forceRefresh),
      this.getConfig().catch(() => loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG)),
    ]);

    const isAllowedIp = isClientIpAllowedByConfig(clientIp, cfg);

    return {
      clientIp,
      isAllowedIp,
      timestamp: Date.now(),
    };
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

  // Store Config (PRIMARY SOURCE OF TRUTH: Live Firebase Firestore `store_config/main_store`)
  async getConfig(): Promise<StoreConfig> {
    let baseConfig = loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    try {
      const fbCfg = await fetchStoreConfigFromFirestore();
      if (fbCfg) {
        baseConfig = {
          ...baseConfig,
          ...fbCfg,
          allowedIps:
            Array.isArray(fbCfg.allowedIps) && fbCfg.allowedIps.length > 0
              ? fbCfg.allowedIps
              : baseConfig.allowedIps,
          shifts:
            Array.isArray(fbCfg.shifts) && fbCfg.shifts.length > 0
              ? fbCfg.shifts
              : baseConfig.shifts,
          firebaseConfig: DEFAULT_CONFIG.firebaseConfig,
        };
        saveLocal(STORAGE_KEYS.CONFIG, baseConfig);
        return baseConfig;
      } else {
        // Seed initial store_config document to Firebase Firestore if not yet created
        saveStoreConfigToFirestore(baseConfig).catch(() => {});
      }
    } catch (e) {
      console.warn('Firestore getConfig warning:', e);
    }

    try {
      const apiRes = await fetchJsonOrThrow(`${API_BASE}/config`);
      if (apiRes?.ok && apiRes.data) {
        baseConfig = {
          ...baseConfig,
          ...apiRes.data,
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
      allowedIps: Array.isArray(config.allowedIps)
        ? Array.from(new Set(config.allowedIps.map((ip) => String(ip).trim()).filter(Boolean)))
        : current.allowedIps,
      shifts: Array.isArray(config.shifts) ? config.shifts : current.shifts,
      firebaseConfig: DEFAULT_CONFIG.firebaseConfig,
    };

    // 1. Save directly to live Firebase Firestore table `store_config/main_store` FIRST
    await saveStoreConfigToFirestore(updated);

    // 2. Save to localStorage & backend API
    saveLocal(STORAGE_KEYS.CONFIG, updated);
    fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});

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
    // 1. Primary: Read directly from live Firebase Firestore so Machine B always gets accounts & stats from Machine A
    try {
      const firestoreList = await fetchUsersFromFirestore();
      if (firestoreList.length > 0) {
        saveLocal(STORAGE_KEYS.USERS, firestoreList);
        return firestoreList;
      }
    } catch (e) {
      console.warn('Firestore direct getUsers warning:', e);
    }

    const localAtt = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
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
        const { consolidated, removedIds, updatedRecords } = consolidateCompletedShifts(fbAtt, localUsers);
        if (removedIds.length > 0) {
          // Clean up duplicate same-shift records in Firestore in background
          Promise.all([
            ...updatedRecords.map((r) => saveAttendanceToFirestore(r, localUsers, 'update').catch(() => {})),
            ...removedIds.map((id) => deleteAttendanceFromFirestore(id).catch(() => {})),
          ]);
        }
        let list = consolidated;
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
      const rawList = Array.isArray(data) ? data : [];
      const { consolidated: enriched } = consolidateCompletedShifts(rawList, localUsers);
      if (!params) {
        saveLocal(STORAGE_KEYS.ATTENDANCE, enriched);
        for (const r of enriched) {
          saveAttendanceToFirestore(r, localUsers).catch(() => {});
        }
      }
      return enriched;
    } catch {
      const rawLocal = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      let { consolidated: list } = consolidateCompletedShifts(rawLocal, localUsers);
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
    const lockKey = `check_${payload.userId}`;
    if (activeCheckActionLocks.has(lockKey)) {
      throw new Error('Hệ thống đang xử lý thao tác chấm công của bạn, vui lòng không bấm lặp lại.');
    }
    activeCheckActionLocks.add(lockKey);

    try {
      let users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      let user = users.find((u) => u.id === payload.userId);
      if (!user) {
        try {
          const fbUsers = await fetchUsersFromFirestore();
          if (fbUsers.length > 0) {
            users = fbUsers;
            user = users.find((u) => u.id === payload.userId);
          }
        } catch {}
      }
      if (!user) throw new Error('Không tìm thấy thông tin nhân viên trên Firebase.');

      const rawAttendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      const { consolidated: attendance } = consolidateCompletedShifts(rawAttendance, users);

      if (attendance.some((r) => r.userId === payload.userId && r.status === 'working')) {
        throw new Error('Bạn đang trong một lượt làm việc chưa Check-out, không thể Check-in trùng lặp.');
      }

      // Use cached storeConfig & cached clientIp for instant check-in (<100ms)
      const cfg = loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
      const clientIp = await detectClientPublicIp(false);

      if (!isClientIpAllowedByConfig(clientIp, cfg)) {
        throw new Error(
          `Chặn chấm công: Thiết bị hiện tại không kết nối đúng mạng WiFi "${cfg.wifiSsid}" (BSSID: ${cfg.wifiBssid || 'A4:2B:B0:C1:9E:58'}) tại cửa hàng.`
        );
      }

      if (cfg.requireGps && cfg.storeGps) {
        if (!payload.gps || typeof payload.gps.lat !== 'number' || typeof payload.gps.lng !== 'number') {
          throw new Error(
            'Chặn chấm công (Khóa Kép Vị Trí): Vui lòng bật quyền Định vị (GPS) trên trình duyệt để xác nhận đang có mặt tại quán.'
          );
        }
        const dist = calculateGpsDistanceMeters(
          payload.gps.lat,
          payload.gps.lng,
          cfg.storeGps.lat,
          cfg.storeGps.lng
        );
        const maxRadius = cfg.storeGps.radiusMeters || 80;
        if (dist > maxRadius) {
          throw new Error(
            `Chặn chấm công (Khóa Kép Vị Trí): Bạn đang cách cửa hàng ${dist}m (vượt quá bán kính cho phép ${maxRadius}m).`
          );
        }
      }

      const now = new Date();
      const shiftCheck = isTimeInConfiguredShifts(now, cfg);
      if (!shiftCheck.inShiftWindow) {
        throw new Error(
          `Chặn chấm công: Hiện tại đang ngoài khung giờ ca làm việc đã cấu hình (${shiftCheck.allowedRangesText}).`
        );
      }

      // Prevent duplicate check-in at the exact same minute as an already completed turn
      const todayStr = getTodayString();
      const nowMs = now.getTime();
      const hasDuplicateSameTimestamp = attendance.some((r) => {
        if (r.userId !== payload.userId || r.date !== todayStr) return false;
        const inDiff = Math.abs(nowMs - new Date(r.checkInTime).getTime());
        const outDiff = r.checkOutTime ? Math.abs(nowMs - new Date(r.checkOutTime).getTime()) : Infinity;
        return inDiff < 15000 || outDiff < 5000;
      });
      if (hasDuplicateSameTimestamp) {
        throw new Error('Bạn vừa thao tác chấm công cách đây vài giây, vui lòng không bấm liên tục.');
      }

      const checkInTime = now.toISOString();
      const timing = evaluateShiftTiming(checkInTime, null, cfg);

      const newRecord: AttendanceRecord = enrichAttendanceRecord(
        {
          id: `att_${user.id}_${Date.now()}`,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          employeeCode: user.employeeCode,
          date: todayStr,
          checkInTime,
          checkOutTime: null,
          totalMinutes: 0,
          status: 'working',
          checkInMethod: 'direct_button',
          checkInIp: clientIp,
          checkInWifiSsid: payload.wifiSsid || cfg.wifiSsid,
          checkInWifiBssid: cfg.wifiBssid || 'A4:2B:B0:C1:9E:58',
          checkInGps: payload.gps,
          shiftId: timing.shiftId,
          shiftName: timing.shiftName,
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

      await Promise.race([
        Promise.all([
          saveAttendanceToFirestore(newRecord, users, 'create').catch(() => {}),
          saveUserToFirestore(user, undefined, nextAttendance, 'update').catch(() => {}),
          fetch(`${API_BASE}/firebase/sync-attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attendance: nextAttendance, replace: true }),
          }).catch(() => {}),
        ]),
        new Promise((r) => setTimeout(r, 1800)),
      ]);

      return { success: true, record: newRecord };
    } finally {
      activeCheckActionLocks.delete(lockKey);
    }
  },

  async checkOut(payload: {
    userId: string;
    qrToken?: string;
    wifiSsid?: string;
    gps?: { lat: number; lng: number; distance?: number };
    note?: string;
    managerOverride?: boolean;
  }): Promise<{ success: boolean; record: AttendanceRecord; removedId?: string; removedIds?: string[] }> {
    const lockKey = `check_${payload.userId}`;
    if (activeCheckActionLocks.has(lockKey)) {
      throw new Error('Hệ thống đang xử lý thao tác chấm công của bạn, vui lòng không bấm lặp lại.');
    }
    activeCheckActionLocks.add(lockKey);

    try {
      const users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
      let rawAttendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      let { consolidated: attendance, removedIds: consolidatedRemovedIds } = consolidateCompletedShifts(
        rawAttendance,
        users
      );
      let idx = attendance.findIndex((r) => r.userId === payload.userId && r.status === 'working');

      if (idx === -1) {
        try {
          const fbAtt = await fetchAttendanceFromFirestore();
          if (fbAtt.length > 0) {
            const consolidatedFb = consolidateCompletedShifts(fbAtt, users);
            attendance = consolidatedFb.consolidated;
            consolidatedRemovedIds = [
              ...consolidatedRemovedIds,
              ...consolidatedFb.removedIds,
            ];
            idx = attendance.findIndex((r) => r.userId === payload.userId && r.status === 'working');
          }
        } catch {}
      }

      if (idx === -1) throw new Error('Không tìm thấy ca làm việc đang mở để check-out.');
      const record = attendance[idx];
      const now = new Date();

      const cfg = loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
      const clientIp = payload.managerOverride ? '127.0.0.1' : await detectClientPublicIp(false);

      if (!payload.managerOverride) {
        if (!isClientIpAllowedByConfig(clientIp, cfg)) {
          throw new Error(
            `Chặn chấm công: Thiết bị hiện tại không kết nối đúng mạng WiFi "${cfg.wifiSsid}" (BSSID: ${cfg.wifiBssid || 'A4:2B:B0:C1:9E:58'}) tại cửa hàng.`
          );
        }

        if (cfg.requireGps && cfg.storeGps) {
          if (!payload.gps || typeof payload.gps.lat !== 'number' || typeof payload.gps.lng !== 'number') {
            throw new Error(
              'Chặn chấm công (Khóa Kép Vị Trí): Vui lòng bật quyền Định vị (GPS) trên trình duyệt để xác nhận đang có mặt tại quán.'
            );
          }
          const dist = calculateGpsDistanceMeters(
            payload.gps.lat,
            payload.gps.lng,
            cfg.storeGps.lat,
            cfg.storeGps.lng
          );
          const maxRadius = cfg.storeGps.radiusMeters || 80;
          if (dist > maxRadius) {
            throw new Error(
              `Chặn chấm công (Khóa Kép Vị Trí): Bạn đang cách cửa hàng ${dist}m (vượt quá bán kính cho phép ${maxRadius}m).`
            );
          }
        }

        const shiftCheck = isTimeInConfiguredShifts(now, cfg);
        if (!shiftCheck.inShiftWindow) {
          throw new Error(
            `Chặn chấm công: Hiện tại đang ngoài khung giờ ca làm việc đã cấu hình (${shiftCheck.allowedRangesText}).`
          );
        }
      }

      const checkOutTime = now.toISOString();
      const diffMinutes = Math.max(
        1,
        Math.round((now.getTime() - new Date(record.checkInTime).getTime()) / 60000)
      );

      const recordShiftId =
        record.shiftId || (new Date(record.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning');

      // Check if employee already has a completed record for this SAME shift today
      const existingShiftIdx = attendance.findIndex(
        (r, i) =>
          i !== idx &&
          r.userId === payload.userId &&
          r.date === record.date &&
          r.status !== 'working' &&
          (r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning')) ===
            recordShiftId
      );

      const user = users.find((u) => u.id === payload.userId);
      const outTiming = evaluateShiftTiming(record.checkInTime, checkOutTime, cfg);

      if (existingShiftIdx !== -1) {
        // Accumulate this turn's minutes & turn details into the existing shift record so 1 shift = 1 record
        const existing = attendance[existingShiftIdx];
        const existingTurns =
          Array.isArray(existing.turns) && existing.turns.length > 0
            ? existing.turns
            : [
                {
                  checkInTime: existing.checkInTime,
                  checkOutTime: existing.checkOutTime,
                  minutes: Number(existing.totalMinutes) || 0,
                  note: existing.note || '',
                },
              ];

        const newTurn = {
          checkInTime: record.checkInTime,
          checkOutTime,
          minutes: diffMinutes,
          note: payload.note || record.note || '',
        };

        const mergedTurns = deduplicateAndMergeOverlappingTurns([...existingTurns, newTurn]);
        const earliestCheckIn = mergedTurns[0]?.checkInTime || existing.checkInTime;
        const accumulatedMinutes = mergedTurns.reduce((sum, t) => sum + (Number(t.minutes) || 0), 0);
        const mergedTiming = evaluateShiftTiming(earliestCheckIn, checkOutTime, cfg);

        const mergedNote = Array.from(
          new Set(
            [existing.note, payload.note || record.note]
              .map((s) => (s || '').trim())
              .filter(Boolean)
          )
        ).join(' | ');

        const mergedRecord: AttendanceRecord = enrichAttendanceRecord(
          {
            ...existing,
            checkInTime: earliestCheckIn,
            checkOutTime,
            totalMinutes: accumulatedMinutes,
            turns: mergedTurns,
            status: 'completed',
            shiftId: mergedTiming.shiftId,
            shiftName: mergedTiming.shiftName,
            isLate: false,
            isEarlyLeave: false,
            checkOutIp: clientIp,
            checkOutGps: payload.gps,
            note: mergedNote || existing.note || '',
            updatedAt: checkOutTime,
          },
          users
        );

        attendance[existingShiftIdx] = mergedRecord;
        // Remove the closed working record and any other working records for this user
        const allRemovedIds = [
          record.id,
          ...consolidatedRemovedIds,
          ...attendance
            .filter((r, i) => i !== existingShiftIdx && r.userId === payload.userId && r.status === 'working')
            .map((r) => r.id),
        ];
        attendance = attendance.filter((r) => !allRemovedIds.includes(r.id));
        saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);

        await Promise.race([
          Promise.all([
            saveAttendanceToFirestore(mergedRecord, users, 'update').catch(() => {}),
            ...allRemovedIds.map((rid) => deleteAttendanceFromFirestore(rid).catch(() => {})),
            user ? saveUserToFirestore(user, undefined, attendance, 'update').catch(() => {}) : Promise.resolve(),
            fetch(`${API_BASE}/firebase/sync-attendance`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ attendance, replace: true, removedIds: allRemovedIds }),
            }).catch(() => {}),
          ]),
          new Promise((r) => setTimeout(r, 1800)),
        ]);

        return { success: true, record: mergedRecord, removedId: record.id, removedIds: allRemovedIds };
      }

      const singleTurnNote = payload.note
        ? record.note
          ? `${record.note} | ${payload.note}`
          : payload.note
        : record.note;

      const updatedRecord: AttendanceRecord = enrichAttendanceRecord(
        {
          ...record,
          checkOutTime,
          totalMinutes: diffMinutes,
          turns: [
            {
              checkInTime: record.checkInTime,
              checkOutTime,
              minutes: diffMinutes,
              note: singleTurnNote || '',
            },
          ],
          status: 'completed',
          shiftId: outTiming.shiftId,
          shiftName: outTiming.shiftName,
          isLate: false,
          isEarlyLeave: false,
          checkOutIp: clientIp,
          checkOutGps: payload.gps,
          note: singleTurnNote,
          updatedAt: checkOutTime,
        },
        users
      );

      attendance[idx] = updatedRecord;
      // Also clean up any other duplicate working records for this user
      const extraWorkingIds = [
        ...consolidatedRemovedIds,
        ...attendance
          .filter((r, i) => i !== idx && r.userId === payload.userId && r.status === 'working')
          .map((r) => r.id),
      ];
      if (extraWorkingIds.length > 0) {
        attendance = attendance.filter((r) => !extraWorkingIds.includes(r.id));
      }
      saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);

      await Promise.race([
        Promise.all([
          saveAttendanceToFirestore(updatedRecord, users, 'update').catch(() => {}),
          ...extraWorkingIds.map((rid) => deleteAttendanceFromFirestore(rid).catch(() => {})),
          user ? saveUserToFirestore(user, undefined, attendance, 'update').catch(() => {}) : Promise.resolve(),
          fetch(`${API_BASE}/firebase/sync-attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attendance, replace: true, removedIds: extraWorkingIds }),
          }).catch(() => {}),
        ]),
        new Promise((r) => setTimeout(r, 1800)),
      ]);

      return { success: true, record: updatedRecord, removedIds: extraWorkingIds };
    } finally {
      activeCheckActionLocks.delete(lockKey);
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
    const cfg = loadLocal<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    const startMs = new Date(payload.checkInTime).getTime();
    const endMs = payload.checkOutTime ? new Date(payload.checkOutTime).getTime() : null;
    const totalMinutes = endMs && endMs > startMs ? Math.round((endMs - startMs) / 60000) : 0;
    const status = payload.checkOutTime ? 'completed' : 'working';
    const timing = evaluateShiftTiming(payload.checkInTime, payload.checkOutTime, cfg);

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
          turns: [
            {
              checkInTime: payload.checkInTime,
              checkOutTime: payload.checkOutTime || null,
              minutes: totalMinutes,
              note: payload.note || '',
            },
          ],
          status,
          shiftId: timing.shiftId,
          shiftName: timing.shiftName,
          isLate: false,
          isEarlyLeave: false,
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
          turns: [
            {
              checkInTime: payload.checkInTime,
              checkOutTime: payload.checkOutTime || null,
              minutes: totalMinutes,
              note: payload.note || '',
            },
          ],
          status,
          shiftId: timing.shiftId,
          shiftName: timing.shiftName,
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
      const uniqueShiftsCount = new Set(
        userRecords.map(
          (r) =>
            `${r.date}_${r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning')}`
        )
      ).size;
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
        recordsCount: uniqueShiftsCount,
      };
    });

    const totalStoreUniqueShifts = new Set(
      monthRecords.map(
        (r) =>
          `${r.userId}_${r.date}_${r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning')}`
      )
    ).size;

    return {
      month: targetMonth,
      summaries,
      totalRecords: totalStoreUniqueShifts,
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
