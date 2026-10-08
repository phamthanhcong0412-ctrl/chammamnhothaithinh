/**
 * CONTRACT: IUserRepository
 * DIP & LSP: Trừu tượng hóa truy xuất dữ liệu nhân viên / tài khoản.
 */

import type { User } from '../../types/index.ts';

export interface IUserRepository {
  /**
   * Lấy toàn bộ danh sách nhân sự
   */
  getAll(): Promise<User[]>;

  /**
   * Lấy thông tin người dùng theo ID
   */
  getById(id: string): Promise<User | null>;

  /**
   * Lấy thông tin người dùng theo tên đăng nhập
   */
  getByUsername(username: string): Promise<User | null>;

  /**
   * Lưu hoặc cập nhật thông tin người dùng
   */
  save(user: User): Promise<User>;

  /**
   * Xóa hoặc vô hiệu hóa tài khoản người dùng theo ID
   */
  delete(id: string): Promise<boolean>;
}
