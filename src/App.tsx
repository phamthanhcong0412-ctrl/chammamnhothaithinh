import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { StaffAttendance } from './components/StaffAttendance.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { MonthlyReport } from './components/MonthlyReport.tsx';
import { EmployeeManagement } from './components/EmployeeManagement.tsx';
import { EmailReportModal } from './components/EmailReportModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { ManualAttendanceModal } from './components/ManualAttendanceModal.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import type { AttendanceRecord } from './types/index.ts';
import { Loader2, AlertTriangle } from 'lucide-react';

function AppContent() {
  const { currentUser, isLoading, error, refreshData } = useApp();
  const isAdmin = currentUser?.role === 'admin';
  const [currentTab, setCurrentTab] = useState<'attendance' | 'dashboard' | 'monthly' | 'employees'>('dashboard');

  const handleSetTab = (tab: 'attendance' | 'dashboard' | 'monthly' | 'employees') => {
    setCurrentTab(tab);
    refreshData().catch(() => {});
  };

  // Modals state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [manualRecord, setManualRecord] = useState<AttendanceRecord | null>(null);
  const [manualPreselectedUserId, setManualPreselectedUserId] = useState<string | undefined>(undefined);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Sync tab on login / role change: Admin goes straight to Dashboard, Staff goes to attendance
  React.useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin') {
        setCurrentTab('dashboard');
      } else {
        setCurrentTab('attendance');
      }
    }
  }, [currentUser?.id, currentUser?.role]);

  const handleOpenManualModal = (record?: AttendanceRecord | null, preselectedUserId?: string) => {
    setManualRecord(record || null);
    setManualPreselectedUserId(preselectedUserId);
    setIsManualModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141416] flex flex-col items-center justify-center text-zinc-100 p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
        <h2 className="text-sm font-bold tracking-tight text-zinc-200">Đang khởi tạo Cháo Mầm Nhỏ...</h2>
        <p className="text-xs text-zinc-500 mt-1">Kiểm tra kết nối và đồng bộ ca làm việc</p>
      </div>
    );
  }

  // MANDATORY LOGIN GATE: If not logged in, show LoginScreen
  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#141416] text-zinc-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-200 relative pb-20 md:pb-10 overflow-x-hidden">
      
      {/* Background Subtle Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-emerald-500/[0.03] blur-3xl pointer-events-none -z-10" />

      {/* Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={handleSetTab}
        onOpenEmailModal={() => setIsEmailModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />

      {/* Global Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 w-full">
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 w-full">
        {currentTab === 'attendance' && (
          isAdmin ? (
            <AdminDashboard
              onOpenManualModal={handleOpenManualModal}
              onOpenEmailModal={() => setIsEmailModalOpen(true)}
              onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
            />
          ) : (
            <StaffAttendance />
          )
        )}
        {currentTab === 'dashboard' && (
          isAdmin ? (
            <AdminDashboard
              onOpenManualModal={handleOpenManualModal}
              onOpenEmailModal={() => setIsEmailModalOpen(true)}
              onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
            />
          ) : (
            <StaffAttendance />
          )
        )}
        {currentTab === 'monthly' && <MonthlyReport />}
        {currentTab === 'employees' && (
          isAdmin ? <EmployeeManagement /> : <StaffAttendance />
        )}
      </main>

      {/* Modals */}
      <EmailReportModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      <ManualAttendanceModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        recordToEdit={manualRecord}
        preselectedUserId={manualPreselectedUserId}
      />

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
