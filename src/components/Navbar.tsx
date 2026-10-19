import React, { useState } from 'react';
import {
  Store,
  LayoutDashboard,
  CalendarDays,
  Users,
  Settings,
  Mail,
  LogOut,
  ChevronDown,
  Clock,
  KeyRound,
  CalendarCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ChangePasswordModal } from './ChangePasswordModal.tsx';

export type AppTab = 'attendance' | 'dashboard' | 'monthly' | 'employees' | 'schedule';

interface NavbarProps {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
  onOpenEmailModal: () => void;
  onOpenSettingsModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenEmailModal,
  onOpenSettingsModal,
}) => {
  const { currentUser, storeConfig, logout } = useApp();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChangePwOpen, setIsChangePwOpen] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  return (
    <>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full bg-[#141416]/90 backdrop-blur-xl border-b border-zinc-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo & Store Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-emerald-400" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-zinc-100 tracking-tight">
                  {storeConfig?.storeName || 'Cháo Mầm Nhỏ'}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Hệ thống sẵn sàng
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate max-w-[180px] sm:max-w-xs">
                WiFi: {storeConfig?.wifiSsid}
              </p>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-900/80 p-1 rounded-2xl border border-zinc-800/80">
            {isAdmin ? (
              <>
                <button
                  onClick={() => setCurrentTab('dashboard')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'dashboard'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" /> Ca Trực Tiếp
                </button>

                <button
                  onClick={() => setCurrentTab('monthly')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'monthly'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Bảng Lương
                </button>

                <button
                  onClick={() => setCurrentTab('employees')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'employees'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> Nhân Viên
                </button>

                <button
                  onClick={() => setCurrentTab('schedule')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'schedule'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <CalendarCheck className="w-3.5 h-3.5" /> Đăng Ký Ca
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCurrentTab('attendance')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'attendance'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  Chấm Công
                </button>

                <button
                  onClick={() => setCurrentTab('monthly')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'monthly'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Bảng Lương
                </button>

                <button
                  onClick={() => setCurrentTab('schedule')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'schedule'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <CalendarCheck className="w-3.5 h-3.5" /> Đăng Ký Ca
                </button>
              </>
            )}
          </nav>

          {/* Right Header Actions: Settings (Admin), User Avatar & Logout */}
          <div className="flex items-center gap-2">
            
            {/* Admin Quick Action: Settings Modal */}
            {isAdmin && (
              <button
                onClick={onOpenSettingsModal}
                title="Cài đặt cửa hàng"
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4 text-emerald-400" />
                <span className="hidden lg:inline">Cài đặt quán</span>
              </button>
            )}

            {/* User Profile Avatar Button (Avatar-only to prevent layout breaking on mobile) */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                title={currentUser?.name || 'Tài khoản'}
                aria-label="Tài khoản cá nhân"
                className="relative p-0.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <img
                  src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                  alt={currentUser?.name || 'Avatar'}
                  className="w-8 h-8 rounded-xl object-cover bg-zinc-800 border border-emerald-500/40 shrink-0"
                />
                {/* Role indicator badge dot */}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#141416] ${
                    isAdmin ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  title={isAdmin ? 'Quản lý' : 'Nhân viên'}
                />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-3 border-b border-zinc-800/80 mb-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-zinc-100">{currentUser?.name}</p>
                        {isAdmin ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Quản lý
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/15 text-emerald-300">
                            Nhân viên
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
                        Tài khoản: {currentUser?.username}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-emerald-400 font-medium">
                        <span>{currentUser?.position}</span>
                        <span className="font-mono">{currentUser?.employeeCode}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {/* Admin shortcuts in dropdown */}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onOpenSettingsModal();
                            }}
                            className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-zinc-200 hover:bg-zinc-800 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5 text-emerald-400" />
                            Cài đặt cửa hàng
                          </button>
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onOpenEmailModal();
                            }}
                            className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-zinc-200 hover:bg-zinc-800 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Mail className="w-3.5 h-3.5 text-amber-400" />
                            Báo cáo Email
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setIsChangePwOpen(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                        Đổi mật khẩu
                      </button>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <ChangePasswordModal
        isOpen={isChangePwOpen}
        onClose={() => setIsChangePwOpen(false)}
      />

      {/* Mobile Bottom Navigation Bar for Smartphone Users with pb-safe */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#141416]/95 backdrop-blur-xl border-t border-zinc-800/80 px-2 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-2xl">
        {isAdmin ? (
          <>
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`flex flex-col items-center justify-center min-h-[48px] px-2.5 rounded-xl transition-all ${
                currentTab === 'dashboard' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] mt-1">Trực Tiếp</span>
            </button>

            <button
              onClick={() => setCurrentTab('monthly')}
              className={`flex flex-col items-center justify-center min-h-[48px] px-2.5 rounded-xl transition-all ${
                currentTab === 'monthly' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <CalendarDays className="w-5 h-5" />
              <span className="text-[10px] mt-1">Bảng Lương</span>
            </button>

            <button
              onClick={() => setCurrentTab('employees')}
              className={`flex flex-col items-center justify-center min-h-[48px] px-2.5 rounded-xl transition-all ${
                currentTab === 'employees' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] mt-1">Nhân Viên</span>
            </button>

            {/* Changed from Cài Đặt to Đăng Ký Ca */}
            <button
              onClick={() => setCurrentTab('schedule')}
              className={`flex flex-col items-center justify-center min-h-[48px] px-2.5 rounded-xl transition-all ${
                currentTab === 'schedule' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <CalendarCheck className="w-5 h-5" />
              <span className="text-[10px] mt-1">Đăng Ký Ca</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setCurrentTab('attendance')}
              className={`flex flex-col items-center justify-center min-h-[48px] px-3 rounded-xl transition-all ${
                currentTab === 'attendance' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span className="text-[10px] mt-1">Chấm Công</span>
            </button>

            <button
              onClick={() => setCurrentTab('monthly')}
              className={`flex flex-col items-center justify-center min-h-[48px] px-3 rounded-xl transition-all ${
                currentTab === 'monthly' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <CalendarDays className="w-5 h-5" />
              <span className="text-[10px] mt-1">Bảng Lương</span>
            </button>

            {/* Added Đăng Ký Ca for Staff as well */}
            <button
              onClick={() => setCurrentTab('schedule')}
              className={`flex flex-col items-center justify-center min-h-[48px] px-3 rounded-xl transition-all ${
                currentTab === 'schedule' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <CalendarCheck className="w-5 h-5" />
              <span className="text-[10px] mt-1">Đăng Ký Ca</span>
            </button>
          </>
        )}
      </div>
    </>
  );
};
