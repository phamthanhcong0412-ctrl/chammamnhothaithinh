import * as XLSX from 'xlsx';
import type { AttendanceRecord, MonthlyEmployeeSummary, User } from '../types/index.ts';

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function formatIsoToVnTime(isoStr?: string | null): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const yr = d.getFullYear();
    return `${h}:${m}:${s} ${day}/${mon}/${yr}`;
  } catch {
    return isoStr;
  }
}

function formatIsoTimeOnly(isoStr?: string | null): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return '';
  }
}

function getDayOfWeekName(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return DAY_NAMES[d.getDay()] || '';
  } catch {
    return '';
  }
}

export interface ExportDetailedPayrollOptions {
  month: string; // YYYY-MM
  storeName?: string;
  summaries: MonthlyEmployeeSummary[];
  attendanceRecords: AttendanceRecord[];
  users: User[];
  currentUserName?: string;
}

export function exportDetailedPayrollExcel({
  month,
  storeName = 'Cháo Mầm Nhỏ Thái Thịnh',
  summaries,
  attendanceRecords,
  users,
  currentUserName,
}: ExportDetailedPayrollOptions): void {
  const wb = XLSX.utils.book_new();

  // Lọc bản ghi của tháng được chọn
  const monthRecords = attendanceRecords
    .filter((r) => r.date && r.date.startsWith(month))
    .sort((a, b) => {
      // Sắp xếp tăng dần theo ngày rồi đến giờ vào ca
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime();
    });

  // Map người dùng để lấy thông tin chi tiết
  const userMap = new Map<string, User>();
  users.forEach((u) => userMap.set(u.id, u));

  // ==========================================================================
  // SHEET 1: BẢNG TỔNG HỢP LƯƠNG THÁNG
  // ==========================================================================
  const summaryRows = summaries.map((s, index) => {
    const u = userMap.get(s.userId);
    return {
      'STT': index + 1,
      'Mã Nhân Viên': s.employeeCode || u?.employeeCode || '',
      'Họ và Tên': s.userName,
      'Vị Trí / Chức Vụ': s.position || u?.position || '',
      'Số Điện Thoại': u?.phone || '',
      'Đơn Giá Lương (VND/giờ)': s.hourlyRate,
      'Số Ngày Đi Làm': s.totalDaysWorked,
      'Tổng Số Ca Hoàn Thành': s.recordsCount,
      'Tổng Thời Gian (Phút)': s.totalMinutes,
      'Tổng Thời Gian (Giờ)': s.totalHours,
      'Lương Thực Lĩnh (VND)': s.estimatedSalary,
      'Ghi Chú': u?.isActive === false ? 'Đã nghỉ việc' : 'Đang làm việc',
    };
  });

  // Dòng Tổng Cộng
  const totalHours = summaries.reduce((acc, s) => acc + (s.totalHours || 0), 0);
  const totalMinutes = summaries.reduce((acc, s) => acc + (s.totalMinutes || 0), 0);
  const totalSalary = summaries.reduce((acc, s) => acc + (s.estimatedSalary || 0), 0);
  const totalShifts = summaries.reduce((acc, s) => acc + (s.recordsCount || 0), 0);

  summaryRows.push({
    'STT': '' as any,
    'Mã Nhân Viên': 'TỔNG CỘNG',
    'Họ và Tên': `${summaries.length} Nhân Sự`,
    'Vị Trí / Chức Vụ': '',
    'Số Điện Thoại': '',
    'Đơn Giá Lương (VND/giờ)': '' as any,
    'Số Ngày Đi Làm': '' as any,
    'Tổng Số Ca Hoàn Thành': totalShifts,
    'Tổng Thời Gian (Phút)': totalMinutes,
    'Tổng Thời Gian (Giờ)': Number(totalHours.toFixed(2)),
    'Lương Thực Lĩnh (VND)': totalSalary,
    'Ghi Chú': `Xuất ngày: ${new Date().toLocaleDateString('vi-VN')}`,
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 6 },  // STT
    { wch: 15 }, // Mã NV
    { wch: 28 }, // Họ và Tên
    { wch: 22 }, // Vị Trí
    { wch: 14 }, // SĐT
    { wch: 22 }, // Đơn giá
    { wch: 16 }, // Ngày công
    { wch: 22 }, // Tổng ca
    { wch: 20 }, // Tổng phút
    { wch: 20 }, // Tổng giờ
    { wch: 24 }, // Lương
    { wch: 22 }, // Ghi chú
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Bang_Luong_Tong_Hop');

  // ==========================================================================
  // SHEET 2: LỊCH SỬ CHẤM CÔNG CHI TIẾT (FULL BACKUP TỪNG CA)
  // ==========================================================================
  const detailRows = monthRecords.map((r, index) => {
    const u = userMap.get(r.userId);
    const hourlyRate = r.hourlyRate || u?.hourlyRate || 28000;
    const totalMinutes = r.totalMinutes || 0;
    const totalHours = r.totalHours || Number((totalMinutes / 60).toFixed(2));
    const estimatedPay = r.estimatedShiftPay || Math.round((totalMinutes / 60) * hourlyRate);

    // Diễn giải chi tiết các lượt vào/ra nếu ca có nhiều lượt gộp
    let turnsDetail = '';
    if (r.turns && r.turns.length > 0) {
      turnsDetail = r.turns
        .map(
          (t, ti) =>
            `Lượt ${ti + 1}: ${formatIsoTimeOnly(t.checkInTime)}-${formatIsoTimeOnly(t.checkOutTime)} (${t.minutes}p${t.note ? ` - ${t.note}` : ''})`
        )
        .join(' | ');
    }

    let methodStr = 'Nút trực tiếp';
    if (r.checkInMethod === 'qr_wifi' || r.checkInMethod === 'qr_gps' || r.checkInMethod === 'qr_wifi_gps') {
      methodStr = 'Quét mã QR';
    } else if (r.checkInMethod === 'manual_admin') {
      methodStr = 'Quản lý chốt bổ sung';
    } else if (r.checkInMethod === 'direct_button') {
      methodStr = 'Nút trực tiếp';
    }

    return {
      'STT': index + 1,
      'Mã Bản Ghi (ID)': r.id,
      'Mã Nhân Viên': r.employeeCode || u?.employeeCode || '',
      'Họ và Tên': r.userName,
      'Vị Trí': u?.position || '',
      'Ngày Làm Việc': r.date,
      'Thứ Trong Tuần': getDayOfWeekName(r.date),
      'Tên Ca Làm': r.shiftName || (new Date(r.checkInTime).getHours() >= 14 ? 'Ca Chiều' : 'Ca Sáng'),
      'Giờ Vào Ca': formatIsoToVnTime(r.checkInTime),
      'Giờ Tan Ca': formatIsoToVnTime(r.checkOutTime),
      'Thời Gian Làm (Phút)': totalMinutes,
      'Thời Gian Làm (Giờ)': totalHours,
      'Đơn Giá (VND/giờ)': hourlyRate,
      'Lương Ca Này (VND)': estimatedPay,
      'Trạng Thái': r.status === 'completed' ? 'Hoàn thành' : 'Đang trong ca',
      'Tự Chốt Quên Check-out': r.autoClosed ? 'CÓ (Tự chốt lúc hết ca)' : 'Không',
      'Phương Thức Chấm Công': methodStr,
      'IP Chấm Công': r.checkInIp || '',
      'WiFi Kết Nối': r.checkInWifiSsid || '',
      'Chi Tiết Các Lượt Ra/Vào': turnsDetail || '1 lượt làm duy nhất',
      'Ghi Chú': r.note || '',
      'Người Điều Chỉnh': r.adjustedBy || '',
      'Lý Do Điều Chỉnh': r.adjustedReason || '',
      'Thời Điểm Tạo': formatIsoToVnTime(r.createdAt),
    };
  });

  const wsDetail = XLSX.utils.json_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 6 },  // STT
    { wch: 22 }, // ID
    { wch: 14 }, // Mã NV
    { wch: 26 }, // Họ Tên
    { wch: 20 }, // Vị Trí
    { wch: 14 }, // Ngày
    { wch: 14 }, // Thứ
    { wch: 24 }, // Tên Ca
    { wch: 22 }, // Vào
    { wch: 22 }, // Ra
    { wch: 18 }, // Phút
    { wch: 18 }, // Giờ
    { wch: 18 }, // Đơn giá
    { wch: 20 }, // Lương
    { wch: 16 }, // Trạng thái
    { wch: 24 }, // Tự chốt
    { wch: 22 }, // Phương thức
    { wch: 16 }, // IP
    { wch: 22 }, // Wifi
    { wch: 35 }, // Chi tiết lượt
    { wch: 30 }, // Ghi chú
    { wch: 24 }, // Người sửa
    { wch: 26 }, // Lý do sửa
    { wch: 22 }, // Tạo lúc
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'LichSu_ChamCong_ChiTiet');

  // ==========================================================================
  // SHEET 3: LƯƠNG VÀ CÔNG TỪNG NGÀY CỦA TỪNG NHÂN VIÊN
  // ==========================================================================
  // Gom nhóm theo Cặp (Ngày + Nhân Viên)
  const dailyUserMap = new Map<string, {
    date: string;
    userId: string;
    userName: string;
    employeeCode: string;
    position: string;
    hourlyRate: number;
    shifts: string[];
    totalMinutes: number;
    totalPay: number;
    notes: string[];
    timeDetails: string[];
  }>();

  monthRecords.forEach((r) => {
    const key = `${r.date}_${r.userId}`;
    const u = userMap.get(r.userId);
    const hourlyRate = r.hourlyRate || u?.hourlyRate || 28000;
    const mins = r.totalMinutes || 0;
    const pay = r.estimatedShiftPay || Math.round((mins / 60) * hourlyRate);
    const shiftName = r.shiftName || (new Date(r.checkInTime).getHours() >= 14 ? 'Ca Chiều' : 'Ca Sáng');
    const timeDetail = `${shiftName}: ${formatIsoTimeOnly(r.checkInTime)} - ${formatIsoTimeOnly(r.checkOutTime)} (${mins}p)`;

    const existing = dailyUserMap.get(key);
    if (!existing) {
      dailyUserMap.set(key, {
        date: r.date,
        userId: r.userId,
        userName: r.userName,
        employeeCode: r.employeeCode || u?.employeeCode || '',
        position: u?.position || '',
        hourlyRate,
        shifts: [shiftName],
        totalMinutes: mins,
        totalPay: pay,
        notes: r.note ? [r.note] : [],
        timeDetails: [timeDetail],
      });
    } else {
      existing.shifts.push(shiftName);
      existing.totalMinutes += mins;
      existing.totalPay += pay;
      if (r.note) existing.notes.push(r.note);
      existing.timeDetails.push(timeDetail);
    }
  });

  const dailyRows = Array.from(dailyUserMap.values())
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.employeeCode.localeCompare(b.employeeCode);
    })
    .map((item, index) => {
      const totalHours = Number((item.totalMinutes / 60).toFixed(2));
      return {
        'STT': index + 1,
        'Ngày Làm Việc': item.date,
        'Thứ Trong Tuần': getDayOfWeekName(item.date),
        'Mã Nhân Viên': item.employeeCode,
        'Họ và Tên': item.userName,
        'Vị Trí': item.position,
        'Các Ca Làm Trong Ngày': item.shifts.join(' + '),
        'Số Ca Đi Làm': item.shifts.length,
        'Tổng Thời Gian (Phút)': item.totalMinutes,
        'Tổng Thời Gian (Giờ)': totalHours,
        'Đơn Giá (VND/giờ)': item.hourlyRate,
        'Tổng Lương Ngày Này (VND)': item.totalPay,
        'Chi Tiết Giờ Vào - Ra': item.timeDetails.join(' | '),
        'Ghi Chú': item.notes.join('; '),
      };
    });

  const wsDaily = XLSX.utils.json_to_sheet(dailyRows);
  wsDaily['!cols'] = [
    { wch: 6 },  // STT
    { wch: 14 }, // Ngày
    { wch: 14 }, // Thứ
    { wch: 14 }, // Mã NV
    { wch: 26 }, // Họ Tên
    { wch: 20 }, // Vị Trí
    { wch: 28 }, // Ca trong ngày
    { wch: 14 }, // Số ca
    { wch: 18 }, // Phút
    { wch: 18 }, // Giờ
    { wch: 18 }, // Đơn giá
    { wch: 24 }, // Lương ngày
    { wch: 38 }, // Chi tiết giờ
    { wch: 30 }, // Ghi chú
  ];
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Luong_Tung_Ngay_Nhan_Vien');

  // ==========================================================================
  // XUẤT FILE EXCEL (.XLSX)
  // ==========================================================================
  const cleanStoreName = storeName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `BangLuong_ChiTiet_${month}_${cleanStoreName}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
