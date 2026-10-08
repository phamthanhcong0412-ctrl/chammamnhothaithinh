/**
 * HOOK: useAttendance (ISP - Interface Segregation Principle)
 * Chuyên trách: Ca làm việc, lượt chấm công, các hành động Check-in / Check-out,
 * chốt ca, và lịch sử công của nhân viên.
 */

import { useApp } from '../context/AppContext.tsx';

export function useAttendance() {
  const {
    attendance,
    activeRecord,
    checkIn,
    checkOut,
    checkOutUser,
    manualAttendance,
    deleteAttendance,
    refreshData,
    isLoading,
    actionLoadingMessage,
    runWithHudLoading,
  } = useApp();

  return {
    attendance,
    activeRecord,
    isWorking: Boolean(activeRecord),
    checkIn,
    checkOut,
    checkOutUser,
    manualAttendance,
    deleteAttendance,
    refreshAttendance: refreshData,
    isLoading,
    actionLoadingMessage,
    runWithHudLoading,
  };
}
