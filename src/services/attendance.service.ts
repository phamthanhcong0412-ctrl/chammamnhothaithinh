/**
 * APPLICATION SERVICE: AttendanceService
 * Chuyên trách: Điều phối toàn bộ quy trình Check-in, Check-out, gộp ca đa lượt,
 * chấm công thủ công (manual) và xóa bản ghi chấm công (SRP).
 */

import type { User, AttendanceRecord, StoreConfig } from '../types/index.ts';
import {
  isSupabaseConfigured,
  fetchAttendanceFromSupabase,
  saveAttendanceToSupabase,
  deleteAttendanceFromSupabase,
  saveUserToSupabase,
} from '../supabase.ts';
import {
  calculateGpsDistanceMeters,
  isClientIpAllowedByConfig,
  isTimeInConfiguredShifts,
  evaluateShiftTiming,
  enrichAttendanceRecord,
  deduplicateAndMergeOverlappingTurns,
  consolidateCompletedShifts,
} from '../domain/index.ts';
import { DEFAULT_STORE_CONFIG } from '../infrastructure/index.ts';
import { userService } from './user.service.ts';
import { configService, detectClientPublicIp } from './config.service.ts';

const API_BASE = '/api';
const STORAGE_KEYS = {
  CONFIG: 'chammam_store_config_v2',
  ATTENDANCE: 'chammam_attendance_v2',
};

const activeCheckActionLocks = new Set<string>();

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

