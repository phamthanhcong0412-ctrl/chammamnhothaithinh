import React from 'react';
import {
  LogIn,
  LogOut,
  Clock,
  ShieldCheck,
  Lock,
  DollarSign,
  FileText,
} from 'lucide-react';
import type { AttendanceRecord, StoreConfig, User } from '../../types/index.ts';

export interface TimeclockActionCardProps {
  currentUser: User | null;
  activeRecord: AttendanceRecord | null;
  activeElapsedSec: number;
  liveEstimatedPayToday: number;
  shiftNote: string;
  onShiftNoteChange: (note: string) => void;
  isProcessing: boolean;
  canCheckInOrOut: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  isWifiValid: boolean;
  isGpsValid: boolean;
  isShiftTimeValid: boolean;
  storeConfig: StoreConfig | null;
  gpsError: string | null;
  userGps: { lat: number; lng: number; accuracy?: number; distance?: number } | null;
  formatElapsed: (sec: number) => string;
}

export const TimeclockActionCard: React.FC<TimeclockActionCardProps> = ({
  currentUser,
  activeRecord,
  activeElapsedSec,
  liveEstimatedPayToday,
  shiftNote,
  onShiftNoteChange,
  isProcessing,
  canCheckInOrOut,
  onCheckIn,
  onCheckOut,
  isWifiValid,
  isGpsValid,
  isShiftTimeValid,
  storeConfig,
  gpsError,
  userGps,
  formatElapsed,
}) => {
  if (currentUser?.role === 'admin') {
    return (
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
    );
  }

  return (
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
          onChange={(e) => onShiftNoteChange(e.target.value)}
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
          onClick={onCheckIn}
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
          onClick={onCheckOut}
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
  );
};
