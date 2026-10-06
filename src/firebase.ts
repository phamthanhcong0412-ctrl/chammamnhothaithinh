import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
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

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

const BOOTSTRAPPED_ADMIN_EMAILS = ['buihoai0412@gmail.com', 'phamthanhcong0412@gmail.com'];

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return BOOTSTRAPPED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
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

export async function saveUserToFirestore(user: User): Promise<void> {
  const currentFbUser = auth.currentUser;
  if (!currentFbUser) return;

  const docId = sanitizeId(user.id);
  const path = `users/${docId}`;
  const docRef = doc(db, 'users', docId);

  try {
    const existingSnap = await getDoc(docRef);
    const basePayload = {
      username: sanitizeUsername(user.username),
      password: String(user.password || '123456').slice(0, 128),
      email: String(user.email || `${user.username}@chaomamnho.vn`).slice(0, 128),
      name: String(user.name || 'Nhân Viên').slice(0, 120),
      avatar: String(
        user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}`
      ).slice(0, 500),
      role: user.role === 'admin' ? ('admin' as const) : ('staff' as const),
      employeeCode: String(user.employeeCode || 'NV-001').slice(0, 32),
      position: String(user.position || 'Nhân Viên').slice(0, 100),
      hourlyRate: Math.max(0, Math.min(10000000, Number(user.hourlyRate) || 28000)),
      phone: String(user.phone || '').slice(0, 32),
      joinDate: String(user.joinDate || new Date().toISOString().slice(0, 10)).slice(0, 32),
      isActive: user.isActive !== false,
      updatedAt: serverTimestamp(),
    };

    if (existingSnap.exists()) {
      await updateDoc(docRef, basePayload);
    } else {
      await setDoc(docRef, {
        id: docId,
        ownerId: currentFbUser.uid,
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserFromFirestore(userId: string): Promise<void> {
  const currentFbUser = auth.currentUser;
  if (!currentFbUser) return;

  const docId = sanitizeId(userId);
  const path = `users/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncAllUsersToFirestore(usersList: User[]): Promise<number> {
  const currentFbUser = auth.currentUser;
  if (!currentFbUser) return 0;

  let syncedCount = 0;
  for (const u of usersList) {
    await saveUserToFirestore(u);
    syncedCount++;
  }
  return syncedCount;
}

export async function fetchUsersFromFirestore(): Promise<User[]> {
  const currentFbUser = auth.currentUser;
  if (!currentFbUser) return [];

  const path = 'users';
  try {
    const q = isBootstrappedAdminEmail(currentFbUser.email)
      ? collection(db, 'users')
      : query(collection(db, 'users'), where('ownerId', '==', currentFbUser.uid));

    const snap = await getDocs(q);
    return snap.docs.map((d) => {
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
      } satisfies User;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveAttendanceToFirestore(record: AttendanceRecord): Promise<void> {
  const currentFbUser = auth.currentUser;
  if (!currentFbUser) return;

  const docId = sanitizeId(record.id);
  const path = `attendance/${docId}`;
  const docRef = doc(db, 'attendance', docId);

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      await updateDoc(docRef, {
        date: String(record.date).slice(0, 16),
        checkInTime: String(record.checkInTime).slice(0, 64),
        checkOutTime: record.checkOutTime ? String(record.checkOutTime).slice(0, 64) : null,
        totalMinutes: Math.max(0, Math.min(1440, Number(record.totalMinutes) || 0)),
        status: record.status,
        isLate: Boolean(record.isLate),
        isEarlyLeave: Boolean(record.isEarlyLeave),
        note: String(record.note || '').slice(0, 500),
        adjustedBy: String(record.adjustedBy || '').slice(0, 120),
        adjustedReason: String(record.adjustedReason || '').slice(0, 300),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        id: docId,
        ownerId: currentFbUser.uid,
        userId: sanitizeId(record.userId),
        userName: String(record.userName || 'Nhân Viên').slice(0, 120),
        userEmail: String(record.userEmail || 'nv@chaomamnho.vn').slice(0, 128),
        employeeCode: String(record.employeeCode || 'NV-001').slice(0, 32),
        date: String(record.date).slice(0, 16),
        checkInTime: String(record.checkInTime).slice(0, 64),
        checkOutTime: record.checkOutTime ? String(record.checkOutTime).slice(0, 64) : null,
        totalMinutes: Math.max(0, Math.min(1440, Number(record.totalMinutes) || 0)),
        status: record.status,
        checkInMethod: record.checkInMethod || 'direct_button',
        checkInIp: String(record.checkInIp || '127.0.0.1').slice(0, 64),
        checkInWifiSsid: String(record.checkInWifiSsid || '').slice(0, 100),
        shiftId: String(record.shiftId || 'shift_morning').slice(0, 64),
        shiftName: String(record.shiftName || 'Ca làm việc').slice(0, 100),
        isLate: Boolean(record.isLate),
        isEarlyLeave: Boolean(record.isEarlyLeave),
        note: String(record.note || '').slice(0, 500),
        adjustedBy: String(record.adjustedBy || '').slice(0, 120),
        adjustedReason: String(record.adjustedReason || '').slice(0, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveStoreConfigToFirestore(cfg: StoreConfig): Promise<void> {
  const currentFbUser = auth.currentUser;
  if (!currentFbUser || !isBootstrappedAdminEmail(currentFbUser.email)) return;

  const docId = 'main_store';
  const path = `store_config/${docId}`;
  const docRef = doc(db, 'store_config', docId);

  try {
    const existingSnap = await getDoc(docRef);
    const payload = {
      storeName: String(cfg.storeName || 'Cháo Mầm Nhỏ Thái Thịnh').slice(0, 150),
      storeAddress: String(cfg.storeAddress || 'Thái Thịnh, Đống Đa, Hà Nội').slice(0, 250),
      wifiSsid: String(cfg.wifiSsid || 'ChaoMamNho_ThaiThinh_5G').slice(0, 100),
      bypassIpCheck: Boolean(cfg.bypassIpCheck),
      requireWifi: Boolean(cfg.requireWifi),
      requireQr: Boolean(cfg.requireQr),
      requireGps: Boolean(cfg.requireGps),
      qrRefreshSeconds: Math.max(10, Math.min(600, Number(cfg.qrRefreshSeconds) || 45)),
      autoEmailTime: String(cfg.autoEmailTime || '21:00').slice(0, 16),
      managerEmail: String(cfg.managerEmail || 'phamthanhcong0412@gmail.com').slice(0, 128),
      updatedAt: serverTimestamp(),
    };

    if (existingSnap.exists()) {
      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        id: docId,
        ownerId: currentFbUser.uid,
        ...payload,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export { signInWithPopup, fbSignOut, onAuthStateChanged, collection, query, where, onSnapshot };
export type { FirebaseUser };
