import React from 'react';
import { LogOut, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import type { AttendanceRecord, User } from '../../types/index.ts';

export interface CompletedShiftGroup {
  key: string;
  record: AttendanceRecord;
  userId: string;
  userName: string;
  employeeCode: string;
  shiftId: string;
  shiftName: string;
  firstCheckInTime: string;
  lastCheckOutTime: string | null;
  totalMinutes: number;
  estimatedPay: number;
  turnsCount: number;
  turns: { checkInTime: string; checkOutTime: string | null; minutes: number; note?: string }[];
  isLate: boolean;
  isEarlyLeave: boolean;
}

export interface LiveOperationsBoardProps {
  workingRecords: AttendanceRecord[];
  todayRecords: AttendanceRecord[];
  completedShiftGroups: CompletedShiftGroup[];
  absentUsers: User[];
  users: User[];
  checkingOutUserId: string | null;
  onQuickCheckOut: (userId: string) => void;
  onOpenManualModal: (record?: AttendanceRecord | null, preselectedUserId?: string) => void;
  formatDuration: (startTimeIso: string) => string;
  formatTime: (iso: string) => string;
}

export const LiveOperationsBoard: React.FC<LiveOperationsBoardProps> = ({
  workingRecords,
  todayRecords,
  completedShiftGroups,
  absentUsers,
  users,
  checkingOutUserId,
  onQuickCheckOut,
  onOpenManualModal,
  formatDuration,
  formatTime,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Column 1: ĐANG LÀM */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-xs font-bold text-zinc-100">
              Đang làm việc ({workingRecords.length})
            </h3>
          </div>
          <span className="text-[11px] text-emerald-400 font-medium">Trực tiếp</span>
        </div>

        <div className="mt-3 space-y-2 flex-1">
          {workingRecords.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Chưa có nhân viên nào trong ca
            </div>
          ) : (
            workingRecords.map((r) => {
              const user = users.find((u) => u.id === r.userId);
              const rShiftId =
                r.shiftId || (new Date(r.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning');
              const isAfternoon = rShiftId === 'shift_afternoon';
              const prevSameShiftRecord = todayRecords.find(
                (prev) =>
                  prev.id !== r.id &&
                  prev.userId === r.userId &&
                  prev.status === 'completed' &&
                  (prev.shiftId ||
                    (new Date(prev.checkInTime).getHours() >= 14 ? 'shift_afternoon' : 'shift_morning')) ===
                    rShiftId
              );
              const prevTurns = prevSameShiftRecord
                ? Array.isArray(prevSameShiftRecord.turns) && prevSameShiftRecord.turns.length > 0
                  ? prevSameShiftRecord.turns
                  : [
                      {
                        checkInTime: prevSameShiftRecord.checkInTime,
                        checkOutTime: prevSameShiftRecord.checkOutTime || null,
                        minutes: Number(prevSameShiftRecord.totalMinutes) || 0,
                      },
                    ]
                : [];

              return (
                <div
                  key={r.id}
                  className="p-3 rounded-xl bg-zinc-950/90 border border-emerald-500/25 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={
                          user?.avatar ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(r.userName)}`
                        }
                        alt={r.userName}
                        className="w-8 h-8 rounded-xl object-cover bg-zinc-800 border border-zinc-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-zinc-100 truncate">{r.userName}</span>
                          {prevTurns.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-mono">
                              Lần {prevTurns.length + 1}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
                          <span>{isAfternoon ? 'Ca Chiều' : 'Ca Sáng'}</span>
                          <span>·</span>
                          <span>Vào {formatTime(r.checkInTime)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                          {formatDuration(r.checkInTime)}
                        </div>
                      </div>
                      <button
                        onClick={() => onQuickCheckOut(r.userId)}
                        disabled={checkingOutUserId === r.userId}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        title="Chốt ca"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>{checkingOutUserId === r.userId ? '...' : 'Chốt ca'}</span>
                      </button>
                    </div>
                  </div>

                  {prevTurns.length > 0 && (
                    <div className="pt-1.5 border-t border-zinc-900 space-y-1">
                      {prevTurns.map((pt, idx) => (
                        <div
                          key={`${pt.checkInTime}_${idx}`}
                          className="flex items-center justify-between text-[10px] font-mono text-zinc-400 bg-zinc-900/60 px-2 py-1 rounded"
                        >
                          <span>
                            <strong className="text-zinc-300">Lần {idx + 1}:</strong>{' '}
                            {formatTime(pt.checkInTime)} → {pt.checkOutTime ? formatTime(pt.checkOutTime) : '--'}
                          </span>
                          <span className="text-indigo-300 font-semibold">{pt.minutes} phút</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Column 2: ĐÃ XONG CA */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
            <h3 className="text-xs font-bold text-zinc-100">
              Đã xong ca ({completedShiftGroups.length})
            </h3>
          </div>
          <span className="text-[11px] text-zinc-500">Trong ngày</span>
        </div>

        <div className="mt-3 space-y-2 flex-1">
          {completedShiftGroups.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Chưa có ca hoàn thành hôm nay
            </div>
          ) : (
            completedShiftGroups.map((group) => {
              const user = users.find((u) => u.id === group.userId);
              return (
                <div
                  key={group.key}
                  className="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800/80 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={
                          user?.avatar ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(group.userName)}`
                        }
                        alt={group.userName}
                        className="w-8 h-8 rounded-xl object-cover bg-zinc-800 border border-zinc-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-zinc-100 truncate">{group.userName}</span>
                          <span className="text-[10px] text-indigo-400 font-medium shrink-0">
                            · {group.shiftName}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[10px] font-mono">
                            {group.turns.length} lần chấm
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {formatTime(group.firstCheckInTime)} →{' '}
                          {group.lastCheckOutTime ? formatTime(group.lastCheckOutTime) : '--'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <div className="text-xs font-bold text-indigo-400">
                        {(group.totalMinutes / 60).toFixed(1)}h{' '}
                        <span className="text-[10px] font-normal text-zinc-500">({group.totalMinutes}p)</span>
                      </div>
                      <div className="text-[10px] text-emerald-400 font-semibold">
                        +{group.estimatedPay.toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                  </div>

                  {/* Per-turn breakdown */}
                  <div className="pt-1.5 border-t border-zinc-900 space-y-1">
                    {group.turns.map((t, idx) => (
                      <div
                        key={`${t.checkInTime}_${idx}`}
                        className="flex items-center justify-between text-[10px] font-mono text-zinc-400 bg-zinc-900/60 px-2 py-1 rounded"
                      >
                        <span>
                          <strong className="text-zinc-300">Lần {idx + 1}:</strong>{' '}
                          {formatTime(t.checkInTime)} → {t.checkOutTime ? formatTime(t.checkOutTime) : '--'}
                        </span>
                        <span className="text-indigo-300 font-semibold">{t.minutes} phút</span>
                      </div>
                    ))}
                    {group.turns.length > 1 && (
                      <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                        <span>Tổng cộng:</span>
                        <strong>
                          {group.turns.map((t) => `${t.minutes}p`).join(' + ')} = {group.totalMinutes} phút
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Column 3: CHƯA VÀO CA */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-zinc-500" />
            <h3 className="text-xs font-bold text-zinc-100">
              Chưa vào ca ({absentUsers.length})
            </h3>
          </div>
          <span className="text-[11px] text-zinc-500">Hôm nay</span>
        </div>

        <div className="mt-3 space-y-2 flex-1">
          {absentUsers.length === 0 ? (
            <div className="py-8 text-center text-xs text-emerald-400 font-medium">
              Tất cả nhân sự đã vào ca
            </div>
          ) : (
            absentUsers.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username)}`}
                    alt={u.name}
                    className="w-8 h-8 rounded-xl object-cover bg-zinc-800 grayscale opacity-70 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-200 truncate">{u.name}</div>
                    <div className="text-[10px] text-zinc-500">
                      {u.position} · <span className="font-mono">{u.employeeCode}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onOpenManualModal(null, u.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-amber-500/20 border border-zinc-700/80 hover:border-amber-500/40 text-[11px] text-amber-300 font-semibold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Chấm hộ</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
