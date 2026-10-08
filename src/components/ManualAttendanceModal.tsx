import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  Trash2,
  Edit3,
  UserCheck,
  Sun,
  Sunset,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { evaluateShiftTiming } from '../services/api.ts';
import type { AttendanceRecord } from '../types/index.ts';

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordToEdit?: AttendanceRecord | null;
  preselectedUserId?: string;
}

export const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({
  isOpen,
  onClose,
  recordToEdit,
  preselectedUserId,
}) => {
  const { users, currentUser, storeConfig, manualAttendance, deleteAttendance } = useApp();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [date, setDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('Nhân viên gặp sự cố thiết bị / mạng tại quán');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setConfirmDelete(false);
    setErrorMessage(null);

    if (recordToEdit) {
      setSelectedUserId(recordToEdit.userId);
      setDate(recordToEdit.date);
      const inDate = new Date(recordToEdit.checkInTime);
      setCheckInTime(formatToInputDateTime(inDate));
      if (recordToEdit.checkOutTime) {
        const outDate = new Date(recordToEdit.checkOutTime);
        setCheckOutTime(formatToInputDateTime(outDate));
      } else {
        setCheckOutTime('');
      }
      setNote(recordToEdit.note || '');
      setReason(recordToEdit.adjustedReason || 'Điều chỉnh công bởi Quản lý');
    } else {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;
      setDate(todayStr);

      const isAfternoon = now.getHours() >= 14;
      const mShift = storeConfig?.shifts?.find((s) => s.id === 'shift_morning');
      const aShift = storeConfig?.shifts?.find((s) => s.id === 'shift_afternoon');

      const startStr = isAfternoon ? aShift?.startTime || '15:30' : mShift?.startTime || '06:00';
      const endStr = isAfternoon ? aShift?.endTime || '20:00' : mShift?.endTime || '12:00';

      setCheckInTime(`${todayStr}T${startStr}`);
      setCheckOutTime(`${todayStr}T${endStr}`);

      const defaultUser =
        (preselectedUserId ? users.find((u) => u.id === preselectedUserId) : null) ||
        users.find((u) => u.role === 'staff') ||
        users[0];
      setSelectedUserId(defaultUser?.id || '');
      setNote('');
      setReason('Nhân viên gặp sự cố thiết bị / mạng tại quán');
    }
  }, [isOpen, recordToEdit, preselectedUserId, users, storeConfig]);

  function formatToInputDateTime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const applyShiftPreset = (preset: 'morning_full' | 'afternoon_full' | 'morning_working' | 'afternoon_working') => {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const mShift = storeConfig?.shifts?.find((s) => s.id === 'shift_morning');
    const aShift = storeConfig?.shifts?.find((s) => s.id === 'shift_afternoon');
    const mStart = mShift?.startTime || '06:00';
    const mEnd = mShift?.endTime || '12:00';
    const aStart = aShift?.startTime || '15:30';
    const aEnd = aShift?.endTime || '20:00';

    if (preset === 'morning_full') {
      setCheckInTime(`${targetDate}T${mStart}`);
      setCheckOutTime(`${targetDate}T${mEnd}`);
    } else if (preset === 'afternoon_full') {
      setCheckInTime(`${targetDate}T${aStart}`);
      setCheckOutTime(`${targetDate}T${aEnd}`);
    } else if (preset === 'morning_working') {
      setCheckInTime(`${targetDate}T${mStart}`);
      setCheckOutTime('');
    } else if (preset === 'afternoon_working') {
      setCheckInTime(`${targetDate}T${aStart}`);
      setCheckOutTime('');
    }
  };

  // Live preview of calculated shift stats
  const shiftPreview = useMemo(() => {
    if (!checkInTime) return null;
    const inMs = new Date(checkInTime).getTime();
    const outMs = checkOutTime ? new Date(checkOutTime).getTime() : null;
    if (Number.isNaN(inMs)) return null;

    const inIso = new Date(checkInTime).toISOString();
    const outIso = outMs && !Number.isNaN(outMs) ? new Date(checkOutTime).toISOString() : null;
    const timing = evaluateShiftTiming(inIso, outIso, storeConfig);
    const totalMinutes = outMs && outMs > inMs ? Math.round((outMs - inMs) / 60000) : 0;
    const totalHours = (totalMinutes / 60).toFixed(2);
    const targetUser = users.find((u) => u.id === selectedUserId);
    const hourlyRate = Number(targetUser?.hourlyRate) || 28000;
    const estimatedPay = Math.round((totalMinutes / 60) * hourlyRate);

    return {
      shiftName: timing.shiftName,
      isLate: timing.isLate,
      lateMinutes: timing.lateMinutes,
      isEarlyLeave: timing.isEarlyLeave,
      earlyLeaveMinutes: timing.earlyLeaveMinutes,
      totalMinutes,
      totalHours,
      estimatedPay,
      isWorking: !outIso,
    };
  }, [checkInTime, checkOutTime, selectedUserId, users, storeConfig]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedUserId) {
      setErrorMessage('Vui lòng chọn nhân viên.');
      return;
    }
    if (!checkInTime) {
      setErrorMessage('Vui lòng nhập giờ check-in.');
      return;
    }

    const inIso = new Date(checkInTime).toISOString();
    const outIso = checkOutTime ? new Date(checkOutTime).toISOString() : null;

    if (outIso && new Date(outIso).getTime() < new Date(inIso).getTime()) {
      setErrorMessage('Giờ Check-out không được sớm hơn giờ Check-in.');
      return;
    }

    setIsSubmitting(true);
    try {
      await manualAttendance({
        id: recordToEdit?.id,
        userId: selectedUserId,
        date: date || checkInTime.split('T')[0],
        checkInTime: inIso,
        checkOutTime: outIso,
        note,
        adjustedBy: currentUser?.name || 'Quản lý',
        adjustedReason: reason,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể lưu bản ghi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!recordToEdit?.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteAttendance(recordToEdit.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi xoá');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              {recordToEdit ? <Edit3 className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">
                {recordToEdit ? 'Sửa Bản Ghi Chấm Công' : 'Chấm Công Hộ'}
              </h3>
              <p className="text-[11px] text-zinc-400">Tự động tính giờ làm và lương ca</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Employee & Date row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Nhân viên
              </label>
              <select
                value={selectedUserId}
                disabled={!!recordToEdit}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-60"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Ngày làm việc
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setDate(nextDate);
                    if (checkInTime.includes('T')) {
                      setCheckInTime(`${nextDate}T${checkInTime.split('T')[1]}`);
                    }
                    if (checkOutTime && checkOutTime.includes('T')) {
                      setCheckOutTime(`${nextDate}T${checkOutTime.split('T')[1]}`);
                    }
                  }}
                  className="w-full pl-8 pr-2.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Quick 1-Click Shift Presets */}
          <div>
            <span className="block text-[11px] font-semibold text-zinc-400 mb-1.5 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Chọn nhanh khung giờ ca:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => applyShiftPreset('morning_full')}
                className="px-2.5 py-2 rounded-xl bg-zinc-950 hover:bg-indigo-500/15 border border-zinc-800 hover:border-indigo-500/40 text-[11px] font-semibold text-zinc-200 hover:text-indigo-300 flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Sun className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Đủ Ca Sáng</span>
              </button>
              <button
                type="button"
                onClick={() => applyShiftPreset('afternoon_full')}
                className="px-2.5 py-2 rounded-xl bg-zinc-950 hover:bg-indigo-500/15 border border-zinc-800 hover:border-indigo-500/40 text-[11px] font-semibold text-zinc-200 hover:text-indigo-300 flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Sunset className="w-3 h-3 text-orange-400 shrink-0" />
                <span>Đủ Ca Chiều</span>
              </button>
              <button
                type="button"
                onClick={() => applyShiftPreset('morning_working')}
                className="px-2.5 py-2 rounded-xl bg-zinc-950 hover:bg-emerald-500/15 border border-zinc-800 hover:border-emerald-500/40 text-[11px] font-semibold text-zinc-200 hover:text-emerald-300 flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <span>Vào Ca Sáng</span>
              </button>
              <button
                type="button"
                onClick={() => applyShiftPreset('afternoon_working')}
                className="px-2.5 py-2 rounded-xl bg-zinc-950 hover:bg-emerald-500/15 border border-zinc-800 hover:border-emerald-500/40 text-[11px] font-semibold text-zinc-200 hover:text-emerald-300 flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <span>Vào Ca Chiều</span>
              </button>
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Giờ vào ca
              </label>
              <input
                type="datetime-local"
                required
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> Giờ ra ca
                </label>
                {checkOutTime && (
                  <button
                    type="button"
                    onClick={() => setCheckOutTime('')}
                    className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                  >
                    Để trống nếu đang làm
                  </button>
                )}
              </div>
              <input
                type="datetime-local"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Live Shift Calculation Preview */}
          {shiftPreview && (
            <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-zinc-800/90 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="font-bold text-zinc-200">{shiftPreview.shiftName}</div>
                <div className="text-[11px] flex items-center gap-2">
                  {shiftPreview.isLate ? (
                    <span className="text-amber-400 font-semibold">
                      Đi muộn {shiftPreview.lateMinutes} phút
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-medium">Vào ca đúng giờ</span>
                  )}
                  {shiftPreview.isEarlyLeave && (
                    <span className="text-rose-400 font-semibold">
                      · Về sớm {shiftPreview.earlyLeaveMinutes} phút
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right font-mono tabular-nums">
                {shiftPreview.isWorking ? (
                  <span className="text-emerald-400 font-bold">Đang trong ca làm</span>
                ) : (
                  <>
                    <div className="font-bold text-indigo-400">
                      {shiftPreview.totalHours}h ({shiftPreview.totalMinutes}p)
                    </div>
                    <div className="text-[11px] text-emerald-400 font-semibold">
                      +{shiftPreview.estimatedPay.toLocaleString('vi-VN')}đ
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Reason & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Lý do điều chỉnh
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="Nhân viên gặp sự cố thiết bị / mạng tại quán">
                  Sự cố thiết bị / mạng tại quán
                </option>
                <option value="Nhân viên quên bấm Check-in / Check-out">
                  Quên chấm công vào/ra
                </option>
                <option value="Tăng ca / đổi ca theo phân công Quản lý">
                  Tăng ca / đổi ca theo phân công
                </option>
                <option value="Điều chỉnh lại giờ công thực tế">
                  Điều chỉnh lại giờ công thực tế
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Ghi chú thêm
              </label>
              <input
                type="text"
                placeholder="Ghi chú (tùy chọn)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {recordToEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  confirmDelete
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {confirmDelete ? 'Xác nhận xóa?' : 'Xóa ca này'}
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                {isSubmitting ? 'Đang lưu...' : recordToEdit ? 'Lưu Thay Đổi' : 'Xác Nhận Chấm'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
