import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Check,
  ShieldCheck,
  CloudUpload,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import type { User } from '../types/index.ts';
import {
  EmployeeCardList,
  EmployeeFormModal,
  DeleteEmployeeModal,
  type EmployeeFormData,
} from './employee/index.ts';

export const EmployeeManagement: React.FC = () => {
  const {
    users,
    addUser,
    updateUser,
    deleteUser,
    syncUsersToSupabase,
    currentUser,
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showFormPassword, setShowFormPassword] = useState(true);
  const [isSyncingSb, setIsSyncingSb] = useState(false);

  // Track which user cards have their password revealed or copied
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => {
      setActionToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const [formData, setFormData] = useState<EmployeeFormData>({
    name: '',
    username: '',
    password: '',
    email: '',
    role: 'staff',
    employeeCode: '',
    position: 'Pha Chế & Thu Ngân',
    hourlyRate: 28000,
    phone: '',
    joinDate: new Date().toISOString().slice(0, 10),
    isActive: true,
    note: '',
  });

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      u.name.toLowerCase().includes(term) ||
      (u.username || '').toLowerCase().includes(term) ||
      u.employeeCode.toLowerCase().includes(term) ||
      u.position.toLowerCase().includes(term) ||
      (u.phone || '').toLowerCase().includes(term) ||
      (u.note || '').toLowerCase().includes(term);
    return matchesRole && matchesSearch;
  });

  const getSuggestedCode = (targetRole: 'admin' | 'staff') => {
    const prefix = targetRole === 'admin' ? 'QL' : 'NV';
    const existingCount = users.filter((u) => u.role === targetRole).length + 1;
    return `${prefix}-${String(existingCount).padStart(3, '0')}`;
  };

  const handleOpenAdd = (initialRole: 'staff' | 'admin' = 'staff') => {
    setEditingUser(null);
    setFormError(null);
    setShowFormPassword(true);
    setFormData({
      name: '',
      username: '',
      password: initialRole === 'admin' ? '12345678@Abc' : '123456',
      email: '',
      role: initialRole,
      employeeCode: getSuggestedCode(initialRole),
      position: initialRole === 'admin' ? 'Quản Lý Cửa Hàng' : 'Nhân Viên Bán Hàng',
      hourlyRate: initialRole === 'admin' ? 50000 : 28000,
      phone: '',
      joinDate: new Date().toISOString().slice(0, 10),
      isActive: true,
      note: '',
    });
    setIsModalOpen(true);
  };

  const handleRoleChangeInForm = (newRole: 'staff' | 'admin') => {
    if (editingUser) {
      setFormData({ ...formData, role: newRole });
      return;
    }
    setFormData({
      ...formData,
      role: newRole,
      employeeCode: getSuggestedCode(newRole),
      position: newRole === 'admin' ? 'Quản Lý Cửa Hàng' : 'Nhân Viên Bán Hàng',
      hourlyRate: newRole === 'admin' ? 50000 : 28000,
    });
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormError(null);
    setShowFormPassword(false);
    setFormData({
      name: user.name,
      username: user.username || '',
      password: user.password || '',
      email: user.email || '',
      role: user.role,
      employeeCode: user.employeeCode,
      position: user.position,
      hourlyRate: user.hourlyRate,
      phone: user.phone || '',
      joinDate: user.joinDate || new Date().toISOString().slice(0, 10),
      isActive: user.isActive !== false,
      note: user.note || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanUsername = formData.username.trim();
    const cleanPassword = formData.password.trim();

    if (!cleanUsername) {
      setFormError('Vui lòng nhập Tên đăng nhập cấp phát.');
      return;
    }
    if (!cleanPassword) {
      setFormError('Vui lòng nhập Mật khẩu cấp phát.');
      return;
    }

    try {
      const payload = {
        ...formData,
        username: cleanUsername,
        password: cleanPassword,
        email: formData.email.trim() || `${cleanUsername}@chaomamnho.vn`,
      };
      if (editingUser) {
        await updateUser(editingUser.id, payload);
        triggerToast(`Đã cập nhật nhân viên "${payload.name}"!`);
      } else {
        await addUser(payload);
        triggerToast(`Đã thêm nhân viên "${payload.name}"!`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu tài khoản nhân sự');
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const deletedName = userToDelete.name;
      await deleteUser(userToDelete.id);
      setUserToDelete(null);
      triggerToast(`Đã xoá nhân viên "${deletedName}"!`);
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi xoá tài khoản');
    }
  };

  const handleSyncAllToSupabase = async () => {
    try {
      setIsSyncingSb(true);
      const res = await syncUsersToSupabase();
      triggerToast(`Đã đồng bộ ${res.syncedCount} nhân viên!`);
    } catch (err: any) {
      triggerToast(err.message || 'Đã lưu danh sách nhân viên.');
    } finally {
      setIsSyncingSb(false);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyCredentials = (user: User) => {
    const roleLabel = user.role === 'admin' ? 'Quản lý' : 'Nhân viên';
    const text = `Tài khoản ${roleLabel} (${user.name}) - Tên đăng nhập: ${user.username} | Mật khẩu: ${user.password || '123456'}`;
    navigator.clipboard.writeText(text);
    setCopiedUserId(user.id);
    setTimeout(() => setCopiedUserId(null), 2000);
  };

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const staffCount = users.filter((u) => u.role === 'staff').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {actionToast && (
        <div className="fixed top-20 right-4 z-50 px-4 py-3 rounded-2xl bg-emerald-950/95 border border-emerald-500/50 text-emerald-100 text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* Top action header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" /> Quản Lý Nhân Sự
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Danh sách nhân viên, mức lương và tài khoản đăng nhập
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSyncAllToSupabase}
            disabled={isSyncingSb}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Đồng bộ danh sách nhân viên"
          >
            <CloudUpload className="w-4 h-4 text-emerald-400" />
            {isSyncingSb ? 'Đang đồng bộ...' : 'Đồng Bộ Dữ Liệu'}
          </button>

          <button
            onClick={() => handleOpenAdd('staff')}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Thêm Nhân Viên
          </button>

          <button
            onClick={() => handleOpenAdd('admin')}
            className="px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" /> Thêm Quản Lý
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-zinc-900/80 border border-zinc-800/80 rounded-xl self-start">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Tất cả ({users.length})
          </button>
          <button
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              roleFilter === 'admin'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Quản lý ({adminCount})
          </button>
          <button
            onClick={() => setRoleFilter('staff')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              roleFilter === 'staff'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Nhân viên ({staffCount})
          </button>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên, tên đăng nhập, mã NV, vị trí, SĐT..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/60 border border-zinc-800/80 rounded-xl text-base sm:text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Employee & Manager Cards Grid */}
      <EmployeeCardList
        filteredUsers={filteredUsers}
        currentUser={currentUser}
        visiblePasswords={visiblePasswords}
        copiedUserId={copiedUserId}
        onTogglePassword={togglePasswordVisibility}
        onCopyCredentials={handleCopyCredentials}
        onOpenEdit={handleOpenEdit}
        onOpenDelete={setUserToDelete}
      />

      {/* Delete Confirmation Modal */}
      <DeleteEmployeeModal
        userToDelete={userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirmDelete={handleConfirmDelete}
      />

      {/* Add / Edit Modal */}
      <EmployeeFormModal
        isOpen={isModalOpen}
        editingUser={editingUser}
        formData={formData}
        formError={formError}
        showFormPassword={showFormPassword}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        onFormDataChange={setFormData}
        onToggleShowPassword={() => setShowFormPassword(!showFormPassword)}
        onRoleChange={handleRoleChangeInForm}
      />
    </div>
  );
};
