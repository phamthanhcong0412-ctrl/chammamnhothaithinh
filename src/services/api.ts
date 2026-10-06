import type {
  User,
  AttendanceRecord,
  StoreConfig,
  NetworkInfo,
  EmailLog,
  MonthlyEmployeeSummary,
} from '../types/index.ts';

const API_BASE = '/api';

export const api = {
  // Network & IP
  async getNetworkInfo(): Promise<NetworkInfo> {
    const res = await fetch(`${API_BASE}/network-info`);
    if (!res.ok) throw new Error('Không thể kiểm tra thông tin mạng');
    return res.json();
  },

  // QR Token
  async getQrToken(): Promise<{ token: string; generatedAt: number; expiresAt: number; storeName: string }> {
    const res = await fetch(`${API_BASE}/qr/token`);
    if (!res.ok) throw new Error('Không thể tạo mã QR mới');
    return res.json();
  },

  // Store Config
  async getConfig(): Promise<StoreConfig> {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) throw new Error('Không thể tải cấu hình cửa hàng');
    return res.json();
  },

  async updateConfig(config: Partial<StoreConfig>): Promise<{ success: boolean; config: StoreConfig }> {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Không thể lưu cấu hình cửa hàng');
    return res.json();
  },

  // Auth & Users
  async login(username: string, password: string): Promise<{ success: boolean; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');
    return data;
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/users`);
    if (!res.ok) throw new Error('Không thể tải danh sách nhân viên');
    return res.json();
  },

  async createUser(user: Partial<User>): Promise<{ success: boolean; user: User }> {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể tạo tài khoản mới');
    return data;
  },

  async updateUser(id: string, user: Partial<User>): Promise<{ success: boolean; user: User }> {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể cập nhật thông tin tài khoản');
    return data;
  },

  async deleteUser(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Không thể xoá nhân viên');
    return res.json();
  },

  // Attendance
  async getAttendance(params?: { date?: string; userId?: string; month?: string }): Promise<AttendanceRecord[]> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const res = await fetch(`${API_BASE}/attendance${query ? `?${query}` : ''}`);
    if (!res.ok) throw new Error('Không thể tải lịch sử chấm công');
    return res.json();
  },

  async checkIn(payload: {
    userId: string;
    qrToken?: string;
    wifiSsid?: string;
    gps?: { lat: number; lng: number; accuracy?: number; distance?: number };
    note?: string;
  }): Promise<{ success: boolean; record: AttendanceRecord }> {
    const res = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Check-in thất bại');
    return data;
  },

  async checkOut(payload: {
    userId: string;
    qrToken?: string;
    wifiSsid?: string;
    gps?: { lat: number; lng: number; distance?: number };
    note?: string;
  }): Promise<{ success: boolean; record: AttendanceRecord }> {
    const res = await fetch(`${API_BASE}/attendance/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Check-out thất bại');
    return data;
  },

  async manualAttendance(payload: {
    id?: string;
    userId: string;
    date: string;
    checkInTime: string;
    checkOutTime?: string | null;
    note?: string;
    adjustedBy?: string;
    adjustedReason?: string;
  }): Promise<{ success: boolean; record: AttendanceRecord }> {
    const res = await fetch(`${API_BASE}/attendance/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể lưu chấm công');
    return data;
  },

  async deleteAttendance(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/attendance/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Không thể xoá bản ghi');
    return res.json();
  },

  // Monthly Report
  async getMonthlyReport(month?: string, userId?: string): Promise<{
    month: string;
    summaries: MonthlyEmployeeSummary[];
    totalRecords: number;
  }> {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (userId) params.append('userId', userId);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/reports/monthly${query}`);
    if (!res.ok) throw new Error('Không thể tải báo cáo tháng');
    return res.json();
  },

  // Email Reports
  async sendEmailReport(payload?: { recipient?: string; trigger?: 'manual' | 'auto_21h' }): Promise<{
    success: boolean;
    message: string;
    log: EmailLog;
  }> {
    const res = await fetch(`${API_BASE}/reports/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gửi email thất bại');
    return data;
  },

  async getEmailLogs(): Promise<EmailLog[]> {
    const res = await fetch(`${API_BASE}/reports/email-logs`);
    if (!res.ok) throw new Error('Không thể tải lịch sử email');
    return res.json();
  },
};
