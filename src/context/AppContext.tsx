import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
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
  saveUserToFirestore,
  deleteUserFromFirestore,
  syncAllUsersToFirestore,
  saveAttendanceToFirestore,
  deleteAttendanceFromFirestore,
  saveStoreConfigToFirestore,
  enrichUserWithAttendanceStats,
  enrichAttendanceRecord,
  isBootstrappedAdminEmail,
  subscribeToRealtimeStoreData,
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
  actionLoadingMessage: string | null;
  runWithHudLoading: <T>(message: string, fn: () => Promise<T>) => Promise<T>;
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
  const [actionLoadingMessage, setActionLoadingMessage] = useState<string | null>(null);
  const isActionLockedRef = useRef<boolean>(false);
  const usersRef = useRef<User[]>(users);
  usersRef.current = users;

  const [error, setError] = useState<string | null>(null);

  // Global HUD Loading Wrapper that blocks duplicate actions
  const runWithHudLoading = useCallback(
    async <T,>(message: string, fn: () => Promise<T>): Promise<T> => {
      if (isActionLockedRef.current) {
        throw new Error('Hệ thống đang xử lý thao tác trước đó, vui lòng đợi...');
      }
      isActionLockedRef.current = true;
      setActionLoadingMessage(message);
      const startTime = Date.now();
      try {
        const result = await fn();
        const elapsed = Date.now() - startTime;
        if (elapsed < 320) {
          await new Promise((r) => setTimeout(r, 320 - elapsed));
        }
        return result;
      } finally {
        isActionLockedRef.current = false;
        setActionLoadingMessage(null);
      }
    },
    []
  );

  // Track Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
    });
    return () => unsub();
  }, []);

  // Compute active record for current user (strictly 1 active shift max)
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
      const { consolidated, removedIds, updatedRecords } = consolidateCompletedShifts(
        attList,
        userList
      );
      if (removedIds.length > 0 || updatedRecords.length > 0) {
        Promise.all([
          ...updatedRecords.map((r) => saveAttendanceToFirestore(r, userList, 'update').catch(() => {})),
          ...removedIds.map((id) => deleteAttendanceFromFirestore(id).catch(() => {})),
          fetch('/api/firebase/sync-attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attendance: consolidated, replace: true, removedIds }),
          }).catch(() => {}),
        ]);
      }

      const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, userList));
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
        return null;
      });
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      setError(err.message || 'Không thể tải dữ liệu hệ thống.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data load + Real-time Firestore `onSnapshot` listeners + Cross-tab `storage` listener
  useEffect(() => {
    refreshData();

    const unsubRealtime = subscribeToRealtimeStoreData({
      onAttendanceChange: (rawRecords) => {
        const currentUsers = usersRef.current;
        const { consolidated, removedIds, updatedRecords } = consolidateCompletedShifts(
          rawRecords,
          currentUsers
        );

        // Automatically purge any duplicate/ghost records from Firestore & server
        if (removedIds.length > 0 || updatedRecords.length > 0) {
          Promise.all([
            ...updatedRecords.map((r) =>
              saveAttendanceToFirestore(r, currentUsers, 'update').catch(() => {})
            ),
            ...removedIds.map((id) => deleteAttendanceFromFirestore(id).catch(() => {})),
            fetch('/api/firebase/sync-attendance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ attendance: consolidated, replace: true, removedIds }),
            }).catch(() => {}),
          ]);
        }

        const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, currentUsers));
        setAttendance(enrichedAtt);
        try {
          localStorage.setItem('chammam_attendance_v2', JSON.stringify(enrichedAtt));
        } catch {}

        setUsers((prevUsers) => {
          const updatedUsers = prevUsers.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt));
          try {
            localStorage.setItem('chammam_users_v2', JSON.stringify(updatedUsers));
          } catch {}
          return updatedUsers;
        });

        setCurrentUser((prev) => (prev ? enrichUserWithAttendanceStats(prev, enrichedAtt) : null));
      },
      onUsersChange: (rawUsers) => {
        setAttendance((currentAtt) => {
          const enrichedUsers = rawUsers.map((u) => enrichUserWithAttendanceStats(u, currentAtt));
          setUsers(enrichedUsers);
          try {
            localStorage.setItem('chammam_users_v2', JSON.stringify(enrichedUsers));
          } catch {}
          setCurrentUser((prev) => {
            if (!prev) return null;
            return enrichedUsers.find((u) => u.id === prev.id) || prev;
          });
          return currentAtt;
        });
      },
      onStoreConfigChange: (fbCfg) => {
        setStoreConfig((prev) => {
          if (!prev) return prev;
          const nextCfg: StoreConfig = {
            ...prev,
            ...fbCfg,
            allowedIps:
              Array.isArray(fbCfg.allowedIps) && fbCfg.allowedIps.length > 0
                ? fbCfg.allowedIps
                : prev.allowedIps,
            shifts:
              Array.isArray(fbCfg.shifts) && fbCfg.shifts.length > 0
                ? fbCfg.shifts
                : prev.shifts,
            storeGps: fbCfg.storeGps || prev.storeGps,
          };
          try {
            localStorage.setItem('chammam_store_config_v2', JSON.stringify(nextCfg));
          } catch {}
          setNetworkInfo((prevNet) => {
            if (!prevNet) return prevNet;
            return {
              ...prevNet,
              isAllowedIp: isClientIpAllowedByConfig(prevNet.clientIp, nextCfg),
            };
          });
          return nextCfg;
        });
      },
    });

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'chammam_attendance_v2' && e.newValue) {
        try {
          const parsed: AttendanceRecord[] = JSON.parse(e.newValue);
          const { consolidated } = consolidateCompletedShifts(parsed, usersRef.current);
          const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, usersRef.current));
          setAttendance(enrichedAtt);
          setUsers((prev) => prev.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt)));
          setCurrentUser((prev) => (prev ? enrichUserWithAttendanceStats(prev, enrichedAtt) : null));
        } catch {}
      } else if (e.key === 'chammam_store_config_v2' && e.newValue) {
        try {
          const parsed: StoreConfig = JSON.parse(e.newValue);
          setStoreConfig(parsed);
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => {
      unsubRealtime();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [refreshData]);

  const switchUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('chammam_auth_username', user.username);
  };

  const loginWithCredentials = async (username: string, password: string): Promise<User> => {
    return runWithHudLoading('Đang xác thực tài khoản đăng nhập...', async () => {
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
        const { consolidated } = consolidateCompletedShifts(latestAtt, latestUsers);
        const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, latestUsers));
        const enrichedUsers = latestUsers.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt));
        const updatedUser =
          enrichedUsers.find((u) => u.id === res.user.id) ||
          enrichUserWithAttendanceStats(res.user, enrichedAtt);
        setAttendance(enrichedAtt);
        setUsers(enrichedUsers);
        setCurrentUser(updatedUser);
      });

      return immediateUser;
    });
  };

  const loginWithGoogle = async (): Promise<User> => {
    return runWithHudLoading('Đang kết nối tài khoản Google...', async () => {
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
        const generatedUsername =
          email.split('@')[0].replace(/[^a-zA-Z0-9_.\-]/g, '_') || 'user_' + Date.now();
        const newProfile: Partial<User> = {
          id: fbUser.uid,
          username: isAdminEmail ? 'ptcong' : generatedUsername,
          password: isAdminEmail ? '12345678@Abc' : '123456',
          email: email || `${generatedUsername}@chaomamnho.vn`,
          name:
            fbUser.displayName || (isAdminEmail ? 'Phạm Thành Công (Chủ Quán)' : 'Nhân Viên Mới'),
          avatar:
            fbUser.photoURL ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(generatedUsername)}`,
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
    });
  };

  const syncUsersToFirebase = async (): Promise<FirebaseSyncResult> => {
    return runWithHudLoading('Đang đồng bộ dữ liệu thời gian thực với Firebase...', async () => {
      const { consolidated, removedIds } = consolidateCompletedShifts(attendance, users);
      const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, users));
      const enrichedUsers = users.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt));
      setAttendance(enrichedAtt);
      setUsers(enrichedUsers);

      const result = await syncAllUsersToFirestore(enrichedUsers, enrichedAtt);
      if (storeConfig) {
        await saveStoreConfigToFirestore(storeConfig).catch(() => {});
      }
      for (const rid of removedIds) {
        await deleteAttendanceFromFirestore(rid).catch(() => {});
      }
      for (const rec of enrichedAtt.slice(0, 100)) {
        await saveAttendanceToFirestore(rec, enrichedUsers).catch(() => {});
      }
      setLastFirebaseSync(result);
      return result;
    });
  };

  const logout = () => {
    localStorage.removeItem('chammam_auth_username');
    localStorage.removeItem('chammam_auth_email');
    fbSignOut(auth).catch(() => {});
    setCurrentUser(null);
  };

  const syncUserAndAttendanceState = (nextAttendance: AttendanceRecord[], targetUserId?: string) => {
    const { consolidated } = consolidateCompletedShifts(nextAttendance, users);
    const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, users));
    setAttendance(enrichedAtt);
    try {
      localStorage.setItem('chammam_attendance_v2', JSON.stringify(enrichedAtt));
    } catch {}
    setUsers((prevUsers) => {
      const updated = prevUsers.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt));
      try {
        localStorage.setItem('chammam_users_v2', JSON.stringify(updated));
      } catch {}
      return updated;
    });
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
    return runWithHudLoading('Đang xử lý Check-in vào ca...', async () => {
      const res = await api.checkIn({
        userId: currentUser.id,
        qrToken: payload?.qrToken,
        wifiSsid: payload?.wifiSsid,
        gps: payload?.gps,
        note: payload?.note,
      });
      const enrichedRec = enrichAttendanceRecord(res.record, users);
      const nextAtt = [
        enrichedRec,
        ...attendance.filter((r) => !(r.userId === currentUser.id && r.status === 'working')),
      ];
      syncUserAndAttendanceState(nextAtt, currentUser.id);
      return enrichedRec;
    });
  };

  const checkOut = async (payload?: {
    qrToken?: string;
    wifiSsid?: string;
    gps?: { lat: number; lng: number; distance?: number };
    note?: string;
  }): Promise<AttendanceRecord> => {
    if (!currentUser) throw new Error('Vui lòng đăng nhập');
    return runWithHudLoading('Đang xử lý Check-out ra ca...', async () => {
      const res = await api.checkOut({
        userId: currentUser.id,
        qrToken: payload?.qrToken,
        wifiSsid: payload?.wifiSsid,
        gps: payload?.gps,
        note: payload?.note,
      });
      const enrichedRec = enrichAttendanceRecord(res.record, users);
      const removedSet = new Set([
        ...(res.removedId ? [res.removedId] : []),
        ...(res.removedIds || []),
      ]);
      const filteredAtt = attendance.filter(
        (r) => !removedSet.has(r.id) && !(r.userId === currentUser.id && r.status === 'working' && r.id !== enrichedRec.id)
      );
      const nextAtt = filteredAtt.some((r) => r.id === enrichedRec.id)
        ? filteredAtt.map((r) => (r.id === enrichedRec.id ? enrichedRec : r))
        : [enrichedRec, ...filteredAtt];
      syncUserAndAttendanceState(nextAtt, currentUser.id);
      return enrichedRec;
    });
  };

  const checkOutUser = async (userId: string, note?: string): Promise<AttendanceRecord> => {
    const targetName = users.find((u) => u.id === userId)?.name || 'nhân viên';
    return runWithHudLoading(`Đang chốt ra ca cho ${targetName}...`, async () => {
      const res = await api.checkOut({
        userId,
        wifiSsid: storeConfig?.wifiSsid,
        note: note || `Quản lý chốt ra ca`,
        managerOverride: true,
      });
      const enrichedRec = enrichAttendanceRecord(res.record, users);
      const removedSet = new Set([
        ...(res.removedId ? [res.removedId] : []),
        ...(res.removedIds || []),
      ]);
      const filteredAtt = attendance.filter(
        (r) => !removedSet.has(r.id) && !(r.userId === userId && r.status === 'working' && r.id !== enrichedRec.id)
      );
      const nextAtt = filteredAtt.some((r) => r.id === enrichedRec.id)
        ? filteredAtt.map((r) => (r.id === enrichedRec.id ? enrichedRec : r))
        : [enrichedRec, ...filteredAtt];
      syncUserAndAttendanceState(nextAtt, userId);
      return enrichedRec;
    });
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
    return runWithHudLoading('Đang lưu dữ liệu chấm công...', async () => {
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
      await saveAttendanceToFirestore(enrichedRec, users).catch((e) =>
        console.warn('Firestore manual attendance sync:', e)
      );
      return enrichedRec;
    });
  };

  const deleteAttendance = async (id: string) => {
    return runWithHudLoading('Đang xoá bản ghi chấm công...', async () => {
      const targetRec = attendance.find((r) => r.id === id);
      await api.deleteAttendance(id);
      const nextAtt = attendance.filter((r) => r.id !== id);
      syncUserAndAttendanceState(nextAtt, targetRec?.userId);
      const targetUser = users.find((u) => u.id === targetRec?.userId);
      await Promise.all([
        deleteAttendanceFromFirestore(id).catch((e) =>
          console.warn('Firestore deleteAttendance sync:', e)
        ),
        targetUser
          ? saveUserToFirestore(targetUser, undefined, nextAtt, 'update').catch(() => {})
          : Promise.resolve(),
        fetch('/api/firebase/sync-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendance: nextAtt, replace: true, removedIds: [id] }),
        }).catch(() => {}),
      ]);
    });
  };

  const updateConfig = async (cfg: Partial<StoreConfig>) => {
    return runWithHudLoading('Đang lưu thiết lập cửa hàng lên Firebase...', async () => {
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
    });
  };

  const addUser = async (userData: Partial<User>) => {
    return runWithHudLoading('Đang tạo hồ sơ nhân sự mới...', async () => {
      const res = await api.createUser(userData);
      const enrichedUser = enrichUserWithAttendanceStats(res.user, attendance);
      setUsers((prev) => [...prev.filter((u) => u.id !== enrichedUser.id), enrichedUser]);
      await saveUserToFirestore(enrichedUser, undefined, attendance).catch((e) =>
        console.warn('Firestore addUser sync:', e)
      );
      return enrichedUser;
    });
  };

  const updateUser = async (id: string, userData: Partial<User>) => {
    return runWithHudLoading('Đang cập nhật thông tin nhân sự...', async () => {
      const res = await api.updateUser(id, userData);
      const enrichedUser = enrichUserWithAttendanceStats(res.user, attendance);
      setUsers((prev) => prev.map((u) => (u.id === id ? enrichedUser : u)));
      if (currentUser?.id === id) {
        setCurrentUser(enrichedUser);
      }
      await saveUserToFirestore(enrichedUser, undefined, attendance).catch((e) =>
        console.warn('Firestore updateUser sync:', e)
      );
      return enrichedUser;
    });
  };

  const deleteUser = async (id: string) => {
    return runWithHudLoading('Đang xoá tài khoản nhân sự...', async () => {
      await api.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      await deleteUserFromFirestore(id).catch((e) => console.warn('Firestore deleteUser sync:', e));
    });
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<User> => {
    if (!currentUser) throw new Error('Vui lòng đăng nhập để đổi mật khẩu.');
    return runWithHudLoading('Đang cập nhật mật khẩu bảo mật...', async () => {
      const res = await api.changePassword(currentUser.id, currentPassword, newPassword);
      setCurrentUser(res.user);
      setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? res.user : u)));
      await saveUserToFirestore(res.user, undefined, attendance).catch((e) =>
        console.warn('Firestore changePassword sync:', e)
      );
      return res.user;
    });
  };

  const sendEmailReport = async (recipient?: string): Promise<EmailLog> => {
    return runWithHudLoading('Đang gửi báo cáo chấm công qua Email...', async () => {
      const res = await api.sendEmailReport({
        recipient: recipient || storeConfig?.managerEmail,
        trigger: 'manual',
      });
      return res.log;
    });
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
        actionLoadingMessage,
        runWithHudLoading,
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

      {/* Global Action HUD Loading Overlay - Blocks all duplicate clicks & provides instant visual feedback */}
      {actionLoadingMessage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none pointer-events-auto animate-in fade-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-xs rounded-3xl bg-zinc-900/95 border border-indigo-500/40 shadow-2xl shadow-indigo-950/60 p-6 text-center space-y-3.5">
            <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 animate-ping" />
              <div className="relative w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-zinc-100 leading-snug">
                {actionLoadingMessage}
              </div>
              <div className="text-[11px] text-zinc-400 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Đã khoá thao tác chống bấm trùng lặp</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

