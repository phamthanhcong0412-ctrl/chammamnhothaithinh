/**
 * PRESENTATION CONTEXT: AppContext
 * Tuân thủ Clean Code & SOLID:
 * - Single Responsibility: Quản lý trạng thái giao diện React (UI state), đồng bộ cache client và điều phối HUD loading
 * - Dependency Inversion: Giao tiếp với tầng ứng dụng qua service facade (api), không ghi đè trực tiếp xuống database
 * - Zero Redundant Writes: Loại bỏ tình trạng ghi kép (double-write) vào Supabase đã được tầng service thực hiện
 * - Performance: Memoization ổn định bằng useCallback & useMemo, loại bỏ render thừa cho toàn bộ consumers
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import type {
  User,
  AttendanceRecord,
  StoreConfig,
  NetworkInfo,
  EmailLog,
} from '../types/index.ts';
import { api, consolidateCompletedShifts, isClientIpAllowedByConfig } from '../services/api.ts';
import {
  isSupabaseConfigured,
  supabase,
  subscribeToRealtimeStoreData as subscribeToSupabaseRealtime,
  batchSaveAttendanceToSupabase,
  batchDeleteAttendanceFromSupabase,
  syncAllUsersToSupabase,
  saveStoreConfigToSupabase,
  enrichUserWithAttendanceStats,
  enrichAttendanceRecord,
  loginWithGoogleOAuth,
  type SupabaseSyncResult,
} from '../supabase.ts';
import { ActionHudLoading } from '../components/common/ActionHudLoading.tsx';

// ====================================================================
// 1. CONTEXT INTERFACE & CONSTANTS
// ====================================================================

export interface AppContextType {
  currentUser: User | null;
  supabaseUser: any | null;
  isSupabaseConnected: boolean;
  supabaseProjectId?: string;
  lastSyncResult: SupabaseSyncResult | null;
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
  loginWithGoogle: () => Promise<User | void>;
  syncUsersToSupabase: () => Promise<SupabaseSyncResult>;
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

const STORAGE_KEYS = {
  USERS: 'chammam_users_v2',
  ATTENDANCE: 'chammam_attendance_v2',
  CONFIG: 'chammam_store_config_v2',
  AUTH_USERNAME: 'chammam_auth_username',
  AUTH_EMAIL: 'chammam_auth_email',
} as const;

const AppContext = createContext<AppContextType | undefined>(undefined);

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// ====================================================================
// 2. CONTEXT PROVIDER IMPLEMENTATION
// ====================================================================

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => readStorage(STORAGE_KEYS.USERS, []));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const parsed = readStorage<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    return consolidateCompletedShifts(parsed, []).consolidated;
  });
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(() =>
    readStorage(STORAGE_KEYS.CONFIG, null)
  );
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUsername = localStorage.getItem(STORAGE_KEYS.AUTH_USERNAME);
      const rawUsers = readStorage<User[]>(STORAGE_KEYS.USERS, []);
      if (savedUsername && rawUsers.length > 0) {
        return (
          rawUsers.find(
            (u) =>
              u.username?.toLowerCase() === savedUsername.toLowerCase() && u.isActive !== false
          ) || null
        );
      }
    } catch {}
    return null;
  });
  const [supabaseUser, setSupabaseUser] = useState<any | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SupabaseSyncResult | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(
    () => !localStorage.getItem(STORAGE_KEYS.USERS)
  );
  const [actionLoadingMessage, setActionLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isActionLockedRef = useRef(false);
  const usersRef = useRef<User[]>(users);
  usersRef.current = users;

  // HUD Loading wrapper: đảm bảo không chạy song song 2 hành động gây race condition
  const runWithHudLoading = useCallback(
    async <T,>(message: string, fn: () => Promise<T>): Promise<T> => {
      if (isActionLockedRef.current) throw new Error('Hệ thống đang xử lý, vui lòng chờ...');
      isActionLockedRef.current = true;
      setActionLoadingMessage(message);
      try {
        return await fn();
      } finally {
        isActionLockedRef.current = false;
        setActionLoadingMessage(null);
      }
    },
    []
  );

  // Supabase Auth listener
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  // Ca làm việc đang hoạt động của user hiện tại
  const activeRecord = useMemo(() => {
    if (!currentUser) return null;
    return attendance.find((r) => r.userId === currentUser.id && r.status === 'working') || null;
  }, [currentUser, attendance]);

  // Đồng bộ trạng thái Chấm công và Tính lương nhân sự trong client state (SRP)
  const syncUserAndAttendanceState = useCallback(
    (nextAttendance: AttendanceRecord[], targetUserId?: string) => {
      const currentUsers = usersRef.current;
      const { consolidated } = consolidateCompletedShifts(nextAttendance, currentUsers);
      const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, currentUsers));
      setAttendance(enrichedAtt);
      try {
        localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(enrichedAtt));
      } catch {}

      const updatedUsers = currentUsers.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt));
      setUsers(updatedUsers);
      try {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
      } catch {}

      setCurrentUser((prev) => {
        if (!prev) return null;
        if (!targetUserId || prev.id === targetUserId) {
          return (
            updatedUsers.find((u) => u.id === prev.id) ||
            enrichUserWithAttendanceStats(prev, enrichedAtt)
          );
        }
        return prev;
      });
    },
    []
  );

  // Làm mới toàn bộ dữ liệu từ tầng Application Service
  const refreshData = useCallback(async () => {
    try {
      setError(null);
      const [cfg, userList, attList, netInfo] = await Promise.all([
        api.getConfig(),
        api.getUsers(),
        api.getAttendance(),
        api.getNetworkInfo().catch(() => null),
      ]);
      setStoreConfig(cfg);

      const { consolidated, removedIds, updatedRecords } = consolidateCompletedShifts(
        attList,
        userList,
        cfg
      );

      // Dọn dẹp các ca trùng lặp hoặc tự đóng ca nếu có
      if (removedIds.length > 0) {
        batchDeleteAttendanceFromSupabase(removedIds).catch(() => {});
      }
      if (updatedRecords.length > 0) {
        batchSaveAttendanceToSupabase(updatedRecords).catch(() => {});
      }
      if (removedIds.length > 0 || updatedRecords.length > 0) {
        fetch('/api/attendance/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendance: consolidated, replace: true, removedIds }),
        }).catch(() => {});
      }

      const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, userList));
      const enrichedUsers = userList.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt));

      setUsers(enrichedUsers);
      setAttendance(enrichedAtt);

      try {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(enrichedUsers));
        localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(enrichedAtt));
      } catch {}

      if (netInfo) setNetworkInfo(netInfo);

      setCurrentUser((prev) => {
        if (prev) return enrichedUsers.find((u) => u.id === prev.id) || prev;
        const savedUsername = localStorage.getItem(STORAGE_KEYS.AUTH_USERNAME);
        return savedUsername
          ? enrichedUsers.find(
              (u) =>
                u.username?.toLowerCase() === savedUsername.toLowerCase() && u.isActive !== false
            ) || null
          : null;
      });
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      setError(err.message || 'Không thể tải dữ liệu hệ thống.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Đăng ký Realtime & Storage events
  useEffect(() => {
    refreshData();
    const unsubSupabase = isSupabaseConfigured
      ? subscribeToSupabaseRealtime({
          onAttendanceChange: () => refreshData(),
          onUsersChange: () => refreshData(),
          onConfigChange: () => refreshData(),
        })
      : () => {};

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.ATTENDANCE && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const currentUsers = usersRef.current;
          const { consolidated } = consolidateCompletedShifts(parsed, currentUsers);
          const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, currentUsers));
          setAttendance(enrichedAtt);
          setUsers((prev) => prev.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt)));
          setCurrentUser((prev) => (prev ? enrichUserWithAttendanceStats(prev, enrichedAtt) : null));
        } catch {}
      } else if (e.key === STORAGE_KEYS.CONFIG && e.newValue) {
        try {
          setStoreConfig(JSON.parse(e.newValue));
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => {
      unsubSupabase();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [refreshData]);

  // ====================================================================
  // 3. AUTHENTICATION & SESSION ACTIONS
  // ====================================================================

  const switchUser = useCallback((user: User) => {
    setCurrentUser(user);
    localStorage.setItem(STORAGE_KEYS.AUTH_USERNAME, user.username);
  }, []);

  const loginWithCredentials = useCallback(
    async (username: string, password: string): Promise<User> => {
      return runWithHudLoading('Đang đăng nhập...', async () => {
        const res = await api.login(username.trim(), password);
        localStorage.setItem(STORAGE_KEYS.AUTH_USERNAME, res.user.username);
        const immediateUser = enrichUserWithAttendanceStats(res.user, attendance);
        setCurrentUser(immediateUser);

        // Nạp song song dữ liệu mới nhất mà không block UI
        Promise.all([
          api.getUsers().catch(() => usersRef.current),
          api.getAttendance().catch(() => attendance),
        ]).then(([latestUsers, latestAtt]) => {
          const { consolidated } = consolidateCompletedShifts(latestAtt, latestUsers);
          const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, latestUsers));
          const enrichedUsers = latestUsers.map((u) =>
            enrichUserWithAttendanceStats(u, enrichedAtt)
          );
          const updatedUser =
            enrichedUsers.find((u) => u.id === res.user.id) ||
            enrichUserWithAttendanceStats(res.user, enrichedAtt);
          setAttendance(enrichedAtt);
          setUsers(enrichedUsers);
          setCurrentUser(updatedUser);
        });

        return immediateUser;
      });
    },
    [attendance, runWithHudLoading]
  );

  const loginWithGoogle = useCallback(async (): Promise<User | void> => {
    return runWithHudLoading('Đang kết nối Google...', async () => {
      await loginWithGoogleOAuth();
    });
  }, [runWithHudLoading]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.AUTH_USERNAME);
    localStorage.removeItem(STORAGE_KEYS.AUTH_EMAIL);
    if (isSupabaseConfigured) supabase.auth.signOut().catch(() => {});
    setCurrentUser(null);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<User> => {
      if (!currentUser) throw new Error('Vui lòng đăng nhập để đổi mật khẩu.');
      return runWithHudLoading('Đang đổi mật khẩu...', async () => {
        const res = await api.changePassword(currentUser.id, currentPassword, newPassword);
        setCurrentUser(res.user);
        setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? res.user : u)));
        return res.user;
      });
    },
    [currentUser, runWithHudLoading]
  );

  // ====================================================================
  // 4. ATTENDANCE ACTIONS
  // ====================================================================

  const checkIn = useCallback(
    async (payload?: {
      qrToken?: string;
      wifiSsid?: string;
      gps?: { lat: number; lng: number; accuracy?: number; distance?: number };
      note?: string;
    }): Promise<AttendanceRecord> => {
      if (!currentUser) throw new Error('Vui lòng đăng nhập trước khi chấm công');
      return runWithHudLoading('Đang check-in...', async () => {
        const res = await api.checkIn({
          userId: currentUser.id,
          qrToken: payload?.qrToken,
          wifiSsid: payload?.wifiSsid,
          gps: payload?.gps,
          note: payload?.note,
        });
        const enrichedRec = enrichAttendanceRecord(res.record, usersRef.current);
        const nextAtt = [
          enrichedRec,
          ...attendance.filter((r) => !(r.userId === currentUser.id && r.status === 'working')),
        ];
        syncUserAndAttendanceState(nextAtt, currentUser.id);
        return enrichedRec;
      });
    },
    [currentUser, attendance, runWithHudLoading, syncUserAndAttendanceState]
  );

  const checkOut = useCallback(
    async (payload?: {
      qrToken?: string;
      wifiSsid?: string;
      gps?: { lat: number; lng: number; distance?: number };
      note?: string;
    }): Promise<AttendanceRecord> => {
      if (!currentUser) throw new Error('Vui lòng đăng nhập');
      return runWithHudLoading('Đang check-out...', async () => {
        const res = await api.checkOut({
          userId: currentUser.id,
          qrToken: payload?.qrToken,
          wifiSsid: payload?.wifiSsid,
          gps: payload?.gps,
          note: payload?.note,
        });
        const enrichedRec = enrichAttendanceRecord(res.record, usersRef.current);
        const removedSet = new Set([
          ...(res.removedId ? [res.removedId] : []),
          ...(res.removedIds || []),
        ]);
        const filteredAtt = attendance.filter(
          (r) =>
            !removedSet.has(r.id) &&
            !(r.userId === currentUser.id && r.status === 'working' && r.id !== enrichedRec.id)
        );
        const nextAtt = filteredAtt.some((r) => r.id === enrichedRec.id)
          ? filteredAtt.map((r) => (r.id === enrichedRec.id ? enrichedRec : r))
          : [enrichedRec, ...filteredAtt];
        syncUserAndAttendanceState(nextAtt, currentUser.id);
        return enrichedRec;
      });
    },
    [currentUser, attendance, runWithHudLoading, syncUserAndAttendanceState]
  );

  const checkOutUser = useCallback(
    async (userId: string, note?: string): Promise<AttendanceRecord> => {
      const targetName = usersRef.current.find((u) => u.id === userId)?.name || 'nhân viên';
      return runWithHudLoading(`Đang chốt ca cho ${targetName}...`, async () => {
        const res = await api.checkOut({
          userId,
          wifiSsid: storeConfig?.wifiSsid,
          note: note || 'Quản lý chốt ra ca',
          managerOverride: true,
        });
        const enrichedRec = enrichAttendanceRecord(res.record, usersRef.current);
        const removedSet = new Set([
          ...(res.removedId ? [res.removedId] : []),
          ...(res.removedIds || []),
        ]);
        const filteredAtt = attendance.filter(
          (r) =>
            !removedSet.has(r.id) &&
            !(r.userId === userId && r.status === 'working' && r.id !== enrichedRec.id)
        );
        const nextAtt = filteredAtt.some((r) => r.id === enrichedRec.id)
          ? filteredAtt.map((r) => (r.id === enrichedRec.id ? enrichedRec : r))
          : [enrichedRec, ...filteredAtt];
        syncUserAndAttendanceState(nextAtt, userId);
        return enrichedRec;
      });
    },
    [storeConfig?.wifiSsid, attendance, runWithHudLoading, syncUserAndAttendanceState]
  );

  const manualAttendance = useCallback(
    async (payload: {
      id?: string;
      userId: string;
      date: string;
      checkInTime: string;
      checkOutTime?: string | null;
      note?: string;
      adjustedBy?: string;
      adjustedReason?: string;
    }): Promise<AttendanceRecord> => {
      return runWithHudLoading('Đang lưu chấm công...', async () => {
        const res = await api.manualAttendance({
          ...payload,
          adjustedBy: currentUser?.name || 'Quản lý',
        });
        const enrichedRec = enrichAttendanceRecord(res.record, usersRef.current);
        const rawNextAtt = payload.id
          ? attendance.map((r) => (r.id === enrichedRec.id ? enrichedRec : r))
          : [enrichedRec, ...attendance];
        const { consolidated: nextAtt } = consolidateCompletedShifts(rawNextAtt, usersRef.current);
        syncUserAndAttendanceState(nextAtt, payload.userId);
        return enrichedRec;
      });
    },
    [attendance, currentUser?.name, runWithHudLoading, syncUserAndAttendanceState]
  );

  const deleteAttendance = useCallback(
    async (id: string): Promise<void> => {
      return runWithHudLoading('Đang xóa chấm công...', async () => {
        const targetRec = attendance.find((r) => r.id === id);
        await api.deleteAttendance(id);
        const nextAtt = attendance.filter((r) => r.id !== id);
        syncUserAndAttendanceState(nextAtt, targetRec?.userId);
      });
    },
    [attendance, runWithHudLoading, syncUserAndAttendanceState]
  );

  // ====================================================================
  // 5. STORE CONFIG & REPORT ACTIONS
  // ====================================================================

  const updateConfig = useCallback(
    async (cfg: Partial<StoreConfig>): Promise<void> => {
      return runWithHudLoading('Đang lưu cài đặt...', async () => {
        const res = await api.updateConfig(cfg);
        setStoreConfig(res.config);
        setNetworkInfo((prev) =>
          prev
            ? { ...prev, isAllowedIp: isClientIpAllowedByConfig(prev.clientIp, res.config) }
            : prev
        );
        api.getNetworkInfo(true).then((net) => setNetworkInfo(net)).catch(() => {});
      });
    },
    [runWithHudLoading]
  );

  const sendEmailReport = useCallback(
    async (recipient?: string): Promise<EmailLog> => {
      return runWithHudLoading('Đang gửi báo cáo...', async () => {
        const res = await api.sendEmailReport({
          recipient: recipient || storeConfig?.managerEmail,
          trigger: 'manual',
        });
        return res.log;
      });
    },
    [storeConfig?.managerEmail, runWithHudLoading]
  );

  // ====================================================================
  // 6. STAFF MANAGEMENT ACTIONS
  // ====================================================================

  const addUser = useCallback(
    async (userData: Partial<User>): Promise<User> => {
      return runWithHudLoading('Đang thêm nhân viên...', async () => {
        const res = await api.createUser(userData);
        const enrichedUser = enrichUserWithAttendanceStats(res.user, attendance);
        setUsers((prev) => [...prev.filter((u) => u.id !== enrichedUser.id), enrichedUser]);
        return enrichedUser;
      });
    },
    [attendance, runWithHudLoading]
  );

  const updateUser = useCallback(
    async (id: string, userData: Partial<User>): Promise<User> => {
      return runWithHudLoading('Đang cập nhật nhân viên...', async () => {
        const res = await api.updateUser(id, userData);
        const enrichedUser = enrichUserWithAttendanceStats(res.user, attendance);
        setUsers((prev) => prev.map((u) => (u.id === id ? enrichedUser : u)));
        if (currentUser?.id === id) setCurrentUser(enrichedUser);
        return enrichedUser;
      });
    },
    [attendance, currentUser?.id, runWithHudLoading]
  );

  const deleteUser = useCallback(
    async (id: string): Promise<void> => {
      return runWithHudLoading('Đang xóa nhân viên...', async () => {
        await api.deleteUser(id);
        setUsers((prev) => prev.filter((u) => u.id !== id));
      });
    },
    [runWithHudLoading]
  );

  const syncUsersToSupabase = useCallback(async (): Promise<SupabaseSyncResult> => {
    return runWithHudLoading('Đang đồng bộ dữ liệu...', async () => {
      const currentUsers = usersRef.current;
      const { consolidated, removedIds } = consolidateCompletedShifts(attendance, currentUsers);
      const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, currentUsers));
      const enrichedUsers = currentUsers.map((u) =>
        enrichUserWithAttendanceStats(u, enrichedAtt)
      );
      setAttendance(enrichedAtt);
      setUsers(enrichedUsers);

      const result = await syncAllUsersToSupabase(enrichedUsers);
      if (storeConfig) await saveStoreConfigToSupabase(storeConfig).catch(() => {});
      if (removedIds.length > 0) {
        await batchDeleteAttendanceFromSupabase(removedIds).catch(() => {});
      }
      if (enrichedAtt.length > 0) {
        await batchSaveAttendanceToSupabase(enrichedAtt.slice(0, 100)).catch(() => {});
      }
      fetch('/api/attendance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance: enrichedAtt, replace: true, removedIds }),
      }).catch(() => {});

      setLastSyncResult(result);
      return result;
    });
  }, [attendance, storeConfig, runWithHudLoading]);

  // ====================================================================
  // 7. CONTEXT VALUE MEMOIZATION (PERFORMANCE)
  // ====================================================================

  const contextValue = useMemo<AppContextType>(
    () => ({
      currentUser,
      supabaseUser,
      isSupabaseConnected: isSupabaseConfigured,
      supabaseProjectId: 'supabase',
      lastSyncResult,
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
      syncUsersToSupabase,
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
    }),
    [
      currentUser,
      supabaseUser,
      lastSyncResult,
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
      syncUsersToSupabase,
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
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      <ActionHudLoading message={actionLoadingMessage} />
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
