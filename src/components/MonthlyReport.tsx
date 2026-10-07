import React, { useState, useEffect } from 'react';
import {
  FileText,
  Calendar,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Search,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../services/api.ts';
import type { MonthlyEmployeeSummary, AttendanceRecord } from '../types/index.ts';

export const MonthlyReport: React.FC = () => {
  const { storeConfig, attendance, currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin';

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [summaries, setSummaries] = useState<MonthlyEmployeeSummary[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadMonthlyData();
  }, [selectedMonth, attendance, currentUser]);

  const loadMonthlyData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      // If staff, strictly request only their own summary
      const filterUserId = isAdmin ? undefined : currentUser.id;
      const res = await api.getMonthlyReport(selectedMonth, filterUserId);
      
      // Secondary frontend guard: if not admin, strictly keep only the current user's summary
      const finalSummaries = isAdmin
        ? res.summaries
        : res.summaries.filter((s) => s.userId === currentUser.id);

      setSummaries(finalSummaries);
      setTotalRecords(res.totalRecords);

      // Default expand for staff so they see their shift details right away
      if (!isAdmin && finalSummaries.length > 0) {
        setExpandedUserId(currentUser.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSummaries = summaries.filter(
    (s) =>
      s.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStoreHours = summaries.reduce((acc, s) => acc + s.totalHours, 0);
  const totalStoreSalary = summaries.reduce((acc, s) => acc + s.estimatedSalary, 0);

  const handleExportCSV = () => {
    const headers = ['Mã NV', 'Họ Tên', 'Vị Trí', 'Số Ngày Làm', 'Tổng Phút', 'Tổng Giờ', 'Số Ca Trễ', 'Lương Ước Tính (VND)'];
    const rows = summaries.map((s) => [
      s.employeeCode,
      `"${s.userName}"`,
      `"${s.position}"`,
      s.totalDaysWorked,
      s.totalMinutes,
      s.totalHours,
      s.totalLateCount,
      s.estimatedSalary,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const filePrefix = isAdmin ? 'Bang_Cong_Tong_Hop' : `Bang_Cong_Ca_Nhan_${currentUser?.name}`;
    link.setAttribute('download', `${filePrefix}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
          <h2 className="text-xl font-bold text-zinc-100">
            {isAdmin ? 'Bảng Công & Lương Tháng' : 'Bảng Công Của Tôi'}
          </h2>
        </div>

        {/* Controls: Month selector & Export */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> Xuất CSV
          </button>

          <button
            onClick={() => window.print()}
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 transition-colors cursor-pointer"
            title="In bảng công"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compact KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <span className="text-[11px] text-zinc-400 font-medium">
            {isAdmin ? 'Tổng giờ toàn quán' : 'Tổng giờ làm'}
          </span>
          <div className="text-xl font-black text-indigo-400 font-mono tabular-nums mt-1">
            {totalStoreHours.toFixed(1)}h
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <span className="text-[11px] text-zinc-400 font-medium">
            {isAdmin ? 'Tổng số ca' : 'Số ca đã làm'}
          </span>
          <div className="text-xl font-black text-emerald-400 font-mono tabular-nums mt-1">
            {isAdmin ? totalRecords : summaries[0]?.recordsCount || summaries[0]?.totalDaysWorked || 0} ca
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <span className="text-[11px] text-zinc-400 font-medium">
            {isAdmin ? 'Tổng quỹ lương' : 'Lương dự tính'}
          </span>
          <div className="text-xl font-black text-amber-400 font-mono tabular-nums mt-1">
            {totalStoreSalary.toLocaleString('vi-VN')}đ
          </div>
        </div>
      </div>

      {/* Search Filter (Admin only) */}
      {isAdmin && (
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên, mã NV..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/60 border border-zinc-800/80 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {/* Summary Table */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-[11px] bg-zinc-950/40 whitespace-nowrap">
                <th className="py-2.5 px-4 font-semibold">Nhân viên</th>
                <th className="py-2.5 px-3 text-center font-semibold">Ngày công</th>
                <th className="py-2.5 px-3 text-center font-semibold">Số phút</th>
                <th className="py-2.5 px-3 text-center font-semibold">Số giờ</th>
                <th className="py-2.5 px-3 text-center font-semibold">Đi muộn</th>
                <th className="py-2.5 px-3 text-right font-semibold">Lương dự tính</th>
                <th className="py-2.5 px-4 text-center font-semibold">Nhật ký</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-500">
                    Chưa có dữ liệu tháng {selectedMonth}.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((summary) => {
                  const isExpanded = expandedUserId === summary.userId;
                  const userMonthRecords = attendance.filter(
                    (r) => r.userId === summary.userId && r.date.startsWith(selectedMonth)
                  );

                  return (
                    <React.Fragment key={summary.userId}>
                      <tr className="hover:bg-zinc-800/30 transition-colors whitespace-nowrap">
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-zinc-100">{summary.userName}</span>
                          <span className="text-[11px] text-zinc-500 font-mono ml-1.5">
                            ({summary.employeeCode})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono tabular-nums text-zinc-200">
                          {summary.totalDaysWorked}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono tabular-nums text-zinc-300">
                          {summary.totalMinutes.toLocaleString('vi-VN')}p
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono tabular-nums font-bold text-indigo-400">
                          {summary.totalHours}h
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                          {summary.totalLateCount > 0 ? (
                            <span className="text-amber-400 font-semibold">{summary.totalLateCount}</span>
                          ) : (
                            <span className="text-zinc-500">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-400">
                          {summary.estimatedSalary.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() =>
                              setExpandedUserId(isExpanded ? null : summary.userId)
                            }
                            className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                Đóng <ChevronUp className="w-3.5 h-3.5" />
                              </>
                            ) : (
                              <>
                                {userMonthRecords.length} ca <ChevronDown className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Daily Shift Breakdown */}
                      {isExpanded && (
                        <tr className="bg-zinc-950/70">
                          <td colSpan={7} className="p-3 border-b border-zinc-800">
                            <div className="rounded-xl border border-zinc-800/80 overflow-x-auto bg-zinc-900/60 px-3 py-2">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="text-zinc-500 text-[11px] border-b border-zinc-800/60 whitespace-nowrap">
                                    <th className="py-1.5 px-2 font-medium">Ngày</th>
                                    <th className="py-1.5 px-2 font-medium">Giờ làm</th>
                                    <th className="py-1.5 px-2 font-medium">Thời lượng</th>
                                    <th className="py-1.5 px-2 font-medium">Hình thức</th>
                                    <th className="py-1.5 px-2 font-medium">Ghi chú</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/40">
                                  {userMonthRecords.map((r) => (
                                    <tr key={r.id} className="whitespace-nowrap">
                                      <td className="py-1.5 px-2 font-mono text-zinc-300">{r.date}</td>
                                      <td className="py-1.5 px-2 font-mono tabular-nums text-zinc-200">
                                        {new Date(r.checkInTime).toLocaleTimeString('vi-VN', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                        {' → '}
                                        {r.checkOutTime
                                          ? new Date(r.checkOutTime).toLocaleTimeString('vi-VN', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })
                                          : 'Đang làm'}
                                      </td>
                                      <td className="py-1.5 px-2 font-mono tabular-nums font-semibold text-indigo-300">
                                        {(r.totalMinutes / 60).toFixed(1)}h{' '}
                                        <span className="text-zinc-500 font-normal">({r.totalMinutes}p)</span>
                                      </td>
                                      <td className="py-1.5 px-2 text-zinc-400">
                                        {r.checkInMethod === 'manual_admin' ? 'Chấm hộ' : 'WiFi'}
                                      </td>
                                      <td className="py-1.5 px-2 text-zinc-500 max-w-[200px] truncate">
                                        {r.note || r.adjustedReason || '--'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
