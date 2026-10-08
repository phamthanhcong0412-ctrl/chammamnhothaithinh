/**
 * COMPONENT: ShiftTurnsTable
 * Hiển thị bảng thống kê ca làm & chi tiết từng lần chấm công trong ngày của nhân viên (SRP)
 */

import React from 'react';
import { Layers } from 'lucide-react';
import type { AttendanceRecord } from '../../types/index.ts';
import { deduplicateAndMergeOverlappingTurns } from '../../domain/index.ts';

interface ShiftTurnsTableProps {
  myTodaySessions: AttendanceRecord[];
  activeRecord: AttendanceRecord | null;
  activeElapsedMinutes: number;
  hourlyRate: number;
  totalMinutesTodayLive: number;
  liveEstimatedPayToday: number;
}

export const ShiftTurnsTable: React.FC<ShiftTurnsTableProps> = ({
  myTodaySessions,
  activeRecord,
  activeElapsedMinutes,
  hourlyRate,
  totalMinutesTodayLive,
  liveEstimatedPayToday,
}) => {
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
      r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning');
    const sLabel = sId === 'shift_afternoon' ? 'Ca Chiều' : 'Ca Sáng';
    const group = shiftGroups.get(sId) || {
      shiftId: sId,
      shiftLabel: sLabel,
      turns: [],
    };

    if (r.status === 'working') {
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

  const fmtHm = (iso: string) =>
    new Date(iso).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-800/80 flex-wrap">
        <span className="text-xs font-bold text-zinc-200 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-amber-400" /> Ca Làm & Chi Tiết Từng Lần Chấm Hôm Nay
        </span>
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <span className="text-zinc-400">
            Tổng thực làm: <strong className="text-zinc-100">{(totalMinutesTodayLive / 60).toFixed(1)}h</strong> ({totalMinutesTodayLive}p)
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
          Array.from(shiftGroups.values()).map((group) => {
            const shiftTotalMins = group.turns.reduce((sum, t) => sum + (Number(t.minutes) || 0), 0);
            const shiftPay = Math.round((shiftTotalMins / 60) * hourlyRate);
            const firstIn = group.turns[0]?.checkInTime;
            const lastTurn = group.turns[group.turns.length - 1];
            const hasWorkingTurn = group.turns.some((t) => t.isWorking);

            return (
              <div
                key={group.shiftId}
                className="p-3.5 rounded-xl bg-zinc-950/90 border border-zinc-800/80 space-y-2.5 text-xs"
              >
                {/* Shift Header Summary */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800/70">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="font-bold text-zinc-100">{group.shiftLabel}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
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
                    <span className="font-bold text-zinc-100">
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
          })
        )}
      </div>
    </div>
  );
};
