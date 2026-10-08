import React from 'react';
import {
  X,
  AlertCircle,
  UserCheck,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Mail,
} from 'lucide-react';
import type { User } from '../../types/index.ts';

export interface EmployeeFormData {
  name: string;
  username: string;
  password: string;
  email: string;
  role: 'admin' | 'staff';
  employeeCode: string;
  position: string;
  hourlyRate: number;
  phone: string;
  joinDate: string;
  isActive: boolean;
  note: string;
}

export interface EmployeeFormModalProps {
  isOpen: boolean;
  editingUser: User | null;
  formData: EmployeeFormData;
  formError: string | null;
  showFormPassword: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFormDataChange: (data: EmployeeFormData) => void;
  onToggleShowPassword: () => void;
  onRoleChange: (newRole: 'staff' | 'admin') => void;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  editingUser,
  formData,
  formError,
  showFormPassword,
  onClose,
  onSubmit,
  onFormDataChange,
  onToggleShowPassword,
  onRoleChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full sm:max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-100 max-h-[92vh] pb-safe">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 rounded-full bg-zinc-700/80 mx-auto mt-2.5 mb-1 sm:hidden" />

        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">
              {editingUser ? 'Chỉnh Sửa Nhân Viên' : 'Thêm Nhân Viên Mới'}
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Thông tin nhân sự và mức lương giờ làm việc
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4 overflow-y-auto">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Loại tài khoản
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onRoleChange('staff')}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                  formData.role === 'staff'
                    ? 'bg-emerald-600/15 border-emerald-500 text-zinc-100 shadow-sm'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <UserCheck
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    formData.role === 'staff' ? 'text-emerald-400' : 'text-zinc-500'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold">Nhân Viên</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    Chấm công và xem bảng lương cá nhân
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onRoleChange('admin')}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                  formData.role === 'admin'
                    ? 'bg-amber-500/15 border-amber-500/60 text-zinc-100 shadow-sm'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <ShieldCheck
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    formData.role === 'admin' ? 'text-amber-400' : 'text-zinc-500'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold">Quản Lý</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    Theo dõi ca làm, duyệt công và quản lý nhân sự
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Login Credentials Section */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Tài Khoản Đăng Nhập
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Tên đăng nhập <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={64}
                  pattern="^[a-zA-Z0-9_.\-@]+$"
                  value={formData.username}
                  onChange={(e) =>
                    onFormDataChange({
                      ...formData,
                      username: e.target.value.replace(/[^a-zA-Z0-9_.\-@]/g, '').slice(0, 64),
                    })
                  }
                  placeholder={formData.role === 'admin' ? 'VD: ql_thanhcong' : 'VD: nv_mai'}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-base sm:text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Mật khẩu <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    required
                    maxLength={128}
                    value={formData.password}
                    onChange={(e) => onFormDataChange({ ...formData, password: e.target.value.slice(0, 128) })}
                    placeholder="Nhập mật khẩu..."
                    className="w-full pl-3 pr-8 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-base sm:text-xs font-mono text-amber-300 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={onToggleShowPassword}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showFormPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Employee Personal Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Họ và Tên <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={formData.name}
                onChange={(e) => onFormDataChange({ ...formData, name: e.target.value.slice(0, 120) })}
                placeholder="Nguyễn Văn A"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Mã Nhân Viên</label>
              <input
                type="text"
                required
                maxLength={32}
                value={formData.employeeCode}
                onChange={(e) => onFormDataChange({ ...formData, employeeCode: e.target.value.slice(0, 32) })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Vị Trí Công Việc</label>
              <input
                type="text"
                maxLength={100}
                value={formData.position}
                onChange={(e) => onFormDataChange({ ...formData, position: e.target.value.slice(0, 100) })}
                placeholder="Thu ngân, Pha chế, Phục vụ..."
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3 text-zinc-500" /> Email Liên Hệ
              </label>
              <input
                type="email"
                maxLength={128}
                value={formData.email}
                onChange={(e) => onFormDataChange({ ...formData, email: e.target.value.slice(0, 128) })}
                placeholder="nhanvien@chaomamnho.vn"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Lương Giờ (VND)</label>
              <input
                type="number"
                min={0}
                max={10000000}
                step={1000}
                value={formData.hourlyRate}
                onChange={(e) => onFormDataChange({ ...formData, hourlyRate: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Số Điện Thoại</label>
              <input
                type="tel"
                maxLength={32}
                value={formData.phone}
                onChange={(e) => onFormDataChange({ ...formData, phone: e.target.value.slice(0, 32) })}
                placeholder="0912 345 678"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Ngày Vào Làm</label>
              <input
                type="date"
                value={formData.joinDate}
                onChange={(e) => onFormDataChange({ ...formData, joinDate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Ghi Chú Nội Bộ
            </label>
            <input
              type="text"
              maxLength={500}
              value={formData.note}
              onChange={(e) => onFormDataChange({ ...formData, note: e.target.value.slice(0, 500) })}
              placeholder="VD: Ca sáng cố định, có thể đổi ca..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 cursor-pointer"
            >
              {editingUser ? 'Lưu Thay Đổi' : 'Tạo Tài Khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
