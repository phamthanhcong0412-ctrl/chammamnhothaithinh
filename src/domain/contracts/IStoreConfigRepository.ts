/**
 * CONTRACT: IStoreConfigRepository
 * DIP & LSP: Trừu tượng hóa truy xuất cấu hình cửa hàng, ca làm, WiFi, GPS.
 */

import type { StoreConfig } from '../../types/index.ts';

export interface IStoreConfigRepository {
  /**
   * Lấy cấu hình cửa hàng hiện tại
   */
  getConfig(): Promise<StoreConfig>;

  /**
   * Lưu hoặc cập nhật cấu hình cửa hàng
   */
  saveConfig(config: StoreConfig): Promise<StoreConfig>;
}
