/**
 * REPOSITORY IMPLEMENTATION: LocalUserRepository
 * Hạ tầng lưu trữ dữ liệu nhân sự trên localStorage (LSP & Offline Fallback)
 */

import type { IUserRepository } from '../../domain/contracts/IUserRepository.ts';
import type { User } from '../../types/index.ts';

const STORAGE_KEY = 'chammam_users_v2';

export class LocalUserRepository implements IUserRepository {
  private getLocalUsers(): User[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn('LocalUserRepository read warning:', e);
    }
    return [];
  }

  private setLocalUsers(users: User[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
      }
    } catch (e) {
      console.warn('LocalUserRepository write warning:', e);
    }
  }

  async getAll(): Promise<User[]> {
    return this.getLocalUsers();
  }

  async getById(id: string): Promise<User | null> {
    const users = this.getLocalUsers();
    return users.find((u) => u.id === id) || null;
  }

  async getByUsername(username: string): Promise<User | null> {
    const clean = username.trim().toLowerCase();
    const users = this.getLocalUsers();
    return users.find((u) => u.username.trim().toLowerCase() === clean) || null;
  }

  async save(user: User): Promise<User> {
    const users = this.getLocalUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      users[idx] = { ...user };
    } else {
      users.push({ ...user });
    }
    this.setLocalUsers(users);
    return user;
  }

  async delete(id: string): Promise<boolean> {
    const users = this.getLocalUsers();
    const filtered = users.filter((u) => u.id !== id);
    if (filtered.length !== users.length) {
      this.setLocalUsers(filtered);
      return true;
    }
    return false;
  }
}
