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
  Lock,
  Layers,
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
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [wifiVerifiedManually, setWifiVerifiedManually] = useState<boolean>(false);

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
        activeShiftTitle: `Ca Sáng: ${formatMinutesToTime(mStart)} - ${formatMinutesToTime(mEnd)}`,
        badgeText: 'Đang trong Ca Sáng',
        checkInRange: `${formatMinutesToTime(mCheckInStart)} - ${formatMinutesToTime(mEnd)}`,
        checkOutRange: `${formatMinutesToTime(mStart)} - ${formatMinutesToTime(mCheckOutEnd)}`,
        endTimeStr: formatMinutesToTime(mEnd),
      };
    }

    if (nowMins >= aCheckInStart && nowMins <= aCheckOutEnd) {
      return {
        inShiftWindow: true,
        activeShiftTitle: `Ca Chiều: ${formatMinutesToTime(aStart)} - ${formatMinutesToTime(aEnd)}`,
        badgeText: 'Đang trong Ca Chiều',
        checkInRange: `${formatMinutesToTime(aCheckInStart)} - ${formatMinutesToTime(aEnd)}`,
        checkOutRange: `${formatMinutesToTime(aStart)} - ${formatMinutesToTime(aCheckOutEnd)}`,
        endTimeStr: formatMinutesToTime(aEnd),
      };
    }

    return {
      inShiftWindow: false,
      activeShiftTitle: 'Chưa đến giờ làm việc',
      badgeText: 'Chưa đến giờ làm việc',
      checkInRange: '',
      checkOutRange: '',
      endTimeStr: '',
    };
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

      {/* Shift Windows Information Card (Only shows current active shift or 'Chưa đến giờ làm việc') */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" /> Quy Định Ca Làm Việc
          </span>
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-lg ${
              shiftStatus.inShiftWindow
                ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30'
                : 'text-amber-300 bg-amber-500/15 border border-amber-500/30'
            }`}
          >
            {shiftStatus.badgeText}
          </span>
        </div>

        {shiftStatus.inShiftWindow ? (
          <>
            <div className="p-3 rounded-xl bg-zinc-950/90 border border-indigo-500/30 text-xs space-y-1">
              <div className="font-bold text-zinc-100 text-sm">{shiftStatus.activeShiftTitle}</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400 pt-0.5">
                <div>
                  • Giờ Check-in: <span className="font-mono font-semibold text-emerald-400">{shiftStatus.checkInRange}</span>
                </div>
                <div>
                  • Giờ Check-out: <span className="font-mono font-semibold text-indigo-400">{shiftStatus.checkOutRange}</span>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-zinc-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Nếu quên check-out, hệ thống mặc định chốt giờ kết thúc ca ({shiftStatus.endTimeStr}).</span>
            </div>
          </>
        ) : (
          <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-amber-500/25 flex items-center gap-2.5 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-amber-300">Chưa đến giờ làm việc</div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Hiện tại nằm ngoài khung giờ từ Check-in đến Check-out của các ca làm việc.
              </p>
            </div>
          </div>
        )}
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

          {/* Today's Sessions Breakdown */}
          <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Nhật Ký Hôm Nay ({myTodaySessions.length})
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                Tổng: {(myTodayTotalMinutes / 60).toFixed(1)}h ({myTodayTotalMinutes}p)
              </span>
            </div>

            <div className="space-y-1.5">
              {myTodaySessions.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2 text-center">Chưa có lượt chấm công hôm nay</p>
              ) : (
                myTodaySessions.map((r, idx) => {
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
                  return (
                    <div
                      key={r.id}
                      className="px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800/60 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-200">Ca {myTodaySessions.length - idx}</span>
                        <span className="text-zinc-400 font-mono tabular-nums">
                          {inTime} → {outTime}
                        </span>
                      </div>

                      <div className="font-mono tabular-nums text-right">
                        {r.status === 'working' ? (
                          <span className="text-emerald-400 font-semibold">Đang làm</span>
                        ) : (
                          <span className="font-bold text-indigo-400">
                            {(r.totalMinutes / 60).toFixed(1)}h{' '}
                            <span className="text-[11px] font-normal text-zinc-500">({r.totalMinutes}p)</span>
                          </span>
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
