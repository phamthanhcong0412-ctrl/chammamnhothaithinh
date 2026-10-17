/**
 * HOOK: useStaffManagement (ISP - Interface Segregation Principle)
 * Chuyên trách: Danh sách nhân sự, quản trị viên thêm/sửa/xóa tài khoản và đồng bộ cơ sở dữ liệu.
 */

import { useApp } from '../context/AppContext.tsx';

export function useStaffManagement() {
  const {
    users,
    addUser,
    updateUser,
    deleteUser,
    syncUsersToSupabase,
    lastSyncResult,
    refreshData,
    isLoading,
    actionLoadingMessage,
    runWithHudLoading,
  } = useApp();

  return {
    users,
    addUser,
    updateUser,
    deleteUser,
    syncUsersToSupabase,
    lastSyncResult,
    refreshStaff: refreshData,
    isLoading,
    actionLoadingMessage,
    runWithHudLoading,
  };
}
