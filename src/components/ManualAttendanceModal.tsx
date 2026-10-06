import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, AlertCircle, CheckCircle, Trash2, Edit3, UserCheck } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import type { AttendanceRecord } from '../types/index.ts';

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordToEdit?: AttendanceRecord | null;
}

export const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({
  isOpen,
  onClose,
  recordToEdit,
}) => {
  const { users, currentUser, manualAttendance, deleteAttendance } = useApp();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [date, setDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('Nhân viên gặp sự cố thiết bị / mạng tại quán');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (recordToEdit) {
      setSelectedUserId(recordToEdit.userId);
      setDate(recordToEdit.date);
      // Format ISO to local datetime-local string
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

      const morning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
      const evening = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 30, 0);
      setCheckInTime(formatToInputDateTime(morning));
      setCheckOutTime(formatToInputDateTime(evening));

      const firstStaff = users.find((u) => u.role === 'staff') || users[0];
      setSelectedUserId(firstStaff?.id || '');
      setNote('Chấm công bổ sung');
      setReason('Nhân viên gặp sự cố thiết bị / mạng tại quán');
    }
  }, [isOpen, recordToEdit, users]);

  function formatToInputDateTime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

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
    if (confirm('Bạn có chắc chắn muốn xoá bản ghi chấm công này không?')) {
      try {
        await deleteAttendance(recordToEdit.id);
        onClose();
      } catch (err: any) {
        alert(err.message || 'Lỗi khi xoá');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              {recordToEdit ? <Edit3 className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">
                {recordToEdit ? 'Chỉnh Sửa Ca Chấm Công' : 'Chấm Công Hộ / Bổ Sung Ca Làm'}
              </h3>
              <p className="text-xs text-zinc-400">Quyền Quản Lý (Admin Action)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Employee select */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Nhân viên được chấm công
            </label>
            <select
              value={selectedUserId}
              disabled={!!recordToEdit}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-60"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.employeeCode} - {u.position})
                </option>
              ))}
            </select>
          </div>

          {/* Date picker */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Ngày làm việc
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Giờ Check-in
              </label>
              <input
                type="datetime-local"
                required
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" /> Giờ Check-out (Tùy chọn)
              </label>
              <input
                type="datetime-local"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">Để trống nếu nhân viên đang làm dở ca</span>
            </div>
          </div>

          {/* Reason for adjustment */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Lý do chấm công hộ / điều chỉnh (Audit log)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors mb-2"
            >
              <option value="Nhân viên gặp sự cố thiết bị / mạng tại quán">
                Nhân viên gặp sự cố thiết bị / mạng tại quán
              </option>
              <option value="Nhân viên quên mang điện thoại đến cửa hàng">
                Nhân viên quên mang điện thoại đến cửa hàng
              </option>
              <option value="Quên quét mã khi vào/ra ca làm việc">
                Quên quét mã khi vào/ra ca làm việc
              </option>
              <option value="Tăng ca đột xuất theo yêu cầu của Quản lý">
                Tăng ca đột xuất theo yêu cầu của Quản lý
              </option>
              <option value="Điều chỉnh sai sót kỹ thuật hệ thống">
                Điều chỉnh sai sót kỹ thuật hệ thống
              </option>
            </select>
            <input
              type="text"
              placeholder="Ghi chú thêm chi tiết (nếu có)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {recordToEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xoá bản ghi này
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
              >
                Huỷ bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {isSubmitting ? 'Đang lưu...' : recordToEdit ? 'Lưu Thay Đổi' : 'Xác Nhận Chấm Công'}
              </button>
            </div>
          </div>

        </form>

        <div className="px-6 py-2.5 bg-zinc-950/80 border-t border-zinc-800/80 text-[11px] text-zinc-500">
          Mọi thay đổi sẽ được lưu vào lịch sử kiểm toán với người điều chỉnh: <span className="text-zinc-300 font-medium">{currentUser?.name}</span>.
        </div>
      </div>
    </div>
  );
};
