/**
 * COMPONENT: ShiftRegistration
 * Nghiệp vụ Đăng ký ca làm việc & Quản lý phân ca theo tuần:
 * 1. Với Quản lý (isAdmin):
 *    - Giao diện giám sát & điều phối trực quan (không phải form tự đăng ký ca cho quản lý).
 *    - Chuyển đổi giữa các chế độ xem: Ma trận ca theo tuần, Bảng tổng hợp theo nhân viên, Lịch chi tiết theo ngày.
 *    - Cảnh báo ca thiếu người (< 2 nhân sự) và danh sách nhân sự chưa đăng ký ca nào trong tuần.
 *    - Quản lý có thể phân ca hộ hoặc điều chuyển/gỡ ca cho nhân viên.
 *    - Khóa / Mở lại bảng đăng ký ca tuần bất kỳ.
 * 2. Với Nhân viên (!isAdmin):
 *    - Đăng ký ca cho mình & theo dõi danh sách đồng nghiệp cùng ca.
 *    - Tuần bị khóa thì chỉ xem và không thể sửa.
 * 3. Bảng tuần cuốn chiếu 11 tuần (tuần hiện tại ± 5 tuần).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDays,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Users,
  Sun,
  Sunset,
  Clock,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  LayoutGrid,
  UserSquare2,
  CalendarCheck,
  Plus,
  X,
  ShieldCheck,
  UserX,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../services/api.ts';
import type { WeekSchedule, ShiftRegistrationItem, User } from '../types/index.ts';
import { getRollingWeeks, type WeekMeta } from '../utils/week.ts';

type ManagerViewMode = 'grid' | 'staff' | 'day';

export const ShiftRegistration: React.FC = () => {
  const { currentUser, storeConfig, users, runWithHudLoading } = useApp();
  const isAdmin = currentUser?.role === 'admin';

  const rollingWeeks = useMemo(() => getRollingWeeks(new Date()), []);
  const currentWeekMeta = useMemo(
    () => rollingWeeks.find((w) => w.isCurrent) || rollingWeeks[5] || rollingWeeks[0],
    [rollingWeeks]
  );

  const [selectedWeekId, setSelectedWeekId] = useState<string>(currentWeekMeta.weekId);
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Manager view mode toggle: 'grid' (ma trận ca) | 'staff' (danh sách nhân viên) | 'day' (theo ngày)
  const [managerViewMode, setManagerViewMode] = useState<ManagerViewMode>('grid');

  // Mobile selected day index (0: Thứ 2 ... 6: Chủ nhật)
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(() => {
    const today = new Date().getDay();
    return today === 0 ? 6 : today - 1;
  });

  // Modal state for manager assigning staff to a shift
  const [assignModal, setAssignModal] = useState<{
    isOpen: boolean;
    date: string;
    dayLabel: string;
    shiftId: string;
    shiftName: string;
  } | null>(null);

  const selectedMeta = useMemo(
    () => rollingWeeks.find((w) => w.weekId === selectedWeekId) || currentWeekMeta,
    [rollingWeeks, selectedWeekId, currentWeekMeta]
  );

  const shifts = useMemo(() => {
    if (storeConfig?.shifts && storeConfig.shifts.length > 0) {
      return storeConfig.shifts.map((s) => ({
        id: s.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
      }));
    }
    return [
      { id: 'shift_morning', name: 'Ca Sáng (06:00 - 12:00)', startTime: '06:00', endTime: '12:00' },
      { id: 'shift_afternoon', name: 'Ca Chiều (15:30 - 20:00)', startTime: '15:30', endTime: '20:00' },
    ];
  }, [storeConfig?.shifts]);

  // Load schedule for selected week
  const loadWeekSchedule = useCallback(async (weekId: string) => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await api.getWeekSchedule(weekId);
      if (res.schedule) {
        setSchedule(res.schedule);
      } else {
        const meta = rollingWeeks.find((w) => w.weekId === weekId);
        setSchedule({
          weekId,
          weekNumber: meta?.weekNumber || 1,
          year: meta?.year || new Date().getFullYear(),
          startDate: meta?.startDate || '',
          endDate: meta?.endDate || '',
          isLocked: false,
          registrations: [],
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Không thể tải lịch ca của tuần này.' });
    } finally {
      setIsLoading(false);
    }
  }, [rollingWeeks]);

  useEffect(() => {
    loadWeekSchedule(selectedWeekId);
  }, [selectedWeekId, loadWeekSchedule]);

  // Handle register / unregister shift
  const handleToggleRegistration = async (
    dateStr: string,
    shiftId: string,
    shiftName: string,
    targetUserId?: string
  ) => {
    const uid = targetUserId || currentUser?.id;
    if (!uid) return;

    const isLocked = schedule?.isLocked;
    if (isLocked && !isAdmin) {
      setStatusMessage({
        type: 'error',
        text: 'Bảng đăng ký ca tuần này đã được Quản lý khóa. Bạn không thể chỉnh sửa.',
      });
      return;
    }

    const isAlreadyRegistered = schedule?.registrations.some(
      (r) => r.userId === uid && r.date === dateStr && r.shiftId === shiftId
    );

    const action = isAlreadyRegistered ? 'unregister' : 'register';

    try {
      await runWithHudLoading(
        action === 'register' ? 'Đang phân ca / đăng ký...' : 'Đang hủy ca...',
        async () => {
          const res = await api.registerShift({
            weekId: selectedWeekId,
            userId: uid,
            date: dateStr,
            shiftId,
            shiftName,
            action,
            isManagerOverride: isAdmin,
          });
          setSchedule(res.schedule);
          setStatusMessage({
            type: 'success',
            text: res.message,
          });
        }
      );
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Thao tác không thành công.',
      });
    }
  };

  // Toggle week lock state by Manager
  const handleToggleLock = async () => {
    if (!isAdmin) return;
    const nextLocked = !schedule?.isLocked;

    try {
      await runWithHudLoading(
        nextLocked ? 'Đang khóa bảng đăng ký tuần...' : 'Đang mở lại bảng đăng ký tuần...',
        async () => {
          const res = await api.toggleScheduleLock({
            weekId: selectedWeekId,
            isLocked: nextLocked,
            managerName: currentUser?.name || 'Quản lý',
          });
          setSchedule(res.schedule);
          setStatusMessage({
            type: 'success',
            text: res.message,
          });
        }
      );
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Không thể đổi trạng thái khóa ca.',
      });
    }
  };

  // Week navigation
  const currentIndex = rollingWeeks.findIndex((w) => w.weekId === selectedWeekId);
  const handlePrevWeek = () => {
    if (currentIndex > 0) setSelectedWeekId(rollingWeeks[currentIndex - 1].weekId);
  };
  const handleNextWeek = () => {
    if (currentIndex < rollingWeeks.length - 1) setSelectedWeekId(rollingWeeks[currentIndex + 1].weekId);
  };
  const handleCurrentWeek = () => {
    setSelectedWeekId(currentWeekMeta.weekId);
  };

  // Aggregate stats for this week
  const weekStats = useMemo(() => {
    const regs = schedule?.registrations || [];
    const totalRegs = regs.length;

    // Filter staff members (excluding admin accounts from required staff roster if desired, or all users)
    const staffMembers = users.filter((u) => u.role !== 'admin');
    const targetUsers = staffMembers.length > 0 ? staffMembers : users;

    // Per user registration count
    const userCountMap = new Map<string, number>();
    const userDatesMap = new Map<string, Set<string>>();

    regs.forEach((r) => {
      userCountMap.set(r.userId, (userCountMap.get(r.userId) || 0) + 1);
      if (!userDatesMap.has(r.userId)) {
        userDatesMap.set(r.userId, new Set());
      }
      userDatesMap.get(r.userId)?.add(`${r.date}_${r.shiftId}`);
    });

    // Unregistered staff list
    const unregisteredUsers = targetUsers.filter((u) => !userCountMap.get(u.id));
    const registeredUserCount = targetUsers.length - unregisteredUsers.length;

    const myRegsCount = currentUser ? (userCountMap.get(currentUser.id) || 0) : 0;

    // Check for low-staffed shifts (< 2 staff)
    let lowStaffShiftsCount = 0;
    const lowStaffList: Array<{ date: string; dayName: string; shiftName: string; count: number }> = [];

    if (selectedMeta) {
      for (const day of selectedMeta.days) {
        for (const s of shifts) {
          const count = regs.filter((r) => r.date === day.date && r.shiftId === s.id).length;
          if (count < 2) {
            lowStaffShiftsCount++;
            lowStaffList.push({
              date: day.date,
              dayName: day.dayName,
              shiftName: s.name.split('(')[0].trim(),
              count,
            });
          }
        }
      }
    }

    return {
      totalRegs,
      myRegsCount,
      userCountMap,
      userDatesMap,
      targetUsers,
      registeredUserCount,
      unregisteredUsers,
      lowStaffShiftsCount,
      lowStaffList,
    };
  }, [schedule?.registrations, users, currentUser, selectedMeta, shifts]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Header and Week Selection Bar */}
      <div className="p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight">
                {isAdmin ? 'Quản Lý & Giám Sát Phân Ca' : 'Đăng Ký Ca Làm Việc'}
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {isAdmin
                ? 'Theo dõi nhân viên đăng ký ca tuần, phát hiện ca thiếu nhân sự và điều phối phân ca trực quan.'
                : 'Đăng ký ca làm việc cá nhân trong tuần và theo dõi đồng nghiệp cùng làm ca.'}
            </p>
          </div>

          {/* Week Lock Status & Toggle for Manager */}
          <div className="flex items-center gap-2.5">
            {schedule?.isLocked ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                ĐÃ KHÓA ĐĂNG KÝ
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                ĐANG MỞ ĐĂNG KÝ
              </span>
            )}

            {isAdmin && (
              <button
                onClick={handleToggleLock}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer shadow-sm ${
                  schedule?.isLocked
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {schedule?.isLocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Mở Lại Đăng Ký</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Khóa Đăng Ký Tuần</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Rolling 11-Week Selector Controls */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800/80 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevWeek}
              disabled={currentIndex <= 0}
              className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer active:scale-95"
              title="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleCurrentWeek}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                selectedWeekId === currentWeekMeta.weekId
                  ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/40 font-bold'
                  : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tuần Này
            </button>

            <button
              onClick={handleNextWeek}
              disabled={currentIndex >= rollingWeeks.length - 1}
              className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer active:scale-95"
              title="Tuần sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Dropdown with all 11 rolling weeks (font-size >= 16px on mobile to prevent iOS Safari auto-zoom) */}
          <div className="flex items-center gap-2">
            <select
              value={selectedWeekId}
              onChange={(e) => setSelectedWeekId(e.target.value)}
              className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs text-zinc-200 font-medium focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
            >
              {rollingWeeks.map((w) => (
                <option key={w.weekId} value={w.weekId}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Summary Pill */}
          <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono tabular-nums">
            <span>
              Tổng lượt ca: <strong className="text-zinc-100">{weekStats.totalRegs}</strong>
            </span>
            {!isAdmin && (
              <>
                <span>·</span>
                <span className="text-emerald-400 font-semibold">
                  Ca của bạn: <strong>{weekStats.myRegsCount}</strong>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="flex-1 font-medium">{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-zinc-400 hover:text-zinc-200 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Lock Notice Info Banner */}
      {schedule?.isLocked && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Bảng đăng ký tuần này đã được Quản lý khóa
              {schedule.lockedBy ? ` bởi ${schedule.lockedBy}` : ''}.
              {!isAdmin && ' Bạn chỉ có thể theo dõi và không thể tự đổi ca.'}
            </span>
          </div>
          {isAdmin && (
            <span className="text-[11px] text-amber-300 font-mono shrink-0">
              (Quản lý có quyền xếp ca bổ sung hoặc mở lại bất kỳ lúc nào)
            </span>
          )}
        </div>
      )}

      {/* =========================================================================
          MANAGER OVERSIGHT DASHBOARD (Only visible to Admin / Manager)
          ========================================================================= */}
      {isAdmin ? (
        <div className="space-y-4">
          
          {/* Manager 3-in-1 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Card 1: Total Registrations */}
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium">Tổng Lượt Ca Tuần</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-extrabold text-zinc-100 font-mono">{weekStats.totalRegs}</span>
                  <span className="text-[11px] text-zinc-500">lượt đăng ký</span>
                </div>
              </div>
            </div>

            {/* Card 2: Staff Participation Ratio */}
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-zinc-400 font-medium">Nhân Sự Tham Gia</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-xl font-extrabold text-zinc-100 font-mono">
                    {weekStats.registeredUserCount}/{weekStats.targetUsers.length}
                  </span>
                  <span className="text-[11px] text-zinc-500 truncate">
                    {weekStats.unregisteredUsers.length === 0
                      ? '(Đầy đủ 100%)'
                      : `(Còn ${weekStats.unregisteredUsers.length} bạn chưa ĐK)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Staffing Alert (< 2 staff per shift) */}
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-3.5 shadow-sm">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  weekStats.lowStaffShiftsCount > 0
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                }`}
              >
                {weekStats.lowStaffShiftsCount > 0 ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium">Tình Trạng Định Biên</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-extrabold text-zinc-100 font-mono">
                    {weekStats.lowStaffShiftsCount}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {weekStats.lowStaffShiftsCount > 0 ? 'ca cần thêm người (<2 NV)' : 'tất cả ca đều đủ người'}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Warning Banner: Unregistered staff list if any */}
          {weekStats.unregisteredUsers.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Chưa đăng ký ca tuần này ({weekStats.unregisteredUsers.length} nhân sự):</strong>{' '}
                  {weekStats.unregisteredUsers.map((u) => u.name).join(', ')}
                </span>
              </div>
              <span className="text-[11px] text-amber-300/80 font-mono">
                Nhắc nhở nhân sự đăng ký trước khi khóa ca
              </span>
            </div>
          )}

          {/* Manager View Switcher Toolbar */}
          <div className="flex items-center justify-between gap-3 p-2 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setManagerViewMode('grid')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                  managerViewMode === 'grid'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Ma Trận Ca (Tuần)</span>
              </button>

              <button
                onClick={() => setManagerViewMode('staff')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                  managerViewMode === 'staff'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <UserSquare2 className="w-3.5 h-3.5" />
                <span>Theo Từng Nhân Viên</span>
              </button>

              <button
                onClick={() => setManagerViewMode('day')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                  managerViewMode === 'day'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Lịch Theo Ngày</span>
              </button>
            </div>

            <div className="text-[11px] text-zinc-400 font-mono hidden sm:block">
              Quản lý: Nhấp vào ô ca để xếp thêm hoặc gỡ nhân viên
            </div>
          </div>

          {/* VIEW MODE 1: MATRIX GRID (7 DAYS x SHIFTS) */}
          {managerViewMode === 'grid' && (
            <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/70">
                      <th className="py-3.5 px-4 text-xs font-bold text-zinc-400 w-40 uppercase tracking-wider">
                        Ca Làm Việc
                      </th>
                      {selectedMeta.days.map((day) => (
                        <th
                          key={day.date}
                          className={`py-3.5 px-3 text-center border-l border-zinc-800/70 transition-colors ${
                            day.isToday ? 'bg-emerald-500/10' : ''
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`text-xs font-bold ${day.isToday ? 'text-emerald-400' : 'text-zinc-200'}`}>
                              {day.dayName}
                            </span>
                            {day.isToday && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-400 mt-0.5 tabular-nums">
                            {day.formattedDate}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-800/80">
                    {shifts.map((shift) => (
                      <tr key={shift.id} className="hover:bg-zinc-800/10 transition-colors">
                        
                        {/* Shift Label Header Column */}
                        <td className="py-4 px-4 align-top bg-zinc-950/40">
                          <div className="flex items-center gap-2">
                            {shift.id === 'shift_morning' ? (
                              <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : (
                              <Sunset className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <div>
                              <div className="text-xs font-bold text-zinc-100">{shift.name.split('(')[0]}</div>
                              <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                <span>{shift.startTime} - {shift.endTime}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 7 Days Grid Cells */}
                        {selectedMeta.days.map((day) => {
                          const cellRegistrations = (schedule?.registrations || []).filter(
                            (r) => r.date === day.date && r.shiftId === shift.id
                          );
                          const isLowStaff = cellRegistrations.length < 2;

                          return (
                            <td
                              key={`${shift.id}_${day.date}`}
                              className={`p-2.5 align-top border-l border-zinc-800/70 transition-colors ${
                                day.isToday ? 'bg-emerald-500/[0.03]' : ''
                              }`}
                            >
                              <div className="space-y-2 min-h-[110px] flex flex-col justify-between">
                                
                                {/* Header Badge in Cell: Staff Count & Status */}
                                <div className="flex items-center justify-between gap-1 pb-1 border-b border-zinc-800/60">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      cellRegistrations.length === 0
                                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                        : isLowStaff
                                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    }`}
                                  >
                                    {cellRegistrations.length} NV {cellRegistrations.length === 0 ? '(Trống)' : isLowStaff ? '(Cần thêm)' : '(Đủ)'}
                                  </span>

                                  {/* Quick Add Staff Button for Manager */}
                                  <button
                                    onClick={() =>
                                      setAssignModal({
                                        isOpen: true,
                                        date: day.date,
                                        dayLabel: `${day.dayName} (${day.formattedDate})`,
                                        shiftId: shift.id,
                                        shiftName: shift.name,
                                      })
                                    }
                                    title="Phân ca cho nhân viên vào ca này"
                                    className="p-1 rounded bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>

                                {/* Registered Staff List in Cell */}
                                <div className="space-y-1.5 flex-1">
                                  {cellRegistrations.length === 0 ? (
                                    <div className="text-[11px] text-zinc-500 italic py-2 text-center">
                                      Chưa có ai
                                    </div>
                                  ) : (
                                    cellRegistrations.map((reg) => (
                                      <div
                                        key={reg.id}
                                        className="p-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 flex items-center justify-between gap-1 text-[11px] group transition-all"
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <img
                                            src={
                                              reg.userAvatar ||
                                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'
                                            }
                                            alt={reg.userName}
                                            className="w-4 h-4 rounded-full object-cover shrink-0"
                                          />
                                          <span className="truncate max-w-[85px] font-medium">
                                            {reg.userName}
                                          </span>
                                        </div>

                                        {/* Remove staff from shift button for Manager */}
                                        <button
                                          onClick={() =>
                                            handleToggleRegistration(day.date, shift.id, shift.name, reg.userId)
                                          }
                                          className="p-0.5 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer shrink-0"
                                          title={`Gỡ ${reg.userName} khỏi ca này`}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>

                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: STAFF ROSTER (PERSONNEL PERSPECTIVE) */}
          {managerViewMode === 'staff' && (
            <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[760px]">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/70">
                      <th className="py-3 px-4 text-xs font-bold text-zinc-400 uppercase tracking-wider w-56">
                        Nhân Viên
                      </th>
                      {selectedMeta.days.map((day) => (
                        <th
                          key={day.date}
                          className={`py-3 px-2 text-center border-l border-zinc-800/70 text-xs font-bold ${
                            day.isToday ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-300'
                          }`}
                        >
                          <div>{day.shortDayName}</div>
                          <div className="text-[10px] font-mono text-zinc-400 font-normal">{day.formattedDate.split('/')[0]}</div>
                        </th>
                      ))}
                      <th className="py-3 px-4 text-center border-l border-zinc-800 text-xs font-bold text-zinc-400 uppercase w-28">
                        Tổng Ca
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-800/80">
                    {weekStats.targetUsers.map((user) => {
                      const count = weekStats.userCountMap.get(user.id) || 0;
                      return (
                        <tr key={user.id} className="hover:bg-zinc-800/20 transition-colors">
                          
                          {/* User Info Column */}
                          <td className="py-3.5 px-4 bg-zinc-950/40">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'}
                                alt={user.name}
                                className="w-8 h-8 rounded-full object-cover shrink-0 border border-zinc-700"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-zinc-100 truncate">{user.name}</div>
                                <div className="text-[10px] text-zinc-400 truncate">{user.position} · {user.employeeCode}</div>
                              </div>
                            </div>
                          </td>

                          {/* 7 Days Status Cells for this user */}
                          {selectedMeta.days.map((day) => {
                            const userRegs = (schedule?.registrations || []).filter(
                              (r) => r.userId === user.id && r.date === day.date
                            );

                            return (
                              <td
                                key={`${user.id}_${day.date}`}
                                className={`p-2 text-center border-l border-zinc-800/70 align-middle ${
                                  day.isToday ? 'bg-emerald-500/[0.02]' : ''
                                }`}
                              >
                                {userRegs.length === 0 ? (
                                  <span className="text-zinc-600 text-xs font-mono">-</span>
                                ) : (
                                  <div className="flex flex-col gap-1 items-center">
                                    {userRegs.map((reg) => (
                                      <span
                                        key={reg.id}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                                          reg.shiftId === 'shift_morning'
                                            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                                            : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                                        }`}
                                      >
                                        {reg.shiftId === 'shift_morning' ? 'Sáng' : 'Chiều'}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {/* Total Shifts Column */}
                          <td className="py-3.5 px-4 text-center border-l border-zinc-800 bg-zinc-950/40">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-xl font-mono text-xs font-bold ${
                                count === 0
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  : count >= 5
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                              }`}
                            >
                              {count} ca
                            </span>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW MODE 3: DAILY DETAIL FOCUS */}
          {managerViewMode === 'day' && (
            <div className="space-y-4">
              {/* Day selection tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {selectedMeta.days.map((day, idx) => {
                  const dayRegs = (schedule?.registrations || []).filter((r) => r.date === day.date);
                  const isSelected = selectedDayIdx === idx;
                  return (
                    <button
                      key={day.date}
                      onClick={() => setSelectedDayIdx(idx)}
                      className={`flex-1 min-w-[70px] py-2.5 px-2 rounded-2xl text-center transition-all cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-bold shadow-md'
                          : day.isToday
                          ? 'bg-zinc-900 border border-emerald-500/40 text-emerald-300'
                          : 'bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-semibold">{day.shortDayName}</div>
                      <div className="text-sm font-mono font-bold mt-0.5">{day.formattedDate}</div>
                      <div className="text-[10px] mt-1 opacity-80">{dayRegs.length} lượt NV</div>
                    </button>
                  );
                })}
              </div>

              {/* Detail cards for shifts in selected day */}
              {(() => {
                const activeDay = selectedMeta.days[selectedDayIdx] || selectedMeta.days[0];
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {shifts.map((shift) => {
                      const cellRegs = (schedule?.registrations || []).filter(
                        (r) => r.date === activeDay.date && r.shiftId === shift.id
                      );
                      const isLowStaff = cellRegs.length < 2;

                      return (
                        <div
                          key={shift.id}
                          className="p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-4"
                        >
                          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                            <div className="flex items-center gap-2.5">
                              {shift.id === 'shift_morning' ? (
                                <Sun className="w-5 h-5 text-amber-400" />
                              ) : (
                                <Sunset className="w-5 h-5 text-rose-400" />
                              )}
                              <div>
                                <h3 className="text-sm font-bold text-zinc-100">{shift.name}</h3>
                                <p className="text-[11px] font-mono text-zinc-400">
                                  {shift.startTime} - {shift.endTime}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold ${
                                cellRegs.length === 0
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  : isLowStaff
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {cellRegs.length} nhân sự {isLowStaff && '(Thiếu người)'}
                            </span>
                          </div>

                          {/* List of staff in this shift */}
                          <div className="space-y-2">
                            {cellRegs.length === 0 ? (
                              <div className="text-xs text-zinc-500 italic py-4 text-center">
                                Chưa có nhân viên nào đăng ký ca này.
                              </div>
                            ) : (
                              cellRegs.map((reg) => (
                                <div
                                  key={reg.id}
                                  className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-2"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <img
                                      src={reg.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'}
                                      alt={reg.userName}
                                      className="w-6 h-6 rounded-full object-cover"
                                    />
                                    <div>
                                      <p className="text-xs font-bold text-zinc-200 truncate">{reg.userName}</p>
                                      <p className="text-[10px] text-zinc-500 font-mono">{reg.employeeCode}</p>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() =>
                                      handleToggleRegistration(activeDay.date, shift.id, shift.name, reg.userId)
                                    }
                                    className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                    title="Gỡ nhân viên khỏi ca"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Action Button for Manager: Add staff */}
                          <button
                            onClick={() =>
                              setAssignModal({
                                isOpen: true,
                                date: activeDay.date,
                                dayLabel: `${activeDay.dayName} (${activeDay.formattedDate})`,
                                shiftId: shift.id,
                                shiftName: shift.name,
                              })
                            }
                            className="w-full h-10 rounded-xl bg-zinc-800 hover:bg-emerald-600 text-zinc-200 hover:text-white border border-zinc-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Xếp Thêm Nhân Viên Vào Ca Này</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      ) : (
        /* =========================================================================
           STAFF EMPLOYEE VIEW (!isAdmin): Personal Shift Registration & Colleague View
           ========================================================================= */
        <div className="space-y-4">
          
          {/* Staff Personal Registration Stat */}
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-100">Lịch Đăng Ký Của Bạn</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Bạn đã đăng ký <strong className="text-emerald-400 font-mono text-sm">{weekStats.myRegsCount}</strong> ca trong {selectedMeta.shortLabel}
                </p>
              </div>
            </div>

            {schedule?.isLocked ? (
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                Đã Khóa
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Unlock className="w-3.5 h-3.5" />
                Đang Mở
              </span>
            )}
          </div>

          {/* Desktop Table View (>= 640px) */}
          <div className="hidden sm:block rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/70">
                    <th className="py-3.5 px-4 text-xs font-bold text-zinc-400 w-36 uppercase tracking-wider">
                      Ca Làm Việc
                    </th>
                    {selectedMeta.days.map((day) => (
                      <th
                        key={day.date}
                        className={`py-3.5 px-3 text-center border-l border-zinc-800/70 transition-colors ${
                          day.isToday ? 'bg-emerald-500/10' : ''
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`text-xs font-bold ${day.isToday ? 'text-emerald-400' : 'text-zinc-200'}`}>
                            {day.dayName}
                          </span>
                          {day.isToday && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400 mt-0.5 tabular-nums">
                          {day.formattedDate}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-800/80">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-zinc-800/20 transition-colors">
                      
                      {/* Shift Label Header Column */}
                      <td className="py-4 px-4 align-top bg-zinc-950/40">
                        <div className="flex items-center gap-2">
                          {shift.id === 'shift_morning' ? (
                            <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : (
                            <Sunset className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <div>
                            <div className="text-xs font-bold text-zinc-100">{shift.name.split('(')[0]}</div>
                            <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{shift.startTime} - {shift.endTime}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 7 Days Grid Cells */}
                      {selectedMeta.days.map((day) => {
                        const cellRegistrations = (schedule?.registrations || []).filter(
                          (r) => r.date === day.date && r.shiftId === shift.id
                        );
                        const isMyRegistered = Boolean(
                          currentUser && cellRegistrations.some((r) => r.userId === currentUser.id)
                        );
                        const isLocked = Boolean(schedule?.isLocked);

                        return (
                          <td
                            key={`${shift.id}_${day.date}`}
                            className={`p-2.5 align-top border-l border-zinc-800/70 transition-colors ${
                              day.isToday ? 'bg-emerald-500/[0.03]' : ''
                            }`}
                          >
                            <div className="space-y-2 min-h-[90px] flex flex-col justify-between">
                              
                              {/* Registered Staff List in this Cell */}
                              <div className="space-y-1.5">
                                {cellRegistrations.length === 0 ? (
                                  <div className="text-[11px] text-zinc-500 italic py-1 text-center">
                                    Chưa có ai
                                  </div>
                                ) : (
                                  cellRegistrations.map((reg) => {
                                    const isSelf = currentUser?.id === reg.userId;
                                    return (
                                      <div
                                        key={reg.id}
                                        className={`p-1.5 rounded-lg flex items-center justify-between gap-1 text-[11px] transition-all ${
                                          isSelf
                                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold'
                                            : 'bg-zinc-800/80 border border-zinc-700/60 text-zinc-200'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <img
                                            src={
                                              reg.userAvatar ||
                                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'
                                            }
                                            alt={reg.userName}
                                            className="w-4 h-4 rounded-full object-cover shrink-0"
                                          />
                                          <span className="truncate max-w-[90px]">
                                            {reg.userName} {isSelf && '(Bạn)'}
                                          </span>
                                        </div>

                                        {isSelf && !isLocked && (
                                          <button
                                            onClick={() =>
                                              handleToggleRegistration(day.date, shift.id, shift.name, reg.userId)
                                            }
                                            className="p-0.5 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer shrink-0"
                                            title="Hủy ca này"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              {/* Quick 1-Touch Action Button for Current Employee */}
                              <div>
                                {isMyRegistered ? (
                                  <button
                                    onClick={() =>
                                      handleToggleRegistration(day.date, shift.id, shift.name)
                                    }
                                    disabled={isLocked}
                                    className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                                      isLocked
                                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 cursor-not-allowed'
                                        : 'bg-emerald-600 hover:bg-rose-600 text-white cursor-pointer group shadow-sm'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3 h-3 group-hover:hidden" />
                                    <span className="group-hover:hidden">Đã Đăng Ký</span>
                                    <span className="hidden group-hover:inline">Hủy Ca Này</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleToggleRegistration(day.date, shift.id, shift.name)
                                    }
                                    disabled={isLocked}
                                    className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                                      isLocked
                                        ? 'bg-zinc-800/40 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                                        : 'bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white border border-zinc-700/80 cursor-pointer'
                                    }`}
                                  >
                                    {isLocked ? (
                                      <>
                                        <Lock className="w-3 h-3 text-zinc-600" />
                                        <span>Đã khóa</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3 h-3" />
                                        <span>Đăng ký</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>

                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Single-Day View (< 640px) */}
          <div className="sm:hidden space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {selectedMeta.days.map((day, idx) => {
                const dayRegCount = (schedule?.registrations || []).filter((r) => r.date === day.date).length;
                const isSelected = selectedDayIdx === idx;
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDayIdx(idx)}
                    className={`flex-1 min-w-[50px] py-2 px-1.5 rounded-xl text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-bold shadow-md'
                        : day.isToday
                        ? 'bg-zinc-900 border border-emerald-500/40 text-emerald-300'
                        : 'bg-zinc-900/80 border border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-semibold">{day.shortDayName}</div>
                    <div className="text-xs font-mono font-bold mt-0.5">{day.formattedDate.split('/')[0]}</div>
                    <div className="text-[9px] mt-0.5 opacity-80">{dayRegCount} ca</div>
                  </button>
                );
              })}
            </div>

            {/* Shift cards for active mobile day */}
            {(() => {
              const activeDay = selectedMeta.days[selectedDayIdx] || selectedMeta.days[0];
              return (
                <div className="space-y-3">
                  {shifts.map((shift) => {
                    const cellRegistrations = (schedule?.registrations || []).filter(
                      (r) => r.date === activeDay.date && r.shiftId === shift.id
                    );
                    const isMyRegistered = Boolean(
                      currentUser && cellRegistrations.some((r) => r.userId === currentUser.id)
                    );
                    const isLocked = Boolean(schedule?.isLocked);

                    return (
                      <div
                        key={shift.id}
                        className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3 shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {shift.id === 'shift_morning' ? (
                              <Sun className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Sunset className="w-4 h-4 text-rose-400" />
                            )}
                            <div>
                              <div className="text-xs font-bold text-zinc-100">{shift.name}</div>
                              <div className="text-[11px] font-mono text-zinc-400">
                                {shift.startTime} - {shift.endTime}
                              </div>
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-zinc-800 text-zinc-300">
                            {cellRegistrations.length} người
                          </span>
                        </div>

                        {/* List of registered staff */}
                        <div className="space-y-1.5">
                          {cellRegistrations.length === 0 ? (
                            <div className="text-xs text-zinc-500 italic py-1">Chưa có nhân viên đăng ký</div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {cellRegistrations.map((reg) => {
                                const isSelf = currentUser?.id === reg.userId;
                                return (
                                  <div
                                    key={reg.id}
                                    className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 ${
                                      isSelf
                                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold'
                                        : 'bg-zinc-800 border border-zinc-700 text-zinc-200'
                                    }`}
                                  >
                                    <img
                                      src={
                                        reg.userAvatar ||
                                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'
                                      }
                                      alt={reg.userName}
                                      className="w-4 h-4 rounded-full object-cover"
                                    />
                                    <span>{reg.userName} {isSelf && '(Bạn)'}</span>
                                    {isSelf && !isLocked && (
                                      <button
                                        onClick={() =>
                                          handleToggleRegistration(activeDay.date, shift.id, shift.name, reg.userId)
                                        }
                                        className="ml-1 text-zinc-400 hover:text-rose-400 cursor-pointer"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Action Button */}
                        <div>
                          {isMyRegistered ? (
                            <button
                              onClick={() =>
                                handleToggleRegistration(activeDay.date, shift.id, shift.name)
                              }
                              disabled={isLocked}
                              className={`w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                                isLocked
                                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 cursor-not-allowed'
                                  : 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-md'
                              }`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{isLocked ? 'Đã đăng ký (Khóa)' : 'Hủy Đăng Ký Ca Này'}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handleToggleRegistration(activeDay.date, shift.id, shift.name)
                              }
                              disabled={isLocked}
                              className={`w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                                isLocked
                                  ? 'bg-zinc-800/40 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md'
                              }`}
                            >
                              {isLocked ? (
                                <>
                                  <Lock className="w-3.5 h-3.5 text-zinc-600" />
                                  <span>Tuần này đã khóa</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Đăng Ký Ca Này</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

        </div>
      )}

      {/* =========================================================================
          MODAL: Manager Assign Staff to Shift
          ========================================================================= */}
      {assignModal && assignModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-5">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  Xếp Nhân Viên Vào Ca
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {assignModal.shiftName.split('(')[0].trim()} · {assignModal.dayLabel}
                </p>
              </div>
              <button
                onClick={() => setAssignModal(null)}
                className="p-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of staff members to select */}
            <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {weekStats.targetUsers.map((user) => {
                const isAlreadyInShift = (schedule?.registrations || []).some(
                  (r) =>
                    r.userId === user.id &&
                    r.date === assignModal.date &&
                    r.shiftId === assignModal.shiftId
                );
                const currentWeekCount = weekStats.userCountMap.get(user.id) || 0;

                return (
                  <div
                    key={user.id}
                    className="p-2.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'}
                        alt={user.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0 border border-zinc-700"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-100 truncate">{user.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate">
                          {user.position} · Đã có {currentWeekCount} ca tuần này
                        </p>
                      </div>
                    </div>

                    {isAlreadyInShift ? (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                        Đã trong ca
                      </span>
                    ) : (
                      <button
                        onClick={async () => {
                          await handleToggleRegistration(
                            assignModal.date,
                            assignModal.shiftId,
                            assignModal.shiftName,
                            user.id
                          );
                          setAssignModal(null);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer active:scale-95 shrink-0 shadow-sm"
                      >
                        + Phân Ca
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Close Button */}
            <button
              onClick={() => setAssignModal(null)}
              className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-semibold text-xs hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Đóng
            </button>

          </div>
        </div>
      )}

    </div>
  );
};
