/**
 * DOMAIN: TurnConsolidator
 * Chuyên trách: Gộp ca làm việc, xử lý ca trùng lặp/liền kề <= 60s, tự động chốt ca quá hạn (Pure Domain Logic - SRP)
 */

import type { AttendanceRecord, ShiftTurn, User, StoreConfig } from '../../types/index.ts';
import { evaluateShiftTiming } from '../shifts/ShiftTimingEvaluator.ts';
import { enrichAttendanceRecord } from '../salary/SalaryCalculator.ts';

/**
 * Gộp các lượt chấm công (turns) lân cận hoặc chồng lấn (<= 60s)
 */
export function deduplicateAndMergeOverlappingTurns(turns: ShiftTurn[]): ShiftTurn[] {
  if (!turns || turns.length <= 1) return turns || [];
  const valid = turns.filter((t) => t && t.checkInTime);
  const sorted = [...valid].sort(
    (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
  );

  const merged: ShiftTurn[] = [];
  for (const curr of sorted) {
    if (merged.length === 0) {
      merged.push({ ...curr });
      continue;
    }
    const last = merged[merged.length - 1];
    const lastOutMs = last.checkOutTime ? new Date(last.checkOutTime).getTime() : 0;
    const currInMs = new Date(curr.checkInTime).getTime();

    // Nếu thời điểm vào của lượt này nằm trong hoặc liền kề lượt trước (<= 60s)
    if (lastOutMs > 0 && currInMs <= lastOutMs + 60000) {
      const currOutMs = curr.checkOutTime ? new Date(curr.checkOutTime).getTime() : 0;
      if (currOutMs > lastOutMs) {
        last.checkOutTime = curr.checkOutTime;
        last.minutes = Math.max(1, Math.round((currOutMs - new Date(last.checkInTime).getTime()) / 60000));
      }
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

export interface ShiftConsolidationResult {
  consolidated: AttendanceRecord[];
  removedIds: string[];
  updatedRecords: AttendanceRecord[];
}

/**
 * Hợp nhất các bản ghi chấm công hoàn thành theo ca,
 * tự động chốt ca cho các lượt làm việc quá hạn / ngày hôm trước,
 * và đảm bảo mỗi nhân viên chỉ có tối đa 1 bản ghi đang làm việc (working) duy nhất.
 */
export function consolidateCompletedShifts(
  records: AttendanceRecord[],
  users: User[] = [],
  cfg?: StoreConfig | null,
  now: Date = new Date()
): ShiftConsolidationResult {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const rawWorking: AttendanceRecord[] = [];
  const completedByShift = new Map<string, AttendanceRecord[]>();
  const updatedRecords: AttendanceRecord[] = [];
  const removedIds: string[] = [];
  const seenIds = new Set<string>();

  for (const rawRec of records) {
    if (!rawRec || !rawRec.id) continue;
    if (seenIds.has(rawRec.id)) continue;
    seenIds.add(rawRec.id);

    let r: AttendanceRecord = {
      ...rawRec,
      isLate: false,
      isEarlyLeave: false,
    };

    if (r.status === 'working') {
      const timing = evaluateShiftTiming(r.checkInTime, null, cfg);
      const inDate = new Date(r.checkInTime);
      const inMins = inDate.getHours() * 60 + inDate.getMinutes();
      const isPastDay = r.date < todayStr;
      const isOverdueToday =
        r.date === todayStr &&
        inMins <= timing.shiftEndMins &&
        nowMins > timing.shiftEndMins + timing.checkOutAfterMinutes;

      if (isPastDay || isOverdueToday) {
        // Auto-close forgotten shift at official shift end time
        const autoOutDate = new Date(inDate);
        autoOutDate.setHours(Math.floor(timing.shiftEndMins / 60), timing.shiftEndMins % 60, 0, 0);
        const finalOutMs =
          autoOutDate.getTime() > inDate.getTime()
            ? autoOutDate.getTime()
            : inDate.getTime() + 60 * 1000;
        const autoOutIso = new Date(finalOutMs).toISOString();
        const autoMins = Math.max(1, Math.round((finalOutMs - inDate.getTime()) / 60000));

        r = enrichAttendanceRecord(
          {
            ...r,
            checkOutTime: autoOutIso,
            totalMinutes: autoMins,
            status: 'completed',
            shiftId: timing.shiftId,
            shiftName: timing.shiftName,
            isLate: false,
            isEarlyLeave: false,
            autoClosed: true,
            note: r.note ? `${r.note} • Tự chốt cuối ca` : 'Tự chốt cuối ca (Quên check-out)',
            updatedAt: new Date().toISOString(),
          },
          users
        );
        updatedRecords.push(r);
      } else {
        rawWorking.push(enrichAttendanceRecord(r, users));
        continue;
      }
    }

    const shiftId =
      r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning');
    const key = `${r.userId}_${r.date}_${shiftId}`;
    const list = completedByShift.get(key) || [];
    list.push(r);
    completedByShift.set(key, list);
  }

  const consolidatedCompleted: AttendanceRecord[] = [];

  for (const [, group] of completedByShift.entries()) {
    const sorted = [...group].sort(
      (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
    );
    const base = sorted[0];

    // Thu thập tất cả các lượt lẻ trong cùng ca và gộp lại
    const rawTurns: ShiftTurn[] = [];
    for (const item of sorted) {
      const itemTurns =
        Array.isArray(item.turns) && item.turns.length > 0
          ? item.turns
          : [
              {
                checkInTime: item.checkInTime,
                checkOutTime: item.checkOutTime || null,
                minutes: Number(item.totalMinutes) || 0,
                note: item.note || '',
              },
            ];
      for (const t of itemTurns) {
        rawTurns.push({
          checkInTime: t.checkInTime,
          checkOutTime: t.checkOutTime || null,
          minutes: Number(t.minutes) || 0,
          note: t.note || '',
        });
      }
    }

    const mergedTurns = deduplicateAndMergeOverlappingTurns(rawTurns);
    const totalMinutes = mergedTurns.reduce((sum, t) => sum + (Number(t.minutes) || 0), 0);

    let latestCheckOut = base.checkOutTime || null;
    for (const t of mergedTurns) {
      if (
        t.checkOutTime &&
        (!latestCheckOut || new Date(t.checkOutTime).getTime() > new Date(latestCheckOut).getTime())
      ) {
        latestCheckOut = t.checkOutTime;
      }
    }

    const earliestCheckIn = mergedTurns[0]?.checkInTime || base.checkInTime;
    const timing = evaluateShiftTiming(earliestCheckIn, latestCheckOut, cfg);

    const merged = enrichAttendanceRecord(
      {
        ...base,
        checkInTime: earliestCheckIn,
        checkOutTime: latestCheckOut,
        totalMinutes,
        turns: mergedTurns,
        shiftId: timing.shiftId,
        shiftName: timing.shiftName,
        isLate: false,
        isEarlyLeave: false,
        updatedAt: new Date().toISOString(),
      },
      users
    );

    consolidatedCompleted.push(merged);
    if (sorted.length > 1 || (Array.isArray(base.turns) && base.turns.length !== mergedTurns.length)) {
      updatedRecords.push(merged);
    }
    for (let i = 1; i < sorted.length; i++) {
      removedIds.push(sorted[i].id);
    }
  }

  // Deduplicate active `working` records:
  // 1. Loại bỏ bản ghi `working` nếu thời điểm check-in đã nằm trọn trong 1 ca hoàn thành cùng ngày
  // 2. Chỉ giữ tối đa 1 bản ghi `working` duy nhất cho mỗi nhân viên
  const workingByUser = new Map<string, AttendanceRecord[]>();
  for (const w of rawWorking) {
    const wInMs = new Date(w.checkInTime).getTime();
    const alreadyCoveredByCompleted = consolidatedCompleted.some((comp) => {
      if (comp.userId !== w.userId || comp.date !== w.date) return false;
      const compOutMs = comp.checkOutTime ? new Date(comp.checkOutTime).getTime() : 0;
      return compOutMs > 0 && wInMs <= compOutMs + 60000;
    });

    if (alreadyCoveredByCompleted) {
      removedIds.push(w.id);
      continue;
    }

    const list = workingByUser.get(w.userId) || [];
    list.push(w);
    workingByUser.set(w.userId, list);
  }

  const working: AttendanceRecord[] = [];
  for (const [, userWorkingList] of workingByUser.entries()) {
    const sortedW = [...userWorkingList].sort(
      (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
    );
    working.push(sortedW[0]);
    for (let i = 1; i < sortedW.length; i++) {
      removedIds.push(sortedW[i].id);
    }
  }

  const all = [...working, ...consolidatedCompleted].sort(
    (a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
  );

  return { consolidated: all, removedIds, updatedRecords };
}
