/**
 * DOMAIN: WifiProfileParser
 * Chuyên trách: Xử lý SSID mạng kép 2.4G/5G, dẫn xuất mã BSSID và kiểm tra IP hợp lệ (SRP)
 */

import type { StoreConfig } from '../../types/index.ts';

export function extractWifiBaseName(rawSsid?: string, storeName?: string): string {
  if (rawSsid && rawSsid.trim()) {
    let cleaned = rawSsid
      .replace(/\s*\([^)]*(?:2\.4|5G|band)[^)]*\)/gi, '')
      .replace(/\s*\(2\.4G.*$/gi, '')
      .replace(/[\s_-]*(2\.4GHz|5GHz|2\.4G|5G|24G)$/gi, '')
      .trim();
    if (cleaned) return cleaned;
  }
  if (storeName && storeName.trim()) {
    const slug = storeName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    if (slug) return slug;
  }
  return 'ChaoMamNho_ThaiThinh';
}

export function deriveDualBandBssidFromIp(ip: string): {
  bssid24G: string;
  bssid5G: string;
  dualBssid: string;
} {
  const parts = String(ip || '14.161.45.88')
    .split('.')
    .map((n) => {
      const parsed = parseInt(n, 10);
      return Number.isNaN(parsed) ? 88 : parsed & 0xff;
    });
  while (parts.length < 4) parts.push(161);
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
  const b24 = `A4:2B:${hex(parts[0])}:${hex(parts[1])}:${hex(parts[2])}:${hex(parts[3])}`;
  const b5Last = hex((parts[3] + 1) & 0xff);
  const b5 = `A4:2B:${hex(parts[0])}:${hex(parts[1])}:${hex(parts[2])}:${b5Last}`;
  return {
    bssid24G: b24,
    bssid5G: b5,
    dualBssid: `${b24} (2.4G) / ${b5Last} (5G)`,
  };
}

export function deriveBssidFromNetworkIp(ip: string): string {
  return deriveDualBandBssidFromIp(ip).dualBssid;
}

export function getDualBandWifiProfile(
  rawSsid?: string,
  ip = '14.161.45.88',
  storeName?: string
): {
  baseSsid: string;
  ssid24G: string;
  ssid5G: string;
  dualSsidLabel: string;
  bssid24G: string;
  bssid5G: string;
  dualBssid: string;
  acceptedSsids: string[];
} {
  const baseSsid = extractWifiBaseName(rawSsid, storeName);
  const ssid24G = `${baseSsid}_2.4G`;
  const ssid5G = `${baseSsid}_5G`;
  const dualSsidLabel = `${baseSsid} (2.4G / 5G)`;
  const { bssid24G, bssid5G, dualBssid } = deriveDualBandBssidFromIp(ip);

  return {
    baseSsid,
    ssid24G,
    ssid5G,
    dualSsidLabel,
    bssid24G,
    bssid5G,
    dualBssid,
    acceptedSsids: [
      dualSsidLabel,
      ssid24G,
      ssid5G,
      baseSsid,
      `${baseSsid}-2.4G`,
      `${baseSsid}-5G`,
      `${baseSsid} 2.4G`,
      `${baseSsid} 5G`,
    ],
  };
}

export function isWifiSsidAllowedByDualBand(
  candidateSsid: string | undefined,
  cfg: StoreConfig
): boolean {
  if (!cfg.requireWifi || cfg.bypassIpCheck) return true;
  if (!candidateSsid || !candidateSsid.trim()) return true;
  const candidateBase = extractWifiBaseName(candidateSsid, cfg.storeName).toLowerCase();
  const configuredBase = extractWifiBaseName(cfg.wifiSsid, cfg.storeName).toLowerCase();
  return candidateBase === configuredBase;
}

export function isClientIpAllowedByConfig(clientIp: string, cfg: StoreConfig): boolean {
  if (!cfg.requireWifi) return true;
  if (cfg.bypassIpCheck) return true;
  const cleanClient = String(clientIp || '').trim();
  if (!cleanClient) return false;
  const allowedList = Array.isArray(cfg.allowedIps)
    ? cfg.allowedIps.map((ip) => String(ip).trim()).filter(Boolean)
    : [];
  return allowedList.includes(cleanClient);
}
