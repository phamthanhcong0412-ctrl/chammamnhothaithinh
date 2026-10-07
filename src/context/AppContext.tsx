import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  User,
  AttendanceRecord,
  StoreConfig,
  NetworkInfo,
  EmailLog,
} from '../types/index.ts';
import { api, consolidateCompletedShifts, isClientIpAllowedByConfig } from '../services/api.ts';
import {
  auth,
  googleProvider,
  signInWithPopup,
  fbSignOut,
  onAuthStateChanged,
  fetchUsersFromFirestore,
  fetchAttendanceFromFirestore,
  saveUserToFirestore,
  deleteUserFromFirestore,
  syncAllUsersToFirestore,
  saveAttendanceToFirestore,
  deleteAttendanceFromFirestore,
  saveStoreConfigToFirestore,
  enrichUserWithAttendanceStats,
  enrichAttendanceRecord,
  isBootstrappedAdminEmail,
  type FirebaseUser,
  type FirebaseSyncResult,
} from '../firebase.ts';
import firebaseAppletConfig from '../../firebase-applet-config.json';

interface AppContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  isFirebaseConnected: boolean;
  firebaseProjectId: string;
  lastFirebaseSync: FirebaseSyncResult | null;
  users: User[];
  attendance: AttendanceRecord[];
  storeConfig: StoreConfig | null;
  networkInfo: NetworkInfo | null;
  activeRecord: AttendanceRecord | null;
  isLoading: boolean;
  error: string | null;
  switchUser: (user: User) => void;
  loginWithCredentials: (username: string, password: string) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  syncUsersToFirebase: () => Promise<FirebaseSyncResult>;
  logout: () => void;
  checkIn: (payload?: {
    qrToken?: string;
    wifiSsid?: string;
    gps?: { lat: number; lng: number; accuracy?: number; distance?: number };
    note?: string;
  }) => Promise<AttendanceRecord>;
  checkOut: (payload?: {
    qrToken?: string;
    wifiSsid?: string;
    gps?: { lat: number; lng: number; distance?: number };
    note?: string;
  }) => Promise<AttendanceRecord>;
  checkOutUser: (userId: string, note?: string) => Promise<AttendanceRecord>;
  manualAttendance: (payload: {
    id?: string;
    userId: string;
    date: string;
    checkInTime: string;
    checkOutTime?: string | null;
    note?: string;
    adjustedBy?: string;
    adjustedReason?: string;
  }) => Promise<AttendanceRecord>;
  deleteAttendance: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  updateConfig: (cfg: Partial<StoreConfig>) => Promise<void>;
  addUser: (userData: Partial<User>) => Promise<User>;
  updateUser: (id: string, userData: Partial<User>) => Promise<User>;
  deleteUser: (id: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<User>;
  sendEmailReport: (recipient?: string) => Promise<EmailLog>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const raw = localStorage.getItem('chammam_users_v2');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    try {
      const raw = localStorage.getItem('chammam_attendance_v2');
      const parsed: AttendanceRecord[] = raw ? JSON.parse(raw) : [];
      return consolidateCompletedShifts(parsed, []).consolidated;
    } catch {
      return [];
    }
  });
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(() => {
    try {
      const raw = localStorage.getItem('chammam_store_config_v2');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUsername = localStorage.getItem('chammam_auth_username');
      const rawUsers = localStorage.getItem('chammam_users_v2');
      if (savedUsername && rawUsers) {
        const parsed: User[] = JSON.parse(rawUsers);
        return (
          parsed.find(
            (u) => u.username?.toLowerCase() === savedUsername.toLowerCase() && u.isActive !== false
          ) || null
        );
      }
    } catch {}
    return null;
  });
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [lastFirebaseSync, setLastFirebaseSync] = useState<FirebaseSyncResult | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('chammam_users_v2');
    } catch {
      return true;
    }
  });
  const [error, setError] = useState<string | null>(null);

  // Track Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
    });
    return () => unsub();
  }, []);

  // Compute active record for current user
  const activeRecord = currentUser
    ? attendance.find((r) => r.userId === currentUser.id && r.status === 'working') || null
    : null;

  const refreshData = useCallback(async () => {
    try {
      setError(null);
      const [cfg, userList, attList, netInfo] = await Promise.all([
        api.getConfig(),
        api.getUsers(),
        api.getAttendance(),
        api.getNetworkInfo().catch(() => null),
      ]);

      setStoreConfig({
        ...cfg,
        firebaseConfig: {
          adminEmail: cfg.firebaseConfig?.adminEmail || 'phamthanhcong0412@gmail.com',
          projectId: cfg.firebaseConfig?.projectId || firebaseAppletConfig.projectId,
          firestoreDatabaseId:
            cfg.firebaseConfig?.firestoreDatabaseId || firebaseAppletConfig.firestoreDatabaseId,
          apiKey: cfg.firebaseConfig?.apiKey || firebaseAppletConfig.apiKey,
          authDomain: cfg.firebaseConfig?.authDomain || firebaseAppletConfig.authDomain,
          storageBucket: cfg.firebaseConfig?.storageBucket || firebaseAppletConfig.storageBucket,
          messagingSenderId:
            cfg.firebaseConfig?.messagingSenderId || firebaseAppletConfig.messagingSenderId,
          appId: cfg.firebaseConfig?.appId || firebaseAppletConfig.appId,
        },
      });
      const enrichedAtt = attList.map((r) => enrichAttendanceRecord(r, userList));
      const enrichedUsers = userList.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt));
      setUsers(enrichedUsers);
      setAttendance(enrichedAtt);
      try {
        localStorage.removeItem('chammam_users_v1');
        localStorage.removeItem('chammam_attendance_v1');
        localStorage.setItem('chammam_users_v2', JSON.stringify(enrichedUsers));
        localStorage.setItem('chammam_attendance_v2', JSON.stringify(enrichedAtt));
      } catch {}
      if (netInfo) setNetworkInfo(netInfo);

      // Restore current user only if saved in localStorage
      setCurrentUser((prev) => {
        if (prev) {
          const updated = enrichedUsers.find((u) => u.id === prev.id);
          return updated || prev;
        }
        const savedUsername = localStorage.getItem('chammam_auth_username');
        if (savedUsername) {
          const matched = enrichedUsers.find(
            (u) => u.username?.toLowerCase() === savedUsername.toLowerCase() && u.isActive !== false
          );
          if (matched) return matched;
        }
        return null; // Require login screen on initial entry
      });
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      setError(err.message || 'Không thể tải dữ liệu hệ thống.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data once on page load (no background polling)
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const switchUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('chammam_auth_username', user.username);
  };

  const loginWithCredentials = async (username: string, password: string): Promise<User> => {
    const cleanUsername = username.trim();
    const res = await api.login(cleanUsername, password);
    localStorage.setItem('chammam_auth_username', res.user.username);
    const immediateUser = enrichUserWithAttendanceStats(res.user, attendance);
    setCurrentUser(immediateUser);

    // Refresh latest users & attendance in the background without blocking login transition
    Promise.all([
      api.getUsers().catch(() => users),
      api.getAttendance().catch(() => attendance),
    ]).then(([latestUsers, latestAtt]) => {
      const enrichedAtt = latestAtt.map((r) => enrichAttendanceRecord(r, latestUsers));
      const enrichedUsers = latestUsers.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt));
      const updatedUser =
        enrichedUsers.find((u) => u.id === res.user.id) ||
        enrichUserWithAttendanceStats(res.user, enrichedAtt);
      setAttendance(enrichedAtt);
      setUsers(enrichedUsers);
      setCurrentUser(updatedUser);
    });

    return immediateUser;
  };

  const loginWithGoogle = async (): Promise<User> => {
    const cred = await signInWithPopup(auth, googleProvider);
    const fbUser = cred.user;
    const email = (fbUser.email || '').trim().toLowerCase();
    const isAdminEmail = isBootstrappedAdminEmail(email);

    let matchedUser = users.find(
      (u) =>
        u.email?.toLowerCase() === email ||
        (isAdminEmail && (u.username?.toLowerCase() === 'ptcong' || u.role === 'admin'))
    );

    if (!matchedUser) {
      const generatedUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_.\-]/g, '_') || 'user_' + Date.now();
      const newProfile: Partial<User> = {
        id: fbUser.uid,
        username: isAdminEmail ? 'ptcong' : generatedUsername,
        password: isAdminEmail ? '12345678@Abc' : '123456',
        email: email || `${generatedUsername}@chaomamnho.vn`,
        name: fbUser.displayName || (isAdminEmail ? 'Phạm Thành Công (Chủ Quán)' : 'Nhân Viên Mới'),
        avatar: fbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(generatedUsername)}`,
        role: isAdminEmail ? 'admin' : 'staff',
        employeeCode: isAdminEmail ? 'QL-001' : `NV-00${users.length + 1}`,
        position: isAdminEmail ? 'Chủ Cửa Hàng / Quản Lý' : 'Nhân Viên Cửa Hàng',
        hourlyRate: isAdminEmail ? 50000 : 28000,
        phone: fbUser.phoneNumber || '',
      };
      const createdRes = await api.createUser(newProfile).catch(() => ({
        success: true,
        user: {
          ...newProfile,
          id: fbUser.uid,
          joinDate: new Date().toISOString().slice(0, 10),
          isActive: true,
        } as User,
      }));
      matchedUser = createdRes.user;
      setUsers((prev) => [...prev, matchedUser!]);
    }

    // Sync to Firestore
    if (isAdminEmail) {
      await syncAllUsersToFirestore(
        users.some((u) => u.id === matchedUser!.id) ? users : [...users, matchedUser],
        attendance
      );
    } else {
      await saveUserToFirestore({ ...matchedUser, id: fbUser.uid }, undefined, attendance);
    }

    if (!currentUser) {
      setCurrentUser(matchedUser);
      localStorage.setItem('chammam_auth_username', matchedUser.username);
    }

    return matchedUser;
  };

  const syncUsersToFirebase = async (): Promise<FirebaseSyncResult> => {
    const startTime = Date.now();
    const enrichedUsers = users.map((u) => enrichUserWithAttendanceStats(u, attendance));
    setUsers(enrichedUsers);
    const result = await syncAllUsersToFirestore(enrichedUsers, attendance);
    if (storeConfig) {
      await saveStoreConfigToFirestore(storeConfig).catch(() => {});
    }
    for (const rec of attendance.slice(0, 100)) {
      await saveAttendanceToFirestore(rec, enrichedUsers).catch(() => {});
    }
    // Ensure visual feedback lasts at least 600ms so button doesn't just flash
    const elapsed = Date.now() - startTime;
    if (elapsed < 600) {
      await new Promise((r) => setTimeout(r, 600 - elapsed));
    }
    setLastFirebaseSync(result);
    return result;
  };

  const logout = () => {
    localStorage.removeItem('chammam_auth_username');
    localStorage.removeItem('chammam_auth_email');
    fbSignOut(auth).catch(() => {});
    setCurrentUser(null);
  };

  const syncUserAndAttendanceState = (nextAttendance: AttendanceRecord[], targetUserId?: string) => {
    const enrichedAtt = nextAttendance.map((r) => enrichAttendanceRecord(r, users));
    setAttendance(enrichedAtt);
    setUsers((prevUsers) => prevUsers.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt)));
    if (currentUser && (!targetUserId || currentUser.id === targetUserId)) {
      setCurrentUser((prev) => (prev ? enrichUserWithAttendanceStats(prev, enrichedAtt) : null));
    }
  };

  const checkIn = async (payload?: {
    qrToken?: string;
    wifiSsid?: string;
    gps?: { lat: number; lng: number; accuracy?: number; distance?: number };
    note?: string;
  }): Promise<AttendanceRecord> => {
    if (!currentUser) throw new Error('Vui lòng đăng nhập trước khi chấm công');
    const res = await api.checkIn({
      userId: currentUser.id,
      qrToken: payload?.qrToken,
      wifiSsid: payload?.wifiSsid,
      gps: payload?.gps,
      note: payload?.note,
    });
    const enrichedRec = enrichAttendanceRecord(res.record, users);
    const nextAtt = [enrichedRec, ...attendance];
    syncUserAndAttendanceState(nextAtt, currentUser.id);
    return enrichedRec;
  };

  const checkOut = async (payload?: {
    qrToken?: string;
    wifiSsid?: string;
    gps?: { lat: number; lng: number; distance?: number };
    note?: string;
  }): Promise<AttendanceRecord> => {
    if (!currentUser) throw new Error('Vui lòng đăng nhập');
    const res = await api.checkOut({
      userId: currentUser.id,
      qrToken: payload?.qrToken,
      wifiSsid: payload?.wifiSsid,
      gps: payload?.gps,
      note: payload?.note,
    });
    const enrichedRec = enrichAttendanceRecord(res.record, users);
    const filteredAtt = res.removedId
      ? attendance.filter((r) => r.id !== res.removedId)
      : attendance;
    const nextAtt = filteredAtt.map((r) => (r.id === enrichedRec.id ? enrichedRec : r));
    syncUserAndAttendanceState(nextAtt, currentUser.id);
    return enrichedRec;
  };

  const checkOutUser = async (userId: string, note?: string): Promise<AttendanceRecord> => {
    const res = await api.checkOut({
      userId,
      wifiSsid: storeConfig?.wifiSsid,
      note: note || `Quản lý chốt ra ca`,
      managerOverride: true,
    });
    const enrichedRec = enrichAttendanceRecord(res.record, users);
    const filteredAtt = res.removedId
      ? attendance.filter((r) => r.id !== res.removedId)
      : attendance;
    const nextAtt = filteredAtt.map((r) => (r.id === enrichedRec.id ? enrichedRec : r));
    syncUserAndAttendanceState(nextAtt, userId);
    return enrichedRec;
  };

  const manualAttendance = async (payload: {
    id?: string;
    userId: string;
    date: string;
    checkInTime: string;
    checkOutTime?: string | null;
    note?: string;
    adjustedBy?: string;
    adjustedReason?: string;
  }): Promise<AttendanceRecord> => {
    const res = await api.manualAttendance({
      ...payload,
      adjustedBy: currentUser?.name || 'Quản lý',
    });
    const enrichedRec = enrichAttendanceRecord(res.record, users);
    const rawNextAtt = payload.id
      ? attendance.map((r) => (r.id === enrichedRec.id ? enrichedRec : r))
      : [enrichedRec, ...attendance];
    const { consolidated: nextAtt } = consolidateCompletedShifts(rawNextAtt, users);
    syncUserAndAttendanceState(nextAtt, payload.userId);
    saveAttendanceToFirestore(enrichedRec, users).catch((e) =>
      console.warn('Firestore manual attendance sync:', e)
    );
    return enrichedRec;
  };

  const deleteAttendance = async (id: string) => {
    const targetRec = attendance.find((r) => r.id === id);
    await api.deleteAttendance(id);
    const nextAtt = attendance.filter((r) => r.id !== id);
    syncUserAndAttendanceState(nextAtt, targetRec?.userId);
    const targetUser = users.find((u) => u.id === targetRec?.userId);
    if (targetUser) {
      saveUserToFirestore(targetUser, undefined, nextAtt, 'update').catch(() => {});
    }
    deleteAttendanceFromFirestore(id).catch((e) =>
      console.warn('Firestore deleteAttendance sync:', e)
    );
  };

  const updateConfig = async (cfg: Partial<StoreConfig>) => {
    const res = await api.updateConfig(cfg);
    setStoreConfig(res.config);
    setNetworkInfo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        isAllowedIp: isClientIpAllowedByConfig(prev.clientIp, res.config),
      };
    });
    api
      .getNetworkInfo(true)
      .then((net) => setNetworkInfo(net))
      .catch(() => {});
  };

  const addUser = async (userData: Partial<User>) => {
    const res = await api.createUser(userData);
    const enrichedUser = enrichUserWithAttendanceStats(res.user, attendance);
    setUsers((prev) => [...prev.filter((u) => u.id !== enrichedUser.id), enrichedUser]);
    saveUserToFirestore(enrichedUser, undefined, attendance).catch((e) =>
      console.warn('Firestore addUser sync:', e)
    );
    return enrichedUser;
  };

  const updateUser = async (id: string, userData: Partial<User>) => {
    const res = await api.updateUser(id, userData);
    const enrichedUser = enrichUserWithAttendanceStats(res.user, attendance);
    setUsers((prev) => prev.map((u) => (u.id === id ? enrichedUser : u)));
    if (currentUser?.id === id) {
      setCurrentUser(enrichedUser);
    }
    saveUserToFirestore(enrichedUser, undefined, attendance).catch((e) =>
      console.warn('Firestore updateUser sync:', e)
    );
    return enrichedUser;
  };

  const deleteUser = async (id: string) => {
    await api.deleteUser(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    deleteUserFromFirestore(id).catch((e) => console.warn('Firestore deleteUser sync:', e));
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<User> => {
    if (!currentUser) throw new Error('Vui lòng đăng nhập để đổi mật khẩu.');
    const res = await api.changePassword(currentUser.id, currentPassword, newPassword);
    setCurrentUser(res.user);
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? res.user : u)));
    saveUserToFirestore(res.user, undefined, attendance).catch((e) =>
      console.warn('Firestore changePassword sync:', e)
    );
    return res.user;
  };

  const sendEmailReport = async (recipient?: string): Promise<EmailLog> => {
    const res = await api.sendEmailReport({
      recipient: recipient || storeConfig?.managerEmail,
      trigger: 'manual',
    });
    return res.log;
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        firebaseUser,
        isFirebaseConnected: true,
        firebaseProjectId: firebaseAppletConfig.projectId,
        lastFirebaseSync,
        users,
        attendance,
        storeConfig,
        networkInfo,
        activeRecord,
        isLoading,
        error,
        switchUser,
        loginWithCredentials,
        loginWithGoogle,
        syncUsersToFirebase,
        logout,
        checkIn,
        checkOut,
        checkOutUser,
        manualAttendance,
        deleteAttendance,
        refreshData,
        updateConfig,
        addUser,
        updateUser,
        deleteUser,
        changePassword,
        sendEmailReport,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

