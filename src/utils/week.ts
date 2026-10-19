/**
 * UTILITY: week.ts
 * Pure functions xử lý tính toán lịch tuần, tuần hiện tại, 5 tuần trước & 5 tuần sau (tối đa 11 bản ghi)
 */

import type { WeekSchedule } from '../types/index.ts';

/**
 * Lấy ngày Thứ Hai (Monday) của tuần chứa `d`
 */
export function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  // Trong JS: 0 là Chủ Nhật, 1 là Thứ Hai, ..., 6 là Thứ Bảy
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Định dạng YYYY-MM-DD
 */
export function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Tính số tuần ISO của năm
 */
export function getIsoWeekNumber(d: Date): { year: number; weekNumber: number; weekId: string } {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  // Thứ 5 trong tuần này quyết định năm
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  const year = date.getFullYear();
  const weekId = `${year}-W${String(weekNumber).padStart(2, '0')}`;
  return { year, weekNumber, weekId };
}

export interface WeekMeta {
  weekId: string;
  year: number;
  weekNumber: number;
  startDate: string; // YYYY-MM-DD (Monday)
  endDate: string; // YYYY-MM-DD (Sunday)
  offsetFromCurrent: number; // -5 to +5 (0 là tuần này)
  label: string;
  shortLabel: string;
  isCurrent: boolean;
  days: {
    date: string; // YYYY-MM-DD
    dayName: string; // "Thứ 2", "Thứ 3", ... "Chủ Nhật"
    shortDayName: string; // "T2", "T3", ... "CN"
    formattedDate: string; // "19/10"
    isToday: boolean;
    isPast: boolean;
  }[];
}

const VIETNAMESE_DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
const SHORT_VIETNAMESE_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/**
 * Sinh metadata cho 1 tuần bắt đầu từ Monday
 */
export function buildWeekMeta(mondayDate: Date, offsetFromCurrent: number, todayStr: string): WeekMeta {
  const { year, weekNumber, weekId } = getIsoWeekNumber(mondayDate);
  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(sundayDate.getDate() + 6);

  const startDate = formatDateYmd(mondayDate);
  const endDate = formatDateYmd(sundayDate);

  const startD = mondayDate.getDate();
  const startM = mondayDate.getMonth() + 1;
  const endD = sundayDate.getDate();
  const endM = sundayDate.getMonth() + 1;

  let offsetText = '';
  if (offsetFromCurrent === 0) offsetText = ' (Tuần này)';
  else if (offsetFromCurrent === 1) offsetText = ' (Tuần sau)';
  else if (offsetFromCurrent === -1) offsetText = ' (Tuần trước)';
  else if (offsetFromCurrent > 1) offsetText = ` (+${offsetFromCurrent} tuần)`;
  else offsetText = ` (${offsetFromCurrent} tuần)`;

  const label = `Tuần ${weekNumber}: ${startD}/${startM} - ${endD}/${endM}/${year}${offsetText}`;
  const shortLabel = `T${weekNumber} (${startD}/${startM}-${endD}/${endM})`;

  const days = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(mondayDate);
    cur.setDate(cur.getDate() + i);
    const dateStr = formatDateYmd(cur);
    days.push({
      date: dateStr,
      dayName: VIETNAMESE_DAYS[i],
      shortDayName: SHORT_VIETNAMESE_DAYS[i],
      formattedDate: `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}`,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
    });
  }

  return {
    weekId,
    year,
    weekNumber,
    startDate,
    endDate,
    offsetFromCurrent,
    label,
    shortLabel,
    isCurrent: offsetFromCurrent === 0,
    days,
  };
}

/**
 * Sinh danh sách 11 tuần (5 tuần trước, tuần hiện tại, 5 tuần sau)
 */
export function getRollingWeeks(baseDate: Date = new Date()): WeekMeta[] {
  const currentMonday = getMondayOfWeek(baseDate);
  const todayStr = formatDateYmd(baseDate);
  const weeks: WeekMeta[] = [];

  for (let offset = -5; offset <= 5; offset++) {
    const monday = new Date(currentMonday);
    monday.setDate(monday.getDate() + offset * 7);
    weeks.push(buildWeekMeta(monday, offset, todayStr));
  }

  return weeks;
}

/**
 * Giữ tối đa các tuần trong cửa sổ [-5, +5] tuần so với hiện tại
 */
export function pruneSchedulesToWindow(
  schedules: WeekSchedule[],
  allowedWeekIds: Set<string>
): WeekSchedule[] {
  return schedules.filter((s) => allowedWeekIds.has(s.weekId));
}
