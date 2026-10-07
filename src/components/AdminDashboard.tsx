import React, { useState, useEffect } from 'react';
import {
  Activity,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Mail,
  UserCheck,
  Edit,
  Trash2,
  Wifi,
  MapPin,
  Calendar,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import type { AttendanceRecord } from '../types/index.ts';

interface AdminDashboardProps {
  onOpenManualModal: (record?: AttendanceRecord | null) => void;
  onOpenEmailModal: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenManualModal,
  onOpenEmailModal,
}) => {
  const { users, attendance, storeConfig, networkInfo, deleteAttendance, refreshData } = useApp();
  const [currentSeconds, setCurrentSeconds] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
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

  const completedRecords = todayRecords.filter((r) => r.status === 'completed');
  const completedUserIds = new Set(completedRecords.map((r) => r.userId));

  const staffUsers = users.filter((u) => u.isActive && u.role === 'staff');
  const absentUsers = staffUsers.filter(
    (u) => !workingUserIds.has(u.id) && !completedUserIds.has(u.id)
  );

  // Stats
  const totalMinutesToday = todayRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
  const totalHoursToday = (totalMinutesToday / 60).toFixed(1);
  const onTimeCount = todayRecords.filter((r) => !r.isLate).length;
  const onTimeRate = todayRecords.length > 0 ? Math.round((onTimeCount / todayRecords.length) * 100) : 100;

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
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
            Bảng Điều Khiển Quản Lý
          </h2>
        </div>

        {/* Quick Manager Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
            title="Tải dữ liệu mới nhất từ Firebase"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>

          <button
            onClick={() => onOpenManualModal(null)}
            className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-400" /> Chấm công hộ
          </button>

          <button
            onClick={onOpenEmailModal}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" /> Báo cáo Email
          </button>
        </div>
      </div>

      {/* Compact KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-400 font-medium">Đang có mặt</span>
            <div className="text-xl font-black text-emerald-400 font-mono tabular-nums mt-0.5">
              {workingRecords.length} <span className="text-xs font-normal text-zinc-500">/ {staffUsers.length}</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-400 font-medium">Giờ làm hôm nay</span>
            <div className="text-xl font-black text-indigo-400 font-mono tabular-nums mt-0.5">
              {totalHoursToday}h <span className="text-xs font-normal text-zinc-500">({todayRecords.length} ca)</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-400 font-medium">Đúng giờ</span>
            <div className="text-xl font-black text-teal-400 font-mono tabular-nums mt-0.5">
              {onTimeRate}%
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between min-w-0">
          <div className="min-w-0 pr-2">
            <span className="text-[11px] text-zinc-400 font-medium">WiFi quán</span>
            <div className="text-xs font-bold text-zinc-200 truncate mt-1">
              {storeConfig?.wifiSsid}
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center shrink-0">
            <Wifi className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Real-time 3-Column Status Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: ĐANG LÀM */}
        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-bold text-zinc-200">
                Đang làm ({workingRecords.length})
              </h3>
            </div>
          </div>

          <div className="mt-2.5 space-y-2 flex-1">
            {workingRecords.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500">
                Chưa có nhân viên trong ca
              </div>
            ) : (
              workingRecords.map((r) => {
                const user = users.find((u) => u.id === r.userId);
                return (
                  <div
                    key={r.id}
                    className="px-3 py-2.5 rounded-xl bg-zinc-950 border border-emerald-500/25 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                        alt={r.userName}
                        className="w-7 h-7 rounded-full object-cover border border-zinc-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-100 truncate">{r.userName}</div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          Vào {formatTime(r.checkInTime)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                        {formatDuration(r.checkInTime)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: ĐÃ XONG CA */}
        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <h3 className="text-xs font-bold text-zinc-200">
                Đã xong ca ({completedRecords.length})
              </h3>
            </div>
          </div>

          <div className="mt-2.5 space-y-2 flex-1">
            {completedRecords.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500">
                Chưa có ca hoàn thành
              </div>
            ) : (
              completedRecords.map((r) => {
                const user = users.find((u) => u.id === r.userId);
                return (
                  <div
                    key={r.id}
                    className="px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                        alt={r.userName}
                        className="w-7 h-7 rounded-full object-cover border border-zinc-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-200 truncate">{r.userName}</div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {formatTime(r.checkInTime)} → {r.checkOutTime ? formatTime(r.checkOutTime) : '--'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-indigo-400 tabular-nums">
                        {(r.totalMinutes / 60).toFixed(1)}h
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">{r.totalMinutes}p</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: CHƯA VÀO CA */}
        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-zinc-500" />
              <h3 className="text-xs font-bold text-zinc-200">
                Chưa vào ca ({absentUsers.length})
              </h3>
            </div>
          </div>

          <div className="mt-2.5 space-y-2 flex-1">
            {absentUsers.length === 0 ? (
              <div className="py-6 text-center text-xs text-emerald-400">
                Đủ quân số hôm nay
              </div>
            ) : (
              absentUsers.map((u) => (
                <div
                  key={u.id}
                  className="px-3 py-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-7 h-7 rounded-full object-cover grayscale opacity-70 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-300 truncate">{u.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{u.employeeCode}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onOpenManualModal({
                        id: '',
                        userId: u.id,
                        userName: u.name,
                        userEmail: u.email,
                        employeeCode: u.employeeCode,
                        date: todayStr,
                        checkInTime: new Date().toISOString(),
                        checkOutTime: null,
                        totalMinutes: 0,
                        status: 'working',
                        checkInMethod: 'manual_admin',
                        checkInIp: 'Admin Manual',
                        isLate: false,
                        isEarlyLeave: false,
                        createdAt: '',
                        updatedAt: '',
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-amber-300 font-medium transition-colors shrink-0 cursor-pointer"
                  >
                    Chấm hộ
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Compact Attendance Log Table */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-100">
            Nhật Ký Hôm Nay ({todayRecords.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-[11px] whitespace-nowrap">
                <th className="py-2.5 px-3 font-semibold">Nhân viên</th>
                <th className="py-2.5 px-3 font-semibold">Vào ca</th>
                <th className="py-2.5 px-3 font-semibold">Ra ca</th>
                <th className="py-2.5 px-3 font-semibold">Thời lượng</th>
                <th className="py-2.5 px-3 font-semibold">Hình thức</th>
                <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
                <th className="py-2.5 px-3 text-right font-semibold">Sửa / Xoá</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {todayRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-500">
                    Chưa có lượt chấm công hôm nay.
                  </td>
                </tr>
              ) : (
                todayRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-zinc-800/30 transition-colors whitespace-nowrap">
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-zinc-100">{record.userName}</span>
                      <span className="text-[11px] text-zinc-500 font-mono ml-1.5">
                        ({record.employeeCode})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-zinc-300">
                      {formatTime(record.checkInTime)}
                      {record.isLate && (
                        <span className="ml-1.5 text-[10px] text-amber-400 font-sans font-medium">
                          · Muộn
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-zinc-300">
                      {record.checkOutTime ? formatTime(record.checkOutTime) : '--:--'}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">
                      {record.totalMinutes > 0 ? (
                        <span className="font-semibold text-indigo-300">
                          {(record.totalMinutes / 60).toFixed(1)}h{' '}
                          <span className="text-[11px] font-normal text-zinc-500">
                            ({record.totalMinutes}p)
                          </span>
                        </span>
                      ) : (
                        <span className="text-zinc-500">--</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">
                      {record.checkInMethod === 'manual_admin' || record.adjustedBy ? (
                        <span className="text-amber-300/90">Chấm hộ</span>
                      ) : (
                        <span>WiFi quán</span>
                      )}
                      {record.note && (
                        <span
                          className="text-zinc-500 ml-1.5 max-w-[140px] inline-block truncate align-bottom"
                          title={record.note}
                        >
                          · {record.note}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {record.status === 'working' ? (
                        <span className="text-emerald-400 font-semibold">Đang làm</span>
                      ) : (
                        <span className="text-zinc-400">Đã về</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onOpenManualModal(record)}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                          title="Chỉnh sửa ca"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Xoá bản ghi chấm công này?')) {
                              deleteAttendance(record.id);
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Xoá ca"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
