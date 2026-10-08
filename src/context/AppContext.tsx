import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  deleteAttendanceFromSupabase,
  saveAttendanceToSupabase,
  saveUserToSupabase,
  deleteUserFromSupabase,
  syncAllUsersToSupabase,
  saveStoreConfigToSupabase,
  enrichUserWithAttendanceStats,
  enrichAttendanceRecord,
  loginWithGoogleOAuth,
  type SupabaseSyncResult,
} from '../supabase.ts';
import { ActionHudLoading } from '../components/common/ActionHudLoading.tsx';

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

const AppContext = createContext<AppContextType | undefined>(undefined);

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => readStorage('chammam_users_v2', []));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const parsed = readStorage<AttendanceRecord[]>('chammam_attendance_v2', []);
    return consolidateCompletedShifts(parsed, []).consolidated;
  });
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(() => readStorage('chammam_store_config_v2', null));
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUsername = localStorage.getItem('chammam_auth_username');
      const rawUsers = readStorage<User[]>('chammam_users_v2', []);
      if (savedUsername && rawUsers.length > 0) {
        return rawUsers.find((u) => u.username?.toLowerCase() === savedUsername.toLowerCase() && u.isActive !== false) || null;
      }
    } catch {}
    return null;
  });
  const [supabaseUser, setSupabaseUser] = useState<any | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SupabaseSyncResult | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => !localStorage.getItem('chammam_users_v2'));
  const [actionLoadingMessage, setActionLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isActionLockedRef = useRef(false);
  const usersRef = useRef<User[]>(users);
  usersRef.current = users;

  const runWithHudLoading = useCallback(async <T,>(message: string, fn: () => Promise<T>): Promise<T> => {
    if (isActionLockedRef.current) throw new Error('Hệ thống đang xử lý, vui lòng chờ...');
    isActionLockedRef.current = true;
    setActionLoadingMessage(message);
    const start = Date.now();
    try {
      const res = await fn();
      const elapsed = Date.now() - start;
      if (elapsed < 320) await new Promise((r) => setTimeout(r, 320 - elapsed));
      return res;
    } finally {
      isActionLockedRef.current = false;
      setActionLoadingMessage(null);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const activeRecord = currentUser
    ? attendance.find((r) => r.userId === currentUser.id && r.status === 'working') || null
    : null;

  const syncUserAndAttendanceState = useCallback((nextAttendance: AttendanceRecord[], targetUserId?: string) => {
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
  }, [currentUser, users]);

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
      const { consolidated, removedIds, updatedRecords } = consolidateCompletedShifts(attList, userList);
      if (removedIds.length > 0 || updatedRecords.length > 0) {
        Promise.all([
          ...updatedRecords.map((r) => saveAttendanceToSupabase(r).catch(() => {})),
          ...removedIds.map((id) => deleteAttendanceFromSupabase(id).catch(() => {})),
          fetch('/api/attendance/sync', {
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
        localStorage.setItem('chammam_users_v2', JSON.stringify(enrichedUsers));
        localStorage.setItem('chammam_attendance_v2', JSON.stringify(enrichedAtt));
      } catch {}
      if (netInfo) setNetworkInfo(netInfo);
      setCurrentUser((prev) => {
        if (prev) return enrichedUsers.find((u) => u.id === prev.id) || prev;
        const savedUsername = localStorage.getItem('chammam_auth_username');
        return savedUsername
          ? enrichedUsers.find((u) => u.username?.toLowerCase() === savedUsername.toLowerCase() && u.isActive !== false) || null
          : null;
      });
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      setError(err.message || 'Không thể tải dữ liệu hệ thống.');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      if (e.key === 'chammam_attendance_v2' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const { consolidated } = consolidateCompletedShifts(parsed, usersRef.current);
          const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, usersRef.current));
          setAttendance(enrichedAtt);
          setUsers((prev) => prev.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt)));
          setCurrentUser((prev) => (prev ? enrichUserWithAttendanceStats(prev, enrichedAtt) : null));
        } catch {}
      } else if (e.key === 'chammam_store_config_v2' && e.newValue) {
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

  const switchUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('chammam_auth_username', user.username);
  };

  const loginWithCredentials = async (username: string, password: string): Promise<User> => {
    return runWithHudLoading('Đang đăng nhập...', async () => {
      const res = await api.login(username.trim(), password);
      localStorage.setItem('chammam_auth_username', res.user.username);
      const immediateUser = enrichUserWithAttendanceStats(res.user, attendance);
      setCurrentUser(immediateUser);
      Promise.all([api.getUsers().catch(() => users), api.getAttendance().catch(() => attendance)]).then(([latestUsers, latestAtt]) => {
        const { consolidated } = consolidateCompletedShifts(latestAtt, latestUsers);
        const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, latestUsers));
        const enrichedUsers = latestUsers.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt));
        const updatedUser = enrichedUsers.find((u) => u.id === res.user.id) || enrichUserWithAttendanceStats(res.user, enrichedAtt);
        setAttendance(enrichedAtt);
        setUsers(enrichedUsers);
        setCurrentUser(updatedUser);
      });
      return immediateUser;
    });
  };

  const loginWithGoogle = async (): Promise<User | void> => {
    return runWithHudLoading('Đang kết nối Google...', async () => {
      await loginWithGoogleOAuth();
    });
  };

  const syncUsersToSupabase = async (): Promise<SupabaseSyncResult> => {
    return runWithHudLoading('Đang đồng bộ dữ liệu...', async () => {
      const { consolidated, removedIds } = consolidateCompletedShifts(attendance, users);
      const enrichedAtt = consolidated.map((r) => enrichAttendanceRecord(r, users));
      const enrichedUsers = users.map((u) => enrichUserWithAttendanceStats(u, enrichedAtt));
      setAttendance(enrichedAtt);
      setUsers(enrichedUsers);
      const result = await syncAllUsersToSupabase(enrichedUsers);
      if (storeConfig) await saveStoreConfigToSupabase(storeConfig).catch(() => {});
      for (const rid of removedIds) await deleteAttendanceFromSupabase(rid).catch(() => {});
      for (const rec of enrichedAtt.slice(0, 100)) await saveAttendanceToSupabase(rec).catch(() => {});
      fetch('/api/attendance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance: enrichedAtt, replace: true, removedIds }),
      }).catch(() => {});
      setLastSyncResult(result);
      return result;
    });
  };

  const logout = () => {
    localStorage.removeItem('chammam_auth_username');
    localStorage.removeItem('chammam_auth_email');
    if (isSupabaseConfigured) supabase.auth.signOut().catch(() => {});
    setCurrentUser(null);
  };

  const checkIn = async (payload?: {
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
      const enrichedRec = enrichAttendanceRecord(res.record, users);
      const nextAtt = [enrichedRec, ...attendance.filter((r) => !(r.userId === currentUser.id && r.status === 'working'))];
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
    return runWithHudLoading('Đang check-out...', async () => {
      const res = await api.checkOut({
        userId: currentUser.id,
        qrToken: payload?.qrToken,
        wifiSsid: payload?.wifiSsid,
        gps: payload?.gps,
        note: payload?.note,
      });
      const enrichedRec = enrichAttendanceRecord(res.record, users);
      const removedSet = new Set([...(res.removedId ? [res.removedId] : []), ...(res.removedIds || [])]);
      const filteredAtt = attendance.filter((r) => !removedSet.has(r.id) && !(r.userId === currentUser.id && r.status === 'working' && r.id !== enrichedRec.id));
      const nextAtt = filteredAtt.some((r) => r.id === enrichedRec.id)
        ? filteredAtt.map((r) => (r.id === enrichedRec.id ? enrichedRec : r))
        : [enrichedRec, ...filteredAtt];
      syncUserAndAttendanceState(nextAtt, currentUser.id);
      return enrichedRec;
    });
  };

  const checkOutUser = async (userId: string, note?: string): Promise<AttendanceRecord> => {
    const targetName = users.find((u) => u.id === userId)?.name || 'nhân viên';
    return runWithHudLoading(`Đang chốt ca cho ${targetName}...`, async () => {
      const res = await api.checkOut({
        userId,
        wifiSsid: storeConfig?.wifiSsid,
        note: note || 'Quản lý chốt ra ca',
        managerOverride: true,
      });
      const enrichedRec = enrichAttendanceRecord(res.record, users);
      const removedSet = new Set([...(res.removedId ? [res.removedId] : []), ...(res.removedIds || [])]);
      const filteredAtt = attendance.filter((r) => !removedSet.has(r.id) && !(r.userId === userId && r.status === 'working' && r.id !== enrichedRec.id));
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
    return runWithHudLoading('Đang lưu chấm công...', async () => {
      const res = await api.manualAttendance({ ...payload, adjustedBy: currentUser?.name || 'Quản lý' });
      const enrichedRec = enrichAttendanceRecord(res.record, users);
      const rawNextAtt = payload.id
        ? attendance.map((r) => (r.id === enrichedRec.id ? enrichedRec : r))
        : [enrichedRec, ...attendance];
      const { consolidated: nextAtt } = consolidateCompletedShifts(rawNextAtt, users);
      syncUserAndAttendanceState(nextAtt, payload.userId);
      await saveAttendanceToSupabase(enrichedRec).catch((e) => console.warn('Supabase manual attendance sync:', e));
      return enrichedRec;
    });
  };

  const deleteAttendance = async (id: string) => {
    return runWithHudLoading('Đang xóa chấm công...', async () => {
      const targetRec = attendance.find((r) => r.id === id);
      await api.deleteAttendance(id);
      const nextAtt = attendance.filter((r) => r.id !== id);
      syncUserAndAttendanceState(nextAtt, targetRec?.userId);
      const targetUser = users.find((u) => u.id === targetRec?.userId);
      await Promise.all([
        deleteAttendanceFromSupabase(id).catch((e) => console.warn('Supabase deleteAttendance sync:', e)),
        targetUser ? saveUserToSupabase(targetUser).catch(() => {}) : Promise.resolve(),
        fetch('/api/attendance/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendance: nextAtt, replace: true, removedIds: [id] }),
        }).catch(() => {}),
      ]);
    });
  };

  const updateConfig = async (cfg: Partial<StoreConfig>) => {
    return runWithHudLoading('Đang lưu cài đặt...', async () => {
      const res = await api.updateConfig(cfg);
      setStoreConfig(res.config);
      await saveStoreConfigToSupabase(res.config).catch(() => {});
      setNetworkInfo((prev) => (prev ? { ...prev, isAllowedIp: isClientIpAllowedByConfig(prev.clientIp, res.config) } : prev));
      api.getNetworkInfo(true).then((net) => setNetworkInfo(net)).catch(() => {});
    });
  };

  const addUser = async (userData: Partial<User>) => {
    return runWithHudLoading('Đang thêm nhân viên...', async () => {
      const res = await api.createUser(userData);
      const enrichedUser = enrichUserWithAttendanceStats(res.user, attendance);
      setUsers((prev) => [...prev.filter((u) => u.id !== enrichedUser.id), enrichedUser]);
      await saveUserToSupabase(enrichedUser).catch((e) => console.warn('Supabase addUser sync:', e));
      return enrichedUser;
    });
  };

  const updateUser = async (id: string, userData: Partial<User>) => {
    return runWithHudLoading('Đang cập nhật nhân viên...', async () => {
      const res = await api.updateUser(id, userData);
      const enrichedUser = enrichUserWithAttendanceStats(res.user, attendance);
      setUsers((prev) => prev.map((u) => (u.id === id ? enrichedUser : u)));
      if (currentUser?.id === id) setCurrentUser(enrichedUser);
      await saveUserToSupabase(enrichedUser).catch((e) => console.warn('Supabase updateUser sync:', e));
      return enrichedUser;
    });
  };

  const deleteUser = async (id: string) => {
    return runWithHudLoading('Đang xóa nhân viên...', async () => {
      await api.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      await deleteUserFromSupabase(id).catch((e) => console.warn('Supabase deleteUser sync:', e));
    });
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<User> => {
    if (!currentUser) throw new Error('Vui lòng đăng nhập để đổi mật khẩu.');
    return runWithHudLoading('Đang đổi mật khẩu...', async () => {
      const res = await api.changePassword(currentUser.id, currentPassword, newPassword);
      setCurrentUser(res.user);
      setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? res.user : u)));
      await saveUserToSupabase(res.user).catch((e) => console.warn('Supabase changePassword sync:', e));
      return res.user;
    });
  };

  const sendEmailReport = async (recipient?: string): Promise<EmailLog> => {
    return runWithHudLoading('Đang gửi báo cáo...', async () => {
      const res = await api.sendEmailReport({ recipient: recipient || storeConfig?.managerEmail, trigger: 'manual' });
      return res.log;
    });
  };

  return (
    <AppContext.Provider
      value={{
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
      }}
    >
      {children}
      <ActionHudLoading message={actionLoadingMessage} />
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
