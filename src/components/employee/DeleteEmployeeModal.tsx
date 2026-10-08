import React from 'react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 text-zinc-100 shadow-2xl">
        <h3 className="text-sm font-bold text-zinc-100">Xóa tài khoản nhân viên</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Bạn có chắc chắn muốn xóa nhân viên <strong className="text-zinc-200">{userToDelete.name}</strong> ({userToDelete.username}) khỏi hệ thống không?
        </p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 cursor-pointer"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={onConfirmDelete}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
          >
            Xóa Nhân Viên
          </button>
        </div>
      </div>
    </div>
  );
};
