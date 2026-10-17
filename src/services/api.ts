/**
 * APPLICATION FACADE: api / apiService
 * Kiến trúc Clean Architecture & Facade Pattern:
 * Tập hợp và điều phối các dịch vụ chuyên biệt (AuthService, UserService, AttendanceService,
 * ConfigService, ReportService) và re-export các Domain helpers để đảm bảo Zero-Regression.
 */

import { authService } from './auth.service.ts';
import { userService } from './user.service.ts';
import { attendanceService } from './attendance.service.ts';
import { configService } from './config.service.ts';
import { reportService } from './report.service.ts';

// Re-export toàn bộ Domain Pure Functions để các UI components tiếp tục hoạt động mà không cần sửa import
export {
  calculateGpsDistanceMeters,
  isGpsWithinStoreRadius,
  extractWifiBaseName,
  deriveDualBandBssidFromIp,
  deriveBssidFromNetworkIp,
  getDualBandWifiProfile,
  isWifiSsidAllowedByDualBand,
  isClientIpAllowedByConfig,
  parseHmToMins,
  evaluateShiftTiming,
  isTimeInConfiguredShifts,
  calculateEstimatedSalary,
  enrichAttendanceRecord,
  enrichUserWithAttendanceStats,
  deduplicateAndMergeOverlappingTurns,
  consolidateCompletedShifts,
} from '../domain/index.ts';

// Re-export services con để các module mới có thể import trực tiếp (SRP)
export { authService, userService, attendanceService, configService, reportService };

/**
 * Facade Object: Giữ nguyên 100% API surface cũ cho AppContext và các Component
 */
export const api = {
  // Config & Network
  getNetworkInfo: (forceRefresh?: boolean) => configService.getNetworkInfo(forceRefresh),
  getQrToken: () => configService.getQrToken(),
  getConfig: () => configService.getConfig(),
  updateConfig: (config: any) => configService.updateConfig(config),

  // Auth
  login: (u: string, p: string) => authService.login(u, p),
  loginWithGoogle: () => authService.loginWithGoogle(),
  changePassword: (uid: string, curr: string, next: string) => authService.changePassword(uid, curr, next),

  // Users
  getUsers: () => userService.getUsers(),
  createUser: (u: any) => userService.createUser(u),
  updateUser: (id: string, u: any) => userService.updateUser(id, u),
  deleteUser: (id: string) => userService.deleteUser(id),
  syncUsersToSupabase: (list?: any) => userService.syncUsersToSupabase(list),

  // Attendance
  getAttendance: (params?: any) => attendanceService.getAttendance(params),
  checkIn: (payload: any) => attendanceService.checkIn(payload),
  checkOut: (payload: any) => attendanceService.checkOut(payload),
  manualAttendance: (payload: any) => attendanceService.manualAttendance(payload),
  deleteAttendance: (id: string) => attendanceService.deleteAttendance(id),

  // Reports
  getMonthlyReport: (month?: string, userId?: string) =>
    reportService.getMonthlyReport(month, userId, () => attendanceService.getAttendance()),
  sendEmailReport: (payload?: any) => reportService.sendEmailReport(payload),
  getEmailLogs: () => reportService.getEmailLogs(),
};

export const apiService = api;
export default api;
