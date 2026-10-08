/**
 * REPOSITORY IMPLEMENTATION: SupabaseAttendanceRepository
 * Hạ tầng lưu trữ dữ liệu chấm công trên cơ sở dữ liệu Supabase PostgreSQL (LSP & DIP)
 */

import type { IAttendanceRepository } from '../../domain/contracts/IAttendanceRepository.ts';
import type { AttendanceRecord } from '../../types/index.ts';
import {
  isSupabaseConfigured,
  fetchAttendanceFromSupabase,
  saveAttendanceToSupabase,
  deleteAttendanceFromSupabase,
} from '../../supabase.ts';

export class SupabaseAttendanceRepository implements IAttendanceRepository {
  async getAll(): Promise<AttendanceRecord[]> {
    if (!isSupabaseConfigured) return [];
    return await fetchAttendanceFromSupabase();
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
    if (isSupabaseConfigured) {
      await saveAttendanceToSupabase(record);
    }
    return record;
  }

  async saveBatch(records: AttendanceRecord[]): Promise<void> {
    if (!isSupabaseConfigured || records.length === 0) return;
    for (const rec of records) {
      await saveAttendanceToSupabase(rec);
    }
  }

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      await deleteAttendanceFromSupabase(id);
      return true;
    }
    return false;
  }

  async deleteBatch(ids: string[]): Promise<void> {
    if (!isSupabaseConfigured || ids.length === 0) return;
    for (const id of ids) {
      await deleteAttendanceFromSupabase(id);
    }
  }
}
