import React from 'react';
import {
  Edit,
  Trash2,
  Phone,
  DollarSign,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Calendar,
  FileText,
} from 'lucide-react';
import type { User } from '../../types/index.ts';

export interface EmployeeCardListProps {
  filteredUsers: User[];
  currentUser: User | null;
  visiblePasswords: Record<string, boolean>;
  copiedUserId: string | null;
  onTogglePassword: (id: string) => void;
  onCopyCredentials: (user: User) => void;
  onOpenEdit: (user: User) => void;
  onOpenDelete: (user: User) => void;
}

export const EmployeeCardList: React.FC<EmployeeCardListProps> = ({
  filteredUsers,
  currentUser,
  visiblePasswords,
  copiedUserId,
  onTogglePassword,
  onCopyCredentials,
  onOpenEdit,
  onOpenDelete,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredUsers.map((user) => {
        const isAdmin = user.role === 'admin';
        const isPwVisible = !!visiblePasswords[user.id];
        const isCopied = copiedUserId === user.id;
        const isWorkingNow = user.currentStatus === 'working';

        return (
          <div
            key={user.id}
            className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-2xl object-cover bg-zinc-800 border border-zinc-700/60 shadow-inner"
                    />
                    <span
                      className={`w-3 h-3 rounded-full border-2 border-zinc-900 absolute -bottom-0.5 -right-0.5 ${
                        isWorkingNow ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                      }`}
                      title={isWorkingNow ? 'Đang trong ca làm việc' : 'Ngoài ca'}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm font-bold text-zinc-100 truncate">{user.name}</h4>
                      {isAdmin ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Quản lý
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                          Nhân viên
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-indigo-400 font-medium truncate mt-0.5">{user.position}</p>
                  </div>
                </div>

                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-300 shrink-0">
                  {user.employeeCode}
                </span>
              </div>

              {/* Issued Account Credentials Box */}
              <div className="mt-4 p-3 rounded-xl bg-zinc-950/90 border border-zinc-800/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                    Tài khoản cấp phát
                  </span>
                  <button
                    type="button"
                    onClick={() => onCopyCredentials(user)}
                    className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Sao chép tài khoản & mật khẩu để gửi cho nhân sự"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Sao chép TK</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-900 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Tên đăng nhập</span>
                    <span className="font-mono font-bold text-zinc-100">{user.username}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Mật khẩu</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-amber-300 truncate">
                        {isPwVisible ? user.password || '123456' : '••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onTogglePassword(user.id)}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer shrink-0"
                        title={isPwVisible ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                      >
                        {isPwVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="mt-3 space-y-1.5 text-xs text-zinc-400 pt-1">
                {user.phone && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-zinc-400">
                      <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" /> Điện thoại:
                    </span>
                    <span className="font-mono text-zinc-300">{user.phone}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Lương theo giờ:
                  </span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {user.hourlyRate.toLocaleString('vi-VN')} đ/h
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" /> Ngày vào làm:
                  </span>
                  <span className="font-mono text-zinc-300">{user.joinDate}</span>
                </div>
                {user.note && (
                  <div className="flex items-start justify-between gap-2 pt-0.5">
                    <span className="flex items-center gap-1.5 text-zinc-400 shrink-0">
                      <FileText className="w-3.5 h-3.5 text-zinc-500" /> Ghi chú:
                    </span>
                    <span className="text-zinc-300 text-right truncate">{user.note}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-end gap-1.5">
              <button
                onClick={() => onOpenEdit(user)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5 text-indigo-400" /> Sửa
              </button>
              {user.id !== currentUser?.id && (
                <button
                  onClick={() => onOpenDelete(user)}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Xoá tài khoản"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Xoá
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
