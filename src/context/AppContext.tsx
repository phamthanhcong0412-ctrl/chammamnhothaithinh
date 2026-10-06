import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  User,
  AttendanceRecord,
  StoreConfig,
  NetworkInfo,
  EmailLog,
} from '../types/index.ts';
import { api } from '../services/api.ts';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  fbSignOut,
  onAuthStateChanged,
  collection,
  query,
  where,
  onSnapshot,
  saveUserToFirestore,
  deleteUserFromFirestore,
  syncAllUsersToFirestore,
  saveAttendanceToFirestore,
  saveStoreConfigToFirestore,
  isBootstrappedAdminEmail,
  handleFirestoreError,
  OperationType,
  type FirebaseUser,
} from '../firebase.ts';
import firebaseAppletConfig from '../../firebase-applet-config.json';

interface AppContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  isFirebaseConnected: boolean;
  firebaseProjectId: string;
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
  syncUsersToFirebase: () => Promise<number>;
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
  sendEmailReport: (recipient?: string) => Promise<EmailLog>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [users, setUsers] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Track Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore listener for users when authenticated with Firebase
  useEffect(() => {
    if (!isAuthReady || !firebaseUser) return;

    const usersPath = 'users';
    const usersQuery = isBootstrappedAdminEmail(firebaseUser.email)
      ? collection(db, 'users')
      : query(collection(db, 'users'), where('ownerId', '==', firebaseUser.uid));

    const unsubUsers = onSnapshot(
      usersQuery,
      (snapshot) => {
        if (snapshot.empty) {
          // If admin connected for the first time and Firestore users collection is empty, seed current users
          if (isBootstrappedAdminEmail(firebaseUser.email) && users.length > 0) {
            syncAllUsersToFirestore(users).catch((err) => console.error('Initial Firestore seed error:', err));
          }
          return;
        }

        const firestoreUsers: User[] = snapshot.docs.map((d) => {
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
          };
        });

        setUsers((prev) => {
          const mergedMap = new Map<string, User>();
          prev.forEach((u) => mergedMap.set(u.id, u));
          firestoreUsers.forEach((u) => mergedMap.set(u.id, u));
          const mergedList = Array.from(mergedMap.values());
          try {
            localStorage.setItem('chammam_users_v1', JSON.stringify(mergedList));
          } catch {}
          return mergedList;
        });
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, usersPath);
        } catch (handledErr) {
          console.warn(handledErr);
        }
      }
    );

    return () => unsubUsers();
  }, [isAuthReady, firebaseUser]);

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
          projectId: firebaseAppletConfig.projectId,
          firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId,
          apiKey: firebaseAppletConfig.apiKey,
          authDomain: firebaseAppletConfig.authDomain,
          storageBucket: firebaseAppletConfig.storageBucket,
          messagingSenderId: firebaseAppletConfig.messagingSenderId,
          appId: firebaseAppletConfig.appId,
        },
      });
      setUsers(userList);
      setAttendance(attList);
      if (netInfo) setNetworkInfo(netInfo);

      // Restore current user only if saved in localStorage
      setCurrentUser((prev) => {
        if (prev) {
          const updated = userList.find((u) => u.id === prev.id);
          return updated || prev;
        }
        const savedUsername = localStorage.getItem('chammam_auth_username');
        if (savedUsername) {
          const matched = userList.find(
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

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 20000); // Polling every 20s
    return () => clearInterval(interval);
  }, [refreshData]);

  const switchUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('chammam_auth_username', user.username);
  };

  const loginWithCredentials = async (username: string, password: string): Promise<User> => {
    const cleanUsername = username.trim();
    const res = await api.login(cleanUsername, password);
    const loggedInUser = res.user;
    setCurrentUser(loggedInUser);
    localStorage.setItem('chammam_auth_username', loggedInUser.username);
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === loggedInUser.id);
      return exists ? prev.map((u) => (u.id === loggedInUser.id ? loggedInUser : u)) : [loggedInUser, ...prev];
    });
    if (auth.currentUser) {
      saveUserToFirestore(loggedInUser).catch((e) => console.warn('Firestore user sync warning:', e));
    }
    return loggedInUser;
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
      await syncAllUsersToFirestore(users.some((u) => u.id === matchedUser!.id) ? users : [...users, matchedUser]);
    } else {
      await saveUserToFirestore({ ...matchedUser, id: fbUser.uid });
    }

    if (!currentUser) {
      setCurrentUser(matchedUser);
      localStorage.setItem('chammam_auth_username', matchedUser.username);
    }

    return matchedUser;
  };

  const syncUsersToFirebase = async (): Promise<number> => {
    if (!auth.currentUser) {
      await loginWithGoogle();
    }
    return await syncAllUsersToFirestore(users);
  };

  const logout = () => {
    localStorage.removeItem('chammam_auth_username');
    localStorage.removeItem('chammam_auth_email');
    fbSignOut(auth).catch(() => {});
    setCurrentUser(null);
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
    setAttendance((prev) => [res.record, ...prev]);
    if (auth.currentUser) {
      saveAttendanceToFirestore(res.record).catch((e) => console.warn('Firestore attendance sync:', e));
    }
    return res.record;
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
    setAttendance((prev) =>
      prev.map((r) => (r.id === res.record.id ? res.record : r))
    );
    if (auth.currentUser) {
      saveAttendanceToFirestore(res.record).catch((e) => console.warn('Firestore checkout sync:', e));
    }
    return res.record;
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
    if (payload.id) {
      setAttendance((prev) => prev.map((r) => (r.id === res.record.id ? res.record : r)));
    } else {
      setAttendance((prev) => [res.record, ...prev]);
    }
    if (auth.currentUser) {
      saveAttendanceToFirestore(res.record).catch((e) => console.warn('Firestore manual attendance sync:', e));
    }
    return res.record;
  };

  const deleteAttendance = async (id: string) => {
    await api.deleteAttendance(id);
    setAttendance((prev) => prev.filter((r) => r.id !== id));
  };

  const updateConfig = async (cfg: Partial<StoreConfig>) => {
    const res = await api.updateConfig(cfg);
    setStoreConfig(res.config);
    if (auth.currentUser) {
      saveStoreConfigToFirestore(res.config).catch((e) => console.warn('Firestore config sync:', e));
    }
  };

  const addUser = async (userData: Partial<User>) => {
    const res = await api.createUser(userData);
    setUsers((prev) => [...prev, res.user]);
    if (auth.currentUser) {
      await saveUserToFirestore(res.user);
    }
    return res.user;
  };

  const updateUser = async (id: string, userData: Partial<User>) => {
    const res = await api.updateUser(id, userData);
    setUsers((prev) => prev.map((u) => (u.id === id ? res.user : u)));
    if (currentUser?.id === id) {
      setCurrentUser(res.user);
    }
    if (auth.currentUser) {
      await saveUserToFirestore(res.user);
    }
    return res.user;
  };

  const deleteUser = async (id: string) => {
    await api.deleteUser(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    if (auth.currentUser) {
      await deleteUserFromFirestore(id);
    }
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
        isFirebaseConnected: !!firebaseUser,
        firebaseProjectId: firebaseAppletConfig.projectId,
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
        manualAttendance,
        deleteAttendance,
        refreshData,
        updateConfig,
        addUser,
        updateUser,
        deleteUser,
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

