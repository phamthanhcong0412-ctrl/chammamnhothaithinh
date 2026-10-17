/**
 * SERVER APP: Express configuration & Route mounting (Clean Architecture)
 */

import express from 'express';
import { configRouter } from './controllers/config.controller.ts';
import { authRouter } from './controllers/auth.controller.ts';
import { usersRouter } from './controllers/users.controller.ts';
import { attendanceRouter } from './controllers/attendance.controller.ts';
import { ensureUsersHaveCredentials } from './storage/json-repository.ts';
import { syncAllStatsOnServer, initPeriodicScheduler } from './services/shift-scheduler.service.ts';

export function createApp(): express.Application {
  const app = express();
  app.use(express.json());

  // Bootstrap initial checks and scheduling
  ensureUsersHaveCredentials();
  syncAllStatsOnServer();
  initPeriodicScheduler();

  // Mount modular route controllers
  app.use(configRouter);
  app.use(authRouter);
  app.use(usersRouter);
  app.use(attendanceRouter);

  return app;
}
