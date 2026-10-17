/**
 * COMPONENT: StaffAttendance
 * Màn hình chấm công nhân viên (Check-in / Check-out), tích hợp Khóa kép WiFi & GPS,
 * hiển thị đồng hồ trực tiếp và lịch sử lượt làm việc trong ngày (SRP)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { isClientIpAllowedByConfig, calculateGpsDistanceMeters } from '../services/api.ts';
import {
  AttendanceHeader,
  ShiftTurnsTable,
  TimeclockActionCard,
} from './attendance/index.ts';

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

  // Strict WiFi Verification
  const isWifiValid = useMemo(() => {
    if (!storeConfig) return true;
    return isClientIpAllowedByConfig(networkInfo?.clientIp || '', storeConfig);
  }, [storeConfig, networkInfo?.clientIp]);

  // Dual-Lock GPS Verification
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
        setGpsError('Chưa cấp quyền vị trí GPS');
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

  // Current Shift Window Calculation
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
        badgeText: 'Trong Ca Sáng',
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
        badgeText: 'Trong Ca Chiều',
        checkInRange: `${formatMinutesToTime(aCheckInStart)} - ${formatMinutesToTime(aEnd)}`,
        checkOutRange: `${formatMinutesToTime(aStart)} - ${formatMinutesToTime(aEnd)}`,
        endTimeStr: formatMinutesToTime(aEnd),
      };
    }

    return {
      inShiftWindow: false,
      isAfternoon: nowMins >= 14 * 60,
      activeShiftTitle: nowMins < mCheckInStart ? 'Chưa tới Ca Sáng' : 'Ngoài Giờ Làm Việc',
      badgeText: 'Ngoài Giờ Ca',
      checkInRange: `${formatMinutesToTime(mCheckInStart)} - ${formatMinutesToTime(mEnd)} | ${formatMinutesToTime(aCheckInStart)} - ${formatMinutesToTime(aEnd)}`,
      checkOutRange: '--',
    };
  }, [currentTime, storeConfig?.shifts]);

  const isShiftTimeValid = useMemo(() => {
    if (!storeConfig?.shifts || storeConfig.shifts.length === 0) return true;
    return shiftStatus.inShiftWindow;
  }, [storeConfig?.shifts, shiftStatus.inShiftWindow]);

  const canCheckInOrOut = isWifiValid && isGpsValid && isShiftTimeValid;

  // Realtime Active Session Stopwatch
  const [activeElapsedSec, setActiveElapsedSec] = useState<number>(0);
  useEffect(() => {
    if (!activeRecord) {
      setActiveElapsedSec(0);
      return;
    }
    const updateElapsed = () => {
      const startMs = new Date(activeRecord.checkInTime).getTime();
      const nowMs = Date.now();
      const sec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setActiveElapsedSec(sec);
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [activeRecord]);

  const formatElapsed = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleRecheckWifiAndConfig = async () => {
    setIsRecheckingNetwork(true);
    setStatusMessage(null);
    try {
      await runWithHudLoading('Đang kiểm tra kết nối...', async () => {
        await refreshData();
      });
      if (storeConfig?.requireGps) {
        checkEmployeeGps();
      }
      setStatusMessage({
        type: 'success',
        text: 'Đã làm mới trạng thái kết nối.',
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Không thể kiểm tra kết nối lúc này.',
      });
    } finally {
      setIsRecheckingNetwork(false);
    }
  };

  const todayStr = useMemo(() => {
    const now = currentTime;
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [currentTime]);

  const myTodaySessions = useMemo(() => {
    if (!currentUser) return [];
    return attendance.filter((r) => r.userId === currentUser.id && r.date === todayStr);
  }, [attendance, currentUser, todayStr]);

  const hourlyRate = currentUser?.hourlyRate || 28000;
  const activeElapsedMinutes = Math.floor(activeElapsedSec / 60);

  const completedMinutesToday = useMemo(() => {
    return myTodaySessions
      .filter((r) => r.status !== 'working')
      .reduce((sum, r) => sum + (Number(r.totalMinutes) || 0), 0);
  }, [myTodaySessions]);

  const totalMinutesTodayLive = completedMinutesToday + (activeRecord ? activeElapsedMinutes : 0);
  const liveEstimatedPayToday = Math.round((totalMinutesTodayLive / 60) * hourlyRate);

  const handleCheckIn = async () => {
    if (processingRef.current || isProcessing) return;
    if (!currentUser) return;

    if (!isWifiValid) {
      setStatusMessage({
        type: 'error',
        text: `Chưa kết nối đúng WiFi "${storeConfig?.wifiSsid}". Vui lòng kết nối lại.`,
      });
      return;
    }

    if (!isGpsValid) {
      setStatusMessage({
        type: 'error',
        text: gpsError || `Bạn đang ở ngoài bán kính cửa hàng (${storeConfig?.storeGps?.radiusMeters || 80}m).`,
      });
      return;
    }

    if (!isShiftTimeValid) {
      setStatusMessage({
        type: 'error',
        text: 'Hiện tại đang ngoài khung giờ ca làm việc.',
      });
      return;
    }

    if (activeRecord) {
      setStatusMessage({
        type: 'error',
        text: 'Bạn đang trong ca, vui lòng Check-out trước khi Check-in lại.',
      });
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      await checkIn({
        wifiSsid: storeConfig?.wifiSsid,
        gps: userGps || undefined,
        note: shiftNote.trim() || undefined,
      });

      setShiftNote('');
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      setStatusMessage({
        type: 'success',
        text: 'Check-in thành công! Chúc bạn làm việc tốt.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Check-in không thành công. Vui lòng thử lại.',
      });
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (processingRef.current || isProcessing) return;
    if (!currentUser) return;

    if (!isWifiValid) {
      setStatusMessage({
        type: 'error',
        text: `Chưa kết nối đúng WiFi "${storeConfig?.wifiSsid}". Vui lòng kết nối lại.`,
      });
      return;
    }

    if (!isGpsValid) {
      setStatusMessage({
        type: 'error',
        text: gpsError || `Bạn đang ở ngoài bán kính cửa hàng (${storeConfig?.storeGps?.radiusMeters || 80}m).`,
      });
      return;
    }

    if (!isShiftTimeValid) {
      setStatusMessage({
        type: 'error',
        text: 'Hiện tại đang ngoài khung giờ ca làm việc.',
      });
      return;
    }

    if (!activeRecord) {
      setStatusMessage({
        type: 'error',
        text: 'Bạn chưa vào ca để Check-out.',
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
        text: `Check-out thành công! Tổng thời gian: ${(record.totalMinutes / 60).toFixed(1)}h.`,
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
      {/* Digital Clock Header & Status */}
      <AttendanceHeader
        currentTime={currentTime}
        shiftStatus={shiftStatus}
        storeConfig={storeConfig}
        isWifiValid={isWifiValid}
        isRecheckingNetwork={isRecheckingNetwork}
        handleRecheckWifiAndConfig={handleRecheckWifiAndConfig}
        isGpsValid={isGpsValid}
        userGps={userGps}
        gpsError={gpsError}
        checkEmployeeGps={checkEmployeeGps}
      />

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

      {/* Main Action Terminal Card */}
      <TimeclockActionCard
        currentUser={currentUser}
        activeRecord={activeRecord}
        activeElapsedSec={activeElapsedSec}
        liveEstimatedPayToday={liveEstimatedPayToday}
        shiftNote={shiftNote}
        onShiftNoteChange={setShiftNote}
        isProcessing={isProcessing}
        canCheckInOrOut={canCheckInOrOut}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        isWifiValid={isWifiValid}
        isGpsValid={isGpsValid}
        isShiftTimeValid={isShiftTimeValid}
        storeConfig={storeConfig}
        gpsError={gpsError}
        userGps={userGps}
        formatElapsed={formatElapsed}
      />

      {/* Today's Consolidated Shifts Summary with Per-Turn Breakdown */}
      {currentUser?.role !== 'admin' && (
        <ShiftTurnsTable
          myTodaySessions={myTodaySessions}
          activeRecord={activeRecord}
          activeElapsedMinutes={activeElapsedMinutes}
          hourlyRate={hourlyRate}
          totalMinutesTodayLive={totalMinutesTodayLive}
          liveEstimatedPayToday={liveEstimatedPayToday}
        />
      )}
    </div>
  );
};
