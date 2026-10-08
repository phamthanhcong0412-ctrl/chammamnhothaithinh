import React from 'react';
import { Activity, Clock, CheckCircle2, DollarSign } from 'lucide-react';

export interface KpiMetricsGridProps {
  workingCount: number;
  totalStaffCount: number;
  totalHoursToday: string;
  totalUniqueShiftsToday: number;
  completedShiftsCount: number;
  absentCount: number;
  todayEstimatedPay: number;
}

export const KpiMetricsGrid: React.FC<KpiMetricsGridProps> = ({
  workingCount,
  totalStaffCount,
  totalHoursToday,
  totalUniqueShiftsToday,
  completedShiftsCount,
  absentCount,
  todayEstimatedPay,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
        <div>
          <span className="text-xs text-zinc-400 font-medium">Nhân sự trong ca</span>
          <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums mt-1">
            {workingCount} <span className="text-xs font-normal text-zinc-500">/ {totalStaffCount} NV</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <Activity className="w-5 h-5" />
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
        <div>
          <span className="text-xs text-zinc-400 font-medium">Tổng giờ hôm nay</span>
          <div className="text-2xl font-black text-indigo-400 font-mono tabular-nums mt-1">
            {totalHoursToday}h <span className="text-xs font-normal text-zinc-500">({totalUniqueShiftsToday} ca)</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5" />
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
        <div>
          <span className="text-xs text-zinc-400 font-medium">Đã xong ca hôm nay</span>
          <div className="text-2xl font-black text-teal-400 font-mono tabular-nums mt-1">
            {completedShiftsCount} ca{' '}
            <span className="text-xs font-sans font-normal text-zinc-500">
              (Chưa vào: {absentCount} NV)
            </span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
        <div>
          <span className="text-xs text-zinc-400 font-medium">Quỹ lương hôm nay</span>
          <div className="text-2xl font-black text-amber-400 font-mono tabular-nums mt-1">
            {todayEstimatedPay.toLocaleString('vi-VN')}đ
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
          <DollarSign className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
