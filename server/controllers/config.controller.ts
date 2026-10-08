/**
 * CONTROLLER: config.controller
 * Quản lý endpoints /api/network-info, /api/qr/token, /api/config
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { execSync } from 'child_process';
import { db } from '../storage/json-repository.ts';
import { generateQrToken } from '../services/qr-token.service.ts';

export const configRouter = Router();

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Tự động quét Tên WiFi (SSID) và địa chỉ MAC (BSSID) của card mạng máy chủ/thiết bị đang kết nối
 */
export function detectActiveSystemWifi(): { ssid?: string; bssid?: string; signal?: string } {
  try {
    if (process.platform === 'win32') {
      const output = execSync('netsh wlan show interfaces', { encoding: 'utf-8', timeout: 2000 });
      // SSID: Tên WiFi (lưu ý không lấy AP BSSID)
      const ssidMatch = output.match(/^\s*SSID\s*:\s*(.+)$/m);
      const bssidMatch =
        output.match(/^\s*AP BSSID\s*:\s*(.+)$/m) || output.match(/^\s*BSSID\s*:\s*(.+)$/m);
      const signalMatch = output.match(/^\s*Signal\s*:\s*(.+)$/m);
      const ssid = ssidMatch ? ssidMatch[1].trim() : undefined;
      const bssid = bssidMatch ? bssidMatch[1].trim() : undefined;
      const signal = signalMatch ? signalMatch[1].trim() : undefined;
      if (ssid && ssid !== '') return { ssid, bssid, signal };
    } else if (process.platform === 'darwin') {
      const output = execSync(
        '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I',
        { encoding: 'utf-8', timeout: 2000 }
      );
      const ssidMatch = output.match(/^\s*SSID:\s*(.+)$/m);
      const bssidMatch = output.match(/^\s*BSSID:\s*(.+)$/m);
      const ssid = ssidMatch ? ssidMatch[1].trim() : undefined;
      const bssid = bssidMatch ? bssidMatch[1].trim() : undefined;
      if (ssid && ssid !== '') return { ssid, bssid };
    } else if (process.platform === 'linux') {
      try {
        const ssid = execSync('iwgetid -r', { encoding: 'utf-8', timeout: 2000 }).trim();
        if (ssid) return { ssid };
      } catch {}
      try {
        const output = execSync("nmcli -t -f active,ssid dev wifi | grep '^yes'", {
          encoding: 'utf-8',
          timeout: 2000,
        });
        const ssid = output.split(':')[1]?.trim();
        if (ssid) return { ssid };
      } catch {}
    }
  } catch {}
  return {};
}

configRouter.get('/api/network-info', (req: Request, res: Response) => {
  const storeConfig = db.getConfig();
  const clientIp = getClientIp(req);
  const isAllowedIp =
    storeConfig.bypassIpCheck ||
    storeConfig.allowedIps.includes(clientIp) ||
    clientIp === '127.0.0.1' ||
    clientIp === '::1';

  // Tự động nhận diện WiFi thực tế từ card mạng
  const systemWifi = detectActiveSystemWifi();
  const rawSsid = systemWifi.ssid || storeConfig.wifiSsid || 'ChaoMamNho_ThaiThinh (2.4G / 5G)';
  const baseSsid =
    rawSsid
      .replace(/\s*\([^)]*(?:2\.4|5G|band)[^)]*\)/gi, '')
      .replace(/\s*\(2\.4G.*$/gi, '')
      .replace(/[\s_-]*(2\.4GHz|5GHz|2\.4G|5G|24G)$/gi, '')
      .trim() || 'ChaoMamNho_ThaiThinh';

  res.json({
    clientIp,
    isAllowedIp,
    bypassIpCheck: storeConfig.bypassIpCheck,
    wifiSsid: systemWifi.ssid ? `${systemWifi.ssid} (2.4G / 5G)` : storeConfig.wifiSsid,
    detectedSsid: `${baseSsid} (2.4G / 5G)`,
    rawDetectedSsid: systemWifi.ssid || baseSsid,
    detectedBssid: systemWifi.bssid || undefined,
    ssid24G: `${baseSsid}_2.4G`,
    ssid5G: `${baseSsid}_5G`,
    signal: systemWifi.signal,
    timestamp: Date.now(),
  });
});

configRouter.get('/api/qr/token', (_req: Request, res: Response) => {
  const tokenData = generateQrToken();
  res.json(tokenData);
});

configRouter.get('/api/config', (_req: Request, res: Response) => {
  res.json(db.getConfig());
});

configRouter.post('/api/config', (req: Request, res: Response) => {
  const current = db.getConfig();
  const updated = { ...current, ...req.body };
  db.setConfig(updated);
  res.json({ success: true, config: updated });
});
