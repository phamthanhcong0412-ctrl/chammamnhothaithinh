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
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header & Role Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              {isAdmin ? 'Bảng Tổng Hợp Công & Lương (Toàn Bộ Quán)' : 'Bảng Công & Lương Cá Nhân'}
            </h2>
            {!isAdmin ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Riêng tư
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Quyền Quản Lý
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isAdmin
              ? 'Quản lý toàn bộ giờ công, số ca và quỹ lương của tất cả nhân sự cửa hàng.'
              : 'Bạn chỉ có thể xem số giờ làm và mức lương của chính mình (được bảo mật hoàn toàn).'}
          </p>
        </div>

        {/* Controls: Month selector & Export */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Calendar className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-9 pr-3 py-2 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> Xuất File
          </button>

          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 transition-colors"
            title="In bảng công"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Overview (Personal for Staff, Store-wide for Admin) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">
            {isAdmin ? 'Tổng Giờ Toàn Cửa Hàng' : 'Tổng Giờ Làm Của Bạn'}
          </span>
          <div className="text-2xl font-black text-indigo-400 mt-2">
            {totalStoreHours.toFixed(1)} <span className="text-sm font-normal text-zinc-400">giờ</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Tính theo phút thực tế giữa các lần check-in/out</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">
            {isAdmin ? 'Tổng Số Ca Hoàn Thành' : 'Số Ca Đã Đi Làm'}
          </span>
          <div className="text-2xl font-black text-emerald-400 mt-2">
            {isAdmin ? totalRecords : summaries[0]?.recordsCount || summaries[0]?.totalDaysWorked || 0}{' '}
            <span className="text-sm font-normal text-zinc-400">ca</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Trong tháng {selectedMonth}</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">
            {isAdmin ? 'Dự Toán Quỹ Lương Quán' : 'Tiền Lương Ước Tính Của Bạn'}
          </span>
          <div className="text-2xl font-black text-amber-400 mt-2">
            {totalStoreSalary.toLocaleString('vi-VN')} <span className="text-sm font-normal text-zinc-400">đ</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {isAdmin ? 'Tổng chi phí nhân sự tháng' : `Đơn giá: ${currentUser?.hourlyRate?.toLocaleString('vi-VN')} đ/giờ`}
          </p>
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
            placeholder="Tìm kiếm nhân viên theo tên, mã số, vị trí..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/60 border border-zinc-800/80 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {/* Summary Table */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[11px] bg-zinc-950/40">
                <th className="py-3 px-4">Nhân Viên</th>
                <th className="py-3 px-3 text-center">Số Ngày Làm</th>
                <th className="py-3 px-3 text-center">Tổng Phút Thực Tế</th>
                <th className="py-3 px-3 text-center">Tổng Giờ Quy Đổi</th>
                <th className="py-3 px-3 text-center">Ca Đi Muộn</th>
                <th className="py-3 px-3 text-right">Lương Dự Tính</th>
                <th className="py-3 px-4 text-center">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    Không tìm thấy dữ liệu chấm công cho tháng {selectedMonth}.
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
                      <tr className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-zinc-100">{summary.userName}</div>
                          <div className="text-[11px] text-zinc-400">
                            {summary.employeeCode} • {summary.position}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-zinc-200">
                          {summary.totalDaysWorked} ngày
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-zinc-300">
                          {summary.totalMinutes.toLocaleString('vi-VN')} phút
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-indigo-400 text-sm">
                          {summary.totalHours}h
                        </td>
                        <td className="py-3 px-3 text-center">
                          {summary.totalLateCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/20">
                              {summary.totalLateCount} ca muộn
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-[11px]">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-400 text-sm">
                          {summary.estimatedSalary.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() =>
                              setExpandedUserId(isExpanded ? null : summary.userId)
                            }
                            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1 text-[11px]"
                          >
                            {isExpanded ? (
                              <>
                                Thu gọn <ChevronUp className="w-3.5 h-3.5" />
                              </>
                            ) : (
                              <>
                                Xem ca ({userMonthRecords.length}) <ChevronDown className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Daily Shift Breakdown */}
                      {isExpanded && (
                        <tr className="bg-zinc-950/80">
                          <td colSpan={7} className="p-4 border-b border-zinc-800">
                            <div className="rounded-xl border border-zinc-800/80 overflow-hidden bg-zinc-900/80">
                              <div className="px-4 py-2.5 bg-zinc-800/50 border-b border-zinc-800 text-[11px] font-semibold text-zinc-300 flex items-center justify-between">
                                <span>Chi tiết từng ca làm của {summary.userName} trong tháng {selectedMonth}:</span>
                                <span>Đơn giá: {summary.hourlyRate?.toLocaleString('vi-VN')} đ/giờ</span>
                              </div>
                              <div className="p-3 overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="text-zinc-500 text-[10px] uppercase border-b border-zinc-800/60 pb-1">
                                      <th className="pb-1.5">Ngày</th>
                                      <th className="pb-1.5">Vào ca</th>
                                      <th className="pb-1.5">Ra ca</th>
                                      <th className="pb-1.5">Số phút</th>
                                      <th className="pb-1.5">Xác thực</th>
                                      <th className="pb-1.5">Ghi chú</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-800/40">
                                    {userMonthRecords.map((r) => (
                                      <tr key={r.id}>
                                        <td className="py-2 text-zinc-300 font-medium">{r.date}</td>
                                        <td className="py-2 font-mono text-zinc-300">
                                          {new Date(r.checkInTime).toLocaleTimeString('vi-VN', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </td>
                                        <td className="py-2 font-mono text-zinc-300">
                                          {r.checkOutTime
                                            ? new Date(r.checkOutTime).toLocaleTimeString('vi-VN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })
                                            : 'Đang làm'}
                                        </td>
                                        <td className="py-2 font-semibold text-indigo-300">
                                          {r.totalMinutes}p ({(r.totalMinutes / 60).toFixed(1)}h)
                                        </td>
                                        <td className="py-2 text-[11px] text-zinc-400">
                                          {r.checkInMethod === 'manual_admin'
                                            ? 'Quản lý điều chỉnh'
                                            : 'Check-in Trực Tiếp (WiFi Quán)'}
                                        </td>
                                        <td className="py-2 text-zinc-500 text-[11px]">
                                          {r.note || r.adjustedReason || '--'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
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
