/**
 * REPOSITORY IMPLEMENTATION: LocalStoreConfigRepository
 * Hạ tầng lưu trữ cấu hình quán trên localStorage (LSP & Offline Fallback)
 */

import type { IStoreConfigRepository } from '../../domain/contracts/IStoreConfigRepository.ts';
import type { StoreConfig } from '../../types/index.ts';

const STORAGE_KEY = 'chammam_store_config_v2';

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  storeName: 'Cháo Mầm Nhỏ Thái Thịnh',
  storeAddress: 'Thái Thịnh, Đống Đa, Hà Nội',
  wifiSsid: 'ChaoMamNho_ThaiThinh_5G',
  wifiBssid: 'A4:2B:B0:C1:9E:58',
  allowedIps: ['127.0.0.1', '::1', '14.161.45.88', '118.69.182.20'],
  bypassIpCheck: true,
  requireWifi: true,
  requireQr: false,
  requireGps: false,
  storeGps: {
    lat: 21.0116,
    lng: 105.8174,
    radiusMeters: 150,
  },
  qrRefreshSeconds: 45,
  qrSecret: 'store_secret_qr_token_default',
  shifts: [
    {
      id: 'shift_morning',
      name: 'Ca Sáng (06:00 - 12:00)',
      startTime: '06:00',
      endTime: '12:00',
      lateGraceMinutes: 15,
      checkInBeforeMinutes: 30,
      checkOutAfterMinutes: 90,
    },
    {
      id: 'shift_afternoon',
      name: 'Ca Chiều (15:30 - 20:00)',
      startTime: '15:30',
      endTime: '20:00',
      lateGraceMinutes: 15,
      checkInBeforeMinutes: 30,
      checkOutAfterMinutes: 90,
    },
  ],
  autoEmailTime: '21:00',
  managerEmail: 'phamthanhcong0412@gmail.com',
  lastReportSentDate: null,
};

export class LocalStoreConfigRepository implements IStoreConfigRepository {
  private getLocalConfig(): StoreConfig {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            return {
              ...DEFAULT_STORE_CONFIG,
              ...parsed,
              storeGps: { ...DEFAULT_STORE_CONFIG.storeGps, ...parsed.storeGps },
              shifts: Array.isArray(parsed.shifts) && parsed.shifts.length > 0 ? parsed.shifts : DEFAULT_STORE_CONFIG.shifts,
            };
          }
        }
      }
    } catch (e) {
      console.warn('LocalStoreConfigRepository read warning:', e);
    }
    return DEFAULT_STORE_CONFIG;
  }

  private setLocalConfig(cfg: StoreConfig): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      }
    } catch (e) {
      console.warn('LocalStoreConfigRepository write warning:', e);
    }
  }

  async getConfig(): Promise<StoreConfig> {
    return this.getLocalConfig();
  }

  async saveConfig(config: StoreConfig): Promise<StoreConfig> {
    this.setLocalConfig(config);
    return config;
  }
}
