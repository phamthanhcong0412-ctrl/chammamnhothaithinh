/**
 * REPOSITORY IMPLEMENTATION: CompositeStoreConfigRepository
 * Tổ hợp lưu trữ cấu hình quán (Supabase Primary + Local Storage Fallback - DIP & LSP)
 */

import type { IStoreConfigRepository } from '../../domain/contracts/IStoreConfigRepository.ts';
import type { StoreConfig } from '../../types/index.ts';
import { SupabaseStoreConfigRepository } from './SupabaseStoreConfigRepository.ts';
import { LocalStoreConfigRepository } from './LocalStoreConfigRepository.ts';
import { isSupabaseConfigured } from '../../supabase.ts';

export class CompositeStoreConfigRepository implements IStoreConfigRepository {
  private remoteRepo: IStoreConfigRepository;
  private localRepo: IStoreConfigRepository;

  constructor(
    remoteRepo: IStoreConfigRepository = new SupabaseStoreConfigRepository(),
    localRepo: IStoreConfigRepository = new LocalStoreConfigRepository()
  ) {
    this.remoteRepo = remoteRepo;
    this.localRepo = localRepo;
  }

  async getConfig(): Promise<StoreConfig> {
    if (isSupabaseConfigured) {
      try {
        const remoteCfg = await this.remoteRepo.getConfig();
        if (remoteCfg) {
          await this.localRepo.saveConfig(remoteCfg);
          return remoteCfg;
        }
      } catch (err) {
        console.warn('CompositeStoreConfigRepository remote read warning, falling back to local:', err);
      }
    }
    return await this.localRepo.getConfig();
  }

  async saveConfig(config: StoreConfig): Promise<StoreConfig> {
    await this.localRepo.saveConfig(config);
    if (isSupabaseConfigured) {
      try {
        await this.remoteRepo.saveConfig(config);
      } catch (err) {
        console.warn('Lỗi lưu remote store config:', err);
      }
    }
    return config;
  }
}
