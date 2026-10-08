/**
 * CONTROLLER: config.controller
 * Quản lý endpoints /api/network-info, /api/qr/token, /api/config
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
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

configRouter.get('/api/network-info', (req: Request, res: Response) => {
  const storeConfig = db.getConfig();
  const clientIp = getClientIp(req);
  const isAllowedIp =
    storeConfig.bypassIpCheck ||
    storeConfig.allowedIps.includes(clientIp) ||
    clientIp === '127.0.0.1' ||
    clientIp === '::1';

  const rawSsid = storeConfig.wifiSsid || 'ChaoMamNho_ThaiThinh (2.4G / 5G)';
  const baseSsid =
    rawSsid
      .split('/')[0]
      .replace(/\s*\(2\.4G\s*[/&]\s*5G\)/gi, '')
      .replace(/[\s_-]*(2\.4GHz|5GHz|2\.4G|5G|24G)$/gi, '')
      .trim() || 'ChaoMamNho_ThaiThinh';

  res.json({
    clientIp,
    isAllowedIp,
    bypassIpCheck: storeConfig.bypassIpCheck,
    wifiSsid: storeConfig.wifiSsid,
    detectedSsid: `${baseSsid} (2.4G / 5G)`,
    ssid24G: `${baseSsid}_2.4G`,
    ssid5G: `${baseSsid}_5G`,
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
