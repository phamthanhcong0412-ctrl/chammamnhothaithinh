import React, { useState } from 'react';
import {
  QrCode,
  LayoutDashboard,
  CalendarDays,
  Users,
  Settings,
  Mail,
  LogOut,
  ChevronDown,
  Clock,
  Sparkles,
  Wifi,
  ShieldCheck,
  User as UserIcon,
  Check,
  KeyRound,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ChangePasswordModal } from './ChangePasswordModal.tsx';

interface NavbarProps {
  currentTab: 'attendance' | 'dashboard' | 'monthly' | 'employees';
  setCurrentTab: (tab: 'attendance' | 'dashboard' | 'monthly' | 'employees') => void;
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
      <header className="sticky top-0 z-40 w-full bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo & Store Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 p-0.5 shadow-lg shadow-indigo-600/20 shrink-0">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                <Clock className="w-5 h-5 text-indigo-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-zinc-100 tracking-tight">
                  {storeConfig?.storeName || 'Chấm Công Quán'}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate max-w-[200px] sm:max-w-xs">
                WiFi: {storeConfig?.wifiSsid}
              </p>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-900/60 p-1 rounded-2xl border border-zinc-800/60">
            {isAdmin ? (
              <>
                <button
                  onClick={() => setCurrentTab('dashboard')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    currentTab === 'dashboard'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" /> Theo Dõi Trực Tiếp
                </button>

                <button
                  onClick={() => setCurrentTab('monthly')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    currentTab === 'monthly'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Bảng Công & Lương
                </button>

                <button
                  onClick={() => setCurrentTab('employees')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    currentTab === 'employees'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> Nhân Viên
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCurrentTab('attendance')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    currentTab === 'attendance'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  Chấm Công
                </button>

                <button
                  onClick={() => setCurrentTab('monthly')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    currentTab === 'monthly'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Bảng Công Của Tôi
                </button>
              </>
            )}
          </nav>

          {/* Right Header Actions: Email, Settings, Profile */}
          <div className="flex items-center gap-2">
            
            {/* Email Report Button */}
            {isAdmin && (
              <button
                onClick={onOpenEmailModal}
                title="Báo cáo email tự động 21h"
                className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-indigo-300 transition-colors"
              >
                <Mail className="w-4 h-4" />
              </button>
            )}

            {/* Settings Button */}
            {isAdmin && (
              <button
                onClick={onOpenSettingsModal}
                title="Cấu hình hệ thống cửa hàng"
                className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* User Profile Dropdown (Tài khoản nào dùng tài khoản ấy, không cho chuyển nhanh) */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-left transition-all"
              >
                <img
                  src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                  alt={currentUser?.name}
                  className="w-7 h-7 rounded-xl object-cover bg-zinc-800 border border-zinc-700 shrink-0"
                />
                <div className="hidden sm:block">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-zinc-200 leading-none truncate max-w-[100px]">
                      {currentUser?.name || 'Đăng nhập'}
                    </span>
                    {isAdmin ? (
                      <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Quản lý
                      </span>
                    ) : (
                      <span className="px-1 py-0.2 rounded text-[9px] font-medium bg-emerald-500/15 text-emerald-300">
                        Nhân viên
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
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
                      <p className="text-xs font-bold text-zinc-100">{currentUser?.name}</p>
                      <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
                        Tài khoản: {currentUser?.username}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-indigo-400 font-medium">
                        <span>{currentUser?.position}</span>
                        <span className="font-mono">{currentUser?.employeeCode}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setIsChangePwOpen(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-indigo-300 hover:bg-indigo-500/15 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                        Đổi mật khẩu cá nhân
                      </button>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Đăng xuất khỏi tài khoản
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

      {/* Mobile Bottom Navigation Bar for Smartphone Users */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-2 py-1.5 flex items-center justify-around">
        {isAdmin ? (
          <>
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
                currentTab === 'dashboard' ? 'text-indigo-400 font-bold' : 'text-zinc-500'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Dashboard</span>
            </button>

            <button
              onClick={() => setCurrentTab('monthly')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
                currentTab === 'monthly' ? 'text-indigo-400 font-bold' : 'text-zinc-500'
              }`}
            >
              <CalendarDays className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Bảng Công & Lương</span>
            </button>

            <button
              onClick={() => setCurrentTab('employees')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
                currentTab === 'employees' ? 'text-indigo-400 font-bold' : 'text-zinc-500'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Nhân Viên</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setCurrentTab('attendance')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
                currentTab === 'attendance' ? 'text-indigo-400 font-bold' : 'text-zinc-500'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Chấm Công</span>
            </button>

            <button
              onClick={() => setCurrentTab('monthly')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
                currentTab === 'monthly' ? 'text-indigo-400 font-bold' : 'text-zinc-500'
              }`}
            >
              <CalendarDays className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Bảng Công Của Tôi</span>
            </button>
          </>
        )}
      </div>
    </>
  );
};
