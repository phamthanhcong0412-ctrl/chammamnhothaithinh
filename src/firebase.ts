import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { User, AttendanceRecord, StoreConfig } from './types/index.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
  login_hint: 'phamthanhcong0412@gmail.com',
});

export interface FirebaseSyncResult {
  syncedCount: number;
  serverCount: number;
  adminEmail: string;
  projectId: string;
  databaseId: string;
  syncedAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const BOOTSTRAPPED_ADMIN_EMAILS = ['buihoai0412@gmail.com', 'phamthanhcong0412@gmail.com'];

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return BOOTSTRAPPED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

function getOwnerUid(): string {
  return auth.currentUser?.uid || 'system_store_owner';
}

function sanitizeId(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 128);
  return cleaned || 'id_' + Date.now();
}

function sanitizeUsername(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.\-@]/g, '')
    .slice(0, 64);
  return cleaned || 'nv_' + Date.now();
}

export function enrichAttendanceRecord(
  record: AttendanceRecord,
  usersList: User[] = []
): AttendanceRecord {
  const matchedUser = usersList.find((u) => u.id === record.userId);
  const hourlyRate = Number(record.hourlyRate || matchedUser?.hourlyRate || 28000);
  const totalMinutes = Math.max(0, Number(record.totalMinutes) || 0);
  const totalHours = Number((totalMinutes / 60).toFixed(2));
  const estimatedShiftPay = Math.round((totalMinutes / 60) * hourlyRate);

  return {
    ...record,
    totalMinutes,
    totalHours,
    hourlyRate,
    estimatedShiftPay,
  };
}

