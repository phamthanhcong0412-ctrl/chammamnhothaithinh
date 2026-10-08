import React, { useState } from 'react';
import { Sun, Sunset, Search, Edit, Trash2 } from 'lucide-react';
import type { AttendanceRecord } from '../../types/index.ts';

export interface AttendanceLogTableProps {
  filteredLogRecords: AttendanceRecord[];
  totalAttendanceCount: number;
  logScope: 'today' | 'all';
  onLogScopeChange: (scope: 'today' | 'all') => void;
  shiftFilter: 'all' | 'shift_morning' | 'shift_afternoon';
  onShiftFilterChange: (shift: 'all' | 'shift_morning' | 'shift_afternoon') => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  formatDuration: (startTimeIso: string) => string;
  formatTime: (iso: string) => string;
  onEditRecord: (record: AttendanceRecord) => void;
  onDeleteRecord: (recordId: string) => void;
}

export const AttendanceLogTable: React.FC<AttendanceLogTableProps> = ({
  filteredLogRecords,
  totalAttendanceCount,
  logScope,
  onLogScopeChange,
  shiftFilter,
  onShiftFilterChange,
  searchQuery,
  onSearchQueryChange,
  formatDuration,
  formatTime,
  onEditRecord,
  onDeleteRecord,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 overflow-hidden">
      <div className="p-4 border-b border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-zinc-100">
            Nhật Ký Chấm Công ({filteredLogRecords.length})
          </h3>
          <div className="flex items-center gap-1 p-0.5 bg-zinc-950 border border-zinc-800 rounded-xl">
            <button
              onClick={() => onLogScopeChange('today')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                logScope === 'today' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => onLogScopeChange('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                logScope === 'all' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tất cả ({totalAttendanceCount})
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Shift filter */}
          <div className="flex items-center gap-1 p-0.5 bg-zinc-950 border border-zinc-800 rounded-xl">
            <button
              onClick={() => onShiftFilterChange('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                shiftFilter === 'all' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Mọi ca
            </button>
            <button
              onClick={() => onShiftFilterChange('shift_morning')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                shiftFilter === 'shift_morning' ? 'bg-zinc-800 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sun className="w-3 h-3" /> Ca Sáng
            </button>
            <button
              onClick={() => onShiftFilterChange('shift_afternoon')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                shiftFilter === 'shift_afternoon' ? 'bg-zinc-800 text-orange-300' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sunset className="w-3 h-3" /> Ca Chiều
            </button>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Tìm tên, mã NV..."
              className="pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 w-44"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800/80 text-zinc-400 text-[11px] bg-zinc-950/40 whitespace-nowrap">
              <th className="py-3 px-4 font-semibold">Nhân viên</th>
              <th className="py-3 px-3 font-semibold">Ca / Ngày</th>
              <th className="py-3 px-3 font-semibold">Giờ vào → Ra</th>
              <th className="py-3 px-3 font-semibold">Thời lượng</th>
              <th className="py-3 px-3 font-semibold">Lương ca</th>
              <th className="py-3 px-3 font-semibold">Ghi chú & Hình thức</th>
              <th className="py-3 px-4 text-right font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {filteredLogRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-500">
                  Chưa có lượt chấm công nào.
                </td>
              </tr>
            ) : (
              filteredLogRecords.map((record) => {
                const isAfternoon =
                  record.shiftId === 'shift_afternoon' ||
                  new Date(record.checkInTime).getHours() >= 14;
                const isConfirming = confirmDeleteId === record.id;

                return (
                  <tr key={record.id} className="hover:bg-zinc-800/30 transition-colors whitespace-nowrap">
                    <td className="py-3 px-4">
                      <span className="font-bold text-zinc-100">{record.userName}</span>
                      <span className="text-[11px] text-zinc-500 font-mono ml-1.5">
                        ({record.employeeCode})
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-semibold text-zinc-200">
                        {isAfternoon ? 'Ca Chiều' : 'Ca Sáng'}
                      </span>
                      <span className="text-zinc-500 font-mono ml-1.5 text-[11px]">
                        · {record.date.slice(5)}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono tabular-nums text-zinc-200">
                      <div>
                        {formatTime(record.checkInTime)} →{' '}
                        {record.checkOutTime ? (
                          formatTime(record.checkOutTime)
                        ) : (
                          <span className="text-emerald-400 font-sans font-semibold">Đang làm</span>
                        )}
                      </div>
                      {Array.isArray(record.turns) && record.turns.length > 0 && record.status !== 'working' && (
                        <div className="mt-1 space-y-0.5">
                          {record.turns.map((t, i) => (
                            <div key={`${t.checkInTime}_${i}`} className="text-[10px] text-zinc-400">
                              <span className="text-indigo-400 font-semibold">Lần {i + 1}:</span>{' '}
                              {formatTime(t.checkInTime)}→{t.checkOutTime ? formatTime(t.checkOutTime) : '--'}{' '}
                              <span className="text-zinc-300">({t.minutes}p)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono tabular-nums">
                      {record.status === 'working' ? (
                        <span className="text-emerald-400 font-bold">
                          {formatDuration(record.checkInTime)}
                        </span>
                      ) : (
                        <div>
                          <span className="font-bold text-indigo-400">
                            {(record.totalMinutes / 60).toFixed(1)}h{' '}
                            <span className="text-[11px] font-normal text-zinc-500">
                              ({record.totalMinutes}p)
                            </span>
                          </span>
                          {Array.isArray(record.turns) && record.turns.length > 1 && (
                            <div className="text-[10px] text-emerald-400/90 mt-0.5">
                              {record.turns.map((t) => `${t.minutes}p`).join(' + ')} = {record.totalMinutes}p
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono tabular-nums text-emerald-400 font-semibold">
                      {record.estimatedShiftPay
                        ? `${record.estimatedShiftPay.toLocaleString('vi-VN')}đ`
                        : '--'}
                    </td>

                    <td className="py-3 px-3 text-zinc-400">
                      {record.checkInMethod === 'manual_admin' || record.adjustedBy ? (
                        <span className="text-amber-300 font-medium">Chấm hộ</span>
                      ) : (
                        <span>WiFi quán</span>
                      )}
                      {record.note && (
                        <span
                          className="text-zinc-500 ml-1.5 max-w-[160px] inline-block truncate align-bottom"
                          title={record.note}
                        >
                          · {record.note}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditRecord(record)}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                          title="Sửa ca"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (isConfirming) {
                              onDeleteRecord(record.id);
                              setConfirmDeleteId(null);
                            } else {
                              setConfirmDeleteId(record.id);
                              setTimeout(
                                () => setConfirmDeleteId((prev) => (prev === record.id ? null : prev)),
                                3000
                              );
                            }
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                            isConfirming
                              ? 'bg-rose-600 text-white'
                              : 'hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400'
                          }`}
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isConfirming && <span>Xóa?</span>}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
