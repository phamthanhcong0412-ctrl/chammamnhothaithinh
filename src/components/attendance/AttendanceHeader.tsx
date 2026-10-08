/**
 * COMPONENT: AttendanceHeader
 * Hiển thị đồng hồ số lớn, trạng thái ca làm việc hiện tại, và thẻ trạng thái WiFi/GPS (SRP)
 */

import React from 'react';
import {
  Wifi,
  Lock,
  CheckCircle2,
  RefreshCw,
  Sun,
  Sunset,
  MapPin,
} from 'lucide-react';
import type { StoreConfig } from '../../types/index.ts';

interface AttendanceHeaderProps {
  currentTime: Date;
  shiftStatus: {
    inShiftWindow: boolean;
    isAfternoon: boolean;
    activeShiftTitle: string;
    badgeText: string;
    checkInRange?: string;
    checkOutRange?: string;
  };
  storeConfig: StoreConfig | null;
  isWifiValid: boolean;
  isRecheckingNetwork: boolean;
  handleRecheckWifiAndConfig: () => Promise<void>;
  isGpsValid: boolean;
  userGps: { lat: number; lng: number; accuracy?: number; distance?: number } | null;
  gpsError: string | null;
  checkEmployeeGps: () => void;
}

export const AttendanceHeader: React.FC<AttendanceHeaderProps> = ({
  currentTime,
  shiftStatus,
  storeConfig,
  isWifiValid,
  isRecheckingNetwork,
  handleRecheckWifiAndConfig,
  isGpsValid,
  userGps,
  gpsError,
  checkEmployeeGps,
}) => {
  const isFullyVerified = isWifiValid && isGpsValid;

  return (
    <>
      {/* Digital Clock Header with separated seconds and refined typography */}
      <div className="text-center pt-2 pb-2">
        <div className="inline-flex items-baseline justify-center gap-1 font-mono tabular-nums text-zinc-100 select-none">
          <span className="text-5xl sm:text-6xl font-black tracking-tight drop-shadow-sm">
            {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-emerald-400/80">
            :{String(currentTime.getSeconds()).padStart(2, '0')}
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs text-zinc-300 font-medium capitalize">
            {currentTime.toLocaleDateString('vi-VN', {
              weekday: 'long',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
          <span className="w-1 h-1 rounded-full bg-zinc-600" />
          <span className="text-[11px] text-zinc-400">
            {storeConfig?.storeName || 'Cháo Mầm Nhỏ'}
          </span>
        </div>
      </div>

      {/* Shift Window & Dual-Lock Status Card */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-3 shadow-sm">
        {/* Active Shift Window Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                shiftStatus.inShiftWindow
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
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
                  Nhận ca: <span className="text-emerald-400 font-semibold">{shiftStatus.checkInRange}</span> · Hết ca:{' '}
                  <span className="text-amber-300 font-semibold">{shiftStatus.checkOutRange}</span>
                </div>
              ) : (
                <div className="text-[11px] text-rose-400 font-medium truncate">
                  Ngoài giờ ca làm việc
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

        {/* Dual-Lock Conditions Container */}
        <div className="pt-2.5 border-t border-zinc-800/80 space-y-2">
          {/* Store WiFi Row */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                isWifiValid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
              }`}>
                <Wifi className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-zinc-400 truncate block text-[11px]">
                  WiFi: <strong className="text-zinc-200">{storeConfig?.wifiSsid}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isWifiValid ? (
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Đúng WiFi
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
                className="px-2.5 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 active:scale-95 border border-zinc-700/80 text-zinc-200 font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                title="Kiểm tra lại kết nối WiFi"
              >
                <RefreshCw className={`w-3 h-3 text-zinc-300 ${isRecheckingNetwork ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Kiểm tra lại</span>
              </button>
            </div>
          </div>

          {/* GPS Row if required */}
          {storeConfig?.requireGps && (
            <div className="flex items-center justify-between gap-2 text-xs pt-1.5 border-t border-zinc-800/50">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  isGpsValid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                }`}>
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-zinc-400 block truncate text-[11px]">
                    Vị trí: {userGps?.distance !== undefined ? (
                      <strong className={isGpsValid ? 'text-emerald-300' : 'text-rose-300'}>
                        Cách {userGps.distance}m (Cho phép {storeConfig.storeGps?.radiusMeters || 80}m)
                      </strong>
                    ) : (
                      <span className="text-zinc-500">Đang dò vị trí...</span>
                    )}
                  </span>
                  {gpsError && <span className="text-[10px] text-rose-400 block truncate">{gpsError}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isGpsValid ? (
                  <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đúng vị trí
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Ngoài quán
                  </span>
                )}
                <button
                  type="button"
                  onClick={checkEmployeeGps}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 active:scale-95 border border-zinc-700/80 text-zinc-200 font-semibold text-[11px] shrink-0 transition-all cursor-pointer"
                >
                  Định vị lại
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
