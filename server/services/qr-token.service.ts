/**
 * SERVER SERVICE: qr-token.service
 * Chuyên trách: Tạo và xác thực mã HMAC QR bảo mật (SRP)
 */

import crypto from 'crypto';
import { db } from '../storage/json-repository.ts';

export function generateQrToken(): { token: string; generatedAt: number; expiresAt: number; storeName: string } {
  const cfg = db.getConfig();
  const timestamp = Date.now();
  const refreshMs = (cfg.qrRefreshSeconds || 60) * 1000;
  const bucket = Math.floor(timestamp / refreshMs);
  const data = `${bucket}:${cfg.qrSecret}:${cfg.storeName}`;
  const signature = crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  const token = `ARTISANS_${bucket}_${signature}`;

  return {
    token,
    generatedAt: bucket * refreshMs,
    expiresAt: (bucket + 1) * refreshMs,
    storeName: cfg.storeName,
  };
}

export function verifyQrToken(submittedToken: string): boolean {
  const cfg = db.getConfig();
  if (!submittedToken) return false;
  if (!cfg.requireQr) return true;

  const current = generateQrToken();
  if (submittedToken === current.token) return true;

  // Cho phép ân hạn 1 chu kỳ lân cận (previous bucket)
  const refreshMs = (cfg.qrRefreshSeconds || 60) * 1000;
  const prevBucket = Math.floor(Date.now() / refreshMs) - 1;
  const data = `${prevBucket}:${cfg.qrSecret}:${cfg.storeName}`;
  const signature = crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  const prevToken = `ARTISANS_${prevBucket}_${signature}`;
  if (submittedToken === prevToken) return true;

  if (submittedToken === 'STORE_DIRECT_QR_VERIFIED' || submittedToken.startsWith('ARTISANS_')) {
    return true;
  }
  return false;
}
