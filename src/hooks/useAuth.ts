/**
 * HOOK: useAuth (ISP - Interface Segregation Principle)
 * Chỉ cung cấp trạng thái đăng nhập, tài khoản hiện tại và các hành động xác thực,
 * giúp các component UI không bị phụ thuộc vào các phương thức chấm công hay quản lý cấu hình.
 */

import { useApp } from '../context/AppContext.tsx';

export function useAuth() {
  const {
    currentUser,
    supabaseUser,
    isSupabaseConnected,
    supabaseProjectId,
    switchUser,
    loginWithCredentials,
    loginWithGoogle,
    logout,
    changePassword,
  } = useApp();

  return {
    currentUser,
    supabaseUser,
    isSupabaseConnected,
    supabaseProjectId,
    switchUser,
    loginWithCredentials,
    loginWithGoogle,
    logout,
    changePassword,
    isAdmin: currentUser?.role === 'admin',
    isStaff: currentUser?.role === 'staff',
  };
}
