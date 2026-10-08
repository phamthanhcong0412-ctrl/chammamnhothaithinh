/**
 * SERVER SERVICE: email-report.service
 * Chuyên trách: Soạn thảo mẫu email báo cáo HTML đẹp mắt, tối ưu thiết kế,
 * tính toán các chỉ số KPI tóm tắt trong ngày (SRP)
 */

import { db } from '../storage/json-repository.ts';

export function compileDailyEmailHtml(dateStr: string): { subject: string; html: string; summary: any } {
  const storeConfig = db.getConfig();
  const users = db.getUsers();
  const attendance = db.getAttendance();

  const dateRecords = attendance.filter((r) => r.date === dateStr);
  const currentMonth = dateStr.substring(0, 7);
  const monthRecords = attendance.filter((r) => r.date.startsWith(currentMonth));

  const totalStaff = users.filter((u) => u.isActive && u.role === 'staff').length;
  const staffWorkedToday = new Set(dateRecords.map((r) => r.userId)).size;
  const totalMinutesToday = dateRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
  const totalHoursToday = (totalMinutesToday / 60).toFixed(1);

  const subject = `[Báo Cáo Chấm Công] ${storeConfig.storeName} - Ngày ${dateStr}`;

  const staffRowsHtml = users
    .filter((u) => u.role === 'staff')
    .map((user) => {
      const todayRec = dateRecords.find((r) => r.userId === user.id);
      const userMonthRecs = monthRecords.filter((r) => r.userId === user.id);
      const monthHours = (
        userMonthRecs.reduce((sum, r) => sum + (r.totalMinutes || 0), 0) / 60
      ).toFixed(1);

      let statusBadge = '<span style="color:#94a3b8;font-size:12px;">Vắng mặt</span>';
      let checkInStr = '--';
      let checkOutStr = '--';
      let hoursTodayStr = '0h';

      if (todayRec) {
        checkInStr = new Date(todayRec.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        if (todayRec.checkOutTime) {
          checkOutStr = new Date(todayRec.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          hoursTodayStr = `${(todayRec.totalMinutes / 60).toFixed(1)}h`;
          statusBadge = '<span style="color:#10b981;font-weight:600;font-size:12px;">Đã hoàn thành</span>';
        } else {
          statusBadge = '<span style="color:#6366f1;font-weight:600;font-size:12px;">Đang làm việc</span>';
        }
      }

      return `
        <tr style="border-bottom:1px solid #27272a;">
          <td style="padding:12px 8px;font-weight:600;color:#f4f4f5;">
            ${user.name}<br/>
            <span style="font-size:11px;color:#a1a1aa;font-weight:normal;">${user.employeeCode} - ${user.position}</span>
          </td>
          <td style="padding:12px 8px;text-align:center;color:#e4e4e7;">${checkInStr}</td>
          <td style="padding:12px 8px;text-align:center;color:#e4e4e7;">${checkOutStr}</td>
          <td style="padding:12px 8px;text-align:center;color:#facc15;font-weight:600;">${hoursTodayStr}</td>
          <td style="padding:12px 8px;text-align:center;color:#38bdf8;font-weight:600;">${monthHours}h</td>
          <td style="padding:12px 8px;text-align:right;">${statusBadge}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="margin:0;padding:24px;background-color:#09090b;font-family:'Be Vietnam Pro',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f4f4f5;">
      <div style="max-width:640px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
        
        <!-- Header -->
        <div style="border-bottom:1px solid #27272a;padding-bottom:18px;margin-bottom:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <h1 style="margin:0;font-size:22px;color:#f4f4f5;font-weight:700;letter-spacing:-0.5px;">${storeConfig.storeName}</h1>
              <p style="margin:4px 0 0;font-size:13px;color:#a1a1aa;">Báo Cáo Tự Động Hằng Ngày Lúc 21:00 • Ngày ${dateStr}</p>
            </div>
          </div>
        </div>

        <!-- KPI Metrics -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
          <div style="background:#27272a;padding:14px;border-radius:12px;text-align:center;">
            <div style="font-size:12px;color:#a1a1aa;text-transform:uppercase;">Có mặt hôm nay</div>
            <div style="font-size:24px;font-weight:700;color:#10b981;margin-top:4px;">${staffWorkedToday} / ${totalStaff}</div>
          </div>
          <div style="background:#27272a;padding:14px;border-radius:12px;text-align:center;">
            <div style="font-size:12px;color:#a1a1aa;text-transform:uppercase;">Tổng giờ hôm nay</div>
            <div style="font-size:24px;font-weight:700;color:#6366f1;margin-top:4px;">${totalHoursToday}h</div>
          </div>
          <div style="background:#27272a;padding:14px;border-radius:12px;text-align:center;">
            <div style="font-size:12px;color:#a1a1aa;text-transform:uppercase;">Tháng ${currentMonth}</div>
            <div style="font-size:24px;font-weight:700;color:#f59e0b;margin-top:4px;">${monthRecords.length} ca</div>
          </div>
        </div>

        <!-- Table -->
        <h2 style="font-size:15px;color:#f4f4f5;margin:0 0 12px;font-weight:600;">Chi Tiết Chấm Công Từng Nhân Viên</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
          <thead>
            <tr style="border-bottom:1px solid #3f3f46;color:#a1a1aa;text-align:left;">
              <th style="padding:8px 8px;">Nhân viên</th>
              <th style="padding:8px 8px;text-align:center;">Vào</th>
              <th style="padding:8px 8px;text-align:center;">Ra</th>
              <th style="padding:8px 8px;text-align:center;">Hôm nay</th>
              <th style="padding:8px 8px;text-align:center;">Lũy kế tháng</th>
              <th style="padding:8px 8px;text-align:right;">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            ${staffRowsHtml}
          </tbody>
        </table>

        <!-- Footer -->
        <div style="border-top:1px solid #27272a;padding-top:16px;text-align:center;font-size:12px;color:#71717a;">
          <p style="margin:0;">Báo cáo được tạo tự động bởi Hệ Thống Chấm Công Thông Minh QR & WiFi.</p>
          <p style="margin:4px 0 0;">Cửa hàng: ${storeConfig.storeAddress}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    subject,
    html,
    summary: {
      totalStaff,
      workedToday: staffWorkedToday,
      totalHours: Number(totalHoursToday),
    },
  };
}
