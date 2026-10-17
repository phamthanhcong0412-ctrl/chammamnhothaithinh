/**
 * REPOSITORY IMPLEMENTATION: CompositeUserRepository
 * Tổ hợp truy xuất dữ liệu nhân sự (Supabase Primary + Local Storage Cache / Fallback - DIP & LSP)
 */

import type { IUserRepository } from '../../domain/contracts/IUserRepository.ts';
import type { User } from '../../types/index.ts';
import { SupabaseUserRepository } from './SupabaseUserRepository.ts';
import { LocalUserRepository } from './LocalUserRepository.ts';
import { isSupabaseConfigured } from '../../supabase.ts';

export class CompositeUserRepository implements IUserRepository {
  private remoteRepo: IUserRepository;
  private localRepo: IUserRepository;

  constructor(
    remoteRepo: IUserRepository = new SupabaseUserRepository(),
    localRepo: IUserRepository = new LocalUserRepository()
  ) {
    this.remoteRepo = remoteRepo;
    this.localRepo = localRepo;
  }

  async getAll(): Promise<User[]> {
    if (isSupabaseConfigured) {
      try {
        const remoteUsers = await this.remoteRepo.getAll();
        if (remoteUsers.length > 0) {
          for (const u of remoteUsers) {
            await this.localRepo.save(u);
          }
          return remoteUsers;
        }
      } catch (err) {
        console.warn('CompositeUserRepository remote read warning, falling back to local:', err);
      }
    }
    return await this.localRepo.getAll();
  }

  async getById(id: string): Promise<User | null> {
    const users = await this.getAll();
    return users.find((u) => u.id === id) || null;
  }

  async getByUsername(username: string): Promise<User | null> {
    const users = await this.getAll();
    const clean = username.trim().toLowerCase();
    return users.find((u) => u.username.trim().toLowerCase() === clean) || null;
  }

  async save(user: User): Promise<User> {
    await this.localRepo.save(user);
    if (isSupabaseConfigured) {
      try {
        await this.remoteRepo.save(user);
      } catch (err) {
        console.warn('Lỗi ghi remote user:', err);
      }
    }
    return user;
  }

  async delete(id: string): Promise<boolean> {
    await this.localRepo.delete(id);
    if (isSupabaseConfigured) {
      try {
        await this.remoteRepo.delete(id);
      } catch (err) {
        console.warn('Lỗi xóa remote user:', err);
      }
    }
    return true;
  }
}
