/**
 * APPLICATION SERVICE: AuthService
 * Chuyên trách: Xác thực danh tính, đăng nhập (Supabase / Local), đổi mật khẩu (SRP)
 */

import type { User, AttendanceRecord } from '../types/index.ts';
import {
  isSupabaseConfigured,
  loginFromSupabase,
  loginWithGoogleOAuth,
  changePasswordFromSupabase,
  saveUserToSupabase,
  fetchUsersFromSupabase,
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

export class AuthService {
  async login(username: string, password: string): Promise<{ success: boolean; user: User }> {
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '');

    // 1. Kiểm tra Supabase trực tiếp nếu đã cấu hình
    if (isSupabaseConfigured) {
      try {
        const sbUser = await loginFromSupabase(cleanUsername, cleanPassword);
        if (sbUser) {
          return { success: true, user: sbUser };
        }
      } catch (e) {
        console.warn('Supabase login warning:', e);
      }
    }

    // 2. Truy vấn endpoint máy chủ backend nếu khả dụng
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
      });
      if (ok && data?.user) {
        if (isSupabaseConfigured) {
          saveUserToSupabase(data.user).catch(() => {});
        }
        return data;
      }
    } catch {}

    // 3. Fallback danh sách local
    const localUsers = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
    const matched = localUsers.find(
      (u) =>
        u.username?.trim().toLowerCase() === cleanUsername.toLowerCase() &&
        String(u.password || '') === cleanPassword &&
        u.isActive !== false
    );
    if (matched) {
      return { success: true, user: matched };
    }

    throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác.');
  }

  async loginWithGoogle(): Promise<void> {
    await loginWithGoogleOAuth();
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; user: User }> {
    let currentUsers: User[] = loadLocal<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
    if (isSupabaseConfigured) {
      try {
        const sbUsers = await fetchUsersFromSupabase();
        if (sbUsers.length > 0) currentUsers = sbUsers;
      } catch {}
    }

    const idx = currentUsers.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('Không tìm thấy tài khoản người dùng trên hệ thống');

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

    // 1. Lưu lên Supabase
    if (isSupabaseConfigured) {
      try {
        await changePasswordFromSupabase(userId, currentPassword, newPassword);
      } catch (e) {
        await saveUserToSupabase(updatedUser).catch(() => {});
      }
    }

    // 2. Lưu local cache & backend endpoint
    const nextUsers = currentUsers.map((u) => (u.id === userId ? updatedUser : u));
    saveLocal(STORAGE_KEYS.USERS, nextUsers);
    fetch(`${API_BASE}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser),
    }).catch(() => {});

    return { success: true, user: updatedUser };
  }
}

export const authService = new AuthService();
