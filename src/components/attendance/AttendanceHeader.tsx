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
  return (
    <>
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

      {/* Shift Window & Store WiFi Status Card */}
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
                  Nhận ca: <span className="text-emerald-400">{shiftStatus.checkInRange}</span> · Hết ca:{' '}
                  <span className="text-indigo-400">{shiftStatus.checkOutRange}</span>
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

        {/* Store WiFi Row */}
        <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <Wifi className={`w-4 h-4 shrink-0 ${isWifiValid ? 'text-emerald-400' : 'text-rose-400'}`} />
            <div className="min-w-0">
              <span className="text-zinc-400 truncate block">
                WiFi: <strong className="text-zinc-200">{storeConfig?.wifiSsid}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isWifiValid ? (
              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã kết nối
              </span>
            ) : (
              <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Chưa kết nối
              </span>
            )}
            <button
              type="button"
              onClick={handleRecheckWifiAndConfig}
              disabled={isRecheckingNetwork}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              title="Kiểm tra lại kết nối"
            >
              <RefreshCw className={`w-3 h-3 text-indigo-400 ${isRecheckingNetwork ? 'animate-spin' : ''}`} />
              <span>Kiểm tra lại</span>
            </button>
          </div>
        </div>

        {/* GPS Row if required */}
        {storeConfig?.requireGps && (
          <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className={`w-4 h-4 shrink-0 ${isGpsValid ? 'text-emerald-400' : 'text-rose-400'}`} />
              <div className="min-w-0">
                <span className="text-zinc-400 block truncate">
                  Vị trí GPS: {userGps?.distance !== undefined ? (
                    <strong className={isGpsValid ? 'text-emerald-300' : 'text-rose-300'}>
                      Cách quán {userGps.distance}m (Cho phép {storeConfig.storeGps?.radiusMeters || 80}m)
                    </strong>
                  ) : (
                    <span className="text-zinc-500">Đang xác định vị trí...</span>
                  )}
                </span>
                {gpsError && <span className="text-[10px] text-rose-400 block">{gpsError}</span>}
              </div>
            </div>

            <button
              type="button"
              onClick={checkEmployeeGps}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-semibold text-[11px] shrink-0 cursor-pointer"
            >
              Định vị lại
            </button>
          </div>
        )}
      </div>
    </>
  );
};
