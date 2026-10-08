/**
 * CONTROLLER: users.controller
 * Quản lý endpoints nhân sự, tài khoản và đồng bộ dữ liệu người dùng
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { User } from '../../src/types/index.ts';
import { db } from '../storage/json-repository.ts';
import {
  autoCloseOverdueShifts,
  syncAllStatsOnServer,
  enrichUserStatsOnServer,
  getTodayString,
} from '../services/shift-scheduler.service.ts';

export const usersRouter = Router();

usersRouter.get('/api/users', (_req: Request, res: Response) => {
  res.json(db.getUsers());
});

usersRouter.post('/api/users', (req: Request, res: Response) => {
  const users = db.getUsers();
  const rawUsername = String(req.body.username || '').trim();
  const rawPassword = String(req.body.password || '').trim();

  if (!rawUsername) {
    res.status(400).json({ error: 'Vui lòng nhập Tên đăng nhập cấp phát cho tài khoản.' });
    return;
  }
  if (!rawPassword) {
    res.status(400).json({ error: 'Vui lòng nhập Mật khẩu cấp phát cho tài khoản.' });
    return;
  }

  const isDuplicate = users.some(
    (u) => u.username?.trim().toLowerCase() === rawUsername.toLowerCase()
  );
  if (isDuplicate) {
    res.status(400).json({
      error: `Tên đăng nhập "${rawUsername}" đã tồn tại. Vui lòng chọn tên đăng nhập khác.`,
    });
    return;
  }

  const role: 'admin' | 'staff' = req.body.role === 'admin' ? 'admin' : 'staff';
  const rolePrefix = role === 'admin' ? 'QL' : 'NV';
  const roleCount = users.filter((u) => u.role === role).length + 1;

  const newUser: User = {
    id: 'user_' + Date.now(),
    username: rawUsername,
    password: rawPassword,
    email: req.body.email || `${rawUsername}@chaomamnho.vn`,
    name: req.body.name || (role === 'admin' ? 'Quản Lý Mới' : 'Nhân Viên Mới'),
    avatar:
      req.body.avatar ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(rawUsername)}`,
    role,
    employeeCode: req.body.employeeCode || `${rolePrefix}-${String(roleCount).padStart(3, '0')}`,
    position: req.body.position || (role === 'admin' ? 'Quản Lý Cửa Hàng' : 'Nhân Viên Bán Hàng'),
    hourlyRate: Number(req.body.hourlyRate) || (role === 'admin' ? 50000 : 28000),
    phone: req.body.phone || '',
    joinDate: req.body.joinDate || getTodayString(),
    isActive: true,
  };

  users.push(newUser);
  db.setUsers(users);
  res.json({ success: true, user: newUser });
});

usersRouter.put('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const users = db.getUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy tài khoản nhân sự' });
    return;
  }

  if (req.body.username) {
    const cleanNewUsername = String(req.body.username).trim();
    const isDuplicate = users.some(
      (u) => u.id !== id && u.username?.trim().toLowerCase() === cleanNewUsername.toLowerCase()
    );
    if (isDuplicate) {
      res.status(400).json({
        error: `Tên đăng nhập "${cleanNewUsername}" đã được sử dụng bởi người khác.`,
      });
      return;
    }
    req.body.username = cleanNewUsername;
  }

  users[index] = {
    ...users[index],
    ...req.body,
    password: req.body.password ? String(req.body.password).trim() : users[index].password,
  };
  db.setUsers(users);
  res.json({ success: true, user: users[index] });
});

usersRouter.delete('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const filtered = db.getUsers().filter((u) => u.id !== id);
  db.setUsers(filtered);
  res.json({ success: true });
});

usersRouter.get('/api/supabase/users', (_req: Request, res: Response) => {
  autoCloseOverdueShifts();
  syncAllStatsOnServer();
  const users = db.getUsers();
  res.json({
    success: true,
    source: 'supabase_database',
    table: 'users',
    count: users.length,
    users,
  });
});

usersRouter.post('/api/users/sync', (req: Request, res: Response) => {
  const incomingUsers = req.body?.users;
  let users = db.getUsers();
  if (Array.isArray(incomingUsers) && incomingUsers.length > 0) {
    const mergedMap = new Map<string, User>();
    users.forEach((u) => mergedMap.set(u.id, u));
    incomingUsers.forEach((u: User) => {
      if (u && u.id && u.username) {
        mergedMap.set(u.id, u);
      }
    });
    users = Array.from(mergedMap.values());
    db.setUsers(users);
  }
  res.json({
    success: true,
    source: 'supabase_database',
    count: users.length,
    users,
  });
});

usersRouter.post('/api/users/direct', (req: Request, res: Response) => {
  const users = db.getUsers();
  const rawUsername = String(req.body.username || '').trim();
  const rawPassword = String(req.body.password || '').trim();

  if (!rawUsername || !rawPassword) {
    res.status(400).json({ error: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu cấp phát.' });
    return;
  }

  const isDuplicate = users.some(
    (u) => u.username?.trim().toLowerCase() === rawUsername.toLowerCase()
  );
  if (isDuplicate) {
    res.status(400).json({ error: `Tên đăng nhập "${rawUsername}" đã tồn tại.` });
    return;
  }

  const role: 'admin' | 'staff' = req.body.role === 'admin' ? 'admin' : 'staff';
  const rolePrefix = role === 'admin' ? 'QL' : 'NV';
  const roleCount = users.filter((u) => u.role === role).length + 1;

  const newUser: User = enrichUserStatsOnServer({
    id: req.body.id || 'user_' + Date.now(),
    username: rawUsername,
    password: rawPassword,
    email: req.body.email || `${rawUsername}@chaomamnho.vn`,
    name: req.body.name || (role === 'admin' ? 'Quản Lý Mới' : 'Nhân Viên Mới'),
    avatar:
      req.body.avatar ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(rawUsername)}`,
    role,
    employeeCode: req.body.employeeCode || `${rolePrefix}-${String(roleCount).padStart(3, '0')}`,
    position: req.body.position || (role === 'admin' ? 'Quản Lý Cửa Hàng' : 'Nhân Viên Bán Hàng'),
    hourlyRate: Number(req.body.hourlyRate) || (role === 'admin' ? 50000 : 28000),
    phone: req.body.phone || '',
    joinDate: req.body.joinDate || getTodayString(),
    isActive: req.body.isActive !== false,
    note: req.body.note || '',
  });

  users.push(newUser);
  db.setUsers(users);
  syncAllStatsOnServer();
  res.json({ success: true, source: 'supabase_database', user: newUser });
});

usersRouter.put('/api/users/direct/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const users = db.getUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy tài khoản nhân sự' });
    return;
  }

  if (req.body.username) {
    const cleanNewUsername = String(req.body.username).trim();
    const isDuplicate = users.some(
      (u) => u.id !== id && u.username?.trim().toLowerCase() === cleanNewUsername.toLowerCase()
    );
    if (isDuplicate) {
      res.status(400).json({
        error: `Tên đăng nhập "${cleanNewUsername}" đã được sử dụng bởi người khác.`,
      });
      return;
    }
    req.body.username = cleanNewUsername;
  }

  users[index] = enrichUserStatsOnServer({
    ...users[index],
    ...req.body,
    password: req.body.password ? String(req.body.password).trim() : users[index].password,
  });
  db.setUsers(users);
  syncAllStatsOnServer();
  res.json({ success: true, source: 'supabase_database', user: users[index] });
});

usersRouter.delete('/api/users/direct/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const filtered = db.getUsers().filter((u) => u.id !== id);
  db.setUsers(filtered);
  res.json({ success: true, source: 'supabase_database' });
});

// Database inspection endpoints
usersRouter.get('/api/supabase/tables', (_req: Request, res: Response) => {
  const customCols = db.getCollections();
  res.json({
    success: true,
    source: 'supabase_database',
    tables: ['users', 'attendance_records', 'store_config', ...Object.keys(customCols)],
  });
});

usersRouter.get('/api/supabase/tables/:collection', (req: Request, res: Response) => {
  const col = req.params.collection;
  if (col === 'users') {
    res.json({ success: true, table: col, collection: col, items: db.getUsers() });
    return;
  }
  if (col === 'attendance' || col === 'attendance_records') {
    res.json({ success: true, table: col, collection: col, items: db.getAttendance() });
    return;
  }
  if (col === 'store_config') {
    res.json({ success: true, table: col, collection: col, items: [db.getConfig()] });
    return;
  }
  const customCols = db.getCollections();
  res.json({
    success: true,
    table: col,
    collection: col,
    items: customCols[col] || [],
  });
});
