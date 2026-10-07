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
  RefreshCw,
  MapPin,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { isClientIpAllowedByConfig, calculateGpsDistanceMeters } from '../services/api.ts';
import { deduplicateAndMergeOverlappingTurns } from '../firebase.ts';

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
    refreshData,
    runWithHudLoading,
  } = useApp();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecheckingNetwork, setIsRecheckingNetwork] = useState(false);
  const processingRef = useRef(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [shiftNote, setShiftNote] = useState('');
  const [userGps, setUserGps] = useState<{ lat: number; lng: number; accuracy?: number; distance?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Strict WiFi Verification based on saved Firebase store_config
  const isWifiValid = useMemo(() => {
    if (!storeConfig) return true;
    return isClientIpAllowedByConfig(networkInfo?.clientIp || '', storeConfig);
  }, [storeConfig, networkInfo?.clientIp]);

  // Dual-Lock GPS Verification when requireGps is enabled in storeConfig
  const checkEmployeeGps = () => {
    if (!storeConfig?.requireGps) {
      setGpsError(null);
      return;
    }
    if (!navigator.geolocation) {
      setGpsError('Thiết bị không hỗ trợ định vị GPS');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const storeLat = storeConfig.storeGps?.lat ?? 21.0116;
        const storeLng = storeConfig.storeGps?.lng ?? 105.8174;
        const dist = calculateGpsDistanceMeters(lat, lng, storeLat, storeLng);
        setUserGps({
          lat,
          lng,
          accuracy: Math.round(pos.coords.accuracy || 0),
          distance: dist,
        });
        setGpsError(null);
      },
      () => {
        setGpsError('Chưa cấp quyền vị trí GPS trên trình duyệt');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  useEffect(() => {
    if (storeConfig?.requireGps) {
      checkEmployeeGps();
    }
  }, [storeConfig?.requireGps, storeConfig?.storeGps?.lat, storeConfig?.storeGps?.lng]);

  const isGpsValid = useMemo(() => {
    if (!storeConfig?.requireGps) return true;
    if (!userGps || typeof userGps.distance !== 'number') return false;
    const maxRadius = storeConfig.storeGps?.radiusMeters || 80;
    return userGps.distance <= maxRadius;
  }, [storeConfig?.requireGps, storeConfig?.storeGps?.radiusMeters, userGps]);

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

  const isShiftTimeValid = shiftStatus.inShiftWindow;
  const canCheckInOrOut = isWifiValid && isShiftTimeValid && isGpsValid;

  const handleRecheckWifiAndConfig = async () => {
    setIsRecheckingNetwork(true);
    setStatusMessage(null);
    try {
      await runWithHudLoading('Đang kiểm tra lại kết nối WiFi & cấu hình quán...', async () => {
        await refreshData();
        if (storeConfig?.requireGps) {
          checkEmployeeGps();
        }
      });
    } finally {
      setIsRecheckingNetwork(false);
    }
  };

  // Today's sessions for current staff
  const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;
  const myTodaySessions = attendance.filter(
    (r) => r.userId === currentUser?.id && r.date === todayStr
  );
  const myTodayCompletedMinutes = myTodaySessions
    .filter((r) => r.status !== 'working')
    .reduce((sum, r) => sum + (r.totalMinutes || 0), 0);

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
        text: `Chặn chấm công: Thiết bị của bạn không kết nối đúng WiFi "${storeConfig?.wifiSsid}" (BSSID: ${storeConfig?.wifiBssid || 'A4:2B:B0:C1:9E:58'}) tại cửa hàng.`,
      });
      return;
    }

    if (!isGpsValid) {
      setStatusMessage({
        type: 'error',
        text: gpsError || `Chặn chấm công (Khóa Kép Vị Trí): Bạn không đứng trong bán kính ${storeConfig?.storeGps?.radiusMeters || 80}m tại cửa hàng.`,
      });
      return;
    }

    if (!isShiftTimeValid) {
      setStatusMessage({
        type: 'error',
        text: 'Chặn chấm công: Hiện tại đang ngoài khung giờ ca làm việc đã lưu trong cấu hình cửa hàng.',
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
        gps: userGps || undefined,
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
        text: `Chặn chấm công: Thiết bị của bạn không kết nối đúng WiFi "${storeConfig?.wifiSsid}" (BSSID: ${storeConfig?.wifiBssid || 'A4:2B:B0:C1:9E:58'}) tại cửa hàng.`,
      });
      return;
    }

    if (!isGpsValid) {
      setStatusMessage({
        type: 'error',
        text: gpsError || `Chặn chấm công (Khóa Kép Vị Trí): Bạn không đứng trong bán kính ${storeConfig?.storeGps?.radiusMeters || 80}m tại cửa hàng.`,
      });
      return;
    }

    if (!isShiftTimeValid) {
      setStatusMessage({
        type: 'error',
        text: 'Chặn chấm công: Hiện tại đang ngoài khung giờ ca làm việc đã lưu trong cấu hình cửa hàng.',
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
        gps: userGps || undefined,
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

      {/* Unified Shift Window & Store WiFi/BSSID Status Card */}
      <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 space-y-3">
        {/* Active Shift Window Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                shiftStatus.inShiftWindow
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
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
                <div className="text-[11px] text-rose-400 font-medium truncate">
                  Ngoài giờ làm việc — Đã khóa Check-in / Check-out
                </div>
              )}
            </div>
          </div>

          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0 ${
              shiftStatus.inShiftWindow
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
            }`}
          >
            {shiftStatus.badgeText}
          </span>
        </div>

        {/* Store WiFi & BSSID Verification Row (IP strictly hidden from employees) */}
        <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <Wifi className={`w-4 h-4 shrink-0 ${isWifiValid ? 'text-emerald-400' : 'text-rose-400'}`} />
            <div className="min-w-0">
              <span className="text-zinc-400 truncate block">
                WiFi quán: <strong className="text-zinc-200">{storeConfig?.wifiSsid}</strong>{' '}
                <span className="text-[10px] text-indigo-300 font-semibold">(Hỗ trợ cả 2 sóng 2.4G & 5G)</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono block truncate">
                BSSID: {storeConfig?.wifiBssid || 'A4:2B:B0:C1:9E:58 (2.4G) / 59 (5G)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isWifiValid ? (
              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ (2.4G/5G)
              </span>
            ) : (
              <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Sai WiFi
              </span>
            )}
            <button
              type="button"
              onClick={handleRecheckWifiAndConfig}
              disabled={isRecheckingNetwork}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              title="Kiểm tra lại kết nối WiFi và đồng bộ cấu hình mới nhất"
            >
              <RefreshCw className={`w-3 h-3 text-indigo-400 ${isRecheckingNetwork ? 'animate-spin' : ''}`} />
              <span>Kiểm tra lại</span>
            </button>
          </div>
        </div>

        {/* Optional Dual-Lock GPS Verification Row when enabled by Manager */}
        {storeConfig?.requireGps && (
          <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs min-w-0">
              <MapPin className={`w-4 h-4 shrink-0 ${isGpsValid ? 'text-emerald-400' : 'text-rose-400'}`} />
              <div className="min-w-0">
                <span className="text-zinc-400 truncate block">
                  Khóa kép vị trí cửa hàng (Bán kính {storeConfig.storeGps?.radiusMeters || 80}m)
                </span>
                <span className="text-[10px] text-zinc-500 font-mono block truncate">
                  {gpsError
                    ? gpsError
                    : userGps?.distance !== undefined
                    ? `Khoảng cách tới quán: ${userGps.distance}m`
                    : 'Đang xác thực vị trí GPS...'}
                </span>
              </div>
            </div>

            {isGpsValid ? (
              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tại quán
              </span>
            ) : (
              <button
                type="button"
                onClick={checkEmployeeGps}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-semibold text-[11px] shrink-0 cursor-pointer"
              >
                Lấy lại GPS
              </button>
            )}
          </div>
        )}
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
                disabled={isProcessing || !!activeRecord || !canCheckInOrOut}
                className={`py-4 px-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.98] shadow-lg ${
                  !activeRecord && canCheckInOrOut
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/25 cursor-pointer'
                    : 'bg-zinc-800/50 border border-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                <LogIn className="w-5 h-5" />
                <span>CHECK-IN VÀO CA</span>
              </button>

              <button
                onClick={handleCheckOut}
                disabled={isProcessing || !activeRecord || !canCheckInOrOut}
                className={`py-4 px-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.98] shadow-lg ${
                  activeRecord && canCheckInOrOut
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/25 cursor-pointer'
                    : 'bg-zinc-800/50 border border-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                <LogOut className="w-5 h-5" />
                <span>CHECK-OUT RA CA</span>
              </button>
            </div>

            {!isWifiValid && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-semibold flex items-start gap-2">
                <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Đã chặn Check-in / Check-out:</strong> Thiết bị của bạn không kết nối đúng mạng WiFi{' '}
                  <strong>"{storeConfig?.wifiSsid}"</strong> (BSSID:{' '}
                  <code className="font-mono text-rose-300">{storeConfig?.wifiBssid || 'A4:2B:B0:C1:9E:58'}</code>) tại cửa hàng. Vui lòng kết nối đúng WiFi quán và bấm{' '}
                  <strong>"Kiểm tra lại"</strong>.
                </div>
              </div>
            )}

            {isWifiValid && !isGpsValid && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-semibold flex items-start gap-2">
                <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Đã chặn Check-in / Check-out (Khóa Kép Vị Trí):</strong>{' '}
                  {gpsError ||
                    `Bạn đang cách quán ${userGps?.distance ?? '...'}m (vượt quá bán kính cho phép ${storeConfig?.storeGps?.radiusMeters || 80}m).`}
                </div>
              </div>
            )}

            {isWifiValid && isGpsValid && !isShiftTimeValid && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Đã chặn Check-in / Check-out:</strong> Hiện tại đang ngoài khung giờ ca làm việc đã cấu hình trong Thiết Lập Cửa Hàng.
                </div>
              </div>
            )}
          </div>

          {/* Today's Consolidated Shifts Summary with Per-Turn Breakdown */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Ca Làm & Chi Tiết Từng Lần Chấm Hôm Nay
              </span>
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                <span className="text-zinc-400">
                  Tổng thực làm: <strong className="text-indigo-400">{(totalMinutesTodayLive / 60).toFixed(1)}h</strong> ({totalMinutesTodayLive}p)
                </span>
                <span className="font-bold text-emerald-400">
                  +{liveEstimatedPayToday.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {myTodaySessions.length === 0 ? (
                <p className="text-xs text-zinc-500 py-3 text-center">
                  Hôm nay bạn chưa có lượt chấm công nào
                </p>
              ) : (
                (() => {
                  // Group today's records by shift so completed turns + active working turn in same shift appear together
                  const shiftGroups = new Map<
                    string,
                    {
                      shiftId: string;
                      shiftLabel: string;
                      turns: {
                        checkInTime: string;
                        checkOutTime: string | null;
                        minutes: number;
                        isWorking: boolean;
                        note?: string;
                      }[];
                    }
                  >();

                  // Sort chronologically
                  const chronological = [...myTodaySessions].sort(
                    (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
                  );

                  for (const r of chronological) {
                    const sId =
                      r.shiftId ||
                      (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning');
                    const sLabel = sId === 'shift_afternoon' ? 'Ca Chiều' : 'Ca Sáng';
                    const group = shiftGroups.get(sId) || {
                      shiftId: sId,
                      shiftLabel: sLabel,
                      turns: [],
                    };

                    if (r.status === 'working') {
                      // Strictly allow at most 1 active working turn matching activeRecord
                      if (activeRecord && r.id === activeRecord.id && !group.turns.some((t) => t.isWorking)) {
                        group.turns.push({
                          checkInTime: r.checkInTime,
                          checkOutTime: null,
                          minutes: activeElapsedMinutes,
                          isWorking: true,
                          note: r.note,
                        });
                      }
                    } else if (Array.isArray(r.turns) && r.turns.length > 0) {
                      const deduped = deduplicateAndMergeOverlappingTurns(r.turns);
                      for (const t of deduped) {
                        group.turns.push({
                          checkInTime: t.checkInTime,
                          checkOutTime: t.checkOutTime,
                          minutes: Number(t.minutes) || 0,
                          isWorking: false,
                          note: t.note,
                        });
                      }
                    } else {
                      group.turns.push({
                        checkInTime: r.checkInTime,
                        checkOutTime: r.checkOutTime,
                        minutes: Number(r.totalMinutes) || 0,
                        isWorking: false,
                        note: r.note,
                      });
                    }

                    shiftGroups.set(sId, group);
                  }

                  return Array.from(shiftGroups.values()).map((group) => {
                    const shiftTotalMins = group.turns.reduce((sum, t) => sum + (Number(t.minutes) || 0), 0);
                    const shiftPay = Math.round((shiftTotalMins / 60) * hourlyRate);
                    const firstIn = group.turns[0]?.checkInTime;
                    const lastTurn = group.turns[group.turns.length - 1];
                    const hasWorkingTurn = group.turns.some((t) => t.isWorking);

                    const fmtHm = (iso: string) =>
                      new Date(iso).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                    return (
                      <div
                        key={group.shiftId}
                        className="p-3.5 rounded-xl bg-zinc-950/90 border border-zinc-800/80 space-y-2.5 text-xs"
                      >
                        {/* Shift Header Summary */}
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800/70">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="font-bold text-zinc-100">{group.shiftLabel}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                              {group.turns.length} lần chấm công
                            </span>
                            {firstIn && (
                              <span className="text-zinc-400 font-mono tabular-nums text-[11px]">
                                ({fmtHm(firstIn)} →{' '}
                                {hasWorkingTurn
                                  ? 'Đang làm'
                                  : lastTurn?.checkOutTime
                                  ? fmtHm(lastTurn.checkOutTime)
                                  : '--'}
                                )
                              </span>
                            )}
                          </div>

                          <div className="font-mono tabular-nums text-right shrink-0 flex items-center gap-2">
                            <span className="font-bold text-indigo-400">
                              {(shiftTotalMins / 60).toFixed(1)}h{' '}
                              <span className="text-[10px] font-normal text-zinc-400">
                                ({shiftTotalMins} phút)
                              </span>
                            </span>
                            <span className="text-emerald-400 font-bold">
                              +{shiftPay.toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        </div>

                        {/* Per-Turn Detailed Breakdown */}
                        <div className="space-y-1.5">
                          {group.turns.map((turn, idx) => (
                            <div
                              key={`${turn.checkInTime}_${idx}`}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-900/70 border border-zinc-800/60 flex items-center justify-between gap-2 text-[11px]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono font-semibold text-[10px]">
                                  Lần {idx + 1}
                                </span>
                                <span className="font-mono tabular-nums text-zinc-200">
                                  Vào <strong>{fmtHm(turn.checkInTime)}</strong> →{' '}
                                  {turn.isWorking ? (
                                    <span className="text-emerald-400 font-sans font-semibold">
                                      Đang làm việc
                                    </span>
                                  ) : turn.checkOutTime ? (
                                    <>
                                      Ra <strong>{fmtHm(turn.checkOutTime)}</strong>
                                    </>
                                  ) : (
                                    '--'
                                  )}
                                </span>
                              </div>

                              <div className="font-mono tabular-nums shrink-0">
                                {turn.isWorking ? (
                                  <span className="text-emerald-400 font-semibold">
                                    +{turn.minutes} phút (Đang tính)
                                  </span>
                                ) : (
                                  <span className="text-zinc-200 font-semibold">
                                    {turn.minutes} phút{' '}
                                    <span className="text-zinc-500 font-normal">
                                      ({(turn.minutes / 60).toFixed(1)}h)
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Transparent Summation Formula when multiple turns exist */}
                        {group.turns.length > 1 && (
                          <div className="pt-1 text-[11px] text-emerald-300/90 font-mono flex items-center justify-between bg-emerald-500/5 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                            <span>Cộng dồn thời gian thực làm các lần:</span>
                            <strong>
                              {group.turns.map((t) => `${t.minutes}p`).join(' + ')} = {shiftTotalMins} phút
                            </strong>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
