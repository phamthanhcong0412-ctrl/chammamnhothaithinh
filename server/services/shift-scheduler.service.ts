/**
 * SERVER SERVICE: shift-scheduler.service
 * Chuyên trách: Tự động chốt ca quá hạn (auto-close), đồng bộ thống kê lương nhân viên,
 * kiểm tra khung giờ check-in và cron job 21:00 (SRP)
 */

import type { AttendanceRecord, User, ShiftConfig } from '../../src/types/index.ts';
import { db } from '../storage/json-repository.ts';
import { compileDailyEmailHtml } from './email-report.service.ts';

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getShiftForCheckIn(now: Date): { shift: ShiftConfig | null; isLate: boolean; error?: string } {
  const cfg = db.getConfig();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  for (const shift of cfg.shifts) {
    const startMins = parseTimeToMinutes(shift.startTime);
    const endMins = parseTimeToMinutes(shift.endTime);
    const checkInStartMins = startMins - (shift.checkInBeforeMinutes ?? 30);
    const checkInEndMins = endMins;

    if (nowMins >= checkInStartMins && nowMins <= checkInEndMins) {
      const isLate = nowMins > startMins + (shift.lateGraceMinutes ?? 15);
      return { shift, isLate };
    }
  }

  return {
    shift: null,
    isLate: false,
    error: 'Hiện tại chưa tới hoặc đã quá khung giờ Check-in ca làm việc. Khung giờ cho phép: Ca Sáng (05:30 - 12:00) hoặc Ca Chiều (15:00 - 20:00).',
  };
}

export function autoCloseOverdueShifts(): void {
  const now = new Date();
  const cfg = db.getConfig();
  const attendance = db.getAttendance();
  let modified = false;

  attendance.forEach((record) => {
    if (record.status === 'working') {
      const shift = cfg.shifts.find((s) => s.id === record.shiftId) || cfg.shifts[0];
      if (shift) {
        const recordInTime = new Date(record.checkInTime);
        const [endH, endM] = shift.endTime.split(':').map(Number);

        const shiftEndDate = new Date(recordInTime);
        shiftEndDate.setHours(endH, endM, 0, 0);

        const graceMinutes = shift.checkOutAfterMinutes ?? 90;
        const maxCutoff = new Date(shiftEndDate.getTime() + graceMinutes * 60 * 1000);

        if (now.getTime() > maxCutoff.getTime()) {
          record.status = 'completed';
          record.checkOutTime = shiftEndDate.toISOString();
          const startMs = recordInTime.getTime();
          const endMs = shiftEndDate.getTime();
          record.totalMinutes = Math.max(1, Math.round((endMs - startMs) / (60 * 1000)));
          record.autoClosed = true;
          record.note = record.note
            ? `${record.note} | (Quên check-out: Hệ thống tự chốt lúc hết ca ${shift.endTime})`
            : `(Quên check-out: Hệ thống tự động tính đến giờ hết ca ${shift.endTime})`;
          record.updatedAt = new Date().toISOString();
          modified = true;
        }
      }
    }
  });

  if (modified) {
    db.setAttendance(attendance);
  }
}

export function enrichAttendanceRecordOnServer(rec: AttendanceRecord): AttendanceRecord {
  const users = db.getUsers();
  const matchedUser = users.find((u) => u.id === rec.userId);
  const hourlyRate = Number(rec.hourlyRate || matchedUser?.hourlyRate || 28000);
  const totalMinutes = Math.max(0, Number(rec.totalMinutes) || 0);
  const totalHours = Number((totalMinutes / 60).toFixed(2));
  const estimatedShiftPay = Math.round((totalMinutes / 60) * hourlyRate);
  return {
    ...rec,
    totalMinutes,
    totalHours,
    hourlyRate,
    estimatedShiftPay,
  };
}

