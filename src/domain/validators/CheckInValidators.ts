/**
 * STRATEGY PATTERN: Check-in / Check-out Validation Rules (OCP & SRP)
 * Cho phép mở rộng thêm phương thức xác thực mới (NFC, Face ID, Bluetooth Beacon)
 * mà không cần can thiệp hoặc sửa đổi mã nguồn cốt lõi của Check-in.
 */

import type { User, StoreConfig, ShiftConfig } from '../../types/index.ts';
import { isGpsWithinStoreRadius } from '../location/GeoLocationCalculator.ts';
import { isWifiSsidAllowedByDualBand, isClientIpAllowedByConfig } from '../network/WifiProfileParser.ts';
import { isTimeInConfiguredShifts } from '../shifts/ShiftTimingEvaluator.ts';

export interface CheckInValidationContext {
  user: User;
  storeConfig: StoreConfig;
  clientIp?: string;
  clientGps?: { lat: number; lng: number };
  clientWifiSsid?: string;
  timestamp?: Date;
  action?: 'check_in' | 'check_out';
}

export interface CheckInValidationResult {
  isValid: boolean;
  error?: string;
  matchingShift?: ShiftConfig;
  details?: Record<string, any>;
}

export interface ICheckInValidator {
  readonly name: string;
  validate(context: CheckInValidationContext): CheckInValidationResult | Promise<CheckInValidationResult>;
}

/**
 * Strategy 1: Xác thực kết nối mạng WiFi cửa hàng (IP Whitelist / Dual-band SSID)
 */
export class WifiCheckInValidator implements ICheckInValidator {
  readonly name = 'WifiCheckInValidator';

  validate(context: CheckInValidationContext): CheckInValidationResult {
    const { storeConfig, clientIp, clientWifiSsid } = context;

    if (!storeConfig.requireWifi || storeConfig.bypassIpCheck) {
      return { isValid: true };
    }

    // 1. Kiểm tra IP nếu có
    if (clientIp) {
      const isIpAllowed = isClientIpAllowedByConfig(clientIp, storeConfig);
      if (!isIpAllowed) {
        return {
          isValid: false,
          error: `Mạng không hợp lệ (IP: ${clientIp}). Vui lòng kết nối vào mạng WiFi cửa hàng để chấm công.`,
          details: { clientIp, allowedIps: storeConfig.allowedIps },
        };
      }
    }

    // 2. Kiểm tra tên mạng WiFi (SSID) nếu có thông tin SSID
    if (clientWifiSsid) {
      const isSsidAllowed = isWifiSsidAllowedByDualBand(clientWifiSsid, storeConfig);
      if (!isSsidAllowed) {
        return {
          isValid: false,
          error: `WiFi không khớp: Bạn đang kết nối "${clientWifiSsid}". Cần kết nối mạng "${storeConfig.wifiSsid}".`,
          details: { clientWifiSsid, configuredSsid: storeConfig.wifiSsid },
        };
      }
    }

    return { isValid: true };
  }
}

/**
 * Strategy 2: Xác thực vị trí địa lý GPS cửa hàng (Khóa Kép Vị Trí)
 */
export class GpsCheckInValidator implements ICheckInValidator {
  readonly name = 'GpsCheckInValidator';

  validate(context: CheckInValidationContext): CheckInValidationResult {
    const { storeConfig, clientGps } = context;

    if (!storeConfig.requireGps) {
      return { isValid: true };
    }

    const gpsCheck = isGpsWithinStoreRadius(clientGps, storeConfig.storeGps);
    if (!gpsCheck.isAllowed) {
      return {
        isValid: false,
        error: gpsCheck.error || 'Vị trí GPS ngoài phạm vi cửa hàng cho phép.',
        details: {
          distanceMeters: gpsCheck.distanceMeters,
          maxRadiusMeters: gpsCheck.maxRadiusMeters,
        },
      };
    }

    return { isValid: true, details: { distanceMeters: gpsCheck.distanceMeters } };
  }
}

/**
 * Strategy 3: Xác thực khung giờ ca làm việc và ân hạn đi muộn
 */
export class ShiftWindowCheckInValidator implements ICheckInValidator {
  readonly name = 'ShiftWindowCheckInValidator';

  validate(context: CheckInValidationContext): CheckInValidationResult {
    const { storeConfig, timestamp = new Date(), action = 'check_in' } = context;

    // Khi check-out, không chặn khung giờ
    if (action === 'check_out') {
      return { isValid: true };
    }

    const evaluation = isTimeInConfiguredShifts(timestamp, storeConfig);
    if (!evaluation.inShiftWindow) {
      return {
        isValid: false,
        error: `Hiện tại chưa tới hoặc đã quá khung giờ Check-in ca làm việc. Khung giờ cho phép: ${evaluation.allowedRangesText}.`,
        details: { allowedRangesText: evaluation.allowedRangesText },
      };
    }

    return {
      isValid: true,
      matchingShift: evaluation.matchingShift,
      details: { isLate: evaluation.isLate },
    };
  }
}

/**
 * Strategy 4: Chống spam bấm nút liên tục (Anti-Spam Throttling)
 */
export class AntiSpamCheckInValidator implements ICheckInValidator {
  readonly name = 'AntiSpamCheckInValidator';
  private static lastActionMap = new Map<string, number>();
  private throttleMs: number;

  constructor(throttleMs = 3000) {
    this.throttleMs = throttleMs;
  }

  validate(context: CheckInValidationContext): CheckInValidationResult {
    const userId = context.user.id;
    const nowMs = Date.now();
    const lastMs = AntiSpamCheckInValidator.lastActionMap.get(userId) || 0;

    if (nowMs - lastMs < this.throttleMs) {
      return {
        isValid: false,
        error: 'Thao tác quá nhanh! Vui lòng chờ vài giây trước khi thực hiện tiếp.',
      };
    }

    AntiSpamCheckInValidator.lastActionMap.set(userId, nowMs);
    return { isValid: true };
  }
}

/**
 * Composite Validator: Tổ hợp và thực thi tuần tự tất cả các Strategy
 */
export class CompositeCheckInValidator implements ICheckInValidator {
  readonly name = 'CompositeCheckInValidator';
  private validators: ICheckInValidator[];

  constructor(validators?: ICheckInValidator[]) {
    this.validators = validators || [
      new AntiSpamCheckInValidator(),
      new WifiCheckInValidator(),
      new GpsCheckInValidator(),
      new ShiftWindowCheckInValidator(),
    ];
  }

  addValidator(validator: ICheckInValidator): this {
    this.validators.push(validator);
    return this;
  }

  async validate(context: CheckInValidationContext): Promise<CheckInValidationResult> {
    for (const v of this.validators) {
      const res = await v.validate(context);
      if (!res.isValid) {
        return res;
      }
    }
    return { isValid: true };
  }
}
