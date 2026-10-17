/**
 * DOMAIN: SalaryCalculator
 * Chuyên trách: Tính toán tiền lương, làm giàu thống kê công cho User & AttendanceRecord (SRP)
 */

import type { User, AttendanceRecord } from '../../types/index.ts';

export function calculateEstimatedSalary(totalMinutes: number, hourlyRate: number): number {
  const safeMinutes = Math.max(0, Number(totalMinutes) || 0);
  const safeRate = Math.max(0, Number(hourlyRate) || 0);
  return Math.round((safeMinutes / 60) * safeRate);
}

export function enrichAttendanceRecord(
  rec: Partial<AttendanceRecord> & { id: string; userId: string; checkInTime: string },
  users?: User[]
): AttendanceRecord {
  const matchedUser = users?.find((u) => u.id === rec.userId);
  const hourlyRate = Number(rec.hourlyRate || matchedUser?.hourlyRate || 28000);
  const totalMinutes = Math.max(0, Number(rec.totalMinutes) || 0);
  const totalHours = Number((totalMinutes / 60).toFixed(2));
  const estimatedShiftPay = calculateEstimatedSalary(totalMinutes, hourlyRate);

  return {
    id: rec.id,
    userId: rec.userId,
    userName: rec.userName || matchedUser?.name || 'Nhân Viên',
    userEmail: rec.userEmail || matchedUser?.email || '',
    employeeCode: rec.employeeCode || matchedUser?.employeeCode || 'NV-001',
    date: rec.date || rec.checkInTime.slice(0, 10),
    checkInTime: rec.checkInTime,
    checkOutTime: rec.checkOutTime || null,
    totalMinutes,
    totalHours,
    hourlyRate,
    estimatedShiftPay,
    turns: rec.turns || [],
    status: (rec.status as any) || (rec.checkOutTime ? 'completed' : 'working'),
    checkInMethod: rec.checkInMethod || 'direct_button',
    checkInIp: rec.checkInIp || '',
    checkInWifiSsid: rec.checkInWifiSsid || '',
    checkInWifiBssid: rec.checkInWifiBssid,
    checkInGps: rec.checkInGps,
    checkOutIp: rec.checkOutIp,
    checkOutGps: rec.checkOutGps,
    shiftId: rec.shiftId || 'shift_morning',
    shiftName: rec.shiftName || 'Ca làm việc',
    isLate: Boolean(rec.isLate),
    isEarlyLeave: Boolean(rec.isEarlyLeave),
    autoClosed: Boolean(rec.autoClosed),
    note: rec.note || '',
    adjustedBy: rec.adjustedBy,
    adjustedReason: rec.adjustedReason,
    createdAt: rec.createdAt || rec.checkInTime,
    updatedAt: rec.updatedAt || new Date().toISOString(),
  };
}

export function enrichUserWithAttendanceStats(
  user: User,
  attendanceRecords: AttendanceRecord[]
): User {
  const userRecords = attendanceRecords.filter((r) => r.userId === user.id);
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthRecords = userRecords.filter((r) => r.date?.startsWith(currentMonthStr));

  const totalMinutesWorked = monthRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
  const totalHoursWorked = Number((totalMinutesWorked / 60).toFixed(2));
  const totalDaysWorked = new Set(monthRecords.map((r) => r.date)).size;
  const totalShifts = monthRecords.length;
  const lateCount = monthRecords.filter((r) => r.isLate).length;
  const estimatedSalary = calculateEstimatedSalary(totalMinutesWorked, user.hourlyRate);

  const activeRecord = userRecords.find((r) => r.status === 'working');
  const currentStatus: 'working' | 'offline' = activeRecord ? 'working' : 'offline';

  const sortedByTime = [...userRecords].sort(
    (a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
  );
  const lastCheckInTime = sortedByTime[0]?.checkInTime;
  const lastCheckOutTime = sortedByTime.find((r) => r.checkOutTime)?.checkOutTime || undefined;

  const recentSummaryItems = sortedByTime.slice(0, 3).map((r) => {
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
      : user.recentAttendanceSummary || 'Chưa có lịch sử chấm công';

  return {
    ...user,
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
