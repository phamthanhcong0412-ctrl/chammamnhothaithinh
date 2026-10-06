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
  const { users, attendance, storeConfig, networkInfo, deleteAttendance } = useApp();
  const [currentSeconds, setCurrentSeconds] = useState(Date.now());

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
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top action header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Theo Dõi Thời Gian Thực
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-zinc-100 tracking-tight mt-0.5">
            Bảng Điều Khiển Quản Lý Cửa Hàng
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Giám sát nhân sự đang làm việc, chấm công hộ và kiểm soát tính trung thực qua WiFi / GPS
          </p>
        </div>

        {/* Quick Manager Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onOpenManualModal(null)}
            className="px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <UserCheck className="w-4 h-4 text-amber-400" /> Chấm Công Hộ
          </button>

          <button
            onClick={onOpenEmailModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/20"
          >
            <Mail className="w-4 h-4" /> Báo Cáo Email (21:00)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        
        {/* KPI 1 */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Đang Có Mặt</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-400">
              {workingRecords.length}{' '}
              <span className="text-sm font-normal text-zinc-500">/ {staffUsers.length}</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Đang trực tiếp làm việc tại quán</p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Tổng Giờ Hôm Nay</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-indigo-400">
              {totalHoursToday} <span className="text-sm font-normal text-zinc-400">giờ</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              {todayRecords.length} lượt check-in hôm nay
            </p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Tỷ Lệ Đúng Giờ</span>
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-teal-400">{onTimeRate}%</div>
            <p className="text-[11px] text-zinc-400 mt-1">
              {todayRecords.filter((r) => r.isLate).length} ca đến muộn
            </p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Mạng WiFi & GPS</span>
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <Wifi className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs font-bold text-zinc-200 truncate">
              {storeConfig?.wifiSsid}
            </div>
            <p className="text-[11px] text-violet-400 mt-1 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              Bán kính: {storeConfig?.storeGps.radiusMeters}m
            </p>
          </div>
        </div>

      </div>

      {/* Real-time 3-Column Status Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Column 1: ĐANG LÀM VIỆC */}
        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Đang Làm Việc Tại Quán ({workingRecords.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              Live
            </span>
          </div>

          <div className="mt-3 space-y-3 flex-1">
            {workingRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                Chưa có nhân viên nào đang trong ca
              </div>
            ) : (
              workingRecords.map((r) => {
                const user = users.find((u) => u.id === r.userId);
                return (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl bg-zinc-950 border border-emerald-500/30 shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                          alt={r.userName}
                          className="w-8 h-8 rounded-full object-cover border border-zinc-700"
                        />
                        <div>
                          <div className="text-xs font-bold text-zinc-100">{r.userName}</div>
                          <div className="text-[10px] text-zinc-400">
                            {r.employeeCode} • {user?.position}
                          </div>
                        </div>
                      </div>
                      
                      {/* Live ticker */}
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-emerald-400">
                          {formatDuration(r.checkInTime)}
                        </div>
                        <div className="text-[10px] text-zinc-500">Thời gian làm</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-900">
                      <span>Vào lúc: <strong className="text-zinc-200">{formatTime(r.checkInTime)}</strong></span>
                      <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> QR + WiFi Quán
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: ĐÃ CHECK-OUT HÔM NAY */}
        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Đã Hoàn Thành Ca ({completedRecords.length})
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500">Hôm nay</span>
          </div>

          <div className="mt-3 space-y-3 flex-1">
            {completedRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                Chưa có ai hoàn thành ca trong ngày
              </div>
            ) : (
              completedRecords.map((r) => {
                const user = users.find((u) => u.id === r.userId);
                return (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                          alt={r.userName}
                          className="w-8 h-8 rounded-full object-cover border border-zinc-700"
                        />
                        <div>
                          <div className="text-xs font-bold text-zinc-200">{r.userName}</div>
                          <div className="text-[10px] text-zinc-400">{r.employeeCode}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-indigo-400">
                          {(r.totalMinutes / 60).toFixed(1)}h
                        </div>
                        <div className="text-[10px] text-zinc-500">{r.totalMinutes} phút</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-900">
                      <span>{formatTime(r.checkInTime)} → {r.checkOutTime ? formatTime(r.checkOutTime) : '--'}</span>
                      {r.isLate && (
                        <span className="text-[10px] text-amber-400 font-medium">Trễ ca</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: CHƯA ĐI LÀM */}
        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-zinc-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Chưa Có Mặt ({absentUsers.length})
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500">Nghỉ / Chưa vào ca</span>
          </div>

          <div className="mt-3 space-y-2.5 flex-1">
            {absentUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-emerald-400">
                Tất cả nhân viên đều đã có mặt!
              </div>
            ) : (
              absentUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-8 h-8 rounded-full object-cover grayscale opacity-70"
                    />
                    <div>
                      <div className="text-xs font-semibold text-zinc-300">{u.name}</div>
                      <div className="text-[10px] text-zinc-500">
                        {u.employeeCode} • {u.position}
                      </div>
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
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-amber-300 font-medium transition-colors"
                  >
                    Chấm công hộ
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Detailed Attendance Log Table */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">
              Nhật Ký Chấm Công Chi Tiết Hôm Nay ({todayRecords.length})
            </h3>
            <p className="text-xs text-zinc-400">
              Ghi nhận địa chỉ IP mạng, phương thức xác thực và thời gian chuẩn xác
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Nhân Viên</th>
                <th className="py-2.5 px-3">Giờ Check-in</th>
                <th className="py-2.5 px-3">Giờ Check-out</th>
                <th className="py-2.5 px-3">Thời Lượng</th>
                <th className="py-2.5 px-3">Xác Thực Mạng / IP</th>
                <th className="py-2.5 px-3">Trạng Thái</th>
                <th className="py-2.5 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {todayRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    Chưa có lượt chấm công nào trong ngày hôm nay.
                  </td>
                </tr>
              ) : (
                todayRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-zinc-200">{record.userName}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{record.employeeCode}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-zinc-300">
                      {formatTime(record.checkInTime)}
                      {record.isLate && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/20 font-sans">
                          Muộn
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-zinc-300">
                      {record.checkOutTime ? formatTime(record.checkOutTime) : (
                        <span className="text-emerald-400 font-semibold">Đang làm việc</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-indigo-300">
                      {record.totalMinutes > 0 ? `${(record.totalMinutes / 60).toFixed(1)}h (${record.totalMinutes}p)` : '--'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-zinc-300 flex items-center gap-1">
                        <Wifi className="w-3 h-3 text-indigo-400" />
                        <span className="font-mono text-[11px]">{record.checkInIp}</span>
                      </div>
                      {record.adjustedBy && (
                        <div className="text-[10px] text-amber-400 mt-0.5">
                          Điều chỉnh bởi {record.adjustedBy}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {record.status === 'working' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Đang làm
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                          Đã về
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenManualModal(record)}
                          className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                          title="Chỉnh sửa ca này"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Xoá bản ghi chấm công này?')) {
                              deleteAttendance(record.id);
                            }
                          }}
                          className="p-1 rounded-lg hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 transition-colors"
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
