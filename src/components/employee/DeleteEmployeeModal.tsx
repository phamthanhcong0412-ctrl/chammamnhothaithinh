import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { User } from '../../types/index.ts';

export interface DeleteEmployeeModalProps {
  userToDelete: User | null;
  onClose: () => void;
  onConfirmDelete: () => void;
}

export const DeleteEmployeeModal: React.FC<DeleteEmployeeModalProps> = ({
  userToDelete,
  onClose,
  onConfirmDelete,
}) => {
  if (!userToDelete) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 text-zinc-100 shadow-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full mx-auto sm:hidden mb-1" />

        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-zinc-100">Xác nhận xóa tài khoản</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mt-1">
              Bạn có chắc chắn muốn xóa nhân viên <strong className="text-zinc-200 font-semibold">{userToDelete.name}</strong> ({userToDelete.username}) khỏi hệ thống? Dữ liệu chấm công lịch sử sẽ được bảo lưu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-all active:scale-95 cursor-pointer"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={onConfirmDelete}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Xóa Nhân Viên
          </button>
        </div>
      </div>
    </div>
  );
};

