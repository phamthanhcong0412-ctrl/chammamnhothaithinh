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
          <h3 className="text-base font-bold text-amber-100">Tài khoản Quản lý</h3>
          <p className="text-xs text-amber-200/80 max-w-md mx-auto leading-relaxed">
            Quản lý không cần chấm công cá nhân. Chuyển sang mục <strong>Theo Dõi Trực Tiếp</strong> để xem ca làm việc và chấm công hộ nhân viên.
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
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              ĐANG TRONG CA
            </div>

            <div className="text-4xl sm:text-5xl font-mono font-black text-emerald-400 tracking-tight tabular-nums">
              {formatElapsed(activeElapsedSec)}
            </div>

            <div className="flex items-center justify-center gap-3 text-xs text-zinc-400">
              <span>
                Vào ca:{' '}
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
                Lương tạm tính: {liveEstimatedPayToday.toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 py-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800/90 border border-zinc-700/80 text-zinc-300 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Sẵn sàng vào ca
            </div>
            <h3 className="text-base font-bold text-zinc-100">
              Bắt Đầu Ca Làm Việc
            </h3>
            <p className="text-xs text-zinc-400">
              Chạm nút bên dưới để nhận ca. Giờ làm và tiền lương được tự động ghi nhận.
            </p>
          </div>
        )}
      </div>

      {/* Optional Shift Note Input (text-[16px] prevents iOS Safari auto-zoom) */}
      <div className="relative">
        <FileText className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={shiftNote}
          onChange={(e) => onShiftNoteChange(e.target.value)}
          placeholder={
            activeRecord
              ? 'Ghi chú kết thúc ca (nếu có)...'
              : 'Ghi chú nhận ca (nếu có)...'
          }
          className="w-full pl-10 pr-3.5 py-3 bg-zinc-950/80 border border-zinc-800 rounded-xl text-base sm:text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* Mobile-First Hero 1-Touch Action Button (Height 56px for comfortable thumb reach) */}
      <div>
        {!activeRecord ? (
          <button
            onClick={onCheckIn}
            disabled={isProcessing || !canCheckInOrOut}
            className={`w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] shadow-lg ${
              canCheckInOrOut
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25 cursor-pointer'
                : 'bg-zinc-800/50 border border-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
            }`}
          >
            <LogIn className="w-6 h-6" />
            <span>NHẬN CA LÀM VIỆC</span>
          </button>
        ) : (
          <button
            onClick={onCheckOut}
            disabled={isProcessing || !canCheckInOrOut}
            className={`w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] shadow-lg ${
              canCheckInOrOut
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25 cursor-pointer'
                : 'bg-zinc-800/50 border border-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
            }`}
          >
            <LogOut className="w-6 h-6" />
            <span>KẾT THÚC CA LÀM VIỆC</span>
          </button>
        )}
      </div>

      {!isWifiValid && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-semibold flex items-start gap-2">
          <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            Chưa kết nối đúng WiFi <strong>"{storeConfig?.wifiSsid}"</strong>. Vui lòng kết nối WiFi của quán và bấm <strong>"Kiểm tra lại"</strong>.
          </div>
        </div>
      )}

      {isWifiValid && !isGpsValid && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-semibold flex items-start gap-2">
          <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            {gpsError || `Vị trí của bạn đang cách quán ${userGps?.distance ?? '...'}m (tối đa cho phép ${storeConfig?.storeGps?.radiusMeters || 80}m).`}
          </div>
        </div>
      )}

      {isWifiValid && isGpsValid && !isShiftTimeValid && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-start gap-2">
          <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            Hiện tại đang ngoài khung giờ ca làm việc.
          </div>
        </div>
      )}
    </div>
  );
};
