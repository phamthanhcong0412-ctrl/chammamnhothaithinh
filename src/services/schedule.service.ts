/**
 * SERVICE: schedule.service
 * Quản lý gọi API và bộ nhớ đệm cho nghiệp vụ Đăng Ký Ca Làm Việc theo tuần (SRP)
 * Đảm bảo kiến trúc Cloud-First (Supabase) + Local-First Fallback:
 * - Khi nhân viên đăng ký ca, luôn fetch trạng thái mới nhất từ Supabase trước khi gộp để KHÔNG làm mất dữ liệu của nhân viên khác.
 * - Hỗ trợ hoạt động đa thiết bị thời gian thực.
 */

import type { WeekSchedule, ShiftRegistrationItem } from '../types/index.ts';
import { getRollingWeeks, pruneSchedulesToWindow, type WeekMeta } from '../utils/week.ts';
import {
  isSupabaseConfigured,
  fetchSchedulesFromSupabase,
  fetchWeekScheduleFromSupabase,
  saveScheduleToSupabase,
} from '../supabase.ts';

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

    if (isSupabaseConfigured) {
      try {
        const sbSchedules = await fetchSchedulesFromSupabase();
        if (sbSchedules && sbSchedules.length > 0) {
          saveLocalSchedules(sbSchedules);
          return {
            weeksMeta: rolling,
            schedules: pruneSchedulesToWindow(sbSchedules, allowedWeekIds),
          };
        }
      } catch (e) {
        console.warn('Supabase getSchedules warning:', e);
      }
    }

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

    if (isSupabaseConfigured) {
      try {
        const sbSchedule = await fetchWeekScheduleFromSupabase(weekId);
        if (sbSchedule) {
          // Lưu vào local cache để đồng bộ
          const localList = loadLocalSchedules();
          const idx = localList.findIndex((s) => s.weekId === weekId);
          if (idx >= 0) localList[idx] = sbSchedule;
          else localList.push(sbSchedule);
          saveLocalSchedules(localList);

          return {
            schedule: sbSchedule,
            meta,
          };
        }
      } catch (e) {
        console.warn('Supabase getWeekSchedule warning:', e);
      }
    }

    try {
      const res = await fetch(`/api/schedules/${weekId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.schedule) {
          const localList = loadLocalSchedules();
          const idx = localList.findIndex((s) => s.weekId === weekId);
          if (idx >= 0) localList[idx] = data.schedule;
          else localList.push(data.schedule);
          saveLocalSchedules(localList);
        }
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
    userName?: string;
    userAvatar?: string;
    employeeCode?: string;
    date: string;
    shiftId: string;
    shiftName?: string;
    action: 'register' | 'unregister';
    note?: string;
    isManagerOverride?: boolean;
  }): Promise<{ success: boolean; message: string; schedule: WeekSchedule }> {
    const rolling = getRollingWeeks(new Date());
    const meta = rolling.find((w) => w.weekId === payload.weekId);

    // BƯỚC 1: Luôn lấy dữ liệu mới nhất từ Supabase trước tiên để không bị mất ca của đồng nghiệp
    let ws: WeekSchedule | null = null;
    if (isSupabaseConfigured) {
      try {
        ws = await fetchWeekScheduleFromSupabase(payload.weekId);
      } catch (err) {
        console.warn('Lấy lịch từ Supabase trước khi đăng ký ca cảnh báo:', err);
      }
    }

    // Nếu Supabase chưa có hoặc offline, kiểm tra Local Storage
    if (!ws) {
      const localList = loadLocalSchedules();
      ws = localList.find((s) => s.weekId === payload.weekId) || null;
    }

    // Nếu chưa từng có bản ghi nào thì khởi tạo tuần mới
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
    }

    if (!ws) {
      throw new Error('Không thể tìm thấy hoặc khởi tạo lịch của tuần này.');
    }

    // BƯỚC 2: Kiểm tra trạng thái khóa ca
    if (ws.isLocked && !payload.isManagerOverride) {
      throw new Error('Bảng đăng ký ca tuần này đã được Quản lý khóa. Bạn không thể chỉnh sửa.');
    }

    // BƯỚC 3: Cập nhật ca làm việc (GIỮ NGUYÊN 100% CA CỦA NHÂN VIÊN KHÁC)
    const currentRegs: ShiftRegistrationItem[] = Array.isArray(ws.registrations) ? [...ws.registrations] : [];
    const regId = `reg_${payload.userId}_${payload.date}_${payload.shiftId}`;

    const existingIdx = currentRegs.findIndex(
      (r) =>
        r.id === regId ||
        (r.userId === payload.userId && r.date === payload.date && r.shiftId === payload.shiftId)
    );

    if (payload.action === 'unregister') {
      if (existingIdx >= 0) {
        currentRegs.splice(existingIdx, 1);
      }
    } else {
      const newItem: ShiftRegistrationItem = {
        id: regId,
        userId: payload.userId,
        userName: payload.userName || 'Nhân viên',
        userAvatar: payload.userAvatar,
        employeeCode: payload.employeeCode,
        date: payload.date,
        shiftId: payload.shiftId,
        shiftName: payload.shiftName || (payload.shiftId === 'shift_morning' ? 'Ca Sáng' : 'Ca Chiều'),
        registeredAt: new Date().toISOString(),
        note: payload.note,
      };

      if (existingIdx >= 0) {
        currentRegs[existingIdx] = { ...currentRegs[existingIdx], ...newItem };
      } else {
        currentRegs.push(newItem);
      }
    }

    ws.registrations = currentRegs;
    ws.updatedAt = new Date().toISOString();

    // BƯỚC 4: Lưu đồng bộ lên Supabase ĐẦU TIÊN
    if (isSupabaseConfigured) {
      try {
        await saveScheduleToSupabase(ws);
      } catch (sbErr) {
        console.error('Lỗi lưu lịch ca lên Supabase:', sbErr);
      }
    }

    // BƯỚC 5: Cập nhật bộ nhớ cục bộ
    const localList = loadLocalSchedules();
    const lIdx = localList.findIndex((s) => s.weekId === ws.weekId);
    if (lIdx >= 0) localList[lIdx] = ws;
    else localList.push(ws);
    saveLocalSchedules(localList);

    // BƯỚC 6: Gửi ngầm tới backend API nếu có server Express chạy
    fetch('/api/schedules/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});

    return {
      success: true,
      message: payload.action === 'unregister' ? 'Đã hủy ca thành công.' : 'Đã đăng ký ca thành công.',
      schedule: ws,
    };
  }

  async toggleScheduleLock(payload: {
    weekId: string;
    isLocked: boolean;
    managerName?: string;
  }): Promise<{ success: boolean; message: string; schedule: WeekSchedule }> {
    const rolling = getRollingWeeks(new Date());
    const meta = rolling.find((w) => w.weekId === payload.weekId);

    // Lấy lịch mới nhất từ Supabase
    let ws: WeekSchedule | null = null;
    if (isSupabaseConfigured) {
      try {
        ws = await fetchWeekScheduleFromSupabase(payload.weekId);
      } catch {}
    }

    if (!ws) {
      const localList = loadLocalSchedules();
      ws = localList.find((s) => s.weekId === payload.weekId) || null;
    }

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
    }

    if (!ws) throw new Error('Không tìm thấy lịch tuần.');

    ws.isLocked = payload.isLocked;
    if (payload.isLocked) {
      ws.lockedBy = payload.managerName || 'Quản lý';
      ws.lockedAt = new Date().toISOString();
    } else {
      ws.lockedBy = undefined;
      ws.lockedAt = undefined;
    }
    ws.updatedAt = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        await saveScheduleToSupabase(ws);
      } catch (sbErr) {
        console.error('Lỗi lưu khóa ca lên Supabase:', sbErr);
      }
    }

    const localList = loadLocalSchedules();
    const lIdx = localList.findIndex((s) => s.weekId === ws.weekId);
    if (lIdx >= 0) localList[lIdx] = ws;
    else localList.push(ws);
    saveLocalSchedules(localList);

    fetch('/api/schedules/toggle-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});

    return {
      success: true,
      message: payload.isLocked ? 'Đã khóa đăng ký tuần này.' : 'Đã mở đăng ký tuần này.',
      schedule: ws,
    };
  }
}

export const scheduleService = new ScheduleService();
