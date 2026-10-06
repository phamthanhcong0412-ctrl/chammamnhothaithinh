import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  Phone,
  DollarSign,
  Search,
  X,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Database,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import type { User } from '../types/index.ts';

export const EmployeeManagement: React.FC = () => {
  const {
    users,
    addUser,
    updateUser,
    deleteUser,
    currentUser,
    isFirebaseConnected,
    firebaseUser,
    firebaseProjectId,
    syncUsersToFirebase,
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showFormPassword, setShowFormPassword] = useState(true);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const handleSyncToFirebase = async () => {
    setIsSyncingFirebase(true);
    setSyncSuccessMsg(null);
    setFormError(null);
    try {
      const count = await syncUsersToFirebase();
      setSyncSuccessMsg(`Đã lưu & đồng bộ ${count} tài khoản nhân sự lên Firebase Firestore (${firebaseProjectId})!`);
      setTimeout(() => setSyncSuccessMsg(null), 5000);
    } catch (err: any) {
      setFormError(err.message || 'Không thể đồng bộ lên Firebase Firestore.');
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  // Track which user cards have their password revealed or copied
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    email: '',
    role: 'staff' as 'admin' | 'staff',
    employeeCode: '',
    position: 'Pha Chế & Thu Ngân',
    hourlyRate: 28000,
    phone: '',
  });

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      u.name.toLowerCase().includes(term) ||
      (u.username || '').toLowerCase().includes(term) ||
      u.employeeCode.toLowerCase().includes(term) ||
      u.position.toLowerCase().includes(term) ||
      (u.phone || '').toLowerCase().includes(term);
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
      } else {
        await addUser(payload);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu tài khoản nhân sự');
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete.id);
      setUserToDelete(null);
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi xoá tài khoản');
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
      {/* Top action header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Quản Lý Nhân Sự & Cấp Phát Tài Khoản
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Thêm Nhân viên hoặc Quản lý mới, cấp phát tên đăng nhập & mật khẩu và thiết lập mức lương theo giờ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSyncToFirebase}
            disabled={isSyncingFirebase}
            className="px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-400 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
            <span>
              {isSyncingFirebase
                ? 'Đang lưu Firebase...'
                : isFirebaseConnected
                ? 'Đồng Bộ Firebase Cloud'
                : 'Kết Nối & Lưu Firebase'}
            </span>
          </button>

          <button
            onClick={() => handleOpenAdd('staff')}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all cursor-pointer"
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

      {/* Firebase Cloud Persistence Banner */}
      <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              isFirebaseConnected
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
            }`}
          >
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-zinc-100">
                Cơ Sở Dữ Liệu Firebase Firestore:
              </span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-indigo-300 border border-zinc-700">
                {firebaseProjectId}
              </span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Admin: {firebaseUser?.email || 'phamthanhcong0412@gmail.com'}
              </span>
              {isFirebaseConnected ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                  Đã Kết Nối ({firebaseUser?.email})
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                  Chưa Xác Thực Google Cloud
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {isFirebaseConnected
                ? 'Mọi thao tác thêm, sửa, xóa nhân sự sẽ tự động lưu trực tiếp vào bảng users trên Firebase Firestore.'
                : 'Bấm "Kết Nối & Lưu Firebase" để xác thực Google và đồng bộ toàn bộ danh sách tài khoản lên đám mây Firestore.'}
            </p>
          </div>
        </div>
      </div>

      {syncSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncSuccessMsg}</span>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-zinc-900/80 border border-zinc-800/80 rounded-xl self-start">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
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
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
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
            placeholder="Tìm theo tên, tên đăng nhập, mã NV, vị trí..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/60 border border-zinc-800/80 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Employee & Manager Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => {
          const isAdmin = user.role === 'admin';
          const isPwVisible = !!visiblePasswords[user.id];
          const isCopied = copiedUserId === user.id;

          return (
            <div
              key={user.id}
              className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-2xl object-cover bg-zinc-800 border border-zinc-700/60 shadow-inner shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
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
                      onClick={() => handleCopyCredentials(user)}
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
                          onClick={() => togglePasswordVisibility(user.id)}
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
                <div className="mt-3 space-y-1.5 text-xs text-zinc-400 pt-2">
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
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(user)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" /> Sửa / Đổi MK
                </button>
                {user.id !== currentUser?.id && user.username !== 'ptcong' && (
                  <button
                    onClick={() => setUserToDelete(user)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Xoá tài khoản"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 text-zinc-100 shadow-2xl">
            <h3 className="text-sm font-bold text-zinc-100">Xác nhận xoá tài khoản</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Bạn có chắc chắn muốn xoá tài khoản <strong className="text-zinc-200">{userToDelete.name}</strong> ({userToDelete.username}) khỏi hệ thống không?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 cursor-pointer"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
              >
                Xoá Tài Khoản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-100 max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">
                  {editingUser ? 'Chỉnh Sửa Tài Khoản & Nhân Sự' : 'Cấp Phát Tài Khoản Nhân Sự Mới'}
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Tài khoản sau khi tạo có thể dùng Tên đăng nhập & Mật khẩu để đăng nhập ngay
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Role Selection: Nhân viên or Quản lý */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Phân Quyền Loại Tài Khoản
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleRoleChangeInForm('staff')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                      formData.role === 'staff'
                        ? 'bg-indigo-600/15 border-indigo-500 text-zinc-100 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <UserCheck
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        formData.role === 'staff' ? 'text-indigo-400' : 'text-zinc-500'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-bold">Nhân Viên</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        Đăng nhập chấm công & xem lương cá nhân
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChangeInForm('admin')}
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
                      <div className="text-xs font-bold">Quản Lý (Admin)</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        Quản lý quán, duyệt công & cấp tài khoản
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Issued Login Credentials Section */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> Thông Tin Tài Khoản Cấp Phát (Dùng Để Đăng Nhập)
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
                        setFormData({
                          ...formData,
                          username: e.target.value.replace(/[^a-zA-Z0-9_.\-@]/g, '').slice(0, 64),
                        })
                      }
                      placeholder={formData.role === 'admin' ? 'VD: ql_thanhcong' : 'VD: nv_mai'}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Mật khẩu cấp phát <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showFormPassword ? 'text' : 'password'}
                        required
                        maxLength={128}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value.slice(0, 128) })}
                        placeholder="Nhập mật khẩu..."
                        className="w-full pl-3 pr-8 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-amber-300 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword(!showFormPassword)}
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
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.slice(0, 120) })}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Mã Nhân Sự</label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={formData.employeeCode}
                    onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value.slice(0, 32) })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Vị Trí Công Việc</label>
                <input
                  type="text"
                  maxLength={100}
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value.slice(0, 100) })}
                  placeholder="Thu ngân, Pha chế, Quản lý cửa hàng..."
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Lương Mỗi Giờ (VND)</label>
                  <input
                    type="number"
                    min={0}
                    max={10000000}
                    step={1000}
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Số Điện Thoại</label>
                  <input
                    type="tel"
                    maxLength={32}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.slice(0, 32) })}
                    placeholder="0912 345 678"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 cursor-pointer"
                >
                  {editingUser
                    ? 'Lưu Thay Đổi'
                    : formData.role === 'admin'
                    ? 'Cấp Tài Khoản Quản Lý'
                    : 'Cấp Tài Khoản Nhân Viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