export function enrichUserStatsOnServer(u: User): User {
  const attendance = db.getAttendance();
  const userRecords = attendance
    .filter((r) => r.userId === u.id)
    .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());

  const totalMinutesWorked = userRecords.reduce((sum, r) => sum + (Number(r.totalMinutes) || 0), 0);
  const totalHoursWorked = Number((totalMinutesWorked / 60).toFixed(2));
  const totalDaysWorked = new Set(userRecords.map((r) => r.date)).size;
  const totalShifts = userRecords.length;
  const lateCount = userRecords.filter((r) => r.isLate).length;
  const hourlyRate = Number(u.hourlyRate) || 28000;
  const estimatedSalary = Math.round((totalMinutesWorked / 60) * hourlyRate);
  const activeShift = userRecords.find((r) => r.status === 'working');
  const currentStatus: 'working' | 'offline' = activeShift ? 'working' : 'offline';
  const lastCheckInTime = userRecords[0]?.checkInTime || u.lastCheckInTime || null;
  const lastCheckOutTime =
    userRecords.find((r) => r.checkOutTime)?.checkOutTime || u.lastCheckOutTime || null;

  const recentSummaryItems = userRecords.slice(0, 5).map((r) => {
    const inStr = new Date(r.checkInTime).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const outStr = r.checkOutTime
      ? new Date(r.checkOutTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Đang làm';
    const hrs = Number(((r.totalMinutes || 0) / 60).toFixed(2));
    return `${r.date}: ${inStr}-${outStr} (${hrs}h / ${r.totalMinutes || 0}p)`;
  });

  const recentAttendanceSummary =
    recentSummaryItems.length > 0
      ? recentSummaryItems.join(' | ').slice(0, 2000)
      : u.recentAttendanceSummary || 'Chưa có lịch sử chấm công';

  return {
    ...u,
    note: u.note || '',
    totalMinutesWorked,
    totalHoursWorked,
    totalDaysWorked,
    totalShifts,
    lateCount,
    estimatedSalary,
    currentStatus,
    lastCheckInTime,
    lastCheckOutTime,
    recentAttendanceSummary,
  };
}

export function syncAllStatsOnServer(): void {
  const currentAttendance = db.getAttendance();
  const completedList = currentAttendance.filter((r) => r.status !== 'working');
  const workingByUser = new Map<string, AttendanceRecord[]>();

  for (const r of currentAttendance) {
    if (r.status !== 'working') continue;
    const wInMs = new Date(r.checkInTime).getTime();
    const covered = completedList.some((comp) => {
      if (comp.userId !== r.userId || comp.date !== r.date) return false;
      const outMs = comp.checkOutTime ? new Date(comp.checkOutTime).getTime() : 0;
      return outMs > 0 && wInMs <= outMs + 60000;
    });
    if (covered) continue;

    const list = workingByUser.get(r.userId) || [];
    list.push(r);
    workingByUser.set(r.userId, list);
  }

  const dedupedWorking: AttendanceRecord[] = [];
  for (const [, list] of workingByUser.entries()) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
    );
    dedupedWorking.push(sorted[0]);
  }

  const nextAttendance = [...dedupedWorking, ...completedList]
    .map((r) => enrichAttendanceRecordOnServer(r))
    .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());

  const currentUsers = db.getUsers();
  const nextUsers = currentUsers.map((u) => enrichUserStatsOnServer(u));

  db.setAttendance(nextAttendance);
  db.setUsers(nextUsers);
}

export function initPeriodicScheduler(): void {
  setInterval(() => {
    try {
      autoCloseOverdueShifts();

      const cfg = db.getConfig();
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`;

      const today = getTodayString();
      const scheduledTime = cfg.autoEmailTime || '21:00';

      if (currentTimeStr >= scheduledTime && cfg.lastReportSentDate !== today) {
        console.log(`[CRON 21:00 TRIGGER] Executing automated daily email report for ${today}`);
        const { subject, html, summary } = compileDailyEmailHtml(today);
        const newLog = {
          id: 'email_auto_' + Date.now(),
          sentAt: new Date().toISOString(),
          date: today,
          recipient: cfg.managerEmail,
          subject,
          summary,
          htmlBody: html,
          status: 'sent' as const,
          trigger: 'auto_21h' as const,
        };

        const currentLogs = db.getEmailLogs();
        currentLogs.unshift(newLog);
        db.setEmailLogs(currentLogs);

        cfg.lastReportSentDate = today;
        db.setConfig(cfg);
      }
    } catch (err) {
      console.error('Error in cron report check:', err);
    }
  }, 30000);
}
