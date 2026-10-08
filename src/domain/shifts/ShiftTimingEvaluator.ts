/**
 * DOMAIN: ShiftTimingEvaluator
 * Chuyên trách: Đánh giá thời gian ca làm việc, khung giờ check-in, ân hạn (SRP)
 */

import type { StoreConfig, ShiftConfig } from '../../types/index.ts';

export function parseHmToMins(timeStr: string, fallback: number): number {
  const parts = String(timeStr || '').split(':');
  if (parts.length !== 2) return fallback;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallback;
  return h * 60 + m;
}

export function evaluateShiftTiming(
  checkInIso: string,
  checkOutIso?: string | null,
  cfg?: StoreConfig | null
): {
  shiftId: string;
  shiftName: string;
  isLate: boolean;
  lateMinutes: number;
  isEarlyLeave: boolean;
  earlyLeaveMinutes: number;
  shiftStartMins: number;
  shiftEndMins: number;
  checkOutAfterMinutes: number;
} {
  const inDate = new Date(checkInIso);
  const inMins = inDate.getHours() * 60 + inDate.getMinutes();
  const isAfternoon = inMins >= 14 * 60;
  const shift =
    cfg?.shifts?.find((s) => s.id === (isAfternoon ? 'shift_afternoon' : 'shift_morning')) ||
    cfg?.shifts?.[0];

  const shiftId = shift?.id || (isAfternoon ? 'shift_afternoon' : 'shift_morning');
  const shiftName = shift?.name || (isAfternoon ? 'Ca Chiều (15:30 - 20:00)' : 'Ca Sáng (06:00 - 12:00)');
  const shiftStartMins = parseHmToMins(
    shift?.startTime || (isAfternoon ? '15:30' : '06:00'),
    isAfternoon ? 15 * 60 + 30 : 6 * 60
  );
  const shiftEndMins = parseHmToMins(
    shift?.endTime || (isAfternoon ? '20:00' : '12:00'),
    isAfternoon ? 20 * 60 : 12 * 60
  );
  const checkOutAfterMinutes = shift?.checkOutAfterMinutes ?? 90;

  // Cửa hàng không phạt đi muộn / về sớm
  return {
    shiftId,
    shiftName,
    isLate: false,
    lateMinutes: 0,
    isEarlyLeave: false,
    earlyLeaveMinutes: 0,
    shiftStartMins,
    shiftEndMins,
    checkOutAfterMinutes,
  };
}

export function isTimeInConfiguredShifts(
  now: Date,
  cfg: StoreConfig
): {
  inShiftWindow: boolean;
  matchingShift?: ShiftConfig;
  isLate: boolean;
  allowedRangesText: string;
} {
  const shifts = Array.isArray(cfg?.shifts) && cfg.shifts.length > 0 ? cfg.shifts : [];
  if (shifts.length === 0) {
    return {
      inShiftWindow: true,
      isLate: false,
      allowedRangesText: 'Không giới hạn ca',
    };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const rangesDescriptions: string[] = [];
  let matchingShift: ShiftConfig | undefined;
  let isLate = false;

  for (const shift of shifts) {
    const startMins = parseHmToMins(shift.startTime, 6 * 60);
    const endMins = parseHmToMins(shift.endTime, 12 * 60);
    const beforeMins = shift.checkInBeforeMinutes ?? 30;
    const graceMins = shift.lateGraceMinutes ?? 15;

    const windowStart = startMins - beforeMins;
    const windowEnd = endMins;

    const startH = String(Math.floor(Math.max(0, windowStart) / 60)).padStart(2, '0');
    const startM = String(Math.max(0, windowStart) % 60).padStart(2, '0');
    rangesDescriptions.push(`${shift.name}: ${startH}:${startM} - ${shift.endTime}`);

    if (nowMinutes >= windowStart && nowMinutes <= windowEnd) {
      matchingShift = shift;
      isLate = nowMinutes > startMins + graceMins;
      break;
    }
  }

  return {
    inShiftWindow: Boolean(matchingShift),
    matchingShift,
    isLate,
    allowedRangesText: rangesDescriptions.join(' | '),
  };
}
