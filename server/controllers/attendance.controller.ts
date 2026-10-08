/**
 * CONTROLLER: attendance.controller
 * Quản lý endpoints chấm công, check-in, check-out, báo cáo tháng và gửi email
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AttendanceRecord, EmailLog } from '../../src/types/index.ts';
import { db } from '../storage/json-repository.ts';
import { getClientIp } from './config.controller.ts';
import {
  autoCloseOverdueShifts,
  syncAllStatsOnServer,
  getShiftForCheckIn,
  enrichAttendanceRecordOnServer,
  getTodayString,
} from '../services/shift-scheduler.service.ts';
import { compileDailyEmailHtml } from '../services/email-report.service.ts';

export const attendanceRouter = Router();

attendanceRouter.get('/api/attendance', (req: Request, res: Response) => {
  autoCloseOverdueShifts();
  syncAllStatsOnServer();

  const { date, userId, month } = req.query;
  let filtered = [...db.getAttendance()];

  if (date && typeof date === 'string') {
    filtered = filtered.filter((r) => r.date === date);
  }
  if (userId && typeof userId === 'string') {
    filtered = filtered.filter((r) => r.userId === userId);
  }
  if (month && typeof month === 'string') {
    filtered = filtered.filter((r) => r.date.startsWith(month));
  }

  filtered.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
  res.json(filtered);
});

attendanceRouter.post('/api/attendance/check-in', (req: Request, res: Response) => {
  autoCloseOverdueShifts();

  const { userId, wifiSsid, wifiVerified, gps, note, bypassShiftWindow } = req.body;
  const users = db.getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    res.status(404).json({ error: 'Không tìm thấy thông tin nhân viên.' });
    return;
  }

  const storeConfig = db.getConfig();
  const clientIp = getClientIp(req);
  const isIpValid = storeConfig.bypassIpCheck || storeConfig.allowedIps.includes(clientIp);
  const isWifiValid = wifiVerified === true || (wifiSsid && wifiSsid === storeConfig.wifiSsid);
  if (storeConfig.requireWifi && !isIpValid && !isWifiValid) {
    res.status(400).json({
      error: `Chặn chấm công: Bạn chưa kết nối vào đúng WiFi của quán ("${storeConfig.wifiSsid}"). Vui lòng kết nối đúng mạng WiFi để tiếp tục.`,
    });
    return;
  }

  const attendance = db.getAttendance();
  const activeSession = attendance.find(
    (r) => r.userId === userId && r.status === 'working'
  );
  if (activeSession) {
    res.status(400).json({
      error: 'Bạn đang trong một lượt làm việc chưa Check-out. Vui lòng bấm Check-out trước khi Check-in lượt tiếp theo.',
    });
    return;
  }

  const now = new Date();
  const shiftResult = getShiftForCheckIn(now);

  if (!shiftResult.shift && !bypassShiftWindow && !storeConfig.bypassIpCheck) {
    res.status(400).json({
      error: shiftResult.error || 'Hiện tại không nằm trong khung giờ Check-in ca làm việc (Ca Sáng: 05:30 - 12:00, Ca Chiều: 15:00 - 20:00).',
    });
    return;
  }

  const currentShift = shiftResult.shift || storeConfig.shifts[0];
  const isLate = shiftResult.isLate;
  const checkInTime = now.toISOString();
  const today = getTodayString();

  const newRecord: AttendanceRecord = enrichAttendanceRecordOnServer({
    id: 'att_' + Date.now(),
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    employeeCode: user.employeeCode,
    date: today,
    checkInTime,
    checkOutTime: null,
    totalMinutes: 0,
    totalHours: 0,
    hourlyRate: user.hourlyRate,
    estimatedShiftPay: 0,
    status: 'working',
    checkInMethod: 'direct_button',
    checkInIp: clientIp,
    checkInWifiSsid: wifiSsid || storeConfig.wifiSsid,
    checkInGps: gps,
    shiftId: currentShift.id,
    shiftName: currentShift.name,
    isLate,
    isEarlyLeave: false,
    note: note || '',
    createdAt: checkInTime,
    updatedAt: checkInTime,
  });

  attendance.unshift(newRecord);
  db.setAttendance(attendance);
  syncAllStatsOnServer();
  res.json({ success: true, record: newRecord });
});

attendanceRouter.post('/api/attendance/check-out', (req: Request, res: Response) => {
  autoCloseOverdueShifts();

  const { userId, wifiSsid, wifiVerified, gps, note } = req.body;
  const storeConfig = db.getConfig();
  const clientIp = getClientIp(req);
  const isIpValid = storeConfig.bypassIpCheck || storeConfig.allowedIps.includes(clientIp);
  const isWifiValid = wifiVerified === true || (wifiSsid && wifiSsid === storeConfig.wifiSsid);
  if (storeConfig.requireWifi && !isIpValid && !isWifiValid) {
    res.status(400).json({
      error: `Chặn chấm công: Bạn chưa kết nối vào đúng WiFi của quán ("${storeConfig.wifiSsid}"). Vui lòng kết nối đúng mạng WiFi để tiếp tục.`,
    });
    return;
  }

  const attendance = db.getAttendance();
  const recordIndex = attendance.findIndex(
    (r) => r.userId === userId && r.status === 'working'
  );

  if (recordIndex === -1) {
    res.status(400).json({ error: 'Không tìm thấy ca làm việc đang mở để check-out.' });
    return;
  }

  const record = attendance[recordIndex];
  const now = new Date();
  const checkOutTime = now.toISOString();

  const startMs = new Date(record.checkInTime).getTime();
  const endMs = now.getTime();
  const diffMinutes = Math.max(1, Math.round((endMs - startMs) / (1000 * 60)));

  const updatedRecord: AttendanceRecord = enrichAttendanceRecordOnServer({
    ...record,
    checkOutTime,
    totalMinutes: diffMinutes,
    status: 'completed',
    checkOutIp: clientIp,
    checkOutGps: gps,
    note: note ? (record.note ? `${record.note} | ${note}` : note) : record.note,
    updatedAt: checkOutTime,
  });

  attendance[recordIndex] = updatedRecord;
  db.setAttendance(attendance);
  syncAllStatsOnServer();
  res.json({ success: true, record: updatedRecord });
});

attendanceRouter.post('/api/attendance/manual', (req: Request, res: Response) => {
  const {
    id,
    userId,
    date,
    checkInTime,
    checkOutTime,
    note,
    adjustedBy,
    adjustedReason,
  } = req.body;

  const users = db.getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    res.status(404).json({ error: 'Không tìm thấy thông tin nhân viên' });
    return;
  }

  const attendance = db.getAttendance();
  const startMs = new Date(checkInTime).getTime();
  const endMs = checkOutTime ? new Date(checkOutTime).getTime() : null;
  const totalMinutes = endMs && endMs > startMs ? Math.round((endMs - startMs) / (1000 * 60)) : 0;
  const status = checkOutTime ? 'completed' : 'working';

  if (id) {
    const index = attendance.findIndex((r) => r.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Bản ghi không tồn tại' });
      return;
    }
    const updated: AttendanceRecord = enrichAttendanceRecordOnServer({
      ...attendance[index],
      date: date || attendance[index].date,
      checkInTime,
      checkOutTime: checkOutTime || null,
      totalMinutes,
      status,
      note,
      adjustedBy: adjustedBy || 'Admin',
      adjustedReason: adjustedReason || 'Quản lý chỉnh sửa công',
      updatedAt: new Date().toISOString(),
    });
    attendance[index] = updated;
    db.setAttendance(attendance);
    syncAllStatsOnServer();
    res.json({ success: true, record: updated });
  } else {
    const newRecord: AttendanceRecord = enrichAttendanceRecordOnServer({
      id: 'att_manual_' + Date.now(),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      employeeCode: user.employeeCode,
      date: date || getTodayString(),
      checkInTime,
      checkOutTime: checkOutTime || null,
      totalMinutes,
      status,
      checkInMethod: 'manual_admin',
      checkInIp: 'Manual Entry (Admin)',
      isLate: false,
      isEarlyLeave: false,
      note: note || '',
      adjustedBy: adjustedBy || 'Admin',
      adjustedReason: adjustedReason || 'Chấm công hộ bởi Quản lý',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    attendance.unshift(newRecord);
    db.setAttendance(attendance);
    syncAllStatsOnServer();
    res.json({ success: true, record: newRecord });
  }
});

attendanceRouter.delete('/api/attendance/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const filtered = db.getAttendance().filter((r) => r.id !== id);
  db.setAttendance(filtered);
  syncAllStatsOnServer();
  res.json({ success: true });
});

attendanceRouter.get('/api/reports/monthly', (req: Request, res: Response) => {
  const month = (req.query.month as string) || getTodayString().substring(0, 7);
  const filterUserId = req.query.userId as string | undefined;
  const attendance = db.getAttendance();
  const users = db.getUsers();

  const monthRecords = attendance.filter((r) => r.date.startsWith(month));
  let targetUsers = users;
  if (filterUserId) {
    targetUsers = users.filter((u) => u.id === filterUserId);
  }

  const summaries = targetUsers.map((user) => {
    const userRecords = monthRecords.filter((r) => r.userId === user.id);
    const totalDaysWorked = new Set(userRecords.map((r) => r.date)).size;
    const totalMinutes = userRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
    const totalHours = Number((totalMinutes / 60).toFixed(2));
    const totalLateCount = userRecords.filter((r) => r.isLate).length;
    const totalEarlyCount = userRecords.filter((r) => r.isEarlyLeave).length;
    const estimatedSalary = Math.round(totalHours * user.hourlyRate);

    return {
      userId: user.id,
      userName: user.name,
      employeeCode: user.employeeCode,
      position: user.position,
      hourlyRate: user.hourlyRate,
      totalDaysWorked,
      totalMinutes,
      totalHours,
      totalLateCount,
      totalEarlyCount,
      estimatedSalary,
      recordsCount: userRecords.length,
    };
  });

  res.json({
    month,
    summaries,
    totalRecords: monthRecords.length,
  });
});

attendanceRouter.post('/api/reports/send-email', (req: Request, res: Response) => {
  const { recipient, trigger } = req.body;
  const storeConfig = db.getConfig();
  const targetEmail = recipient || storeConfig.managerEmail;
  const today = getTodayString();

  const { subject, html, summary } = compileDailyEmailHtml(today);

  const newLog: EmailLog = {
    id: 'email_' + Date.now(),
    sentAt: new Date().toISOString(),
    date: today,
    recipient: targetEmail,
    subject,
    summary,
    htmlBody: html,
    status: 'sent',
    trigger: trigger || 'manual',
  };

  const logs = db.getEmailLogs();
  logs.unshift(newLog);
  db.setEmailLogs(logs);

  storeConfig.lastReportSentDate = today;
  db.setConfig(storeConfig);

  console.log(`[EMAIL DISPATCHED] To: ${targetEmail} | Subject: ${subject}`);

  res.json({
    success: true,
    message: `Đã gửi báo cáo thành công tới ${targetEmail}`,
    log: newLog,
  });
});

attendanceRouter.get('/api/reports/email-logs', (_req: Request, res: Response) => {
  res.json(db.getEmailLogs());
});

attendanceRouter.get('/api/supabase/attendance', (_req: Request, res: Response) => {
  autoCloseOverdueShifts();
  syncAllStatsOnServer();
  const attendance = db.getAttendance();
  res.json({
    success: true,
    source: 'supabase_database',
    table: 'attendance_records',
    count: attendance.length,
    attendance,
  });
});

attendanceRouter.post('/api/attendance/sync', (req: Request, res: Response) => {
  const incomingAttendance = req.body?.attendance;
  const replace = Boolean(req.body?.replace);
  const removedIds: string[] = Array.isArray(req.body?.removedIds) ? req.body.removedIds : [];

  if (Array.isArray(incomingAttendance)) {
    let attendance = db.getAttendance();
    const mergedMap = new Map<string, AttendanceRecord>();
    if (!replace) {
      attendance.forEach((r) => {
        if (!removedIds.includes(r.id)) {
          mergedMap.set(r.id, r);
        }
      });
    }
    incomingAttendance.forEach((r: AttendanceRecord) => {
      if (r && r.id && r.userId && !removedIds.includes(r.id)) {
        mergedMap.set(r.id, r);
      }
    });
    attendance = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
    );
    db.setAttendance(attendance);
    syncAllStatsOnServer();
  }
  res.json({
    success: true,
    source: 'supabase_database',
    count: db.getAttendance().length,
    attendance: db.getAttendance(),
  });
});
