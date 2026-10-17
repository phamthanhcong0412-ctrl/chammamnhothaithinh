import React, { useState } from 'react';
import {
  AlertCircle,
  Store,
  Lock,
  ArrowRight,
  User as UserIcon,
  Eye,
  EyeOff,
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
      setErrorMessage('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await loginWithCredentials(username.trim(), password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Sai tên đăng nhập hoặc mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141416] flex flex-col justify-center items-center p-4 relative selection:bg-emerald-500/20 selection:text-emerald-200">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-emerald-500/[0.03] blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 space-y-5 animate-in fade-in duration-200">
        {/* Clean Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              {storeConfig?.storeName || 'Cháo Mầm Nhỏ Thái Thịnh'}
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">Đăng nhập hệ thống chấm công</p>
          </div>
        </div>

        {/* Concise Error Banner */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Minimal Login Form Card */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Tài khoản
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tên đăng nhập"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
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
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
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
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer mt-1 shadow-md shadow-emerald-600/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
