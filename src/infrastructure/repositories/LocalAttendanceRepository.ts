/**
 * REPOSITORY IMPLEMENTATION: LocalAttendanceRepository
 * Hạ tầng lưu trữ dữ liệu chấm công trên localStorage của trình duyệt (LSP & Offline Fallback)
 */

import type { IAttendanceRepository } from '../../domain/contracts/IAttendanceRepository.ts';
import type { AttendanceRecord } from '../../types/index.ts';

const STORAGE_KEY = 'chammam_attendance_v2';

export class LocalAttendanceRepository implements IAttendanceRepository {
  private getLocalList(): AttendanceRecord[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn('LocalAttendanceRepository read warning:', e);
    }
    return [];
  }

  private setLocalList(list: AttendanceRecord[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
    } catch (e) {
      console.warn('LocalAttendanceRepository write warning:', e);
    }
  }

  async getAll(): Promise<AttendanceRecord[]> {
    return this.getLocalList();
  }

  async getById(id: string): Promise<AttendanceRecord | null> {
    const list = this.getLocalList();
    return list.find((r) => r.id === id) || null;
  }

  async getByUserId(userId: string): Promise<AttendanceRecord[]> {
    const list = this.getLocalList();
    return list.filter((r) => r.userId === userId);
  }

  async save(record: AttendanceRecord): Promise<AttendanceRecord> {
    const list = this.getLocalList();
    const idx = list.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
      list[idx] = { ...record };
    } else {
      list.unshift({ ...record });
    }
    this.setLocalList(list);
    return record;
  }

  async saveBatch(records: AttendanceRecord[]): Promise<void> {
    if (records.length === 0) return;
    const list = this.getLocalList();
    const map = new Map<string, AttendanceRecord>(list.map((r) => [r.id, r]));
    for (const r of records) {
      map.set(r.id, r);
    }
    this.setLocalList(Array.from(map.values()));
  }

  async delete(id: string): Promise<boolean> {
    const list = this.getLocalList();
    const filtered = list.filter((r) => r.id !== id);
    if (filtered.length !== list.length) {
      this.setLocalList(filtered);
      return true;
    }
    return false;
  }

  async deleteBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const list = this.getLocalList();
    const filtered = list.filter((r) => !idSet.has(r.id));
    this.setLocalList(filtered);
  }
}
