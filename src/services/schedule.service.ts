/**
 * SERVICE: schedule.service
 * Quản lý gọi API và bộ nhớ đệm cho nghiệp vụ Đăng Ký Ca Làm Việc theo tuần (SRP)
 */

import type { WeekSchedule, ShiftRegistrationItem } from '../types/index.ts';
import { getRollingWeeks, pruneSchedulesToWindow, type WeekMeta } from '../utils/week.ts';

const STORAGE_KEY_SCHEDULES = 'chao_mam_nho_shift_schedules';

function loadLocalSchedules(): WeekSchedule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SCHEDULES);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalSchedules(list: WeekSchedule[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SCHEDULES, JSON.stringify(list));
  } catch {}
}

export class ScheduleService {
  async getSchedules(): Promise<{ weeksMeta: WeekMeta[]; schedules: WeekSchedule[] }> {
    const rolling = getRollingWeeks(new Date());
    const allowedWeekIds = new Set(rolling.map((w) => w.weekId));

    try {
      const res = await fetch('/api/schedules');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.schedules)) {
          saveLocalSchedules(data.schedules);
          return {
            weeksMeta: data.weeksMeta || rolling,
            schedules: data.schedules,
          };
        }
      }
    } catch {}

    let local = loadLocalSchedules();
    local = pruneSchedulesToWindow(local, allowedWeekIds);
    return {
      weeksMeta: rolling,
      schedules: local,
    };
  }

  async getWeekSchedule(weekId: string): Promise<{ schedule: WeekSchedule | null; meta: WeekMeta | null }> {
    const rolling = getRollingWeeks(new Date());
    const meta = rolling.find((w) => w.weekId === weekId) || null;

    try {
      const res = await fetch(`/api/schedules/${weekId}`);
      if (res.ok) {
        const data = await res.json();
        return {
          schedule: data.schedule || null,
          meta: data.meta || meta,
        };
      }
    } catch {}

    const localList = loadLocalSchedules();
    const found = localList.find((s) => s.weekId === weekId) || null;
    return {
      schedule: found,
      meta,
    };
  }

  async registerShift(payload: {
    weekId: string;
    userId: string;
    date: string;
    shiftId: string;
    shiftName?: string;
    action: 'register' | 'unregister';
    note?: string;
    isManagerOverride?: boolean;
  }): Promise<{ success: boolean; message: string; schedule: WeekSchedule }> {
    try {
      const res = await fetch('/api/schedules/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Đăng ký ca thất bại.');
      }
      if (data.schedule) {
        const localList = loadLocalSchedules();
        const idx = localList.findIndex((s) => s.weekId === data.schedule.weekId);
        if (idx >= 0) localList[idx] = data.schedule;
        else localList.push(data.schedule);
        saveLocalSchedules(localList);
      }
      return data;
    } catch (err: any) {
      // Local fallback if offline
      const localList = loadLocalSchedules();
      let ws = localList.find((s) => s.weekId === payload.weekId);
      const rolling = getRollingWeeks(new Date());
      const meta = rolling.find((w) => w.weekId === payload.weekId);

      if (!ws && meta) {
        ws = {
          weekId: meta.weekId,
          weekNumber: meta.weekNumber,
          year: meta.year,
          startDate: meta.startDate,
          endDate: meta.endDate,
          isLocked: false,
          registrations: [],
          updatedAt: new Date().toISOString(),
        };
        localList.push(ws);
      }

      if (!ws) throw err;

      if (ws.isLocked && !payload.isManagerOverride) {
        throw new Error('Bảng đăng ký ca tuần này đã bị khóa bởi Quản lý.');
      }

      const regId = `reg_${payload.userId}_${payload.date}_${payload.shiftId}`;
      const existingIdx = ws.registrations.findIndex(
        (r) => r.id === regId || (r.userId === payload.userId && r.date === payload.date && r.shiftId === payload.shiftId)
      );

      if (payload.action === 'unregister') {
        if (existingIdx >= 0) ws.registrations.splice(existingIdx, 1);
      } else {
        const item: ShiftRegistrationItem = {
          id: regId,
          userId: payload.userId,
          userName: 'Nhân viên',
          date: payload.date,
          shiftId: payload.shiftId,
          shiftName: payload.shiftName || (payload.shiftId === 'shift_morning' ? 'Ca Sáng' : 'Ca Chiều'),
          registeredAt: new Date().toISOString(),
          note: payload.note,
        };
        if (existingIdx >= 0) ws.registrations[existingIdx] = item;
        else ws.registrations.push(item);
      }

      ws.updatedAt = new Date().toISOString();
      saveLocalSchedules(localList);
      return {
        success: true,
        message: payload.action === 'unregister' ? 'Đã hủy ca.' : 'Đã đăng ký ca.',
        schedule: ws,
      };
    }
  }

  async toggleScheduleLock(payload: {
    weekId: string;
    isLocked: boolean;
    managerName?: string;
  }): Promise<{ success: boolean; message: string; schedule: WeekSchedule }> {
    try {
      const res = await fetch('/api/schedules/toggle-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Khóa/mở ca thất bại.');
      }
      if (data.schedule) {
        const localList = loadLocalSchedules();
        const idx = localList.findIndex((s) => s.weekId === data.schedule.weekId);
        if (idx >= 0) localList[idx] = data.schedule;
        else localList.push(data.schedule);
        saveLocalSchedules(localList);
      }
      return data;
    } catch (err: any) {
      const localList = loadLocalSchedules();
      let ws = localList.find((s) => s.weekId === payload.weekId);
      const rolling = getRollingWeeks(new Date());
      const meta = rolling.find((w) => w.weekId === payload.weekId);

      if (!ws && meta) {
        ws = {
          weekId: meta.weekId,
          weekNumber: meta.weekNumber,
          year: meta.year,
          startDate: meta.startDate,
          endDate: meta.endDate,
          isLocked: payload.isLocked,
          registrations: [],
          updatedAt: new Date().toISOString(),
        };
        localList.push(ws);
      }

      if (!ws) throw err;
      ws.isLocked = payload.isLocked;
      if (payload.isLocked) {
        ws.lockedBy = payload.managerName || 'Quản lý';
        ws.lockedAt = new Date().toISOString();
      } else {
        ws.lockedBy = undefined;
        ws.lockedAt = undefined;
      }
      ws.updatedAt = new Date().toISOString();
      saveLocalSchedules(localList);
      return {
        success: true,
        message: payload.isLocked ? 'Đã khóa đăng ký tuần này.' : 'Đã mở đăng ký tuần này.',
        schedule: ws,
      };
    }
  }
}

export const scheduleService = new ScheduleService();