export class AttendanceService {
  async getAttendance(params?: { date?: string; userId?: string; month?: string }): Promise<AttendanceRecord[]> {
    const localUsers = await userService.getUsers();

    // 1. Primary: Đọc trực tiếp từ Supabase nếu có
    if (isSupabaseConfigured) {
      try {
        const sbAtt = await fetchAttendanceFromSupabase();
        if (sbAtt.length > 0) {
          const cfg = await configService.getConfig().catch(() => DEFAULT_STORE_CONFIG);
          const { consolidated } = consolidateCompletedShifts(sbAtt, localUsers, cfg);
          let list = consolidated;
          if (!params) saveLocal(STORAGE_KEYS.ATTENDANCE, list);
          if (params?.date) list = list.filter((r) => r.date === params.date);
          if (params?.userId) list = list.filter((r) => r.userId === params.userId);
          if (params?.month) list = list.filter((r) => r.date.startsWith(params.month!));
          return list.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
        }
      } catch (e) {
        console.warn('Supabase direct getAttendance warning:', e);
      }
    }

    // 2. Fallback backend API / localStorage
    try {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/attendance${query ? `?${query}` : ''}`);
      if (ok) {
        const rawList = Array.isArray(data) ? data : [];
        const cfg = await configService.getConfig().catch(() => DEFAULT_STORE_CONFIG);
        const { consolidated: enriched } = consolidateCompletedShifts(rawList, localUsers, cfg);
        if (!params) {
          saveLocal(STORAGE_KEYS.ATTENDANCE, enriched);
          if (isSupabaseConfigured) {
            for (const r of enriched) {
              saveAttendanceToSupabase(r).catch(() => {});
            }
          }
        }
        let list = enriched;
        if (params?.date) list = list.filter((r) => r.date === params.date);
        if (params?.userId) list = list.filter((r) => r.userId === params.userId);
        if (params?.month) list = list.filter((r) => r.date.startsWith(params.month!));
        return list.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
      }
    } catch {}

    const localList = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    const cfg = await configService.getConfig().catch(() => DEFAULT_STORE_CONFIG);
    const { consolidated: enriched } = consolidateCompletedShifts(localList, localUsers, cfg);
    let list = enriched;
    if (params?.date) list = list.filter((r) => r.date === params.date);
    if (params?.userId) list = list.filter((r) => r.userId === params.userId);
    if (params?.month) list = list.filter((r) => r.date.startsWith(params.month!));
    return list.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
  }

  async checkIn(payload: {
    userId: string;
    method?: string;
    wifiSsid?: string;
    wifiBssid?: string;
    gps?: { lat: number; lng: number };
    qrToken?: string;
    note?: string;
  }): Promise<{ success: boolean; record: AttendanceRecord }> {
    const lockKey = `check_${payload.userId}`;
    if (activeCheckActionLocks.has(lockKey)) {
      throw new Error('Hệ thống đang xử lý, vui lòng chờ trong giây lát.');
    }
    activeCheckActionLocks.add(lockKey);

    try {
      const users = await userService.getUsers();
      const user = users.find((u) => u.id === payload.userId);
      if (!user) throw new Error('Không tìm thấy thông tin nhân viên.');

      const cfg = await configService.getConfig().catch(() => DEFAULT_STORE_CONFIG);
      const rawAttendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      const { consolidated: attendance } = consolidateCompletedShifts(rawAttendance, users, cfg);

      if (attendance.some((r) => r.userId === payload.userId && r.status === 'working')) {
        throw new Error('Bạn đang trong ca làm việc, vui lòng check-out trước khi vào ca mới.');
      }

      const clientIp = await detectClientPublicIp(false);

      if (!isClientIpAllowedByConfig(clientIp, cfg)) {
        throw new Error(
          `Vui lòng kết nối đúng mạng WiFi "${cfg.wifiSsid}" của quán để chấm công.`
        );
      }

      if (cfg.requireGps && cfg.storeGps) {
        if (!payload.gps || typeof payload.gps.lat !== 'number' || typeof payload.gps.lng !== 'number') {
          throw new Error(
            'Vui lòng bật định vị GPS trên trình duyệt để xác nhận vị trí tại quán.'
          );
        }
        const dist = calculateGpsDistanceMeters(
          payload.gps.lat,
          payload.gps.lng,
          cfg.storeGps.lat,
          cfg.storeGps.lng
        );
        const maxRadius = cfg.storeGps.radiusMeters || 80;
        if (dist > maxRadius) {
          throw new Error(
            `Bạn đang ở cách quán ${dist}m (vượt quá bán kính cho phép ${maxRadius}m).`
          );
        }
      }

      const now = new Date();
      const shiftCheck = isTimeInConfiguredShifts(now, cfg);
      if (!shiftCheck.inShiftWindow) {
        throw new Error(
          `Hiện tại chưa đến hoặc đã qua giờ vào ca (${shiftCheck.allowedRangesText}).`
        );
      }

      const todayStr = getTodayString();
      const nowMs = now.getTime();
      const hasDuplicateSameTimestamp = attendance.some((r) => {
        if (r.userId !== payload.userId || r.date !== todayStr) return false;
        const inDiff = Math.abs(nowMs - new Date(r.checkInTime).getTime());
        const outDiff = r.checkOutTime ? Math.abs(nowMs - new Date(r.checkOutTime).getTime()) : Infinity;
        return inDiff < 15000 || outDiff < 5000;
      });
      if (hasDuplicateSameTimestamp) {
        throw new Error('Thao tác quá nhanh, vui lòng chờ giây lát rồi thử lại.');
      }

      const checkInTime = now.toISOString();
      const timing = evaluateShiftTiming(checkInTime, null, cfg);

      const newRecord: AttendanceRecord = enrichAttendanceRecord(
        {
          id: `att_${user.id}_${Date.now()}`,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          employeeCode: user.employeeCode,
          date: todayStr,
          checkInTime,
          checkOutTime: null,
          totalMinutes: 0,
          status: 'working',
          checkInMethod: 'direct_button',
          checkInIp: clientIp,
          checkInWifiSsid: payload.wifiSsid || cfg.wifiSsid,
          checkInWifiBssid: cfg.wifiBssid || 'A4:2B:B0:C1:9E:58',
          checkInGps: payload.gps,
          shiftId: timing.shiftId,
          shiftName: timing.shiftName,
          isLate: false,
          isEarlyLeave: false,
          note: payload.note || '',
          createdAt: checkInTime,
          updatedAt: checkInTime,
        },
        users
      );

      const nextAttendance = [newRecord, ...attendance];
      saveLocal(STORAGE_KEYS.ATTENDANCE, nextAttendance);

      if (isSupabaseConfigured) {
        saveAttendanceToSupabase(newRecord).catch(() => {});
        saveUserToSupabase(user).catch(() => {});
      }
      fetch(`${API_BASE}/attendance/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance: nextAttendance, replace: true }),
      }).catch(() => {});

      return { success: true, record: newRecord };
    } finally {
      activeCheckActionLocks.delete(lockKey);
    }
  }

  async checkOut(payload: {
    userId: string;
    qrToken?: string;
    wifiSsid?: string;
    gps?: { lat: number; lng: number; distance?: number };
    note?: string;
    managerOverride?: boolean;
  }): Promise<{ success: boolean; record: AttendanceRecord; removedId?: string; removedIds?: string[] }> {
    const lockKey = `check_${payload.userId}`;
    if (activeCheckActionLocks.has(lockKey)) {
      throw new Error('Hệ thống đang xử lý, vui lòng chờ trong giây lát.');
    }
    activeCheckActionLocks.add(lockKey);

    try {
      const users = await userService.getUsers();
      const cfg = await configService.getConfig().catch(() => DEFAULT_STORE_CONFIG);
      let rawAttendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      let { consolidated: attendance, removedIds: consolidatedRemovedIds } = consolidateCompletedShifts(
        rawAttendance,
        users,
        cfg
      );
      let idx = attendance.findIndex((r) => r.userId === payload.userId && r.status === 'working');

      if (idx === -1 && isSupabaseConfigured) {
        try {
          const sbAtt = await fetchAttendanceFromSupabase();
          if (sbAtt.length > 0) {
            const consolidatedSb = consolidateCompletedShifts(sbAtt, users, cfg);
            attendance = consolidatedSb.consolidated;
            consolidatedRemovedIds = [
              ...consolidatedRemovedIds,
              ...consolidatedSb.removedIds,
            ];
            idx = attendance.findIndex((r) => r.userId === payload.userId && r.status === 'working');
          }
        } catch {}
      }

      if (idx === -1) throw new Error('Không tìm thấy ca làm việc đang mở để check-out.');
      const record = attendance[idx];
      const now = new Date();
      const clientIp = payload.managerOverride ? '127.0.0.1' : await detectClientPublicIp(false);

      if (!payload.managerOverride) {
        if (!isClientIpAllowedByConfig(clientIp, cfg)) {
          throw new Error(
            `Vui lòng kết nối đúng mạng WiFi "${cfg.wifiSsid}" của quán để hết ca.`
          );
        }

        if (cfg.requireGps && cfg.storeGps) {
          if (!payload.gps || typeof payload.gps.lat !== 'number' || typeof payload.gps.lng !== 'number') {
            throw new Error(
              'Vui lòng bật định vị GPS trên trình duyệt để xác nhận vị trí tại quán.'
            );
          }
          const dist = calculateGpsDistanceMeters(
            payload.gps.lat,
            payload.gps.lng,
            cfg.storeGps.lat,
            cfg.storeGps.lng
          );
          const maxRadius = cfg.storeGps.radiusMeters || 80;
          if (dist > maxRadius) {
            throw new Error(
              `Bạn đang ở cách quán ${dist}m (vượt quá bán kính cho phép ${maxRadius}m).`
            );
          }
        }

        const shiftCheck = isTimeInConfiguredShifts(now, cfg);
        if (!shiftCheck.inShiftWindow) {
          throw new Error(
            `Hiện tại chưa đến hoặc đã qua giờ hết ca (${shiftCheck.allowedRangesText}).`
          );
        }
      }

      const checkOutTime = now.toISOString();
      const diffMinutes = Math.max(
        1,
        Math.round((now.getTime() - new Date(record.checkInTime).getTime()) / 60000)
      );

      const recordShiftId =
        record.shiftId || (new Date(record.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning');

      const existingShiftIdx = attendance.findIndex(
        (r, i) =>
          i !== idx &&
          r.userId === payload.userId &&
          r.date === record.date &&
          r.status !== 'working' &&
          (r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning')) ===
            recordShiftId
      );

      const user = users.find((u) => u.id === payload.userId);
      const outTiming = evaluateShiftTiming(record.checkInTime, checkOutTime, cfg);

      if (existingShiftIdx !== -1) {
        // Gộp lượt mới vào ca đã hoàn thành của cùng ngày
        const existing = attendance[existingShiftIdx];
        const existingTurns =
          Array.isArray(existing.turns) && existing.turns.length > 0
            ? existing.turns
            : [
                {
                  checkInTime: existing.checkInTime,
                  checkOutTime: existing.checkOutTime,
                  minutes: Number(existing.totalMinutes) || 0,
                  note: existing.note || '',
                },
              ];

        const newTurn = {
          checkInTime: record.checkInTime,
          checkOutTime,
          minutes: diffMinutes,
          note: payload.note || record.note || '',
        };

        const mergedTurns = deduplicateAndMergeOverlappingTurns([...existingTurns, newTurn]);
        const earliestCheckIn = mergedTurns[0]?.checkInTime || existing.checkInTime;
        const accumulatedMinutes = mergedTurns.reduce((sum, t) => sum + (Number(t.minutes) || 0), 0);
        const mergedTiming = evaluateShiftTiming(earliestCheckIn, checkOutTime, cfg);

        const mergedNote = Array.from(
          new Set(
            [existing.note, payload.note || record.note]
              .map((s) => (s || '').trim())
              .filter(Boolean)
          )
        ).join(' | ');

        const mergedRecord: AttendanceRecord = enrichAttendanceRecord(
          {
            ...existing,
            checkInTime: earliestCheckIn,
            checkOutTime,
            totalMinutes: accumulatedMinutes,
            turns: mergedTurns,
            status: 'completed',
            shiftId: mergedTiming.shiftId,
            shiftName: mergedTiming.shiftName,
            isLate: false,
            isEarlyLeave: false,
            checkOutIp: clientIp,
            checkOutGps: payload.gps,
            note: mergedNote || existing.note || '',
            updatedAt: checkOutTime,
          },
          users
        );

        attendance[existingShiftIdx] = mergedRecord;
        const allRemovedIds = [
          record.id,
          ...consolidatedRemovedIds,
          ...attendance
            .filter((r, i) => i !== existingShiftIdx && r.userId === payload.userId && r.status === 'working')
            .map((r) => r.id),
        ];
        attendance = attendance.filter((r) => !allRemovedIds.includes(r.id));
        saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);

        if (isSupabaseConfigured) {
          saveAttendanceToSupabase(mergedRecord).catch(() => {});
          allRemovedIds.forEach((rid) => deleteAttendanceFromSupabase(rid).catch(() => {}));
          if (user) saveUserToSupabase(user).catch(() => {});
        }
        fetch(`${API_BASE}/attendance/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendance, replace: true, removedIds: allRemovedIds }),
        }).catch(() => {});

        return { success: true, record: mergedRecord, removedId: record.id, removedIds: allRemovedIds };
      }

      const singleTurnNote = payload.note
        ? record.note
          ? `${record.note} | ${payload.note}`
          : payload.note
        : record.note;

      const updatedRecord: AttendanceRecord = enrichAttendanceRecord(
        {
          ...record,
          checkOutTime,
          totalMinutes: diffMinutes,
          turns: [
            {
              checkInTime: record.checkInTime,
              checkOutTime,
              minutes: diffMinutes,
              note: singleTurnNote || '',
            },
          ],
          status: 'completed',
          shiftId: outTiming.shiftId,
          shiftName: outTiming.shiftName,
          isLate: false,
          isEarlyLeave: false,
          checkOutIp: clientIp,
          checkOutGps: payload.gps,
          note: singleTurnNote,
          updatedAt: checkOutTime,
        },
        users
      );

      attendance[idx] = updatedRecord;
      const extraWorkingIds = [
        ...consolidatedRemovedIds,
        ...attendance
          .filter((r, i) => i !== idx && r.userId === payload.userId && r.status === 'working')
          .map((r) => r.id),
      ];
      if (extraWorkingIds.length > 0) {
        attendance = attendance.filter((r) => !extraWorkingIds.includes(r.id));
      }
      saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);

      if (isSupabaseConfigured) {
        saveAttendanceToSupabase(updatedRecord).catch(() => {});
        extraWorkingIds.forEach((rid) => deleteAttendanceFromSupabase(rid).catch(() => {}));
        if (user) saveUserToSupabase(user).catch(() => {});
      }
      fetch(`${API_BASE}/attendance/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance, replace: true, removedIds: extraWorkingIds }),
      }).catch(() => {});

      return { success: true, record: updatedRecord, removedIds: extraWorkingIds };
    } finally {
      activeCheckActionLocks.delete(lockKey);
    }
  }

  async manualAttendance(payload: {
    id?: string;
    userId: string;
    date: string;
    checkInTime: string;
    checkOutTime?: string | null;
    note?: string;
    adjustedBy?: string;
    adjustedReason?: string;
  }): Promise<{ success: boolean; record: AttendanceRecord }> {
    const users = await userService.getUsers();
    let attendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    if (isSupabaseConfigured) {
      try {
        const sbAtt = await fetchAttendanceFromSupabase();
        if (sbAtt.length > 0) attendance = sbAtt;
      } catch {}
    }

    const user = users.find((u) => u.id === payload.userId);
    if (!user) throw new Error('Không tìm thấy thông tin nhân viên trên hệ thống.');
    const cfg = await configService.getConfig().catch(() => DEFAULT_STORE_CONFIG);
    const startMs = new Date(payload.checkInTime).getTime();
    const endMs = payload.checkOutTime ? new Date(payload.checkOutTime).getTime() : null;
    const totalMinutes = endMs && endMs > startMs ? Math.round((endMs - startMs) / 60000) : 0;
    const status = payload.checkOutTime ? 'completed' : 'working';
    const timing = evaluateShiftTiming(payload.checkInTime, payload.checkOutTime, cfg);

    let targetRecord: AttendanceRecord;
    if (payload.id) {
      const idx = attendance.findIndex((r) => r.id === payload.id);
      if (idx === -1) throw new Error('Bản ghi không tồn tại');
      targetRecord = enrichAttendanceRecord(
        {
          ...attendance[idx],
          date: payload.date || attendance[idx].date,
          checkInTime: payload.checkInTime,
          checkOutTime: payload.checkOutTime || null,
          totalMinutes,
          turns: [
            {
              checkInTime: payload.checkInTime,
              checkOutTime: payload.checkOutTime || null,
              minutes: totalMinutes,
              note: payload.note || '',
            },
          ],
          status,
          shiftId: timing.shiftId,
          shiftName: timing.shiftName,
          isLate: false,
          isEarlyLeave: false,
          note: payload.note,
          adjustedBy: payload.adjustedBy || 'Admin',
          adjustedReason: payload.adjustedReason || 'Quản lý chỉnh sửa công',
          updatedAt: new Date().toISOString(),
        },
        users
      );
      attendance[idx] = targetRecord;
    } else {
      targetRecord = enrichAttendanceRecord(
        {
          id: 'att_manual_' + Date.now(),
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          employeeCode: user.employeeCode,
          date: payload.date || getTodayString(),
          checkInTime: payload.checkInTime,
          checkOutTime: payload.checkOutTime || null,
          totalMinutes,
          turns: [
            {
              checkInTime: payload.checkInTime,
              checkOutTime: payload.checkOutTime || null,
              minutes: totalMinutes,
              note: payload.note || '',
            },
          ],
          status,
          shiftId: timing.shiftId,
          shiftName: timing.shiftName,
          checkInMethod: 'manual_admin',
          checkInIp: 'Manual Entry (Admin)',
          isLate: false,
          isEarlyLeave: false,
          note: payload.note || '',
          adjustedBy: payload.adjustedBy || 'Admin',
          adjustedReason: payload.adjustedReason || 'Chấm công hộ bởi Quản lý',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        users
      );
      attendance.unshift(targetRecord);
    }

    saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);

    if (isSupabaseConfigured) {
      saveAttendanceToSupabase(targetRecord).catch(() => {});
      saveUserToSupabase(user).catch(() => {});
    }

    fetch(`${API_BASE}/attendance/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendance }),
    }).catch(() => {});

    return { success: true, record: targetRecord };
  }

  async deleteAttendance(id: string): Promise<{ success: boolean }> {
    if (isSupabaseConfigured) {
      deleteAttendanceFromSupabase(id).catch(() => {});
    }
    const attendance = loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []).filter((r) => r.id !== id);
    saveLocal(STORAGE_KEYS.ATTENDANCE, attendance);
    fetch(`${API_BASE}/attendance/${id}`, { method: 'DELETE' }).catch(() => {});
    fetch(`${API_BASE}/attendance/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendance, replace: true, removedIds: [id] }),
    }).catch(() => {});
    return { success: true };
  }
}

export const attendanceService = new AttendanceService();