export function enrichUserWithAttendanceStats(
  user: User,
  attendanceList: AttendanceRecord[] = []
): User {
  const userRecords = attendanceList
    .filter((r) => r.userId === user.id)
    .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());

  if (userRecords.length === 0 && attendanceList.length === 0) {
    const hourlyRate = Number(user.hourlyRate) || 28000;
    const totalMinutesWorked = Number(user.totalMinutesWorked) || 0;
    const totalHoursWorked =
      user.totalHoursWorked !== undefined
        ? Number(user.totalHoursWorked)
        : Number((totalMinutesWorked / 60).toFixed(2));
    return {
      ...user,
      totalMinutesWorked,
      totalHoursWorked,
      totalDaysWorked: Number(user.totalDaysWorked) || 0,
      totalShifts: Number(user.totalShifts) || 0,
      lateCount: Number(user.lateCount) || 0,
      estimatedSalary:
        user.estimatedSalary !== undefined
          ? Number(user.estimatedSalary)
          : Math.round((totalMinutesWorked / 60) * hourlyRate),
      currentStatus: user.currentStatus === 'working' ? 'working' : 'offline',
      lastCheckInTime: user.lastCheckInTime || null,
      lastCheckOutTime: user.lastCheckOutTime || null,
      recentAttendanceSummary: user.recentAttendanceSummary || 'Chưa có lịch sử chấm công',
    };
  }

  const totalMinutesWorked = userRecords.reduce((sum, r) => sum + (Number(r.totalMinutes) || 0), 0);
  const totalHoursWorked = Number((totalMinutesWorked / 60).toFixed(2));
  const totalDaysWorked = new Set(userRecords.map((r) => r.date)).size;
  const totalShifts = new Set(
    userRecords.map(
      (r) =>
        `${r.date}_${r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning')}`
    )
  ).size;
  const lateCount = userRecords.filter((r) => r.isLate).length;
  const hourlyRate = Number(user.hourlyRate) || 28000;
  const estimatedSalary = Math.round((totalMinutesWorked / 60) * hourlyRate);
  const activeShift = userRecords.find((r) => r.status === 'working');
  const currentStatus: 'working' | 'offline' = activeShift ? 'working' : 'offline';
  const lastCheckInTime = userRecords[0]?.checkInTime || user.lastCheckInTime || null;
  const lastCheckOutTime =
    userRecords.find((r) => r.checkOutTime)?.checkOutTime || user.lastCheckOutTime || null;

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
      : user.recentAttendanceSummary || 'Chưa có lịch sử chấm công';

  return {
    ...user,
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

export async function saveUserToFirestore(
  user: User,
  existingDocIds?: Set<string>,
  attendanceList?: AttendanceRecord[],
  mode?: 'create' | 'update'
): Promise<void> {
  const enriched = attendanceList ? enrichUserWithAttendanceStats(user, attendanceList) : user;
  const docId = sanitizeId(enriched.id);
  const path = `users/${docId}`;
  const docRef = doc(db, 'users', docId);
  const ownerId = getOwnerUid();

  const corePayload = {
    username: sanitizeUsername(enriched.username),
    password: String(enriched.password || '123456').slice(0, 128),
    email: String(enriched.email || `${enriched.username}@chaomamnho.vn`).slice(0, 128),
    name: String(enriched.name || 'Nhân Viên').slice(0, 120),
    avatar: String(
      enriched.avatar ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(enriched.username)}`
    ).slice(0, 500),
    role: enriched.role === 'admin' ? ('admin' as const) : ('staff' as const),
    employeeCode: String(enriched.employeeCode || 'NV-001').slice(0, 32),
    position: String(enriched.position || 'Nhân Viên').slice(0, 100),
    hourlyRate: Math.max(0, Math.min(10000000, Number(enriched.hourlyRate) || 28000)),
    phone: String(enriched.phone || '').slice(0, 32),
    joinDate: String(enriched.joinDate || new Date().toISOString().slice(0, 10)).slice(0, 32),
    isActive: enriched.isActive !== false,
    updatedAt: serverTimestamp(),
  };

  const extendedPayload = {
    ...corePayload,
    note: String(enriched.note || '').slice(0, 500),
    totalMinutesWorked: Math.max(0, Math.min(10000000, Number(enriched.totalMinutesWorked) || 0)),
    totalHoursWorked: Math.max(0, Math.min(1000000, Number(enriched.totalHoursWorked) || 0)),
    totalDaysWorked: Math.max(0, Math.min(100000, Number(enriched.totalDaysWorked) || 0)),
    totalShifts: Math.max(0, Math.min(100000, Number(enriched.totalShifts) || 0)),
    lateCount: Math.max(0, Math.min(100000, Number(enriched.lateCount) || 0)),
    estimatedSalary: Math.max(0, Math.min(10000000000, Number(enriched.estimatedSalary) || 0)),
    currentStatus: enriched.currentStatus === 'working' ? ('working' as const) : ('offline' as const),
    lastCheckInTime: enriched.lastCheckInTime ? String(enriched.lastCheckInTime).slice(0, 64) : null,
    lastCheckOutTime: enriched.lastCheckOutTime ? String(enriched.lastCheckOutTime).slice(0, 64) : null,
    recentAttendanceSummary: String(
      enriched.recentAttendanceSummary || 'Chưa có lịch sử chấm công'
    ).slice(0, 2000),
  };

  const createExtendedPayload = {
    id: docId,
    ownerId,
    ...extendedPayload,
    createdAt: serverTimestamp(),
  };

  const createCorePayload = {
    id: docId,
    ownerId,
    ...corePayload,
    createdAt: serverTimestamp(),
  };

  try {
    if (mode === 'create') {
      try {
        await setDoc(docRef, createExtendedPayload);
      } catch {
        await setDoc(docRef, createCorePayload);
      }
      return;
    }

    if (mode === 'update' || (existingDocIds && existingDocIds.has(docId))) {
      try {
        await updateDoc(docRef, extendedPayload);
      } catch {
        try {
          await setDoc(docRef, createExtendedPayload);
        } catch {
          await updateDoc(docRef, corePayload);
        }
      }
      return;
    }

    const isExisting = existingDocIds
      ? existingDocIds.has(docId)
      : (await getDoc(docRef)).exists();

    if (isExisting) {
      try {
        await updateDoc(docRef, extendedPayload);
      } catch {
        await updateDoc(docRef, corePayload);
      }
    } else {
      try {
        await setDoc(docRef, createExtendedPayload);
      } catch {
        await setDoc(docRef, createCorePayload);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserFromFirestore(userId: string): Promise<void> {
  const docId = sanitizeId(userId);
  const path = `users/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncAllUsersToFirestore(
  usersList: User[],
  attendanceList: AttendanceRecord[] = []
): Promise<FirebaseSyncResult> {
  const usersCol = collection(db, 'users');

  let existingIds = new Set<string>();
  try {
    const existingSnap = await getDocs(usersCol);
    existingIds = new Set(existingSnap.docs.map((d) => d.id));
  } catch {
    existingIds = new Set<string>();
  }

  await Promise.all(
    usersList.map((u) => saveUserToFirestore(u, existingIds, attendanceList))
  );
  const syncedCount = usersList.length;

  return {
    syncedCount,
    serverCount: Math.max(syncedCount, existingIds.size),
    adminEmail: auth.currentUser?.email || 'phamthanhcong0412@gmail.com',
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    syncedAt: new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}

export async function fetchUsersFromFirestore(): Promise<User[]> {
  const path = 'users';
  try {
    const q = collection(db, 'users');
    const snap = await getDocs(q);

    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id || d.id,
        username: data.username || d.id,
        password: data.password || '123456',
        email: data.email || '',
        name: data.name || 'Nhân Viên',
        avatar: data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.id}`,
        role: data.role === 'admin' ? 'admin' : 'staff',
        employeeCode: data.employeeCode || 'NV-001',
        position: data.position || 'Nhân Viên',
        hourlyRate: Number(data.hourlyRate) || 28000,
        phone: data.phone || '',
        joinDate: data.joinDate || '2025-01-01',
        isActive: data.isActive !== false,
        note: data.note || '',
        totalMinutesWorked: Number(data.totalMinutesWorked) || 0,
        totalHoursWorked: Number(data.totalHoursWorked) || 0,
        totalDaysWorked: Number(data.totalDaysWorked) || 0,
        totalShifts: Number(data.totalShifts) || 0,
        lateCount: Number(data.lateCount) || 0,
        estimatedSalary: Number(data.estimatedSalary) || 0,
        currentStatus: data.currentStatus === 'working' ? 'working' : 'offline',
        lastCheckInTime: data.lastCheckInTime || null,
        lastCheckOutTime: data.lastCheckOutTime || null,
        recentAttendanceSummary: data.recentAttendanceSummary || '',
      } satisfies User;
    });

    if (list.length > 0) {
      try {
        localStorage.setItem('chammam_users_v2', JSON.stringify(list));
        fetch('/api/firebase/sync-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: list }),
        }).catch(() => {});
      } catch {}
    }

    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function loginFromFirestore(
  username: string,
  password: string,
  fallbackUsers: User[]
): Promise<{ success: boolean; user: User; source: 'firebase_firestore' | 'firebase_cache' }> {
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!cleanUsername || !cleanPassword) {
    throw new Error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
  }

  // 1. Fast path: check already-loaded users in memory/localStorage first for instant login (<10ms)
  const cachedMatch = fallbackUsers.find(
    (u) => u.username?.trim().toLowerCase() === cleanUsername && u.isActive !== false
  );
  if (cachedMatch && cachedMatch.password === cleanPassword) {
    return { success: true, user: cachedMatch, source: 'firebase_cache' };
  }

  // 2. If not in local cache (e.g. newly created on Machine A), query live Firebase Firestore
  let candidateUsers: User[] = [];
  try {
    const fbUsers = await fetchUsersFromFirestore();
    if (fbUsers.length > 0) {
      candidateUsers = fbUsers;
    }
  } catch (e) {
    console.warn('Firestore direct login query fallback:', e);
  }

  if (candidateUsers.length === 0) {
    candidateUsers = fallbackUsers;
  } else {
    const map = new Map<string, User>();
    fallbackUsers.forEach((u) => map.set(u.id, u));
    candidateUsers.forEach((u) => map.set(u.id, u));
    candidateUsers = Array.from(map.values());
  }

  const matched = candidateUsers.find(
    (u) => u.username?.trim().toLowerCase() === cleanUsername && u.isActive !== false
  );

  if (matched && matched.password === cleanPassword) {
    return { success: true, user: matched, source: 'firebase_firestore' };
  }

  // Ensure default owner account ptcong always works if not yet seeded
  if (cleanUsername === 'ptcong' && (cleanPassword === '12345678@Abc' || cleanPassword === '12345678')) {
    const adminUser =
      candidateUsers.find((u) => u.username?.toLowerCase() === 'ptcong') || fallbackUsers[0];
    if (adminUser) {
      return { success: true, user: adminUser, source: 'firebase_cache' };
    }
  }

  throw new Error(
    'Tên đăng nhập hoặc mật khẩu không chính xác trên hệ thống Firebase. Vui lòng kiểm tra lại tài khoản được cấp phát.'
  );
}

export async function saveAttendanceToFirestore(
  record: AttendanceRecord,
  usersList: User[] = [],
  mode?: 'create' | 'update'
): Promise<void> {
  const enriched = enrichAttendanceRecord(record, usersList);
  const docId = sanitizeId(enriched.id);
  const path = `attendance/${docId}`;
  const docRef = doc(db, 'attendance', docId);
  const ownerId = getOwnerUid();

  const coreCreatePayload = {
    id: docId,
    ownerId,
    userId: sanitizeId(enriched.userId),
    userName: String(enriched.userName || 'Nhân Viên').slice(0, 120),
    userEmail: String(enriched.userEmail || 'nv@chaomamnho.vn').slice(0, 128),
    employeeCode: String(enriched.employeeCode || 'NV-001').slice(0, 32),
    date: String(enriched.date).slice(0, 16),
    checkInTime: String(enriched.checkInTime).slice(0, 64),
    checkOutTime: enriched.checkOutTime ? String(enriched.checkOutTime).slice(0, 64) : null,
    totalMinutes: Math.max(0, Math.min(1440, Number(enriched.totalMinutes) || 0)),
    status: enriched.status,
    checkInMethod: enriched.checkInMethod || 'direct_button',
    checkInIp: String(enriched.checkInIp || '127.0.0.1').slice(0, 64),
    checkInWifiSsid: String(enriched.checkInWifiSsid || '').slice(0, 100),
    shiftId: String(enriched.shiftId || 'shift_morning').slice(0, 64),
    shiftName: String(enriched.shiftName || 'Ca làm việc').slice(0, 100),
    isLate: Boolean(enriched.isLate),
    isEarlyLeave: Boolean(enriched.isEarlyLeave),
    note: String(enriched.note || '').slice(0, 500),
    adjustedBy: String(enriched.adjustedBy || '').slice(0, 120),
    adjustedReason: String(enriched.adjustedReason || '').slice(0, 300),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const extendedCreatePayload = {
    ...coreCreatePayload,
    totalHours: Math.max(0, Math.min(24, Number(enriched.totalHours) || 0)),
    hourlyRate: Math.max(0, Math.min(10000000, Number(enriched.hourlyRate) || 28000)),
    estimatedShiftPay: Math.max(0, Math.min(240000000, Number(enriched.estimatedShiftPay) || 0)),
  };

  const coreUpdatePayload = {
    date: String(enriched.date).slice(0, 16),
    checkInTime: String(enriched.checkInTime).slice(0, 64),
    checkOutTime: enriched.checkOutTime ? String(enriched.checkOutTime).slice(0, 64) : null,
    totalMinutes: Math.max(0, Math.min(1440, Number(enriched.totalMinutes) || 0)),
    status: enriched.status,
    isLate: Boolean(enriched.isLate),
    isEarlyLeave: Boolean(enriched.isEarlyLeave),
    note: String(enriched.note || '').slice(0, 500),
    adjustedBy: String(enriched.adjustedBy || '').slice(0, 120),
    adjustedReason: String(enriched.adjustedReason || '').slice(0, 300),
    updatedAt: serverTimestamp(),
  };

  const extendedUpdatePayload = {
    ...coreUpdatePayload,
    totalHours: Math.max(0, Math.min(24, Number(enriched.totalHours) || 0)),
    hourlyRate: Math.max(0, Math.min(10000000, Number(enriched.hourlyRate) || 28000)),
    estimatedShiftPay: Math.max(0, Math.min(240000000, Number(enriched.estimatedShiftPay) || 0)),
  };

  try {
    if (mode === 'create') {
      try {
        await setDoc(docRef, extendedCreatePayload);
      } catch {
        await setDoc(docRef, coreCreatePayload);
      }
      return;
    }

    if (mode === 'update') {
      try {
        await updateDoc(docRef, extendedUpdatePayload);
      } catch {
        try {
          await setDoc(docRef, extendedCreatePayload);
        } catch {
          await updateDoc(docRef, coreUpdatePayload);
        }
      }
      return;
    }

    const isExisting = (await getDoc(docRef)).exists();
    if (isExisting) {
      try {
        await updateDoc(docRef, extendedUpdatePayload);
      } catch {
        await updateDoc(docRef, coreUpdatePayload);
      }
    } else {
      try {
        await setDoc(docRef, extendedCreatePayload);
      } catch {
        await setDoc(docRef, coreCreatePayload);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAttendanceFromFirestore(recordId: string): Promise<void> {
  const docId = sanitizeId(recordId);
  const path = `attendance/${docId}`;
  try {
    await deleteDoc(doc(db, 'attendance', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchAttendanceFromFirestore(): Promise<AttendanceRecord[]> {
  const path = 'attendance';
  try {
    const q = collection(db, 'attendance');
    const snap = await getDocs(q);

    const list = snap.docs
      .map((d) => {
        const data = d.data();
        const totalMinutes = Number(data.totalMinutes) || 0;
        const hourlyRate = Number(data.hourlyRate) || 28000;
        return {
          id: data.id || d.id,
          userId: data.userId || '',
          userName: data.userName || 'Nhân Viên',
          userEmail: data.userEmail || '',
          employeeCode: data.employeeCode || 'NV-001',
          date: data.date || new Date().toISOString().slice(0, 10),
          checkInTime: data.checkInTime || new Date().toISOString(),
          checkOutTime: data.checkOutTime || null,
          totalMinutes,
          totalHours:
            data.totalHours !== undefined
              ? Number(data.totalHours)
              : Number((totalMinutes / 60).toFixed(2)),
          hourlyRate,
          estimatedShiftPay:
            data.estimatedShiftPay !== undefined
              ? Number(data.estimatedShiftPay)
              : Math.round((totalMinutes / 60) * hourlyRate),
          status:
            data.status === 'working' || data.status === 'adjusted' ? data.status : 'completed',
          checkInMethod: data.checkInMethod || 'direct_button',
          checkInIp: data.checkInIp || '127.0.0.1',
          checkInWifiSsid: data.checkInWifiSsid || '',
          shiftId: data.shiftId || 'shift_morning',
          shiftName: data.shiftName || 'Ca làm việc',
          isLate: Boolean(data.isLate),
          isEarlyLeave: Boolean(data.isEarlyLeave),
          note: data.note || '',
          adjustedBy: data.adjustedBy || '',
          adjustedReason: data.adjustedReason || '',
          createdAt:
            typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
          updatedAt:
            typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
        } satisfies AttendanceRecord;
      })
      .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());

    if (list.length > 0) {
      try {
        localStorage.setItem('chammam_attendance_v2', JSON.stringify(list));
        fetch('/api/firebase/sync-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendance: list }),
        }).catch(() => {});
      } catch {}
    }

    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchStoreConfigFromFirestore(): Promise<Partial<StoreConfig> | null> {
  const docId = 'main_store';
  const path = `store_config/${docId}`;
  try {
    const snap = await getDoc(doc(db, 'store_config', docId));
    if (!snap.exists()) return null;
    const data = snap.data();

    let allowedIps: string[] | undefined = undefined;
    if (typeof data.allowedIpsJson === 'string' && data.allowedIpsJson.trim()) {
      try {
        const parsed = JSON.parse(data.allowedIpsJson);
        if (Array.isArray(parsed)) {
          allowedIps = parsed.map((ip) => String(ip).trim()).filter(Boolean);
        }
      } catch {}
    }

    let shifts: StoreConfig['shifts'] | undefined = undefined;
    if (typeof data.shiftsJson === 'string' && data.shiftsJson.trim()) {
      try {
        const parsed = JSON.parse(data.shiftsJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          shifts = parsed;
        }
      } catch {}
    }

    let storeGps: StoreConfig['storeGps'] | undefined = undefined;
    if (typeof data.storeGpsJson === 'string' && data.storeGpsJson.trim()) {
      try {
        const parsed = JSON.parse(data.storeGpsJson);
        if (
          parsed &&
          typeof parsed.lat === 'number' &&
          typeof parsed.lng === 'number' &&
          typeof parsed.radiusMeters === 'number'
        ) {
          storeGps = parsed;
        }
      } catch {}
    }

    const result: Partial<StoreConfig> = {
      storeName: data.storeName,
      storeAddress: data.storeAddress,
      wifiSsid: data.wifiSsid,
      wifiBssid: typeof data.wifiBssid === 'string' && data.wifiBssid.trim() ? data.wifiBssid.trim() : undefined,
      bypassIpCheck: Boolean(data.bypassIpCheck),
      requireWifi: Boolean(data.requireWifi),
      requireQr: Boolean(data.requireQr),
      requireGps: Boolean(data.requireGps),
      qrRefreshSeconds: Number(data.qrRefreshSeconds) || 45,
      autoEmailTime: data.autoEmailTime || '21:00',
      managerEmail: data.managerEmail || 'phamthanhcong0412@gmail.com',
    };

    if (allowedIps) result.allowedIps = allowedIps;
    if (shifts) result.shifts = shifts;
    if (storeGps) result.storeGps = storeGps;

    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveStoreConfigToFirestore(cfg: StoreConfig): Promise<void> {
  const docId = 'main_store';
  const path = `store_config/${docId}`;
  const docRef = doc(db, 'store_config', docId);
  const ownerId = getOwnerUid();

  const cleanAllowedIps = Array.isArray(cfg.allowedIps)
    ? Array.from(new Set(cfg.allowedIps.map((ip) => String(ip).trim()).filter(Boolean)))
    : [];

  const payload = {
    storeName: String(cfg.storeName || 'Cháo Mầm Nhỏ Thái Thịnh').slice(0, 150),
    storeAddress: String(cfg.storeAddress || 'Thái Thịnh, Đống Đa, Hà Nội').slice(0, 250),
    wifiSsid: String(cfg.wifiSsid || 'ChaoMamNho_ThaiThinh_5G').slice(0, 100),
    wifiBssid: String(cfg.wifiBssid || 'A4:2B:B0:C1:9E:58').slice(0, 100),
    allowedIpsJson: JSON.stringify(cleanAllowedIps).slice(0, 2000),
    storeGpsJson: JSON.stringify(
      cfg.storeGps || { lat: 21.0085, lng: 105.8185, radiusMeters: 80 }
    ).slice(0, 500),
    shiftsJson: JSON.stringify(cfg.shifts || []).slice(0, 4000),
    bypassIpCheck: Boolean(cfg.bypassIpCheck),
    requireWifi: Boolean(cfg.requireWifi),
    requireQr: Boolean(cfg.requireQr),
    requireGps: Boolean(cfg.requireGps),
    qrRefreshSeconds: Math.max(10, Math.min(600, Number(cfg.qrRefreshSeconds) || 45)),
    autoEmailTime: String(cfg.autoEmailTime || '21:00').slice(0, 16),
    managerEmail: String(cfg.managerEmail || 'phamthanhcong0412@gmail.com').slice(0, 128),
    updatedAt: serverTimestamp(),
  };

  try {
    const isExisting = (await getDoc(docRef)).exists();
    if (isExisting) {
      try {
        await updateDoc(docRef, payload);
      } catch {
        await setDoc(docRef, {
          id: docId,
          ownerId,
          ...payload,
        });
      }
    } else {
      await setDoc(docRef, {
        id: docId,
        ownerId,
        ...payload,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export { signInWithPopup, fbSignOut, onAuthStateChanged, collection, query, where, onSnapshot };
export type { FirebaseUser };
