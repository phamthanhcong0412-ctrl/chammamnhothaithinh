/**
 * COMPONENT: NetworkSettingsTab
 * Quản lý cấu hình mạng WiFi, SSID kép 2.4G/5G, danh sách IP cho phép, và khóa kép GPS (SRP)
 */

import React from 'react';
import {
  Wifi,
  Radio,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Sparkles,
  Lock,
  Plus,
  Trash2,
  MapPin,
} from 'lucide-react';
import type { StoreConfig } from '../../types/index.ts';
import { deriveBssidFromNetworkIp, getDualBandWifiProfile } from '../../domain/index.ts';

export const SUGGESTED_WIFI_NAMES = [
  'ChaoMamNho_ThaiThinh',
  'ChaoMamNho_ThaiThinh_5G',
  'ChaoMamNho_ThaiThinh (2.4G / 5G)',
  'Chao Mam Nho Thai Thinh',
  'Mầm Nhỏ Thái Thịnh',
];

interface NetworkSettingsTabProps {
  formData: StoreConfig;
  setFormData: React.Dispatch<React.SetStateAction<StoreConfig | null>>;
  currentLiveIp: string;
  isCurrentIpInAllowedList: boolean;
  liveDualBandProfile: ReturnType<typeof getDualBandWifiProfile>;
  isDetectingWifi: boolean;
  isDetectingGps: boolean;
  isSaving: boolean;
  ipInput: string;
  setIpInput: (val: string) => void;
  handleScanConnectedWifi: () => Promise<void>;
  handleQuickSelectConnectedWifiAndSave: () => Promise<void>;
  handleCaptureCurrentStoreGps: () => Promise<void>;
  handleAddConnectedIpToList: () => void;
  handleAddIp: () => void;
  handleRemoveIp: (ip: string) => void;
}

