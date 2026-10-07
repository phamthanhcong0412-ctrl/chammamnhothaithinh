import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  LogIn,
  LogOut,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Wifi,
  Lock,
  Layers,
  DollarSign,
  FileText,
  Sun,
  Sunset,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';

function parseTimeMinutes(timeStr: string, fallbackMins: number): number {
  const parts = String(timeStr || '').split(':');
  if (parts.length !== 2) return fallbackMins;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallbackMins;
  return h * 60 + m;
}

function formatMinutesToTime(mins: number): string {
  const normalized = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

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
  const processingRef = useRef(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [wifiVerifiedManually, setWifiVerifiedManually] = useState<boolean>(false);
  const [shiftNote, setShiftNote] = useState('');

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // WiFi Verification
  const isWifiValid = useMemo(() => {
    if (!storeConfig?.requireWifi) return true;
    if (storeConfig.bypassIpCheck) return true;
    if (wifiVerifiedManually) return true;
    return networkInfo?.isAllowedIp ?? false;
  }, [storeConfig, wifiVerifiedManually, networkInfo]);

  // Current Shift Window Calculation (from Check-in start to Check-out end)
  const shiftStatus = useMemo(() => {
    const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();

    const morningCfg = storeConfig?.shifts?.find((s) => s.id === 'shift_morning');
    const afternoonCfg = storeConfig?.shifts?.find((s) => s.id === 'shift_afternoon');

    const mStart = parseTimeMinutes(morningCfg?.startTime || '06:00', 6 * 60);
    const mEnd = parseTimeMinutes(morningCfg?.endTime || '12:00', 12 * 60);
    const mBefore = morningCfg?.checkInBeforeMinutes ?? 30;
    const mAfter = morningCfg?.checkOutAfterMinutes ?? 90;
    const mCheckInStart = mStart - mBefore;
    const mCheckOutEnd = mEnd + mAfter;

    const aStart = parseTimeMinutes(afternoonCfg?.startTime || '15:30', 15 * 60 + 30);
    const aEnd = parseTimeMinutes(afternoonCfg?.endTime || '20:00', 20 * 60);
    const aBefore = afternoonCfg?.checkInBeforeMinutes ?? 30;
    const aAfter = afternoonCfg?.checkOutAfterMinutes ?? 90;
    const aCheckInStart = aStart - aBefore;
    const aCheckOutEnd = aEnd + aAfter;

    if (nowMins >= mCheckInStart && nowMins <= mCheckOutEnd) {
      return {
        inShiftWindow: true,
        isAfternoon: false,
        activeShiftTitle: `Ca Sáng (${formatMinutesToTime(mStart)} - ${formatMinutesToTime(mEnd)})`,
        badgeText: 'Đang trong Ca Sáng',
        checkInRange: `${formatMinutesToTime(mCheckInStart)} - ${formatMinutesToTime(mEnd)}`,
        checkOutRange: `${formatMinutesToTime(mStart)} - ${formatMinutesToTime(mCheckOutEnd)}`,
        endTimeStr: formatMinutesToTime(mEnd),
      };
    }

    if (nowMins >= aCheckInStart && nowMins <= aCheckOutEnd) {
      return {
        inShiftWindow: true,
        isAfternoon: true,
        activeShiftTitle: `Ca Chiều (${formatMinutesToTime(aStart)} - ${formatMinutesToTime(aEnd)})`,
        badgeText: 'Đang trong Ca Chiều',
        checkInRange: `${formatMinutesToTime(aCheckInStart)} - ${formatMinutesToTime(aEnd)}`,
        checkOutRange: `${formatMinutesToTime(aStart)} - ${formatMinutesToTime(aCheckOutEnd)}`,
        endTimeStr: formatMinutesToTime(aEnd),
      };
    }

    return {
      inShiftWindow: false,
      isAfternoon: nowMins >= 12 * 60,
      activeShiftTitle: 'Chưa đến giờ làm việc',
      badgeText: 'Chưa đến giờ làm việc',
      checkInRange: '',
      checkOutRange: '',
      endTimeStr: '',
    };
  }, [currentTime, storeConfig]);

  // Today's sessions for current staff
  const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;
  const myTodaySessions = attendance.filter(
    (r) => r.userId === currentUser?.id && r.date === todayStr
  );
  const myTodayCompletedMinutes = myTodaySessions.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);

  // Live active turn duration & estimated pay
  const activeElapsedSec = useMemo(() => {
    if (!activeRecord) return 0;
    const startMs = new Date(activeRecord.checkInTime).getTime();
    return Math.max(0, Math.floor((currentTime.getTime() - startMs) / 1000));
  }, [activeRecord, currentTime]);

  const activeElapsedMinutes = Math.floor(activeElapsedSec / 60);
  const totalMinutesTodayLive = myTodayCompletedMinutes + activeElapsedMinutes;
  const hourlyRate = currentUser?.hourlyRate || 28000;
  const liveEstimatedPayToday = Math.round((totalMinutesTodayLive / 60) * hourlyRate);

  function formatElapsed(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // 1-Click Check-In Handler
  const handleCheckIn = async () => {
    if (processingRef.current || isProcessing) return;
    if (!isWifiValid) {
      setStatusMessage({
        type: 'error',
        text: `Chặn chấm công: Bạn chưa kết nối vào WiFi "${storeConfig?.wifiSsid}".`,
      });
      return;
    }

    if (activeRecord) {
      setStatusMessage({
        type: 'error',
        text: 'Bạn đang có một lượt làm việc chưa Check-out.',
      });
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const record = await checkIn({
        wifiSsid: storeConfig?.wifiSsid,
        note: shiftNote.trim() || undefined,
      });

      setShiftNote('');
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });

      setStatusMessage({
        type: 'success',
        text: `Đã Check-in vào ca lúc ${new Date(record.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Check-in thất bại.',
      });
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  };

  // 1-Click Check-Out Handler
  const handleCheckOut = async () => {
    if (processingRef.current || isProcessing) return;
    if (!isWifiValid) {
      setStatusMessage({
        type: 'error',
        text: `Chặn chấm công: Bạn chưa kết nối vào WiFi "${storeConfig?.wifiSsid}".`,
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

    processingRef.current = true;
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const record = await checkOut({
        wifiSsid: storeConfig?.wifiSsid,
        note: shiftNote.trim() || undefined,
      });

      setShiftNote('');
      confetti({
        particleCount: 70,
        spread: 55,
        origin: { y: 0.6 },
      });

      setStatusMessage({
        type: 'success',
        text: `Đã Check-out hoàn tất! Tổng thời gian ca: ${(record.totalMinutes / 60).toFixed(1)}h (${record.totalMinutes} phút).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Check-out thất bại.',
      });
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 animate-in fade-in duration-300">
      {/* Digital Clock Header */}
      <div className="text-center pt-1 pb-2">
        <div className="text-4xl sm:text-5xl font-black tracking-tight font-mono tabular-nums text-zinc-100">
          {currentTime.toLocaleTimeString('vi-VN')}
        </div>
        <p className="text-xs text-zinc-400 mt-1 capitalize">
          {currentTime.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Unified Shift Window & Store WiFi Status Card */}
      <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 space-y-3">
        {/* Active Shift Window Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                shiftStatus.inShiftWindow
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              {shiftStatus.isAfternoon ? <Sunset className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-zinc-100 truncate">
                {shiftStatus.activeShiftTitle}
              </div>
              {shiftStatus.inShiftWindow ? (
                <div className="text-[11px] text-zinc-400 font-mono truncate">
                  Nhận công: <span className="text-emerald-400">{shiftStatus.checkInRange}</span> · Chốt ca:{' '}
                  <span className="text-indigo-400">{shiftStatus.checkOutRange}</span>
                </div>
              ) : (
                <div className="text-[11px] text-zinc-500 truncate">
                  Ngoài khung giờ nhận chấm công của ca làm việc
                </div>
              )}
            </div>
          </div>

          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0 ${
              shiftStatus.inShiftWindow
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            }`}
          >
            {shiftStatus.badgeText}
          </span>
        </div>

        {/* Store WiFi Verification Row */}
        <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <Wifi className={`w-4 h-4 shrink-0 ${isWifiValid ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="text-zinc-400 truncate">
              WiFi quán: <strong className="text-zinc-200">{storeConfig?.wifiSsid}</strong>
            </span>
          </div>

          {isWifiValid ? (
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" /> Đã kết nối
            </span>
          ) : (
            <button
              onClick={() => setWifiVerifiedManually(true)}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shrink-0 transition-colors cursor-pointer"
            >
              Xác nhận đã bật WiFi
            </button>
          )}
        </div>
      </div>

      {/* Feedback Notification Banner */}
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
          <div className="flex-1 font-medium">{statusMessage.text}</div>
        </div>
      )}

      {/* MAIN TIMECLOCK TERMINAL CARD */}
      {currentUser?.role === 'admin' ? (
        <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-center space-y-3 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-amber-100">Tài Khoản Quản Lý Cửa Hàng</h3>
            <p className="text-xs text-amber-200/80 max-w-md mx-auto leading-relaxed">
              Quản lý không cần chấm công cá nhân. Vui lòng chuyển sang mục <strong>Theo Dõi Trực Tiếp</strong> để điều hành ca làm việc và chấm công hộ nhân viên.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-3xl p-6 bg-zinc-900/90 border border-zinc-800/90 shadow-2xl space-y-5">
            {/* Live Stopwatch & Status Display */}
            <div className="text-center">
              {activeRecord ? (
                <div className="space-y-2.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    ĐANG TRONG CA LÀM VIỆC
                  </div>

                  <div className="text-4xl sm:text-5xl font-mono font-black text-emerald-400 tracking-tight tabular-nums">
                    {formatElapsed(activeElapsedSec)}
                  </div>

                  <div className="flex items-center justify-center gap-3 text-xs text-zinc-400">
                    <span>
                      Vào lúc:{' '}
                      <strong className="text-zinc-200 font-mono">
                        {new Date(activeRecord.checkInTime).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </span>
                    <span>·</span>
                    <span className="text-emerald-400 font-mono font-semibold flex items-center gap-0.5">
                      <DollarSign className="w-3.5 h-3.5" />
                      Tạm tính hôm nay: {liveEstimatedPayToday.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 py-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800/90 border border-zinc-700/80 text-zinc-300 text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    Sẵn sàng chấm công
                  </div>
                  <h3 className="text-base font-bold text-zinc-100">
                    Bấm Check-in Khi Bắt Đầu Ca Làm Việc
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Nếu ra ngoài giữa ca có thể Check-out và Check-in lại, hệ thống tự gộp vào cùng 1 ca.
                  </p>
                </div>
              )}
            </div>

            {/* Optional Shift Note Input */}
            <div className="relative">
              <FileText className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={shiftNote}
                onChange={(e) => setShiftNote(e.target.value)}
                placeholder={
                  activeRecord
                    ? 'Ghi chú khi ra ca (VD: Tăng ca dọn quán, xin về sớm...)'
                    : 'Ghi chú khi vào ca nếu có (VD: Làm thay ca, tăng ca...)'
                }
                className="w-full pl-10 pr-3.5 py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* 2 Tactile Action Buttons: CHECK-IN & CHECK-OUT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleCheckIn}
                disabled={isProcessing || !!activeRecord || !isWifiValid}
                className={`py-4 px-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.98] shadow-lg ${
                  !activeRecord && isWifiValid
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/25 cursor-pointer'
                    : 'bg-zinc-800/50 border border-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                <LogIn className="w-5 h-5" />
                <span>CHECK-IN VÀO CA</span>
              </button>

              <button
                onClick={handleCheckOut}
                disabled={isProcessing || !activeRecord || !isWifiValid}
                className={`py-4 px-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.98] shadow-lg ${
                  activeRecord && isWifiValid
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/25 cursor-pointer'
                    : 'bg-zinc-800/50 border border-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                <LogOut className="w-5 h-5" />
                <span>CHECK-OUT RA CA</span>
              </button>
            </div>

            {!isWifiValid && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center text-[11px] font-semibold flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Vui lòng kết nối WiFi "{storeConfig?.wifiSsid}" hoặc bấm "Xác nhận đã bật WiFi" ở trên
              </div>
            )}
          </div>

          {/* Today's Consolidated Shifts Summary */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Ca Làm Hôm Nay ({myTodaySessions.length})
              </span>
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                <span className="text-zinc-400">
                  Tổng: <strong className="text-indigo-400">{(totalMinutesTodayLive / 60).toFixed(1)}h</strong> ({totalMinutesTodayLive}p)
                </span>
                <span className="font-bold text-emerald-400">
                  +{liveEstimatedPayToday.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              {myTodaySessions.length === 0 ? (
                <p className="text-xs text-zinc-500 py-3 text-center">
                  Hôm nay bạn chưa có ca chấm công nào
                </p>
              ) : (
                myTodaySessions.map((r) => {
                  const inTime = new Date(r.checkInTime).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const outTime = r.checkOutTime
                    ? new Date(r.checkOutTime).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Đang làm';
                  const shiftLabel =
                    r.shiftId === 'shift_afternoon' || new Date(r.checkInTime).getHours() >= 14
                      ? 'Ca Chiều'
                      : 'Ca Sáng';
                  return (
                    <div
                      key={r.id}
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-950/90 border border-zinc-800/70 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-zinc-100">{shiftLabel}</span>
                        <span className="text-zinc-400 font-mono tabular-nums">
                          {inTime} → {outTime}
                        </span>
                      </div>

                      <div className="font-mono tabular-nums text-right shrink-0">
                        {r.status === 'working' ? (
                          <span className="text-emerald-400 font-semibold">Đang trong ca</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-indigo-400">
                              {(r.totalMinutes / 60).toFixed(1)}h{' '}
                              <span className="text-[10px] font-normal text-zinc-500">({r.totalMinutes}p)</span>
                            </span>
                            <span className="text-emerald-400 font-semibold">
                              +{(Number(r.estimatedShiftPay) || 0).toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
