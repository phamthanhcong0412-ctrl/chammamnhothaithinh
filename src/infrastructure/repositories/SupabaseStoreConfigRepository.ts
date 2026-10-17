/**
 * REPOSITORY IMPLEMENTATION: SupabaseStoreConfigRepository
 * Hạ tầng lưu trữ cấu hình quán trên Supabase PostgreSQL (LSP & DIP)
 */

import type { IStoreConfigRepository } from '../../domain/contracts/IStoreConfigRepository.ts';
import type { StoreConfig } from '../../types/index.ts';
import {
  isSupabaseConfigured,
  fetchStoreConfigFromSupabase,
  saveStoreConfigToSupabase,
} from '../../supabase.ts';

import { DEFAULT_STORE_CONFIG } from './LocalStoreConfigRepository.ts';

export class SupabaseStoreConfigRepository implements IStoreConfigRepository {
  async getConfig(): Promise<StoreConfig> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase chưa được cấu hình.');
    }
    const cfg = await fetchStoreConfigFromSupabase();
    if (!cfg) {
      throw new Error('Không tìm thấy cấu hình trên Supabase.');
    }
    return {
      ...DEFAULT_STORE_CONFIG,
      ...cfg,
      storeGps: { ...DEFAULT_STORE_CONFIG.storeGps, ...cfg.storeGps },
      shifts: Array.isArray(cfg.shifts) && cfg.shifts.length > 0 ? cfg.shifts : DEFAULT_STORE_CONFIG.shifts,
    };
  }

  async saveConfig(config: StoreConfig): Promise<StoreConfig> {
    if (isSupabaseConfigured) {
      await saveStoreConfigToSupabase(config);
    }
    return config;
  }
}
