export interface User {
  id: string;
  username: string;
  password?: string;
  email: string;
  name: string;
  avatar: string;
  role: 'admin' | 'staff';
  employeeCode: string;
  position: string;
  hourlyRate: number;
  phone: string;
  joinDate: string;
  isActive: boolean;
  note?: string;
  // Enriched attendance stats and management fields (hours, minutes, attendance stats)
  totalMinutesWorked?: number;
  totalHoursWorked?: number;
  totalDaysWorked?: number;
  totalShifts?: number;
  lateCount?: number;
  estimatedSalary?: number;
  currentStatus?: 'working' | 'offline';
  lastCheckInTime?: string | null;
  lastCheckOutTime?: string | null;
  recentAttendanceSummary?: string;
}

export interface ShiftTurn {
  checkInTime: string; // ISO
  checkOutTime: string | null; // ISO
  minutes: number;
  note?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  employeeCode: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // ISO
  checkOutTime: string | null; // ISO
  totalMinutes: number;
  totalHours?: number;
  hourlyRate?: number;
  estimatedShiftPay?: number;
  turns?: ShiftTurn[];
  status: 'working' | 'completed' | 'adjusted';
  checkInMethod: 'qr_wifi' | 'manual_admin' | 'qr_gps' | 'qr_wifi_gps' | 'direct_button';
  checkInIp: string;
  checkInGps?: {
    lat: number;
    lng: number;
    accuracy?: number;
    distance?: number;
  };
  checkInWifiSsid?: string;
  checkInWifiBssid?: string;
  checkOutIp?: string;
  checkOutGps?: {
    lat: number;
    lng: number;
    distance?: number;
  };
  isLate: boolean;
  isEarlyLeave: boolean;
  shiftId?: string;
  shiftName?: string;
  autoClosed?: boolean;
  note?: string;
  adjustedBy?: string;
  adjustedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftConfig {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  lateGraceMinutes: number;
  checkInBeforeMinutes: number; // e.g. 30
  checkOutAfterMinutes: number; // e.g. 90 (1.5h)
}

export interface StoreConfig {
  storeName: string;
  storeAddress: string;
  wifiSsid: string;
  wifiBssid?: string;
  allowedIps: string[];
  bypassIpCheck: boolean;
  requireWifi: boolean;
  requireQr: boolean;
  requireGps: boolean;
  storeGps: {
    lat: number;
    lng: number;
    radiusMeters: number;
  };
  qrRefreshSeconds: number;
  qrSecret: string;
  shifts: ShiftConfig[];
  autoEmailTime: string; // default "21:00"
  managerEmail: string;
  lastReportSentDate: string | null;
  supabaseConfig?: {
    url?: string;
    anonKey?: string;
  };
}

export interface NetworkInfo {
  clientIp: string;
  isAllowedIp: boolean;
  timestamp: number;
  detectedSsid?: string;
  rawSsid?: string;
  detectedBssid?: string;
  bssid24G?: string;
  bssid5G?: string;
  headers?: Record<string, string>;
}

export interface EmailLog {
  id: string;
  sentAt: string;
  date: string;
  recipient: string;
  subject: string;
  summary: {
    totalStaff: number;
    workedToday: number;
    totalHours: number;
  };
  htmlBody: string;
  status: 'sent' | 'failed';
  trigger: 'auto_21h' | 'manual';
}

export interface MonthlyEmployeeSummary {
  userId: string;
  userName: string;
  employeeCode: string;
  position: string;
  hourlyRate?: number;
  totalDaysWorked: number;
  totalMinutes: number;
  totalHours: number;
  totalLateCount: number;
  totalEarlyCount: number;
  estimatedSalary: number;
  recordsCount?: number;
  records?: AttendanceRecord[];
}
