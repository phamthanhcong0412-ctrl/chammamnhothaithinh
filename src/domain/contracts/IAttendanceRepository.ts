/**
 * CONTRACT: IAttendanceRepository
 * DIP & LSP: Trừu tượng hóa truy xuất dữ liệu chấm công.
 * Cho phép tráo đổi giữa Supabase, LocalStorage hoặc Mock Repo cho Unit Tests.
 */

import type { AttendanceRecord } from '../../types/index.ts';

export interface IAttendanceRepository {
  /**
   * Lấy toàn bộ danh sách bản ghi chấm công
   */
  getAll(): Promise<AttendanceRecord[]>;

  /**
   * Lấy bản ghi chấm công theo ID
   */
  getById(id: string): Promise<AttendanceRecord | null>;

  /**
   * Lấy danh sách chấm công của một nhân viên
   */
  getByUserId(userId: string): Promise<AttendanceRecord[]>;

  /**
   * Lưu hoặc cập nhật một bản ghi chấm công
   */
  save(record: AttendanceRecord): Promise<AttendanceRecord>;

  /**
   * Lưu hoặc cập nhật hàng loạt bản ghi chấm công
   */
  saveBatch(records: AttendanceRecord[]): Promise<void>;

  /**
   * Xóa một bản ghi chấm công theo ID
   */
  delete(id: string): Promise<boolean>;

  /**
   * Xóa hàng loạt bản ghi chấm công theo danh sách ID
   */
  deleteBatch(ids: string[]): Promise<void>;
}
