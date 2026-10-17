/**
 * APPLICATION SERVICE: UserService
 * Chuyên trách: Quản lý danh sách nhân sự, tạo/sửa/xóa tài khoản, đồng bộ dữ liệu (SRP)
 */

import type { User, AttendanceRecord } from '../types/index.ts';
import {
  isSupabaseConfigured,
  fetchUsersFromSupabase,
  saveUserToSupabase,
  deleteUserFromSupabase,
  syncAllUsersToSupabase,
  type SupabaseSyncResult,
} from '../supabase.ts';
import { enrichUserWithAttendanceStats } from '../domain/index.ts';

const API_BASE = '/api';
const STORAGE_KEYS = {
  USERS: 'chammam_users_v2',
  ATTENDANCE: 'chammam_attendance_v2',
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
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      if (item) return JSON.parse(item);
    }
  } catch {}
  return fallback;
}

function saveLocal<T>(key: string, value: T): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {}
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

export class UserService {
  async getUsers(): Promise<User[]> {
    // 1. Đọc trực tiếp từ Supabase nếu có cấu hình
    if (isSupabaseConfigured) {
      try {
        const sbUsers = await fetchUsersFromSupabase();
        if (sbUsers.length > 0) {
          saveLocal(STORAGE_KEYS.USERS, sbUsers);
          return sbUsers;
        }
      } catch (e) {
        console.warn('Supabase direct getUsers warning:', e);
      }
    }

    const localAtt = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    // 2. Fallback: Đọc từ backend API /api/users
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/users`);
      if (ok) {
        const apiUsers: User[] = Array.isArray(data.users) ? data.users : Array.isArray(data) ? data : [];
        if (apiUsers.length > 0) {
          const enriched = apiUsers.map((u) => enrichUserWithAttendanceStats(u, localAtt));
          saveLocal(STORAGE_KEYS.USERS, enriched);
          if (isSupabaseConfigured) {
            for (const u of enriched) {
              saveUserToSupabase(u).catch(() => {});
            }
          }
          return enriched;
        }
      }
    } catch {}

    const fallback = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
    return fallback.map((u) => enrichUserWithAttendanceStats(u, localAtt));
  }

  async createUser(user: Partial<User>): Promise<{ success: boolean; user: User }> {
    const rawUsername = String(user.username || '').trim();
    const rawPassword = String(user.password || '').trim();
    if (!rawUsername || !rawPassword) {
      throw new Error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
    }

    let currentUsers: User[] = [];
    if (isSupabaseConfigured) {
      try {
        currentUsers = await fetchUsersFromSupabase();
      } catch {}
    }
    if (currentUsers.length === 0) {
      currentUsers = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
    }

    if (currentUsers.some((u) => u.username?.trim().toLowerCase() === rawUsername.toLowerCase())) {
      throw new Error(`Tên đăng nhập "${rawUsername}" đã tồn tại trên hệ thống.`);
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

    // 1. Lưu lên Supabase
    if (isSupabaseConfigured) {
      await saveUserToSupabase(newUser).catch((e) => console.warn('Supabase createUser warning:', e));
    }

    // 2. Đồng bộ local & backend API
    const nextUsers = [...currentUsers.filter((u) => u.id !== newUser.id), newUser];
    saveLocal(STORAGE_KEYS.USERS, nextUsers);
    fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    }).catch(() => {});

    return { success: true, user: newUser };
  }

  async updateUser(id: string, user: Partial<User>): Promise<{ success: boolean; user: User }> {
    let currentUsers: User[] = [];
    if (isSupabaseConfigured) {
      try {
        currentUsers = await fetchUsersFromSupabase();
      } catch {}
    }
    if (currentUsers.length === 0) {
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

    // 1. Lưu lên Supabase
    if (isSupabaseConfigured) {
      await saveUserToSupabase(updatedUser).catch((e) => console.warn('Supabase updateUser warning:', e));
    }

    // 2. Đồng bộ local & backend API
    const nextUsers =
      idx >= 0
        ? currentUsers.map((u) => (u.id === id ? updatedUser : u))
        : [...currentUsers, updatedUser];
    saveLocal(STORAGE_KEYS.USERS, nextUsers);
    fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser),
    }).catch(() => {});

    return { success: true, user: updatedUser };
  }

  async deleteUser(id: string): Promise<{ success: boolean }> {
    // 1. Xóa khỏi Supabase
    if (isSupabaseConfigured) {
      await deleteUserFromSupabase(id).catch((e) => console.warn('Supabase deleteUser warning:', e));
    }

    // 2. Đồng bộ local & backend API
    const users = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS).filter((u) => u.id !== id);
    saveLocal(STORAGE_KEYS.USERS, users);
    fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' }).catch(() => {});

    return { success: true };
  }

  async syncUsersToSupabase(usersList?: User[]): Promise<SupabaseSyncResult> {
    const targetList = usersList || (await this.getUsers());
    return await syncAllUsersToSupabase(targetList);
  }
}

export const userService = new UserService();
