import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  Store,
  Lock,
  ArrowRight,
  User as UserIcon,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';

export const LoginScreen: React.FC = () => {
  const { loginWithCredentials, storeConfig } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu được cấp phát.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await loginWithCredentials(username.trim(), password);
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại tài khoản được cấp phát.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 relative selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Ambient Lighting */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[380px] bg-gradient-to-b from-indigo-500/12 via-violet-500/6 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[450px] h-[320px] bg-emerald-500/6 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Logo & Store Header */}
        <div className="text-center space-y-2.5">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 p-0.5 shadow-2xl shadow-indigo-600/30 mx-auto">
            <div className="w-full h-full bg-zinc-950 rounded-[22px] flex items-center justify-center">
              <Store className="w-8 h-8 text-indigo-400" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-indigo-400 tracking-wide">
              Cửa Hàng Thái Thịnh · Nội Bộ
            </p>
            <h1 className="text-2xl font-black tracking-tight text-zinc-100">
              {storeConfig?.storeName || 'Cháo Mầm Nhỏ Thái Thịnh'}
            </h1>
            <p className="text-xs text-zinc-400">
              Hệ Thống Chấm Công & Quản Lý Nhân Sự Bằng Tài Khoản Cấp Phát
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-3 shadow-lg shadow-rose-950/20 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">
              <strong className="block text-rose-300 font-bold mb-0.5">Đăng nhập không thành công:</strong>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Main Authentication Card */}
        <div className="bg-zinc-900/75 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="space-y-1.5 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-1">
              <KeyRound className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-zinc-100">Đăng Nhập Tài Khoản Cấp Phát</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Vui lòng sử dụng Tên đăng nhập và Mật khẩu do Quản lý cửa hàng cấp phát để truy cập hệ thống.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Tên đăng nhập
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập..."
                  className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full pl-10 pr-11 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.99] disabled:opacity-60 cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xác thực tài khoản...</span>
                </>
              ) : (
                <>
                  <span>Đăng Nhập Hệ Thống</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security & Access Rules Guide */}
          <div className="pt-4 border-t border-zinc-800/80 space-y-3">
            <div className="flex items-start gap-2.5 text-[11px] text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200">Tài Khoản Cấp Phát:</strong> Mỗi nhân viên và quản lý đăng nhập bằng tên đăng nhập và mật khẩu riêng do cửa hàng cấp.
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-[11px] text-zinc-400">
              <Lock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200">Phân Quyền Tự Động:</strong> Tài khoản Quản lý vào thẳng Dashboard điều hành; tài khoản Nhân viên vào giao diện chấm công theo ca.
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-zinc-500 space-y-1">
          <p>Quên mật khẩu? Vui lòng liên hệ Quản lý cửa hàng để được cấp lại.</p>
          <p className="text-zinc-600">WiFi Quán Yêu Cầu: {storeConfig?.wifiSsid}</p>
        </div>
      </div>
    </div>
  );
};
