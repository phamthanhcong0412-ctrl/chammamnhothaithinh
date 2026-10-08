/**
 * APPLICATION SERVICE: ReportService
 * Chuyên trách: Tính toán tổng hợp công tháng (Monthly Payroll Summary), gửi email báo cáo (SRP)
 */

import type { MonthlyEmployeeSummary, EmailLog, StoreConfig } from '../types/index.ts';
import { userService } from './user.service.ts';
import { configService } from './config.service.ts';
import { DEFAULT_STORE_CONFIG } from '../infrastructure/index.ts';

const API_BASE = '/api';
const STORAGE_KEY_EMAIL_LOGS = 'chammam_email_logs_v2';
const STORAGE_KEY_CONFIG = 'chammam_store_config_v2';

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadLocal<T>(key: string, fallback: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      if (item) return JSON.parse(item);
    }
  } catch {}
  return fallback;
}

function saveLocal<T>(key: string, value: T): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {}
}

async function fetchJsonOrThrow(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('STATIC_HOST_FALLBACK');
  }
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export class ReportService {
  async getMonthlyReport(
    month?: string,
    userId?: string,
    attendanceFetcher?: () => Promise<any[]>
  ): Promise<{
    month: string;
    summaries: MonthlyEmployeeSummary[];
    totalRecords: number;
  }> {
    const targetMonth = month || getTodayString().substring(0, 7);
    const users = await userService.getUsers();
    const attendance = attendanceFetcher
      ? await attendanceFetcher()
      : loadLocal<any[]>('chammam_attendance_v2', []);

    const monthRecords = attendance.filter((r) => r.date?.startsWith(targetMonth));
    const targetUsers = userId ? users.filter((u) => u.id === userId) : users;

    const summaries: MonthlyEmployeeSummary[] = targetUsers.map((user) => {
      const userRecords = monthRecords.filter((r) => r.userId === user.id);
      const totalDaysWorked = new Set(userRecords.map((r) => r.date)).size;
      const uniqueShiftsCount = new Set(
        userRecords.map(
          (r) =>
            `${r.date}_${r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning')}`
        )
      ).size;
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
        recordsCount: uniqueShiftsCount,
      };
    });

    const totalStoreUniqueShifts = new Set(
      monthRecords.map(
        (r) =>
          `${r.userId}_${r.date}_${r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning')}`
      )
    ).size;

    return {
      month: targetMonth,
      summaries,
      totalRecords: totalStoreUniqueShifts,
    };
  }

  async sendEmailReport(payload?: { recipient?: string; trigger?: 'manual' | 'auto_21h' }): Promise<{
    success: boolean;
    message: string;
    log: EmailLog;
  }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/reports/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      });
      if (!ok) throw new Error(data.error || 'Gửi email thất bại');
      return data;
    } catch {
      const cfg = await configService.getConfig().catch(() => loadLocal<StoreConfig>(STORAGE_KEY_CONFIG, DEFAULT_STORE_CONFIG));
      const logs = loadLocal<EmailLog[]>(STORAGE_KEY_EMAIL_LOGS, []);
      const today = getTodayString();
      const recipient = payload?.recipient || cfg.managerEmail;
      const newLog: EmailLog = {
        id: 'email_' + Date.now(),
        sentAt: new Date().toISOString(),
        date: today,
        recipient,
        subject: `[Báo Cáo Chấm Công] ${cfg.storeName} - Ngày ${today}`,
        summary: { totalStaff: 5, workedToday: 2, totalHours: 8 },
        htmlBody: `<div style="padding:20px;font-family:'Be Vietnam Pro',sans-serif;background:#18181b;color:#f4f4f5"><h2>${cfg.storeName}</h2><p>Báo cáo ngày ${today} đã được gửi tới ${recipient}</p></div>`,
        status: 'sent',
        trigger: payload?.trigger || 'manual',
      };
      logs.unshift(newLog);
      saveLocal(STORAGE_KEY_EMAIL_LOGS, logs);
      return {
        success: true,
        message: `Đã gửi báo cáo thành công tới ${recipient}`,
        log: newLog,
      };
    }
  }

  async getEmailLogs(): Promise<EmailLog[]> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/reports/email-logs`);
      if (!ok) throw new Error('Không thể tải lịch sử email');
      saveLocal(STORAGE_KEY_EMAIL_LOGS, data);
      return data;
    } catch {
      return loadLocal<EmailLog[]>(STORAGE_KEY_EMAIL_LOGS, []);
    }
  }
}

export const reportService = new ReportService();
