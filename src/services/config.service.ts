/**
 * APPLICATION SERVICE: ConfigService
 * Chuyên trách: Cấu hình cửa hàng, mạng WiFi/IP, lấy thông tin mạng và phát sinh mã QR (SRP)
 */

import type { StoreConfig, NetworkInfo } from '../types/index.ts';
import {
  isSupabaseConfigured,
  fetchStoreConfigFromSupabase,
  saveStoreConfigToSupabase,
} from '../supabase.ts';
import {
  getDualBandWifiProfile,
  isClientIpAllowedByConfig,
} from '../domain/index.ts';
import { DEFAULT_STORE_CONFIG } from '../infrastructure/index.ts';

const API_BASE = '/api';
const STORAGE_KEY_CONFIG = 'chammam_store_config_v2';

function loadLocal<T>(key: string, fallback: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      if (item) return JSON.parse(item);
    }
  } catch {}
  return fallback;
}

function saveLocal<T>(key: string, value: T): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {}
}

async function fetchJsonOrThrow(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('STATIC_HOST_FALLBACK');
  }
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

let cachedPublicIp: { ip: string; fetchedAt: number } | null = null;

export async function detectClientPublicIp(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedPublicIp && Date.now() - cachedPublicIp.fetchedAt < 300000) {
    return cachedPublicIp.ip;
  }

  // 1. IPv4-only json endpoints
  const ipv4JsonEndpoints = [
    'https://api.ipify.org?format=json',
    'https://api4.ipify.org?format=json',
  ];

  for (const url of ipv4JsonEndpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data?.ip && typeof data.ip === 'string') {
          const cleanIp = data.ip.trim();
          cachedPublicIp = { ip: cleanIp, fetchedAt: Date.now() };
          return cleanIp;
        }
      }
    } catch {}
  }

  // 2. Fallback: icanhazip IPv4
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const res = await fetch('https://ipv4.icanhazip.com', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const cleanIp = (await res.text()).trim();
      if (cleanIp && /^\d{1,3}(\.\d{1,3}){3}$/.test(cleanIp)) {
        cachedPublicIp = { ip: cleanIp, fetchedAt: Date.now() };
        return cleanIp;
      }
    }
  } catch {}

  // 3. Fallback: Cloudflare trace
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://1.1.1.1/cdn-cgi/trace', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/^ip=(.+)$/m);
      if (match && match[1]) {
        const cleanIp = match[1].trim();
        cachedPublicIp = { ip: cleanIp, fetchedAt: Date.now() };
        return cleanIp;
      }
    }
  } catch {}

  // 4. Fallback: backend /api/network-info
  try {
    const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/network-info`);
    if (ok && data?.clientIp) {
      cachedPublicIp = { ip: String(data.clientIp).trim(), fetchedAt: Date.now() };
      return cachedPublicIp.ip;
    }
  } catch {}

  return cachedPublicIp?.ip || '14.161.45.88';
}

export class ConfigService {
  async getConfig(): Promise<StoreConfig> {
    let baseConfig = loadLocal<StoreConfig>(STORAGE_KEY_CONFIG, DEFAULT_STORE_CONFIG);

    if (isSupabaseConfigured) {
      try {
        const sbCfg = await fetchStoreConfigFromSupabase();
        if (sbCfg) {
          baseConfig = {
            ...baseConfig,
            ...sbCfg,
            allowedIps:
              Array.isArray(sbCfg.allowedIps) && sbCfg.allowedIps.length > 0
                ? sbCfg.allowedIps
                : baseConfig.allowedIps,
            shifts:
              Array.isArray(sbCfg.shifts) && sbCfg.shifts.length > 0
                ? sbCfg.shifts
                : baseConfig.shifts,
          };
          saveLocal(STORAGE_KEY_CONFIG, baseConfig);
          return baseConfig;
        }
      } catch (e) {
        console.warn('Supabase getConfig warning:', e);
      }
    }

    try {
      const apiRes = await fetchJsonOrThrow(`${API_BASE}/config`);
      if (apiRes?.ok && apiRes.data) {
        baseConfig = {
          ...baseConfig,
          ...apiRes.data,
        };
      }
    } catch {}

    saveLocal(STORAGE_KEY_CONFIG, baseConfig);
    return baseConfig;
  }

  async updateConfig(config: Partial<StoreConfig>): Promise<{ success: boolean; config: StoreConfig }> {
    const current = loadLocal<StoreConfig>(STORAGE_KEY_CONFIG, DEFAULT_STORE_CONFIG);
    const updated: StoreConfig = {
      ...current,
      ...config,
      allowedIps: Array.isArray(config.allowedIps)
        ? Array.from(new Set(config.allowedIps.map((ip) => String(ip).trim()).filter(Boolean)))
        : current.allowedIps,
      shifts: Array.isArray(config.shifts) ? config.shifts : current.shifts,
    };

    // 1. Lưu lên Supabase
    if (isSupabaseConfigured) {
      saveStoreConfigToSupabase(updated).catch(() => {});
    }

    // 2. Lưu localStorage & backend API
    saveLocal(STORAGE_KEY_CONFIG, updated);
    fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});

    return { success: true, config: updated };
  }

  async getNetworkInfo(forceRefresh = false): Promise<NetworkInfo> {
    const [clientIp, cfg, serverNet] = await Promise.all([
      detectClientPublicIp(forceRefresh),
      this.getConfig().catch(() => loadLocal<StoreConfig>(STORAGE_KEY_CONFIG, DEFAULT_STORE_CONFIG)),
      fetchJsonOrThrow(`${API_BASE}/network-info`).catch(() => null),
    ]);

    const isAllowedIp = isClientIpAllowedByConfig(clientIp, cfg);
    const rawDetectedSsid =
      (serverNet?.ok && serverNet.data?.detectedSsid ? String(serverNet.data.detectedSsid) : '') ||
      cfg.wifiSsid ||
      'ChaoMamNho_ThaiThinh';
    const dualProfile = getDualBandWifiProfile(rawDetectedSsid, clientIp, cfg.storeName);

    return {
      clientIp,
      isAllowedIp,
      detectedSsid: dualProfile.dualSsidLabel,
      bssid24G: dualProfile.bssid24G,
      bssid5G: dualProfile.bssid5G,
      timestamp: Date.now(),
    };
  }

  async getQrToken(): Promise<{ token: string; generatedAt: number; expiresAt: number; storeName: string }> {
    try {
      const { ok, data } = await fetchJsonOrThrow(`${API_BASE}/qr/token`);
      if (!ok) throw new Error('Không thể tạo mã QR mới');
      return data;
    } catch {
      const cfg = loadLocal<StoreConfig>(STORAGE_KEY_CONFIG, DEFAULT_STORE_CONFIG);
      const now = Date.now();
      const refreshMs = (cfg.qrRefreshSeconds || 45) * 1000;
      const bucket = Math.floor(now / refreshMs);
      return {
        token: `ARTISANS_${bucket}_STATIC`,
        generatedAt: bucket * refreshMs,
        expiresAt: (bucket + 1) * refreshMs,
        storeName: cfg.storeName,
      };
    }
  }
}

export const configService = new ConfigService();