export const NetworkSettingsTab: React.FC<NetworkSettingsTabProps> = ({
  formData,
  setFormData,
  currentLiveIp,
  isCurrentIpInAllowedList,
  liveDualBandProfile,
  isDetectingWifi,
  isDetectingGps,
  isSaving,
  ipInput,
  setIpInput,
  handleScanConnectedWifi,
  handleQuickSelectConnectedWifiAndSave,
  handleCaptureCurrentStoreGps,
  handleAddConnectedIpToList,
  handleAddIp,
  handleRemoveIp,
}) => {
  return (
    <div className="space-y-5">
      {/* QUICK SELECT CURRENTLY CONNECTED WIFI CARD */}
      <div className="p-5 rounded-2xl bg-gradient-to-b from-indigo-950/40 to-zinc-950 border border-indigo-500/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-zinc-100">
                  Chọn Nhanh WiFi Đang Kết Nối Trên Thiết Bị Này
                </h4>
                {isCurrentIpInAllowedList && !formData.bypassIpCheck ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Đang dùng làm WiFi chuẩn
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Chưa khoá theo IP này
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Chỉ cần bấm nút quét bên dưới, hệ thống sẽ tự nhận diện IP mạng và BSSID cả 2 băng tần 2.4G & 5G
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleScanConnectedWifi}
            disabled={isDetectingWifi}
            className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isDetectingWifi ? 'animate-spin' : ''}`} />
            <span>{isDetectingWifi ? 'Đang quét WiFi...' : 'Quét WiFi Hiện Tại'}</span>
          </button>
        </div>

        {/* Live Detected Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1">
            <span className="text-[11px] text-zinc-400 block">Địa chỉ IP đường truyền WiFi quán đang nhận:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-emerald-400">{currentLiveIp}</span>
              {isCurrentIpInAllowedList ? (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ✓ Có trong danh sách cho phép
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  Chưa có trong danh sách
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1">
            <span className="text-[11px] text-zinc-400 block">Mã Modem BSSID (Cả 2 băng tần 2.4G / 5G):</span>
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="font-mono text-xs font-bold text-indigo-300 truncate">
                {liveDualBandProfile.dualBssid}
              </span>
            </div>
          </div>
        </div>

        {/* Manual Edit Inputs for SSID & BSSID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-zinc-400">Tên WiFi Cửa Hàng (SSID):</label>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) =>
                    prev ? { ...prev, wifiSsid: liveDualBandProfile.dualSsidLabel } : prev
                  )
                }
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                title="Tự động gộp cả 2 băng tần 2.4GHz & 5GHz cho tên WiFi này"
              >
                Gộp 2.4G & 5G
              </button>
            </div>
            <div className="relative">
              <Wifi className="w-3.5 h-3.5 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={formData.wifiSsid}
                onChange={(e) =>
                  setFormData((prev) => (prev ? { ...prev, wifiSsid: e.target.value } : prev))
                }
                placeholder="Nhập tên WiFi quán..."
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-zinc-400">Mã BSSID Kép (2.4G / 5G):</label>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) =>
                    prev
                      ? {
                          ...prev,
                          wifiBssid: deriveBssidFromNetworkIp(currentLiveIp),
                        }
                      : prev
                  )
                }
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                title="Tự động lấy mã định danh BSSID cả 2 băng tần 2.4G & 5G theo đường truyền đang kết nối"
              >
                Lấy tự động
              </button>
            </div>
            <div className="relative">
              <Cpu className="w-3.5 h-3.5 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={formData.wifiBssid || deriveBssidFromNetworkIp(currentLiveIp)}
                onChange={(e) =>
                  setFormData((prev) =>
                    prev ? { ...prev, wifiBssid: e.target.value.toUpperCase() } : prev
                  )
                }
                placeholder="VD: A4:2B:0E:A1:2D:58 (2.4G) / 59 (5G)"
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-indigo-500 uppercase"
              />
            </div>
          </div>
        </div>

        {/* DUAL-BAND 2.4GHz & 5GHz AUTOMATIC ACCEPTANCE BANNER */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-emerald-500/30 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-emerald-300">
                Tự Động Chấp Nhận Cả 2 Sóng Băng Tần 2.4GHz & 5GHz Của Cùng Cục WiFi
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Bắt sóng nào cũng chấm công được
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold text-[10px]">
                    2.4GHz
                  </span>
                  <span className="font-mono font-bold text-zinc-100 truncate">
                    {liveDualBandProfile.ssid24G}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  BSSID 2.4G: {liveDualBandProfile.bssid24G}
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 shrink-0">✓ Hợp lệ</span>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px]">
                    5GHz
                  </span>
                  <span className="font-mono font-bold text-zinc-100 truncate">
                    {liveDualBandProfile.ssid5G}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  BSSID 5G: {liveDualBandProfile.bssid5G}
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 shrink-0">✓ Hợp lệ</span>
            </div>
          </div>
        </div>

        {/* Quick Pick WiFi Name Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-zinc-400 mr-1">Chọn nhanh tên WiFi:</span>
          {SUGGESTED_WIFI_NAMES.map((ssid) => (
            <button
              key={ssid}
              type="button"
              onClick={() =>
                setFormData((prev) => (prev ? { ...prev, wifiSsid: ssid } : prev))
              }
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all cursor-pointer ${
                formData.wifiSsid === ssid
                  ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {ssid}
            </button>
          ))}
        </div>

        {/* 1-CLICK ACTION BUTTON TO SAVE CONNECTED WIFI AS STORE STANDARD */}
        <button
          type="button"
          onClick={handleQuickSelectConnectedWifiAndSave}
          disabled={isSaving}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          <span>
            Chọn Nhanh & Lưu Cả 2 Sóng ({liveDualBandProfile.ssid24G} & {liveDualBandProfile.ssid5G}) Làm Chuẩn Chấm Công
          </span>
        </button>
      </div>

      {/* STRICT WIFI ENFORCEMENT MODE TOGGLE */}
      <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold text-zinc-100">
                Chặn Cứng Check-in / Check-out Khi Sai Mạng WiFi (Kiểm Tra IP Quán)
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
              Khi <strong>BẬT</strong>: Nhân viên bắt buộc phải kết nối đúng mạng WiFi của quán (khớp địa chỉ IP đã lưu bên dưới) và đúng khung giờ ca mới được phép bấm Check-in / Check-out. Nếu dùng 4G/5G hoặc ở nhà sẽ bị chặn hoàn toàn.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setFormData((prev) =>
                prev
                  ? {
                      ...prev,
                      requireWifi: true,
                      bypassIpCheck: !prev.bypassIpCheck,
                    }
                  : prev
              )
            }
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer ${
              !formData.bypassIpCheck ? 'bg-emerald-600' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                !formData.bypassIpCheck ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            !formData.bypassIpCheck
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          <span className="font-semibold">
            {!formData.bypassIpCheck
              ? 'Trạng thái: ĐANG BẬT CHẶN NGHIÊM NGẶT THEO CẤU HÌNH WIFI & CA LÀM VIỆC'
              : 'Trạng thái: Đang tắt kiểm tra IP (Chế độ linh hoạt - chỉ chặn theo khung giờ ca)'}
          </span>
        </div>
      </div>

      {/* ALLOWED IPS LIST */}
      <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-xs font-bold text-zinc-200">
            Danh Sách Địa Chỉ IP WiFi Quán Hợp Lệ ({formData.allowedIps.length})
          </label>
          <div className="flex items-center gap-2">
            {!isCurrentIpInAllowedList && currentLiveIp && (
              <button
                type="button"
                onClick={handleAddConnectedIpToList}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Thêm IP Đang Dùng ({currentLiveIp})
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddIp())}
            placeholder="Nhập IP công khai của quán (VD: 14.161.45.88)..."
            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handleAddIp}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-xl text-zinc-200 transition-colors cursor-pointer"
          >
            Thêm IP
          </button>
        </div>

        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {formData.allowedIps.map((ip) => {
            const isThisIpConnected = ip === currentLiveIp;
            return (
              <div
                key={ip}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono border ${
                  isThisIpConnected
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{ip}</span>
                  {isThisIpConnected && (
                    <span className="text-[10px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10">
                      Đang kết nối
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveIp(ip)}
                  className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Xóa IP"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* DUAL-LOCK GPS LOCATION SETTINGS */}
      <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-zinc-100">
                Khóa Kép Vị Trí Địa Lý (GPS Geolocation Dual-Lock)
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
              Khi <strong>BẬT</strong>: Bên cạnh việc bắt đúng WiFi/IP quán, thiết bị của nhân viên còn bắt buộc phải nằm trong bán kính thực tế của cửa hàng.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setFormData((prev) =>
                prev ? { ...prev, requireGps: !prev.requireGps } : prev
              )
            }
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer ${
              formData.requireGps ? 'bg-emerald-600' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                formData.requireGps ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {formData.requireGps && (
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Vĩ độ (Latitude):</span>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.storeGps?.lat ?? 21.0116}
                  onChange={(e) =>
                    setFormData((prev) =>
                      prev
                        ? {
                            ...prev,
                            storeGps: {
                              ...(prev.storeGps || { lat: 21.0116, lng: 105.8174, radiusMeters: 80 }),
                              lat: Number(e.target.value),
                            },
                          }
                        : prev
                    )
                  }
                  className="w-full mt-1 bg-transparent font-mono text-xs font-bold text-zinc-100 focus:outline-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Kinh độ (Longitude):</span>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.storeGps?.lng ?? 105.8174}
                  onChange={(e) =>
                    setFormData((prev) =>
                      prev
                        ? {
                            ...prev,
                            storeGps: {
                              ...(prev.storeGps || { lat: 21.0116, lng: 105.8174, radiusMeters: 80 }),
                              lng: Number(e.target.value),
                            },
                          }
                        : prev
                    )
                  }
                  className="w-full mt-1 bg-transparent font-mono text-xs font-bold text-zinc-100 focus:outline-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Bán kính cho phép:</span>
                <select
                  value={formData.storeGps?.radiusMeters ?? 80}
                  onChange={(e) =>
                    setFormData((prev) =>
                      prev
                        ? {
                            ...prev,
                            storeGps: {
                              ...(prev.storeGps || { lat: 21.0116, lng: 105.8174, radiusMeters: 80 }),
                              radiusMeters: Number(e.target.value),
                            },
                          }
                        : prev
                    )
                  }
                  className="w-full mt-1 bg-zinc-900 font-mono text-xs font-bold text-emerald-400 focus:outline-none"
                >
                  <option value={50}>50 mét (Rất chặt)</option>
                  <option value={80}>80 mét (Tiêu chuẩn)</option>
                  <option value={120}>120 mét (Rộng)</option>
                  <option value={200}>200 mét</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCaptureCurrentStoreGps}
              disabled={isDetectingGps}
              className="w-full py-2.5 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {isDetectingGps
                  ? 'Đang lấy tọa độ GPS hiện tại...'
                  : 'Lấy Tọa Độ GPS Hiện Tại Của Máy Này Làm Vị Trí Quán'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
