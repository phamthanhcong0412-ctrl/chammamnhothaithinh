import React, { useState, useEffect } from 'react';
import {
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  Mail,
  UserCheck,
  Edit,
  Trash2,
  RefreshCw,
  LogOut,
  Plus,
  Search,
  DollarSign,
  Sun,
  Sunset,
  Wifi,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import type { AttendanceRecord } from '../types/index.ts';

interface AdminDashboardProps {
  onOpenManualModal: (record?: AttendanceRecord | null, preselectedUserId?: string) => void;
  onOpenEmailModal: () => void;
  onOpenSettingsModal?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenManualModal,
  onOpenEmailModal,
  onOpenSettingsModal,
}) => {
  const { users, attendance, deleteAttendance, checkOutUser, refreshData } = useApp();
  const [currentSeconds, setCurrentSeconds] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [checkingOutUserId, setCheckingOutUserId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Table filters
  const [logScope, setLogScope] = useState<'today' | 'all'>('today');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'shift_morning' | 'shift_afternoon'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleQuickCheckOut = async (userId: string) => {
    setCheckingOutUserId(userId);
    try {
      await checkOutUser(userId, 'Quản lý chốt ra ca trực tiếp');
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingOutUserId(null);
    }
  };

  // Ticking timer for real-time live working duration
  useEffect(() => {
    const timer = setInterval(() => setCurrentSeconds(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nowDate = new Date(currentSeconds);
  const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
  const todayRecords = attendance.filter((r) => r.date === todayStr);

  // Group staff into categories
  const workingRecords = todayRecords.filter((r) => r.status === 'working');
  const workingUserIds = new Set(workingRecords.map((r) => r.userId));

  // Group completed records by (userId + shiftId) so multiple check-in/out turns in 1 shift count as 1 completed shift
  const completedShiftsMap = new Map<
    string,
    {
      key: string;
      record: AttendanceRecord;
      userId: string;
      userName: string;
      employeeCode: string;
      shiftId: string;
      shiftName: string;
      firstCheckInTime: string;
      lastCheckOutTime: string | null;
      totalMinutes: number;
      estimatedPay: number;
      turnsCount: number;
      isLate: boolean;
      isEarlyLeave: boolean;
    }
  >();

  todayRecords
    .filter((r) => r.status === 'completed' && !workingUserIds.has(r.userId))
    .forEach((r) => {
      const inferredShiftId =
        r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning');
      const key = `${r.userId}_${inferredShiftId}`;
      const existing = completedShiftsMap.get(key);
      if (!existing) {
        completedShiftsMap.set(key, {
          key,
          record: r,
          userId: r.userId,
          userName: r.userName,
          employeeCode: r.employeeCode,
          shiftId: inferredShiftId,
          shiftName: inferredShiftId === 'shift_afternoon' ? 'Ca Chiều' : 'Ca Sáng',
          firstCheckInTime: r.checkInTime,
          lastCheckOutTime: r.checkOutTime || null,
          totalMinutes: Number(r.totalMinutes) || 0,
          estimatedPay: Number(r.estimatedShiftPay) || 0,
          turnsCount: 1,
          isLate: Boolean(r.isLate),
          isEarlyLeave: Boolean(r.isEarlyLeave),
        });
      } else {
        if (new Date(r.checkInTime).getTime() < new Date(existing.firstCheckInTime).getTime()) {
          existing.firstCheckInTime = r.checkInTime;
        }
        if (
          r.checkOutTime &&
          (!existing.lastCheckOutTime ||
            new Date(r.checkOutTime).getTime() > new Date(existing.lastCheckOutTime).getTime())
        ) {
          existing.lastCheckOutTime = r.checkOutTime;
        }
        existing.totalMinutes += Number(r.totalMinutes) || 0;
        existing.estimatedPay += Number(r.estimatedShiftPay) || 0;
        existing.turnsCount += 1;
        existing.isLate = existing.isLate || Boolean(r.isLate);
        existing.isEarlyLeave = existing.isEarlyLeave || Boolean(r.isEarlyLeave);
      }
    });

  const completedShiftGroups = Array.from(completedShiftsMap.values());
  const completedUserIds = new Set(
    todayRecords.filter((r) => r.status === 'completed').map((r) => r.userId)
  );

  const staffUsers = users.filter((u) => u.isActive && u.role === 'staff');
  const absentUsers = staffUsers.filter(
    (u) => !workingUserIds.has(u.id) && !completedUserIds.has(u.id)
  );

  // Today's KPI Stats
  const totalMinutesToday = todayRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
  const totalHoursToday = (totalMinutesToday / 60).toFixed(1);
  const totalUniqueShiftsToday = new Set(
    todayRecords.map(
      (r) =>
        `${r.userId}_${r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning')}`
    )
  ).size;
  const todayEstimatedPay = todayRecords.reduce((sum, r) => sum + (Number(r.estimatedShiftPay) || 0), 0);

  // Filtered Log Records
  const filteredLogRecords = (logScope === 'today' ? todayRecords : attendance).filter((r) => {
    const inferredShiftId =
      r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning');
    if (shiftFilter !== 'all' && inferredShiftId !== shiftFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.userName.toLowerCase().includes(q) ||
        r.employeeCode.toLowerCase().includes(q) ||
        (r.note && r.note.toLowerCase().includes(q))
      );
    }
    return true;
  });

  function formatDuration(startTimeIso: string): string {
    const startMs = new Date(startTimeIso).getTime();
    const diffSec = Math.max(0, Math.floor((currentSeconds - startMs) / 1000));
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
              Điều Hành Chấm Công Trực Tiếp
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 capitalize">
            {nowDate.toLocaleDateString('vi-VN', {
              weekday: 'long',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Quick Manager Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
            title="Đồng bộ dữ liệu mới nhất"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>

          {onOpenSettingsModal && (
            <button
              onClick={onOpenSettingsModal}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-400" /> Thiết lập WiFi & Cửa hàng
            </button>
          )}

          <button
            onClick={() => onOpenManualModal(null)}
            className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-400" /> Chấm công hộ
          </button>

          <button
            onClick={onOpenEmailModal}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" /> Báo cáo Email
          </button>
        </div>
      </div>

      {/* 4 Modern KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">Nhân sự trong ca</span>
            <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums mt-1">
              {workingRecords.length} <span className="text-xs font-normal text-zinc-500">/ {staffUsers.length} NV</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">Tổng giờ hôm nay</span>
            <div className="text-2xl font-black text-indigo-400 font-mono tabular-nums mt-1">
              {totalHoursToday}h <span className="text-xs font-normal text-zinc-500">({totalUniqueShiftsToday} ca)</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">Đã xong ca hôm nay</span>
            <div className="text-2xl font-black text-teal-400 font-mono tabular-nums mt-1">
              {completedShiftGroups.length} ca{' '}
              <span className="text-xs font-sans font-normal text-zinc-500">
                (Chưa vào: {absentUsers.length} NV)
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">Quỹ lương hôm nay</span>
            <div className="text-2xl font-black text-amber-400 font-mono tabular-nums mt-1">
              {todayEstimatedPay.toLocaleString('vi-VN')}đ
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Real-time 3-Column Operations Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: ĐANG LÀM */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-xs font-bold text-zinc-100">
                Đang trong ca ({workingRecords.length})
              </h3>
            </div>
            <span className="text-[11px] text-emerald-400 font-medium">Trực tiếp</span>
          </div>

          <div className="mt-3 space-y-2 flex-1">
            {workingRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                Hiện chưa có nhân viên nào đang trong ca
              </div>
            ) : (
              workingRecords.map((r) => {
                const user = users.find((u) => u.id === r.userId);
                const isAfternoon =
                  r.shiftId === 'shift_afternoon' || new Date(r.checkInTime).getHours() >= 14;
                return (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-zinc-950/90 border border-emerald-500/25 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={
                          user?.avatar ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(r.userName)}`
                        }
                        alt={r.userName}
                        className="w-8 h-8 rounded-xl object-cover bg-zinc-800 border border-zinc-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-100 truncate">{r.userName}</div>
                        <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
                          <span>{isAfternoon ? 'Ca Chiều' : 'Ca Sáng'}</span>
                          <span>·</span>
                          <span>Vào {formatTime(r.checkInTime)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                          {formatDuration(r.checkInTime)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleQuickCheckOut(r.userId)}
                        disabled={checkingOutUserId === r.userId}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        title="Chốt ra ca hộ nhân viên này"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>{checkingOutUserId === r.userId ? '...' : 'Chốt ca'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: ĐÃ XONG CA (Grouped by employee + shift) */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <h3 className="text-xs font-bold text-zinc-100">
                Đã xong ca ({completedShiftGroups.length})
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500">Gộp theo ca</span>
          </div>

          <div className="mt-3 space-y-2 flex-1">
            {completedShiftGroups.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                Chưa có ca làm việc nào hoàn thành hôm nay
              </div>
            ) : (
              completedShiftGroups.map((group) => {
                const user = users.find((u) => u.id === group.userId);
                return (
                  <div
                    key={group.key}
                    className="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800/80 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={
                          user?.avatar ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(group.userName)}`
                        }
                        alt={group.userName}
                        className="w-8 h-8 rounded-xl object-cover bg-zinc-800 border border-zinc-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-100 truncate">{group.userName}</span>
                          <span className="text-[10px] text-indigo-400 font-medium shrink-0">
                            · {group.shiftName}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {formatTime(group.firstCheckInTime)} →{' '}
                          {group.lastCheckOutTime ? formatTime(group.lastCheckOutTime) : '--'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <div className="text-xs font-bold text-indigo-400">
                        {(group.totalMinutes / 60).toFixed(1)}h{' '}
                        <span className="text-[10px] font-normal text-zinc-500">({group.totalMinutes}p)</span>
                      </div>
                      <div className="text-[10px] text-emerald-400 font-semibold">
                        +{group.estimatedPay.toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: CHƯA VÀO CA */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-zinc-500" />
              <h3 className="text-xs font-bold text-zinc-100">
                Chưa vào ca ({absentUsers.length})
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500">Hôm nay</span>
          </div>

          <div className="mt-3 space-y-2 flex-1">
            {absentUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-emerald-400 font-medium">
                Tất cả nhân sự đã có mặt hôm nay
              </div>
            ) : (
              absentUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username)}`}
                      alt={u.name}
                      className="w-8 h-8 rounded-xl object-cover bg-zinc-800 grayscale opacity-70 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-200 truncate">{u.name}</div>
                      <div className="text-[10px] text-zinc-500">
                        {u.position} · <span className="font-mono">{u.employeeCode}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenManualModal(null, u.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-amber-500/20 border border-zinc-700/80 hover:border-amber-500/40 text-[11px] text-amber-300 font-semibold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Chấm hộ</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Attendance Log Table with Filter Bar */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 overflow-hidden">
        <div className="p-4 border-b border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-zinc-100">
              Nhật Ký Chấm Công ({filteredLogRecords.length})
            </h3>
            <div className="flex items-center gap-1 p-0.5 bg-zinc-950 border border-zinc-800 rounded-xl">
              <button
                onClick={() => setLogScope('today')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  logScope === 'today' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Hôm nay
              </button>
              <button
                onClick={() => setLogScope('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  logScope === 'all' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Tất cả ({attendance.length})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Shift filter */}
            <div className="flex items-center gap-1 p-0.5 bg-zinc-950 border border-zinc-800 rounded-xl">
              <button
                onClick={() => setShiftFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  shiftFilter === 'all' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Mọi ca
              </button>
              <button
                onClick={() => setShiftFilter('shift_morning')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  shiftFilter === 'shift_morning' ? 'bg-zinc-800 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sun className="w-3 h-3" /> Ca Sáng
              </button>
              <button
                onClick={() => setShiftFilter('shift_afternoon')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  shiftFilter === 'shift_afternoon' ? 'bg-zinc-800 text-orange-300' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sunset className="w-3 h-3" /> Ca Chiều
              </button>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên, mã NV..."
                className="pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 w-44"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 text-zinc-400 text-[11px] bg-zinc-950/40 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Nhân viên</th>
                <th className="py-3 px-3 font-semibold">Ca / Ngày</th>
                <th className="py-3 px-3 font-semibold">Giờ vào → Ra</th>
                <th className="py-3 px-3 font-semibold">Thời lượng</th>
                <th className="py-3 px-3 font-semibold">Lương ca</th>
                <th className="py-3 px-3 font-semibold">Ghi chú & Hình thức</th>
                <th className="py-3 px-4 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredLogRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    Không có bản ghi chấm công nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredLogRecords.map((record) => {
                  const isAfternoon =
                    record.shiftId === 'shift_afternoon' ||
                    new Date(record.checkInTime).getHours() >= 14;
                  const isConfirming = confirmDeleteId === record.id;

                  return (
                    <tr key={record.id} className="hover:bg-zinc-800/30 transition-colors whitespace-nowrap">
                      <td className="py-3 px-4">
                        <span className="font-bold text-zinc-100">{record.userName}</span>
                        <span className="text-[11px] text-zinc-500 font-mono ml-1.5">
                          ({record.employeeCode})
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-semibold text-zinc-200">
                          {isAfternoon ? 'Ca Chiều' : 'Ca Sáng'}
                        </span>
                        <span className="text-zinc-500 font-mono ml-1.5 text-[11px]">
                          · {record.date.slice(5)}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono tabular-nums text-zinc-200">
                        {formatTime(record.checkInTime)} →{' '}
                        {record.checkOutTime ? (
                          formatTime(record.checkOutTime)
                        ) : (
                          <span className="text-emerald-400 font-sans font-semibold">Đang làm</span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono tabular-nums">
                        {record.status === 'working' ? (
                          <span className="text-emerald-400 font-bold">
                            {formatDuration(record.checkInTime)}
                          </span>
                        ) : (
                          <span className="font-bold text-indigo-400">
                            {(record.totalMinutes / 60).toFixed(1)}h{' '}
                            <span className="text-[11px] font-normal text-zinc-500">
                              ({record.totalMinutes}p)
                            </span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono tabular-nums text-emerald-400 font-semibold">
                        {record.estimatedShiftPay
                          ? `${record.estimatedShiftPay.toLocaleString('vi-VN')}đ`
                          : '--'}
                      </td>

                      <td className="py-3 px-3 text-zinc-400">
                        {record.checkInMethod === 'manual_admin' || record.adjustedBy ? (
                          <span className="text-amber-300 font-medium">Chấm hộ</span>
                        ) : (
                          <span>WiFi quán</span>
                        )}
                        {record.note && (
                          <span
                            className="text-zinc-500 ml-1.5 max-w-[160px] inline-block truncate align-bottom"
                            title={record.note}
                          >
                            · {record.note}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenManualModal(record)}
                            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                            title="Chỉnh sửa ca"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (isConfirming) {
                                deleteAttendance(record.id);
                                setConfirmDeleteId(null);
                              } else {
                                setConfirmDeleteId(record.id);
                                setTimeout(
                                  () => setConfirmDeleteId((prev) => (prev === record.id ? null : prev)),
                                  3000
                                );
                              }
                            }}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                              isConfirming
                                ? 'bg-rose-600 text-white'
                                : 'hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400'
                            }`}
                            title="Xoá bản ghi này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isConfirming && <span>Xoá?</span>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
