/**
 * COMPONENT: ShiftRegistration
 * Nghiệp vụ Đăng ký ca làm việc theo tuần:
 * - Nhân viên đăng ký ca cho mình & theo dõi bảng đăng ký ca chung
 * - Quản lý khóa / mở lại đăng ký ca từng tuần
 * - Bảng theo tuần (T2 - CN), lưu trữ tối đa trong phạm vi 11 tuần (tuần hiện tại ± 5 tuần)
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
  Sparkles,
  UserCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../services/api.ts';
import type { WeekSchedule, ShiftRegistrationItem } from '../types/index.ts';
import { getRollingWeeks, type WeekMeta } from '../utils/week.ts';

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
  const [mobileDayIdx, setMobileDayIdx] = useState<number>(() => {
    const today = new Date().getDay();
    // Monday is 0 in our days array (Sunday is 6)
    return today === 0 ? 6 : today - 1;
  });

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
        // Fallback default empty week schedule
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

  // Toggle shift registration for current user (or manager registering someone)
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
        action === 'register' ? 'Đang đăng ký ca...' : 'Đang hủy đăng ký ca...',
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

    // Per user count
    const userCountMap = new Map<string, number>();
    regs.forEach((r) => {
      userCountMap.set(r.userId, (userCountMap.get(r.userId) || 0) + 1);
    });

    const myRegsCount = currentUser ? (userCountMap.get(currentUser.id) || 0) : 0;

    // Check for low-staffed shifts (< 2 staff)
    let lowStaffShifts = 0;
    if (selectedMeta) {
      for (const day of selectedMeta.days) {
        for (const s of shifts) {
          const count = regs.filter((r) => r.date === day.date && r.shiftId === s.id).length;
          if (count < 2) lowStaffShifts++;
        }
      }
    }

    return {
      totalRegs,
      myRegsCount,
      userCountMap,
      lowStaffShifts,
    };
  }, [schedule?.registrations, currentUser, selectedMeta, shifts]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Header and Week Selection Bar */}
      <div className="p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CalendarDays className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight">
                Đăng Ký Ca Làm Việc
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {isAdmin
                ? 'Quản lý lịch ca tuần, phân bổ nhân sự và khóa/mở ca đăng ký.'
                : 'Đăng ký ca làm việc cá nhân và theo dõi bảng phân bổ ca chung.'}
            </p>
          </div>

          {/* Week Lock Status & Toggle for Manager */}
          <div className="flex items-center gap-3">
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
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-800/80 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevWeek}
              disabled={currentIndex <= 0}
              className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleCurrentWeek}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
              className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
            <span>·</span>
            <span className="text-emerald-400 font-semibold">
              Ca của bạn: <strong>{weekStats.myRegsCount}</strong>
            </span>
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
              {!isAdmin && ' Bạn chỉ có thể xem lịch ca và không thể tự đổi ca.'}
            </span>
          </div>
          {isAdmin && (
            <span className="text-[11px] text-amber-300 font-mono">
              (Quản lý có thể mở lại hoặc đổi ca hộ)
            </span>
          )}
        </div>
      )}

      {/* Mobile Day Selector Tabs (< 640px) */}
      <div className="sm:hidden flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {selectedMeta.days.map((day, idx) => {
          const dayRegCount = (schedule?.registrations || []).filter((r) => r.date === day.date).length;
          const isSelected = mobileDayIdx === idx;
          return (
            <button
              key={day.date}
              onClick={() => setMobileDayIdx(idx)}
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

      {/* Weekly Schedule Table / Grid */}
      <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-xl overflow-hidden">
        
        {/* Desktop Weekly Matrix View (>= 640px) */}
        <div className="hidden sm:block overflow-x-auto">
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

                                    {/* Action to unregister (if self and not locked, or if admin) */}
                                    {((isSelf && !isLocked) || isAdmin) && (
                                      <button
                                        onClick={() =>
                                          handleToggleRegistration(day.date, shift.id, shift.name, reg.userId)
                                        }
                                        className="p-0.5 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer shrink-0"
                                        title="Hủy đăng ký ca này"
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
                                disabled={isLocked && !isAdmin}
                                className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                                  isLocked && !isAdmin
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
                                disabled={isLocked && !isAdmin}
                                className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                                  isLocked && !isAdmin
                                    ? 'bg-zinc-800/40 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                                    : 'bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white border border-zinc-700/80 cursor-pointer'
                                }`}
                              >
                                {isLocked && !isAdmin ? (
                                  <>
                                    <Lock className="w-3 h-3 text-zinc-600" />
                                    <span>Đã khóa</span>
                                  </>
                                ) : (
                                  <>
                                    <span>+ Đăng ký</span>
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

        {/* Mobile Single-Day Focused View (< 640px) */}
        <div className="sm:hidden p-4 space-y-4">
          {(() => {
            const activeDay = selectedMeta.days[mobileDayIdx] || selectedMeta.days[0];
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-100">
                      {activeDay.dayName} ({activeDay.formattedDate})
                    </span>
                    {activeDay.isToday && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Hôm nay
                      </span>
                    )}
                  </div>
                </div>

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
                        className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3"
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
                                        : 'bg-zinc-900 border border-zinc-800 text-zinc-200'
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
                                    {((isSelf && !isLocked) || isAdmin) && (
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
                              disabled={isLocked && !isAdmin}
                              className={`w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                                isLocked && !isAdmin
                                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 cursor-not-allowed'
                                  : 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-md'
                              }`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{isLocked && !isAdmin ? 'Đã đăng ký (Khóa)' : 'Hủy Đăng Ký Ca Này'}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handleToggleRegistration(activeDay.date, shift.id, shift.name)
                              }
                              disabled={isLocked && !isAdmin}
                              className={`w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                                isLocked && !isAdmin
                                  ? 'bg-zinc-800/40 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md'
                              }`}
                            >
                              {isLocked && !isAdmin ? (
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
              </div>
            );
          })()}
        </div>

      </div>

      {/* Staff Allocation & Weekly Summary Card */}
      <div className="p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <span className="text-xs font-bold text-zinc-200 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            Phân Bổ Nhân Sự Đăng Ký Trong Tuần ({selectedMeta.shortLabel})
          </span>
          <span className="text-xs text-zinc-400 font-mono">
            {users.length} nhân viên trong hệ thống
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {users.map((u) => {
            const count = weekStats.userCountMap.get(u.id) || 0;
            const isSelf = currentUser?.id === u.id;
            return (
              <div
                key={u.id}
                className={`p-3 rounded-2xl border text-center space-y-1.5 transition-all ${
                  isSelf
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-zinc-950/80 border-zinc-800/80'
                }`}
              >
                <img
                  src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                  alt={u.name}
                  className="w-8 h-8 rounded-full object-cover mx-auto"
                />
                <div className="text-xs font-bold text-zinc-100 truncate">
                  {u.name} {isSelf && '(Bạn)'}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">{u.position}</div>
                <div className="pt-1 border-t border-zinc-800/80">
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    {count} ca
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
