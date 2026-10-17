/**
 * REPOSITORY IMPLEMENTATION: SupabaseUserRepository
 * Hạ tầng lưu trữ dữ liệu nhân sự trên Supabase PostgreSQL (LSP & DIP)
 */

import type { IUserRepository } from '../../domain/contracts/IUserRepository.ts';
import type { User } from '../../types/index.ts';
import {
  isSupabaseConfigured,
  fetchUsersFromSupabase,
  saveUserToSupabase,
  deleteUserFromSupabase,
} from '../../supabase.ts';

export class SupabaseUserRepository implements IUserRepository {
  async getAll(): Promise<User[]> {
    if (!isSupabaseConfigured) return [];
    return await fetchUsersFromSupabase();
  }

  async getById(id: string): Promise<User | null> {
    const users = await this.getAll();
    return users.find((u) => u.id === id) || null;
  }

  async getByUsername(username: string): Promise<User | null> {
    const clean = username.trim().toLowerCase();
    const users = await this.getAll();
    return users.find((u) => u.username.trim().toLowerCase() === clean) || null;
  }

  async save(user: User): Promise<User> {
    if (isSupabaseConfigured) {
      await saveUserToSupabase(user);
    }
    return user;
  }

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      await deleteUserFromSupabase(id);
      return true;
    }
    return false;
  }
}
