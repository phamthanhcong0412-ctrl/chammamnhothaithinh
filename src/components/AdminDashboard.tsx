import React, { useState, useEffect } from 'react';
import { RefreshCw, UserCheck, Mail, Wifi } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { deduplicateAndMergeOverlappingTurns } from '../supabase.ts';
import type { AttendanceRecord } from '../types/index.ts';
import {
  KpiMetricsGrid,
  LiveOperationsBoard,
  AttendanceLogTable,
  type CompletedShiftGroup,
} from './dashboard/index.ts';

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
  const { users, attendance, deleteAttendance, checkOutUser, refreshData, runWithHudLoading } = useApp();
  const [currentSeconds, setCurrentSeconds] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [checkingOutUserId, setCheckingOutUserId] = useState<string | null>(null);

  // Table filters
  const [logScope, setLogScope] = useState<'today' | 'all'>('today');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'shift_morning' | 'shift_afternoon'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await runWithHudLoading('Đang làm mới dữ liệu...', async () => {
        await refreshData();
      });
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleQuickCheckOut = async (userId: string) => {
    setCheckingOutUserId(userId);
    try {
      await checkOutUser(userId, 'Quản lý chốt ca');
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
  const completedShiftsMap = new Map<string, CompletedShiftGroup>();

  todayRecords
    .filter((r) => r.status === 'completed' && !workingUserIds.has(r.userId))
    .forEach((r) => {
      const inferredShiftId =
        r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning');
      const key = `${r.userId}_${inferredShiftId}`;
      const recordTurns = deduplicateAndMergeOverlappingTurns(
        Array.isArray(r.turns) && r.turns.length > 0
          ? r.turns
          : [
              {
                checkInTime: r.checkInTime,
                checkOutTime: r.checkOutTime || null,
                minutes: Number(r.totalMinutes) || 0,
                note: r.note || '',
              },
            ]
      );

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
          turnsCount: recordTurns.length,
          turns: recordTurns,
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
        existing.turns = deduplicateAndMergeOverlappingTurns([...existing.turns, ...recordTurns]);
        existing.totalMinutes = existing.turns.reduce((sum, t) => sum + (Number(t.minutes) || 0), 0);
        const userRate = users.find((u) => u.id === r.userId)?.hourlyRate || r.hourlyRate || 28000;
        existing.estimatedPay = Math.round((existing.totalMinutes / 60) * userRate);
        existing.turnsCount = existing.turns.length;
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
              Theo Dõi Ca Làm Việc
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
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>

          {onOpenSettingsModal && (
            <button
              onClick={onOpenSettingsModal}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-400" /> Cài đặt quán
            </button>
          )}

          <button
            onClick={() => onOpenManualModal(null)}
            className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-400" /> Chấm hộ
          </button>

          <button
            onClick={onOpenEmailModal}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" /> Gửi báo cáo
          </button>
        </div>
      </div>

      {/* 4 Modern KPI Metric Cards */}
      <KpiMetricsGrid
        workingCount={workingRecords.length}
        totalStaffCount={staffUsers.length}
        totalHoursToday={totalHoursToday}
        totalUniqueShiftsToday={totalUniqueShiftsToday}
        completedShiftsCount={completedShiftGroups.length}
        absentCount={absentUsers.length}
        todayEstimatedPay={todayEstimatedPay}
      />

      {/* Real-time 3-Column Operations Board */}
      <LiveOperationsBoard
        workingRecords={workingRecords}
        todayRecords={todayRecords}
        completedShiftGroups={completedShiftGroups}
        absentUsers={absentUsers}
        users={users}
        checkingOutUserId={checkingOutUserId}
        onQuickCheckOut={handleQuickCheckOut}
        onOpenManualModal={onOpenManualModal}
        formatDuration={formatDuration}
        formatTime={formatTime}
      />

      {/* Attendance Log Table with Filter Bar */}
      <AttendanceLogTable
        filteredLogRecords={filteredLogRecords}
        totalAttendanceCount={attendance.length}
        logScope={logScope}
        onLogScopeChange={setLogScope}
        shiftFilter={shiftFilter}
        onShiftFilterChange={setShiftFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        formatDuration={formatDuration}
        formatTime={formatTime}
        onEditRecord={onOpenManualModal}
        onDeleteRecord={deleteAttendance}
      />
    </div>
  );
};
