/**
 * CONTROLLER: schedule.controller
 * Quản lý endpoints đăng ký ca làm việc theo tuần, khóa/mở ca của quản lý,
 * và lưu trữ tối đa trong phạm vi 11 tuần (tuần hiện tại, 5 tuần trước, 5 tuần sau) (SRP)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../storage/json-repository.ts';
import type { WeekSchedule, ShiftRegistrationItem } from '../../src/types/index.ts';
import { getRollingWeeks, pruneSchedulesToWindow } from '../../src/utils/week.ts';

export const scheduleRouter = Router();

// GET /api/schedules - Lấy toàn bộ lịch các tuần (giới hạn trong phạm vi 11 tuần)
scheduleRouter.get('/api/schedules', (_req: Request, res: Response) => {
  const rolling = getRollingWeeks(new Date());
  const allowedWeekIds = new Set(rolling.map((w) => w.weekId));

  let schedules = db.getSchedules();
  // Giữ tối đa trong phạm vi 11 tuần
  schedules = pruneSchedulesToWindow(schedules, allowedWeekIds);
  db.setSchedules(schedules);

  res.json({
    success: true,
    weeksMeta: rolling,
    schedules,
  });
});

// GET /api/schedules/:weekId - Lấy lịch tuần cụ thể (tự động tạo mới nếu chưa có)
scheduleRouter.get('/api/schedules/:weekId', (req: Request, res: Response) => {
  const { weekId } = req.params;
  const rolling = getRollingWeeks(new Date());
  const meta = rolling.find((w) => w.weekId === weekId);

  let ws = db.getWeekSchedule(weekId);
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
    db.saveWeekSchedule(ws);
  }

  res.json({
    success: true,
    schedule: ws || null,
    meta: meta || null,
  });
});

// POST /api/schedules/register - Đăng ký hoặc hủy đăng ký ca
scheduleRouter.post('/api/schedules/register', (req: Request, res: Response) => {
  const { weekId, userId, date, shiftId, shiftName, action } = req.body;
  if (!weekId || !userId || !date || !shiftId) {
    res.status(400).json({ error: 'Thiếu thông tin đăng ký ca (weekId, userId, date, shiftId).' });
    return;
  }

  const rolling = getRollingWeeks(new Date());
  const meta = rolling.find((w) => w.weekId === weekId);

  let ws = db.getWeekSchedule(weekId);
  if (!ws) {
    if (!meta) {
      res.status(400).json({ error: 'Tuần này nằm ngoài phạm vi 10-11 tuần cho phép.' });
      return;
    }
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

  const users = db.getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    res.status(404).json({ error: 'Không tìm thấy thông tin nhân viên.' });
    return;
  }

  // Quản lý can override lock; nếu không phải quản lý và tuần bị khóa -> chặn
  const isManagerOverride = Boolean(req.body.isManagerOverride);
  if (ws.isLocked && !isManagerOverride) {
    res.status(403).json({
      error: 'Bảng đăng ký ca tuần này đã được Quản lý khóa. Bạn chỉ có thể theo dõi và không thể thay đổi ca.',
    });
    return;
  }

  const regId = `reg_${userId}_${date}_${shiftId}`;
  const existingIdx = ws.registrations.findIndex((r) => r.id === regId || (r.userId === userId && r.date === date && r.shiftId === shiftId));

  if (action === 'unregister') {
    if (existingIdx >= 0) {
      ws.registrations.splice(existingIdx, 1);
    }
  } else {
    // Register
    const newReg: ShiftRegistrationItem = {
      id: regId,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      employeeCode: user.employeeCode,
      date,
      shiftId,
      shiftName: shiftName || (shiftId === 'shift_morning' ? 'Ca Sáng' : 'Ca Chiều'),
      registeredAt: new Date().toISOString(),
      note: req.body.note || '',
    };

    if (existingIdx >= 0) {
      ws.registrations[existingIdx] = newReg;
    } else {
      ws.registrations.push(newReg);
    }
  }

  ws.updatedAt = new Date().toISOString();
  db.saveWeekSchedule(ws);

  res.json({
    success: true,
    message: action === 'unregister' ? 'Đã hủy đăng ký ca thành công.' : 'Đã đăng ký ca thành công.',
    schedule: ws,
  });
});

// POST /api/schedules/toggle-lock - Quản lý khóa / mở lại đăng ký ca tuần
scheduleRouter.post('/api/schedules/toggle-lock', (req: Request, res: Response) => {
  const { weekId, isLocked, managerName } = req.body;
  if (!weekId || typeof isLocked !== 'boolean') {
    res.status(400).json({ error: 'Thiếu thông tin weekId hoặc trạng thái khóa.' });
    return;
  }

  const rolling = getRollingWeeks(new Date());
  const meta = rolling.find((w) => w.weekId === weekId);

  let ws = db.getWeekSchedule(weekId);
  if (!ws) {
    if (!meta) {
      res.status(400).json({ error: 'Tuần này nằm ngoài phạm vi cho phép.' });
      return;
    }
    ws = {
      weekId: meta.weekId,
      weekNumber: meta.weekNumber,
      year: meta.year,
      startDate: meta.startDate,
      endDate: meta.endDate,
      isLocked,
      registrations: [],
      updatedAt: new Date().toISOString(),
    };
  } else {
    ws.isLocked = isLocked;
  }

  if (isLocked) {
    ws.lockedBy = managerName || 'Quản lý';
    ws.lockedAt = new Date().toISOString();
  } else {
    ws.lockedBy = undefined;
    ws.lockedAt = undefined;
  }

  ws.updatedAt = new Date().toISOString();
  db.saveWeekSchedule(ws);

  res.json({
    success: true,
    message: isLocked ? `Đã khóa bảng đăng ký ca tuần ${ws.weekNumber}.` : `Đã mở lại đăng ký ca tuần ${ws.weekNumber}.`,
    schedule: ws,
  });
});
