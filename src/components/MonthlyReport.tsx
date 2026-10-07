import React, { useState, useEffect } from 'react';
import {
  FileText,
  Calendar,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Search,
  Receipt,
  X,
  Clock,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../services/api.ts';
import type { MonthlyEmployeeSummary } from '../types/index.ts';

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
  const [payslipUser, setPayslipUser] = useState<MonthlyEmployeeSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadMonthlyData();
  }, [selectedMonth, attendance, currentUser]);

  const loadMonthlyData = async () => {
    if (!currentUser) return;
    try {
      const filterUserId = isAdmin ? undefined : currentUser.id;
      const res = await api.getMonthlyReport(selectedMonth, filterUserId);

      const finalSummaries = isAdmin
        ? res.summaries
        : res.summaries.filter((s) => s.userId === currentUser.id);

      setSummaries(finalSummaries);
      setTotalRecords(res.totalRecords);

      if (!isAdmin && finalSummaries.length > 0) {
        setExpandedUserId(currentUser.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredSummaries = summaries.filter(
    (s) =>
      s.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStoreHours = summaries.reduce((acc, s) => acc + s.totalHours, 0);
  const totalStoreMinutes = summaries.reduce((acc, s) => acc + s.totalMinutes, 0);
  const totalStoreSalary = summaries.reduce((acc, s) => acc + s.estimatedSalary, 0);

  const handleExportCSV = () => {
    const headers = [
      'Mã NV',
      'Họ Tên',
      'Vị Trí',
      'Đơn Giá/Giờ (VND)',
      'Số Ngày Công',
      'Số Ca',
      'Tổng Phút',
      'Tổng Giờ',
      'Đi Muộn',
      'Về Sớm',
      'Lương Thực Lĩnh (VND)',
    ];
    const rows = summaries.map((s) => [
      s.employeeCode,
      `"${s.userName}"`,
      `"${s.position}"`,
      s.hourlyRate,
      s.totalDaysWorked,
      s.recordsCount,
      s.totalMinutes,
      s.totalHours,
      s.totalLateCount,
      s.totalEarlyCount,
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
              {isAdmin ? 'Bảng Công & Quyết Toán Lương Tháng' : 'Bảng Công & Phiếu Lương Cá Nhân'}
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Kỳ lương tháng {selectedMonth} · Tự động cộng dồn phút làm & đơn giá theo giờ
          </p>
        </div>

        {/* Controls: Month selector & Export */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> Xuất Excel/CSV
          </button>

          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
            title="In bảng công"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3 Modern KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">
              {isAdmin ? 'Tổng giờ công toàn quán' : 'Tổng giờ làm trong tháng'}
            </span>
            <div className="text-2xl font-black text-indigo-400 font-mono tabular-nums mt-1">
              {totalStoreHours.toFixed(1)}h{' '}
              <span className="text-xs font-normal text-zinc-500">({totalStoreMinutes}p)</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">
              {isAdmin ? 'Tổng số ca hoàn thành' : 'Số ca đã làm'}
            </span>
            <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums mt-1">
              {isAdmin ? totalRecords : summaries[0]?.recordsCount || 0} ca
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">
              {isAdmin ? 'Tổng quỹ lương tháng' : 'Lương tạm tính'}
            </span>
            <div className="text-2xl font-black text-amber-400 font-mono tabular-nums mt-1">
              {totalStoreSalary.toLocaleString('vi-VN')}đ
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Filter (Admin only) */}
      {isAdmin && (
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm nhân viên theo tên, mã NV, vị trí..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {/* Summary Table */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-[11px] bg-zinc-950/40 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Nhân viên</th>
                <th className="py-3 px-3 text-right font-semibold">Đơn giá/h</th>
                <th className="py-3 px-3 text-center font-semibold">Ngày công</th>
                <th className="py-3 px-3 text-center font-semibold">Số ca</th>
                <th className="py-3 px-3 text-center font-semibold">Tổng giờ (phút)</th>
                <th className="py-3 px-3 text-center font-semibold">Muộn / Sớm</th>
                <th className="py-3 px-3 text-right font-semibold">Thực lĩnh tạm tính</th>
                <th className="py-3 px-4 text-right font-semibold">Chi tiết / Phiếu lương</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500">
                    Chưa có dữ liệu chấm công trong tháng {selectedMonth}.
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
                        <td className="py-3 px-4">
                          <div className="font-bold text-zinc-100">{summary.userName}</div>
                          <div className="text-[11px] text-zinc-500">
                            {summary.position} · <span className="font-mono">{summary.employeeCode}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-300">
                          {(summary.hourlyRate || 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-3 px-3 text-center font-mono tabular-nums text-zinc-200 font-semibold">
                          {summary.totalDaysWorked}
                        </td>
                        <td className="py-3 px-3 text-center font-mono tabular-nums text-zinc-200">
                          {summary.recordsCount}
                        </td>
                        <td className="py-3 px-3 text-center font-mono tabular-nums">
                          <span className="font-bold text-indigo-400">{summary.totalHours}h</span>{' '}
                          <span className="text-[11px] text-zinc-500">
                            ({summary.totalMinutes.toLocaleString('vi-VN')}p)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono tabular-nums">
                          {summary.totalLateCount > 0 || summary.totalEarlyCount > 0 ? (
                            <span className="text-amber-400 font-semibold">
                              {summary.totalLateCount} trễ · {summary.totalEarlyCount} sớm
                            </span>
                          ) : (
                            <span className="text-emerald-400/80 font-sans text-[11px]">Chuẩn giờ</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-400 text-sm">
                          {summary.estimatedSalary.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => setPayslipUser(summary)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="Xem phiếu lương chi tiết"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Phiếu lương</span>
                            </button>

                            <button
                              onClick={() =>
                                setExpandedUserId(isExpanded ? null : summary.userId)
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer"
                            >
                              {isExpanded ? (
                                <>
                                  <span>Ẩn</span> <ChevronUp className="w-3.5 h-3.5" />
                                </>
                              ) : (
                                <>
                                  <span>Nhật ký</span> <ChevronDown className="w-3.5 h-3.5" />
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Daily Shift Breakdown */}
                      {isExpanded && (
                        <tr className="bg-zinc-950/70">
                          <td colSpan={8} className="p-3.5 border-b border-zinc-800">
                            <div className="rounded-xl border border-zinc-800/80 overflow-x-auto bg-zinc-900/60 px-3 py-2">
                              {userMonthRecords.length === 0 ? (
                                <div className="py-4 text-center text-xs text-zinc-500">
                                  Chưa có ca làm việc nào trong tháng {selectedMonth}.
                                </div>
                              ) : (
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="text-zinc-500 text-[11px] border-b border-zinc-800/60 whitespace-nowrap">
                                      <th className="py-2 px-2 font-medium">Ngày</th>
                                      <th className="py-2 px-2 font-medium">Ca làm</th>
                                      <th className="py-2 px-2 font-medium">Giờ vào → Ra</th>
                                      <th className="py-2 px-2 font-medium">Thời lượng</th>
                                      <th className="py-2 px-2 font-medium">Lương ca</th>
                                      <th className="py-2 px-2 font-medium">Ghi chú</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-800/40">
                                    {userMonthRecords.map((r) => {
                                      const isAfternoon =
                                        r.shiftId === 'shift_afternoon' ||
                                        new Date(r.checkInTime).getHours() >= 14;
                                      return (
                                        <tr key={r.id} className="whitespace-nowrap">
                                          <td className="py-2 px-2 font-mono text-zinc-300">{r.date}</td>
                                          <td className="py-2 px-2 font-semibold text-zinc-200">
                                            {isAfternoon ? 'Ca Chiều' : 'Ca Sáng'}
                                          </td>
                                          <td className="py-2 px-2 font-mono tabular-nums text-zinc-200">
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
                                            {r.isLate && (
                                              <span className="text-amber-400 font-sans ml-1.5">· Muộn</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-2 font-mono tabular-nums font-semibold text-indigo-300">
                                            {(r.totalMinutes / 60).toFixed(1)}h{' '}
                                            <span className="text-zinc-500 font-normal">({r.totalMinutes}p)</span>
                                          </td>
                                          <td className="py-2 px-2 font-mono tabular-nums text-emerald-400 font-semibold">
                                            {r.estimatedShiftPay
                                              ? `${r.estimatedShiftPay.toLocaleString('vi-VN')}đ`
                                              : '--'}
                                          </td>
                                          <td className="py-2 px-2 text-zinc-400 max-w-[220px] truncate">
                                            {r.checkInMethod === 'manual_admin' ? 'Chấm hộ' : 'WiFi quán'}
                                            {r.note ? ` · ${r.note}` : ''}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
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

      {/* Printable Individual Payslip Modal */}
      {payslipUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-zinc-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Phiếu Lương Nhân Viên</h3>
                  <p className="text-[11px] text-zinc-400">
                    {storeConfig?.storeName || 'Cháo Mầm Nhỏ Thái Thịnh'} · Tháng {selectedMonth}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPayslipUser(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-zinc-100">{payslipUser.userName}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{payslipUser.position}</div>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-400 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  {payslipUser.employeeCode}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-zinc-800/70">
                  <span className="text-zinc-400">Mức lương theo giờ</span>
                  <span className="font-mono font-semibold text-zinc-200">
                    {(payslipUser.hourlyRate || 0).toLocaleString('vi-VN')}đ / giờ
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-800/70">
                  <span className="text-zinc-400">Số ngày đi làm</span>
                  <span className="font-mono font-semibold text-zinc-200">
                    {payslipUser.totalDaysWorked} ngày ({payslipUser.recordsCount} ca)
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-800/70">
                  <span className="text-zinc-400">Tổng thời gian làm việc</span>
                  <span className="font-mono font-bold text-indigo-400">
                    {payslipUser.totalHours} giờ ({payslipUser.totalMinutes.toLocaleString('vi-VN')} phút)
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-800/70">
                  <span className="text-zinc-400">Chuyên cần (Đi muộn / Về sớm)</span>
                  <span className="font-mono text-zinc-200">
                    {payslipUser.totalLateCount} lần muộn · {payslipUser.totalEarlyCount} lần về sớm
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-300">TỔNG LƯƠNG THỰC LĨNH</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Tính theo {payslipUser.totalMinutes} phút công thực tế
                  </div>
                </div>
                <div className="text-xl font-black font-mono tabular-nums text-emerald-400">
                  {payslipUser.estimatedSalary.toLocaleString('vi-VN')}đ
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> In phiếu lương
                </button>
                <button
                  onClick={() => setPayslipUser(null)}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
