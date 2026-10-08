/**
 * REPOSITORY IMPLEMENTATION: CompositeAttendanceRepository
 * Tổ hợp lưu trữ kết hợp (Supabase Primary + Local Storage Cache / Offline Fallback - DIP & LSP)
 */

import type { IAttendanceRepository } from '../../domain/contracts/IAttendanceRepository.ts';
import type { AttendanceRecord } from '../../types/index.ts';
import { SupabaseAttendanceRepository } from './SupabaseAttendanceRepository.ts';
import { LocalAttendanceRepository } from './LocalAttendanceRepository.ts';
import { isSupabaseConfigured } from '../../supabase.ts';

export class CompositeAttendanceRepository implements IAttendanceRepository {
  private remoteRepo: IAttendanceRepository;
  private localRepo: IAttendanceRepository;

  constructor(
    remoteRepo: IAttendanceRepository = new SupabaseAttendanceRepository(),
    localRepo: IAttendanceRepository = new LocalAttendanceRepository()
  ) {
    this.remoteRepo = remoteRepo;
    this.localRepo = localRepo;
  }

  async getAll(): Promise<AttendanceRecord[]> {
    if (isSupabaseConfigured) {
      try {
        const remoteRecords = await this.remoteRepo.getAll();
        if (remoteRecords.length > 0) {
          // Đồng bộ vào bộ nhớ tạm local
          await this.localRepo.saveBatch(remoteRecords);
          return remoteRecords;
        }
      } catch (err) {
        console.warn('CompositeAttendanceRepository remote read warning, falling back to local:', err);
      }
    }
    return await this.localRepo.getAll();
  }

  async getById(id: string): Promise<AttendanceRecord | null> {
    const list = await this.getAll();
    return list.find((r) => r.id === id) || null;
  }

  async getByUserId(userId: string): Promise<AttendanceRecord[]> {
    const list = await this.getAll();
    return list.filter((r) => r.userId === userId);
  }

  async save(record: AttendanceRecord): Promise<AttendanceRecord> {
    // 1. Lưu ngay vào local cache để phản hồi tức thì trên UI
    await this.localRepo.save(record);

    // 2. Lưu đồng thời lên Supabase nếu có kết nối
    if (isSupabaseConfigured) {
      try {
        await this.remoteRepo.save(record);
      } catch (err) {
        console.warn('Lỗi ghi remote attendance (sẽ lưu tạm local):', err);
      }
    }
    return record;
  }

  async saveBatch(records: AttendanceRecord[]): Promise<void> {
    await this.localRepo.saveBatch(records);
    if (isSupabaseConfigured) {
      try {
        await this.remoteRepo.saveBatch(records);
      } catch (err) {
        console.warn('Lỗi ghi remote attendance batch:', err);
      }
    }
  }

  async delete(id: string): Promise<boolean> {
    await this.localRepo.delete(id);
    if (isSupabaseConfigured) {
      try {
        await this.remoteRepo.delete(id);
      } catch (err) {
        console.warn('Lỗi xóa remote attendance:', err);
      }
    }
    return true;
  }

  async deleteBatch(ids: string[]): Promise<void> {
    await this.localRepo.deleteBatch(ids);
    if (isSupabaseConfigured) {
      try {
        await this.remoteRepo.deleteBatch(ids);
      } catch (err) {
        console.warn('Lỗi xóa remote attendance batch:', err);
      }
    }
  }
}
