import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  LogIn,
  LogOut,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Wifi,
  Sparkles,
  TrendingUp,
  Lock,
  Layers,
  KeyRound,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ChangePasswordModal } from './ChangePasswordModal.tsx';

export const StaffAttendance: React.FC = () => {
  const {
    currentUser,
    storeConfig,
    networkInfo,
    activeRecord,
    checkIn,
    checkOut,
    attendance,
  } = useApp();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [wifiVerifiedManually, setWifiVerifiedManually] = useState<boolean>(false);
  const [isChangePwOpen, setIsChangePwOpen] = useState(false);

  // Personal Monthly Stats
  const [myMonthlyHours, setMyMonthlyHours] = useState<number>(0);
  const [myMonthlyDays, setMyMonthlyDays] = useState<number>(0);
  const [myEstimatedSalary, setMyEstimatedSalary] = useState<number>(0);

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load personal stats
  useEffect(() => {
    if (!currentUser) return;
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const myMonthRecords = attendance.filter(
      (r) => r.userId === currentUser.id && r.date.startsWith(currentMonth)
    );
    const totalMinutes = myMonthRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
    const hours = Number((totalMinutes / 60).toFixed(1));
    const days = new Set(myMonthRecords.map((r) => r.date)).size;
    const salary = Math.round(hours * currentUser.hourlyRate);

    setMyMonthlyHours(hours);
    setMyMonthlyDays(days);
    setMyEstimatedSalary(salary);
  }, [attendance, currentUser]);

  // WiFi Verification
  const isWifiValid = useMemo(() => {
    if (!storeConfig?.requireWifi) return true;
    if (storeConfig.bypassIpCheck) return true;
    if (wifiVerifiedManually) return true;
    return networkInfo?.isAllowedIp ?? false;
  }, [storeConfig, wifiVerifiedManually, networkInfo]);

  // Current Shift Window Calculation
  const shiftStatus = useMemo(() => {
    const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    const morningShift = storeConfig?.shifts?.find((s) => s.id === 'shift_morning') || {
      startTime: '06:00',
      endTime: '12:00',
      checkInBeforeMinutes: 30,
      checkOutAfterMinutes: 90,
    };
    const afternoonShift = storeConfig?.shifts?.find((s) => s.id === 'shift_afternoon') || {
      startTime: '15:30',
      endTime: '20:00',
      checkInBeforeMinutes: 30,
      checkOutAfterMinutes: 90,
    };

    // Morning: Check-in 05:30 - 12:00, Check-out 06:00 - 13:30
    const mCheckInStart = 5 * 60 + 30;
    const mCheckInEnd = 12 * 60;
    const mCheckOutStart = 6 * 60;
    const mCheckOutEnd = 13 * 60 + 30;

    // Afternoon: Check-in 15:00 - 20:00, Check-out 15:30 - 21:30
    const aCheckInStart = 15 * 60;
    const aCheckInEnd = 20 * 60;
    const aCheckOutStart = 15 * 60 + 30;
    const aCheckOutEnd = 21 * 60 + 30;

    const inMorningCheckIn = nowMins >= mCheckInStart && nowMins <= mCheckInEnd;
    const inMorningCheckOut = nowMins >= mCheckOutStart && nowMins <= mCheckOutEnd;

    const inAfternoonCheckIn = nowMins >= aCheckInStart && nowMins <= aCheckInEnd;
    const inAfternoonCheckOut = nowMins >= aCheckOutStart && nowMins <= aCheckOutEnd;

    if (inMorningCheckIn || inMorningCheckOut) {
      return {
        activeShiftName: 'Ca Sáng (06:00 - 12:00)',
        canCheckIn: inMorningCheckIn,
        canCheckOut: inMorningCheckOut,
        message: 'Đang trong khung giờ Ca Sáng',
        windowDetails: 'Check-in: 05:30 - 12:00 | Check-out: 06:00 - 13:30',
      };
    } else if (inAfternoonCheckIn || inAfternoonCheckOut) {
      return {
        activeShiftName: 'Ca Chiều (15:30 - 20:00)',
        canCheckIn: inAfternoonCheckIn,
        canCheckOut: inAfternoonCheckOut,
        message: 'Đang trong khung giờ Ca Chiều',
        windowDetails: 'Check-in: 15:00 - 20:00 | Check-out: 15:30 - 21:30',
      };
    } else {
      return {
        activeShiftName: 'Ngoài giờ ca',
        canCheckIn: false,
        canCheckOut: false,
        message: 'Hiện tại ngoài khung giờ ca',
        windowDetails: 'Ca Sáng (05:30 - 12:00) | Ca Chiều (15:00 - 20:00)',
      };
    }
  }, [currentTime, storeConfig]);

  // Today's multiple sessions for current staff
  const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;
  const myTodaySessions = attendance.filter(
    (r) => r.userId === currentUser?.id && r.date === todayStr
  );
  const myTodayTotalMinutes = myTodaySessions.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);

  // 1-Click Check-In Handler
  const handleCheckIn = async () => {
    if (!isWifiValid) {
      setStatusMessage({
        type: 'error',
        text: `Chặn chấm công: Bạn chưa kết nối vào WiFi của quán ("${storeConfig?.wifiSsid}"). Vui lòng kết nối vào đúng mạng WiFi quán để tiếp tục.`,
      });
      return;
    }

    if (activeRecord) {
      setStatusMessage({
        type: 'error',
        text: 'Bạn đang có một lượt làm việc chưa Check-out. Vui lòng bấm Check-out trước khi Check-in lượt tiếp theo.',
      });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const record = await checkIn({
        wifiSsid: storeConfig?.wifiSsid,
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      setStatusMessage({
        type: 'success',
        text: `Check-in thành công lúc ${new Date(record.checkInTime).toLocaleTimeString('vi-VN')} (${record.shiftName || 'Trong ca'})! Giờ làm việc bắt đầu được tính.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Check-in thất bại.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 1-Click Check-Out Handler
  const handleCheckOut = async () => {
    if (!isWifiValid) {
      setStatusMessage({
        type: 'error',
        text: `Chặn chấm công: Bạn chưa kết nối vào WiFi của quán ("${storeConfig?.wifiSsid}"). Vui lòng kết nối vào đúng mạng WiFi quán để tiếp tục.`,
      });
      return;
    }

    if (!activeRecord) {
      setStatusMessage({
        type: 'error',
        text: 'Bạn chưa có lượt làm việc nào đang mở để Check-out.',
      });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const record = await checkOut({
        wifiSsid: storeConfig?.wifiSsid,
      });

      confetti({
        particleCount: 75,
        spread: 55,
        origin: { y: 0.6 },
      });

      setStatusMessage({
        type: 'success',
        text: `Check-out thành công! Lượt làm này được ghi nhận: ${(record.totalMinutes / 60).toFixed(1)} giờ (${record.totalMinutes} phút). Bạn có thể tiếp tục Check-in lại lượt mới bất kỳ lúc nào trong ca!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Check-out thất bại.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  function getWorkingDuration(): string {
    if (!activeRecord) return '00:00:00';
    const startMs = new Date(activeRecord.checkInTime).getTime();
    const nowMs = currentTime.getTime();
    const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div className="max-w-xl mx-auto space-y-5 animate-in fade-in duration-300">
      
      {/* Real-time Clock */}
      <div className="text-center py-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          {storeConfig?.storeName || 'Cháo Mầm Nhỏ Thái Thịnh'}
        </div>
        <div className="text-4xl sm:text-5xl font-extrabold tracking-tight font-mono text-zinc-100">
          {currentTime.toLocaleTimeString('vi-VN')}
        </div>
        <p className="text-xs text-zinc-400 mt-1 capitalize">
          {currentTime.toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Staff Profile Header Card */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src={currentUser?.avatar}
            alt={currentUser?.name}
            className="w-12 h-12 rounded-2xl object-cover bg-zinc-800 border border-zinc-700 shadow-inner"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-100">{currentUser?.name}</h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                {currentUser?.employeeCode}
              </span>
            </div>
            <p className="text-xs text-zinc-400">{currentUser?.position}</p>
            <p className="text-[11px] font-mono text-zinc-500 truncate">
              Tài khoản: {currentUser?.username}
            </p>
          </div>
        </div>

        <div className="text-right space-y-1.5">
          <div>
            <span className="text-[11px] text-zinc-500 block">Lương của bạn</span>
            <span className="text-xs font-bold text-emerald-400">
              {currentUser?.hourlyRate.toLocaleString('vi-VN')} đ/h
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsChangePwOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[11px] font-semibold text-indigo-300 flex items-center gap-1 ml-auto transition-colors cursor-pointer"
          >
            <KeyRound className="w-3 h-3 text-indigo-400" />
            <span>Đổi mật khẩu</span>
          </button>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isChangePwOpen}
        onClose={() => setIsChangePwOpen(false)}
      />

      {/* Shift Windows Information Card */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" /> Quy Định 2 Ca Làm Việc
          </span>
          <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
            {shiftStatus.activeShiftName}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
            <div className="font-bold text-zinc-200">Ca Sáng: 06:00 - 12:00</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              • Check-in: <span className="text-emerald-400">05:30 - 12:00</span>
            </div>
            <div className="text-[11px] text-zinc-400">
              • Check-out: <span className="text-indigo-400">06:00 - 13:30</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
            <div className="font-bold text-zinc-200">Ca Chiều: 15:30 - 20:00</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              • Check-in: <span className="text-emerald-400">15:00 - 20:00</span>
            </div>
            <div className="text-[11px] text-zinc-400">
              • Check-out: <span className="text-indigo-400">15:30 - 21:30</span>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-zinc-500 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Nếu quên check-out, hệ thống mặc định chốt giờ kết thúc ca (12:00 hoặc 20:00).</span>
        </div>
      </div>

      {/* Strict WiFi Requirement Banner */}
      <div
        className={`p-4 rounded-2xl border text-xs transition-all ${
          isWifiValid
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-950/30 border-rose-500/40 text-rose-200 shadow-lg shadow-rose-950/20'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Wifi className={`w-4 h-4 shrink-0 mt-0.5 ${isWifiValid ? 'text-emerald-400' : 'text-rose-400'}`} />
            <div>
              <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                WiFi Bắt Buộc: <span className="underline">{storeConfig?.wifiSsid}</span>
                {isWifiValid ? (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    ĐÃ KẾT NỐI
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">
                    CHƯA KẾT NỐI
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                {isWifiValid
                  ? 'Thiết bị đã kết nối đúng mạng WiFi của quán. Bạn đủ điều kiện để chấm công.'
                  : `Hệ thống chặn chấm công nếu không có WiFi quán. Vui lòng kết nối vào "${storeConfig?.wifiSsid}".`}
              </p>
            </div>
          </div>

          {!isWifiValid && (
            <button
              onClick={() => setWifiVerifiedManually(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shrink-0 transition-colors"
            >
              Tôi Đã Bật WiFi
            </button>
          )}
        </div>
      </div>

      {/* Notification banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-start gap-3 animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium leading-relaxed">{statusMessage.text}</div>
        </div>
      )}

      {/* 2 DIRECT BUTTONS: CHECK-IN & CHECK-OUT HERO CARD (OR MANAGER NOTICE) */}
      {currentUser?.role === 'admin' ? (
        <div className="p-6 sm:p-8 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-amber-100">Tài Khoản Quản Lý / Chủ Quán</h3>
            <p className="text-xs text-amber-200/80 max-w-md mx-auto leading-relaxed">
              Bạn là Quản lý cửa hàng nên <strong>không cần chấm công Check-in / Check-out</strong>. Vui lòng sử dụng mục <strong>Theo Dõi Trực Tiếp (Dashboard)</strong> để xem nhân viên nào đang làm việc, duyệt bảng công hoặc chấm công hộ khi có sự cố.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 shadow-2xl">
            
            {/* Ambient lighting */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Current Active Working Status Tracker */}
            <div className="text-center mb-6">
              {activeRecord ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    BẠN ĐANG TRONG LƯỢT LÀM VIỆC
                  </div>

                  <div>
                    <span className="text-xs text-zinc-400">Thời gian làm việc lượt này:</span>
                    <div className="text-4xl sm:text-5xl font-mono font-black text-emerald-400 tracking-tight mt-1">
                      {getWorkingDuration()}
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400">
                    Bắt đầu lượt này lúc: <strong className="text-zinc-200">{new Date(activeRecord.checkInTime).toLocaleTimeString('vi-VN')}</strong>
                    {activeRecord.shiftName && ` (${activeRecord.shiftName})`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    Sẵn sàng vào ca làm việc
                  </div>
                  <h3 className="text-lg font-bold text-zinc-100">Bấm Check-in Khi Bắt Đầu Làm</h3>
                  <p className="text-xs text-zinc-400">
                    Trong ca có thể check-in, check-out nhiều lần và hệ thống sẽ cộng dồn tổng số giờ công.
                  </p>
                </div>
              )}
            </div>

            {/* 2 DISTINCT BIG BUTTONS: CHECK-IN and CHECK-OUT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* BUTTON 1: CHECK-IN */}
              <button
                onClick={handleCheckIn}
                disabled={isProcessing || !!activeRecord || !isWifiValid}
                className={`py-4 px-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.98] shadow-lg ${
                  !activeRecord && isWifiValid
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 cursor-pointer'
                    : 'bg-zinc-800/60 border border-zinc-700/40 text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                <LogIn className="w-5 h-5" />
                <span>CHECK-IN (VÀO CA)</span>
              </button>

              {/* BUTTON 2: CHECK-OUT */}
              <button
                onClick={handleCheckOut}
                disabled={isProcessing || !activeRecord || !isWifiValid}
                className={`py-4 px-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.98] shadow-lg ${
                  activeRecord && isWifiValid
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30 cursor-pointer animate-pulse'
                    : 'bg-zinc-800/60 border border-zinc-700/40 text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                <LogOut className="w-5 h-5" />
                <span>CHECK-OUT (RA CA)</span>
              </button>

            </div>

            {!isWifiValid && (
              <div className="mt-3.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center text-[11px] font-semibold flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Nút chấm công tạm khóa vì chưa kết nối đúng WiFi "{storeConfig?.wifiSsid}"
              </div>
            )}

          </div>

          {/* Today's Multiple Sessions Breakdown */}
          <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Các Lượt Làm Trong Ngày Hôm Nay ({myTodaySessions.length})
              </span>
              <span className="text-xs font-bold text-emerald-400">
                Hôm nay: {(myTodayTotalMinutes / 60).toFixed(1)}h ({myTodayTotalMinutes}p)
              </span>
            </div>

            <div className="space-y-2">
              {myTodaySessions.length === 0 ? (
                <p className="text-xs text-zinc-500 py-3 text-center">Hôm nay bạn chưa có lượt check-in nào</p>
              ) : (
                myTodaySessions.map((r, idx) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-200">Lượt {myTodaySessions.length - idx}</span>
                        <span className="text-zinc-400 text-[11px]">({r.shiftName || 'Trong ca'})</span>
                        {r.status === 'working' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 animate-pulse">
                            Đang làm
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400">
                            Đã xong
                          </span>
                        )}
                        {r.autoClosed && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Chốt tự động
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">
                        Vào: <strong className="text-zinc-300">{new Date(r.checkInTime).toLocaleTimeString('vi-VN')}</strong>
                        {' → '}
                        Ra: <strong className="text-zinc-300">{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('vi-VN') : 'Đang làm...'}</strong>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-indigo-400">
                        {r.totalMinutes > 0 ? `${(r.totalMinutes / 60).toFixed(1)}h` : '--'}
                      </div>
                      <div className="text-[10px] text-zinc-500">{r.totalMinutes} phút</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Personal Monthly Work Hours & Salary Widget (Staff ONLY sees their own) */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" /> Bảng Công Cá Nhân Của Bạn (Tháng Này)
          </span>
          <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded">
            Dữ liệu riêng tư
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 text-center">
            <span className="text-[10px] text-zinc-500 uppercase block">Số ngày làm</span>
            <div className="text-lg font-black text-zinc-100 mt-0.5">{myMonthlyDays} ngày</div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 text-center">
            <span className="text-[10px] text-zinc-500 uppercase block">Tổng giờ công</span>
            <div className="text-lg font-black text-indigo-400 mt-0.5">{myMonthlyHours}h</div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 text-center">
            <span className="text-[10px] text-zinc-500 uppercase block">Lương dự tính</span>
            <div className="text-lg font-black text-emerald-400 mt-0.5">
              {myEstimatedSalary.toLocaleString('vi-VN')} đ
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
