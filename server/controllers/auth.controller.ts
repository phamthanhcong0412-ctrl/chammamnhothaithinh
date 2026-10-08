/**
 * CONTROLLER: auth.controller
 * Quản lý endpoints đăng nhập và đổi mật khẩu trên server backend
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, DEFAULT_USERS } from '../storage/json-repository.ts';

export const authRouter = Router();

authRouter.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!cleanUsername || !cleanPassword) {
    res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
    return;
  }

  const users = db.getUsers();

  // Đảm bảo tài khoản admin ptcong mặc định luôn có thể đăng nhập
  if (cleanUsername === 'ptcong' && cleanPassword === '12345678@Abc') {
    let adminUser = users.find((u) => u.username?.toLowerCase() === 'ptcong');
    if (!adminUser) {
      adminUser = { ...DEFAULT_USERS[0] };
      users.unshift(adminUser);
      db.setUsers(users);
    }
    res.json({ success: true, user: adminUser });
    return;
  }

  const matchedUser = users.find(
    (u) => u.username?.trim().toLowerCase() === cleanUsername && u.isActive !== false
  );

  if (!matchedUser || matchedUser.password !== cleanPassword) {
    res.status(401).json({
      error: 'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại tài khoản được cấp phát.',
    });
    return;
  }

  res.json({ success: true, user: matchedUser });
});

authRouter.post('/api/auth/login-direct', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!cleanUsername || !cleanPassword) {
    res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
    return;
  }

  const users = db.getUsers();

  if (cleanUsername === 'ptcong' && cleanPassword === '12345678@Abc') {
    let adminUser = users.find((u) => u.username?.toLowerCase() === 'ptcong');
    if (!adminUser) {
      adminUser = { ...DEFAULT_USERS[0] };
      users.unshift(adminUser);
      db.setUsers(users);
    }
    res.json({
      success: true,
      source: 'supabase_database',
      table: 'users',
      user: adminUser,
    });
    return;
  }

  const matchedUser = users.find(
    (u) => u.username?.trim().toLowerCase() === cleanUsername && u.isActive !== false
  );

  if (!matchedUser || matchedUser.password !== cleanPassword) {
    res.status(401).json({
      error: 'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại tài khoản được cấp phát.',
    });
    return;
  }

  res.json({
    success: true,
    source: 'supabase_database',
    table: 'users',
    user: matchedUser,
  });
});

authRouter.post('/api/auth/change-password', (req: Request, res: Response) => {
  const { userId, currentPassword, newPassword } = req.body;
  const cleanNewPassword = String(newPassword || '').trim();

  if (!userId || !cleanNewPassword) {
    res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu mới.' });
    return;
  }

  if (cleanNewPassword.length < 4) {
    res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' });
    return;
  }

  const users = db.getUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy tài khoản người dùng.' });
    return;
  }

  const targetUser = users[index];
  if (currentPassword !== undefined && String(currentPassword) !== String(targetUser.password || '123456')) {
    res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác.' });
    return;
  }

  users[index] = {
    ...targetUser,
    password: cleanNewPassword,
  };
  db.setUsers(users);

  res.json({
    success: true,
    source: 'supabase_database',
    user: users[index],
  });
});
