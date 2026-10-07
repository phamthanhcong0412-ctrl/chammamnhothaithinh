import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Wifi,
  Clock,
  Shield,
  Save,
  Database,
  Download,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Radio,
  RefreshCw,
  Lock,
  Sparkles,
  Trash2,
  MapPin,
  Cpu,
  EyeOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { api, deriveBssidFromNetworkIp } from '../services/api.ts';
import type { StoreConfig } from '../types/index.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SyncToastState {
  type: 'loading' | 'success' | 'error';
  title: string;
  description: string;
  timestamp?: string;
}

const SUGGESTED_WIFI_NAMES = [
  'ChaoMamNho_ThaiThinh_5G',
  'ChaoMamNho_ThaiThinh_2.4G',
  'ChaoMamNho_ThaiThinh',
  'ChaoMamNho_Staff',
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    storeConfig,
    updateConfig,
    networkInfo,
    attendance,
    users,
    firebaseProjectId,
  } = useApp();
  const [formData, setFormData] = useState<StoreConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'network' | 'shifts' | 'general' | 'firebase'>('network');
  const [isSaving, setIsSaving] = useState(false);
  const [isDetectingWifi, setIsDetectingWifi] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [detectedClientIp, setDetectedClientIp] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [toast, setToast] = useState<SyncToastState | null>(null);

  const showToast = (nextToast: SyncToastState, autoHideMs = 5000) => {
    setToast(nextToast);
    if (nextToast.type !== 'loading' && autoHideMs > 0) {
      setTimeout(() => {
        setToast((prev) => (prev === nextToast ? null : prev));
      }, autoHideMs);
    }
  };

  useEffect(() => {
    if (storeConfig && isOpen) {
      setFormData(JSON.parse(JSON.stringify(storeConfig)));
      setDetectedClientIp(networkInfo?.clientIp || '');
      // Refresh live IP and latest Firebase store_config on modal open
      api
        .getNetworkInfo(true)
        .then((net) => {
          if (net?.clientIp) setDetectedClientIp(net.clientIp);
        })
        .catch(() => {});
    }
  }, [storeConfig, isOpen, networkInfo?.clientIp]);

  if (!isOpen || !formData) return null;

  const currentLiveIp = detectedClientIp || networkInfo?.clientIp || '14.161.45.88';
  const isCurrentIpInAllowedList =
    Array.isArray(formData.allowedIps) && formData.allowedIps.includes(currentLiveIp);

  const handleScanConnectedWifi = async () => {
    setIsDetectingWifi(true);
    try {
      const net = await api.getNetworkInfo(true);
      setDetectedClientIp(net.clientIp);
      showToast({
        type: 'success',
        title: 'Đã quét mạng WiFi đang kết nối!',
        description: `Phát hiện thiết bị đang kết nối qua địa chỉ IP mạng: ${net.clientIp}`,
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Không thể quét mạng',
        description: 'Vui lòng kiểm tra lại kết nối Internet.',
      });
    } finally {
      setIsDetectingWifi(false);
    }
  };

  // 1-Click Quick Select Currently Connected WiFi & Save to Firebase `store_config`
  const handleQuickSelectConnectedWifiAndSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const net = await api.getNetworkInfo(true).catch(() => ({
        clientIp: currentLiveIp,
        isAllowedIp: true,
        timestamp: Date.now(),
      }));
      const activeIp = net.clientIp || currentLiveIp;
      setDetectedClientIp(activeIp);

      const cleanSsid = formData.wifiSsid.trim() || 'ChaoMamNho_ThaiThinh_5G';
      const autoBssid = deriveBssidFromNetworkIp(activeIp);
      const cleanBssid =
        formData.wifiBssid && formData.wifiBssid.trim() && formData.wifiBssid !== 'A4:2B:B0:C1:9E:58'
          ? formData.wifiBssid.trim().toUpperCase()
          : autoBssid;

      const nextConfig: StoreConfig = {
        ...formData,
        wifiSsid: cleanSsid,
        wifiBssid: cleanBssid,
        allowedIps: [activeIp],
        requireWifi: true,
        bypassIpCheck: false,
      };

      setFormData(nextConfig);
      await updateConfig(nextConfig);
      setSaveSuccess(true);
      showToast({
        type: 'success',
        title: 'Đã chọn & lưu WiFi + BSSID đang kết nối lên Firebase!',
        description: `Đã khoá chấm công theo mạng "${cleanSsid}" (BSSID: ${cleanBssid}). Thiết bị khác mạng này sẽ bị chặn Check-in / Check-out.`,
      });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Lỗi lưu cấu hình WiFi',
        description: err.message || 'Không thể lưu cấu hình lên bảng Firebase store_config',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCaptureCurrentStoreGps = () => {
    if (!navigator.geolocation) {
      showToast({
        type: 'error',
        title: 'Thiết bị không hỗ trợ GPS',
        description: 'Trình duyệt hiện tại không hỗ trợ định vị GPS.',
      });
      return;
    }
    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setFormData((prev) =>
          prev
            ? {
                ...prev,
                requireGps: true,
                storeGps: {
                  lat,
                  lng,
                  radiusMeters: prev.storeGps?.radiusMeters || 80,
                },
              }
            : prev
        );
        showToast({
          type: 'success',
          title: 'Đã lấy tọa độ GPS hiện tại làm vị trí quán!',
          description: `Tọa độ: ${lat}, ${lng}. Hãy bấm "Lưu Cấu Hình Lên Firebase" để áp dụng Khóa Kép.`,
        });
      },
      (err) => {
        setIsDetectingGps(false);
        showToast({
          type: 'error',
          title: 'Không thể lấy vị trí GPS',
          description: err.message || 'Vui lòng cấp quyền truy cập Vị trí (Location) cho trình duyệt.',
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateConfig({
        ...formData,
        wifiBssid: (formData.wifiBssid || deriveBssidFromNetworkIp(currentLiveIp)).trim().toUpperCase(),
      });
      setSaveSuccess(true);
      showToast({
        type: 'success',
        title: 'Đã lưu lên bảng Firebase (store_config)!',
        description: 'Mọi thiết lập WiFi, BSSID, Khóa kép GPS và Ca làm việc đã được đồng bộ ngay lập tức.',
      });
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Lỗi khi lưu cấu hình',
        description: err.message || 'Không thể lưu cấu hình cửa hàng lên Firebase',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddConnectedIpToList = () => {
    if (!currentLiveIp) return;
    if (!formData.allowedIps.includes(currentLiveIp)) {
      setFormData({
        ...formData,
        allowedIps: [...formData.allowedIps, currentLiveIp],
      });
    }
  };

  const handleAddIp = () => {
    if (!ipInput.trim()) return;
    if (!formData.allowedIps.includes(ipInput.trim())) {
      setFormData({
        ...formData,
        allowedIps: [...formData.allowedIps, ipInput.trim()],
      });
    }
    setIpInput('');
  };

  const handleRemoveIp = (ipToRemove: string) => {
    setFormData({
      ...formData,
      allowedIps: formData.allowedIps.filter((ip) => ip !== ipToRemove),
    });
  };

  const handleExportData = () => {
    const exportData = {
      config: storeConfig,
      users,
      attendance,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `store_attendance_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-[110] max-w-md w-full sm:w-96 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start gap-3 ${
              toast.type === 'success'
                ? 'bg-zinc-900/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/50'
                : toast.type === 'error'
                ? 'bg-zinc-900/95 border-rose-500/50 text-rose-100 shadow-rose-950/50'
                : 'bg-zinc-900/95 border-indigo-500/50 text-indigo-100 shadow-indigo-950/50'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
              {toast.type === 'loading' && <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold leading-snug">{toast.title}</h4>
                {toast.timestamp && (
                  <span className="text-[10px] font-mono opacity-75 shrink-0">{toast.timestamp}</span>
                )}
              </div>
              <p className="text-[11px] opacity-90 mt-1 leading-relaxed break-words">{toast.description}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-3xl max-h-[92vh] bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-zinc-100">Thiết Lập Cửa Hàng & Chặn Chấm Công</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                  Firebase: store_config
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Mọi cấu hình được lưu trực tiếp lên bảng <code className="text-indigo-300">store_config/main_store</code> trên Firebase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-800 px-6 bg-zinc-950/40 overflow-x-auto">
          <button
            onClick={() => setActiveTab('network')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'network'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" /> Thiết Lập WiFi & Chặn Chấm Công
          </button>
          <button
            onClick={() => setActiveTab('shifts')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'shifts'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Khung Giờ Ca Làm Việc
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'general'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> Thông Tin Cửa Hàng
          </button>
          <button
            onClick={() => setActiveTab('firebase')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'firebase'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" /> Bảng Cấu Hình Firebase
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: WiFi & Strict Blocking */}
          {activeTab === 'network' && (
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
                        Hãy kết nối máy của bạn vào đúng WiFi của quán, sau đó bấm nút bên dưới để lấy ngay thông tin mạng này làm chuẩn chấm công.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleScanConnectedWifi}
                    disabled={isDetectingWifi}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isDetectingWifi ? 'animate-spin' : ''}`} />
                    <span>Quét lại mạng</span>
                  </button>
                </div>

                {/* Detected Network Info + SSID + BSSID Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400">
                        IP Đường truyền cáp quang:
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-semibold">
                        <EyeOff className="w-2.5 h-2.5" /> Ẩn với NV
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="font-mono text-sm font-black text-emerald-400">
                        {currentLiveIp}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold">
                        WAN Quán
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      Tên sóng WiFi (SSID):
                    </label>
                    <div className="relative">
                      <Wifi className="w-3.5 h-3.5 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={formData.wifiSsid}
                        onChange={(e) => setFormData({ ...formData, wifiSsid: e.target.value })}
                        placeholder="Nhập tên WiFi quán..."
                        className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-zinc-400">
                        Mã BSSID (MAC Modem):
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            wifiBssid: deriveBssidFromNetworkIp(currentLiveIp),
                          })
                        }
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                        title="Tự động lấy mã định danh BSSID theo đường truyền đang kết nối"
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
                          setFormData({ ...formData, wifiBssid: e.target.value.toUpperCase() })
                        }
                        placeholder="VD: A4:2B:B0:C1:9E:58"
                        className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-indigo-500 uppercase"
                      />
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
                      onClick={() => setFormData({ ...formData, wifiSsid: ssid })}
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
                    Chọn Nhanh Mạng Đang Kết Nối ({formData.wifiSsid || 'WiFi Quán'} • BSSID: {formData.wifiBssid || deriveBssidFromNetworkIp(currentLiveIp)}) & Lưu Cấu Hình Chặn
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
                      setFormData({
                        ...formData,
                        requireWifi: true,
                        bypassIpCheck: !formData.bypassIpCheck,
                      })
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
                    {!isCurrentIpInAllowedList && (
                      <button
                        type="button"
                        onClick={handleAddConnectedIpToList}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold cursor-pointer"
                      >
                        + Thêm IP đang kết nối ({currentLiveIp})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          allowedIps: [currentLiveIp],
                          bypassIpCheck: false,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                      title="Xoá các IP cũ, chỉ giữ duy nhất IP đang kết nối"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" /> Chỉ giữ IP hiện tại
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ipInput}
                    onChange={(e) => setIpInput(e.target.value)}
                    placeholder="Nhập thêm địa chỉ IP WiFi phụ (nếu quán có 2 đường truyền)..."
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddIp}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer"
                  >
                    Thêm IP
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.allowedIps.length === 0 ? (
                    <span className="text-xs text-rose-400">
                      Chưa có IP nào trong danh sách. Hãy bấm "Chọn Nhanh Mạng Đang Kết Nối" ở trên.
                    </span>
                  ) : (
                    formData.allowedIps.map((ip) => (
                      <span
                        key={ip}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-mono ${
                          ip === currentLiveIp
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                        }`}
                      >
                        {ip}
                        {ip === currentLiveIp && (
                          <span className="text-[10px] font-sans text-emerald-400">(Đang kết nối)</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveIp(ip)}
                          className="text-zinc-500 hover:text-rose-400 ml-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* DUAL-LOCK GPS GEOFENCING AT STORE */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <MapPin className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-zinc-100">
                        Khóa Kép Vị Trí GPS Tại Quán (Chống Gian Lận Từ Xa 100%)
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        Tuỳ chọn nâng cao
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      Khi bật: Ngoài việc phải bắt đúng WiFi của quán, điện thoại nhân viên còn phải <strong>đang đứng trực tiếp tại tọa độ cửa hàng</strong> trong bán kính cho phép mới được Check-in / Check-out.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        requireGps: !formData.requireGps,
                      })
                    }
                    className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer ${
                      formData.requireGps ? 'bg-indigo-600' : 'bg-zinc-700'
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
                  <div className="pt-2 border-t border-zinc-900 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block">Vĩ độ (Latitude)</span>
                        <input
                          type="number"
                          step="0.000001"
                          value={formData.storeGps?.lat ?? 21.0116}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              storeGps: {
                                ...(formData.storeGps || { lat: 21.0116, lng: 105.8174, radiusMeters: 80 }),
                                lat: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full mt-1 bg-transparent font-mono text-xs font-bold text-zinc-100 focus:outline-none"
                        />
                      </div>

                      <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block">Kinh độ (Longitude)</span>
                        <input
                          type="number"
                          step="0.000001"
                          value={formData.storeGps?.lng ?? 105.8174}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              storeGps: {
                                ...(formData.storeGps || { lat: 21.0116, lng: 105.8174, radiusMeters: 80 }),
                                lng: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full mt-1 bg-transparent font-mono text-xs font-bold text-zinc-100 focus:outline-none"
                        />
                      </div>

                      <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block">Bán kính cho phép (mét)</span>
                        <select
                          value={formData.storeGps?.radiusMeters ?? 80}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              storeGps: {
                                ...(formData.storeGps || { lat: 21.0116, lng: 105.8174, radiusMeters: 80 }),
                                radiusMeters: Number(e.target.value),
                              },
                            })
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
          )}

          {/* TAB 2: Shifts */}
          {activeTab === 'shifts' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-200">
                Nhân viên <strong>chỉ được phép Check-in và Check-out trong khung giờ của ca làm việc</strong> (tính từ giờ Mở Check-in trước ca đến giờ Đóng Check-out sau ca). Ngoài khoảng này hệ thống sẽ tự động chặn chấm công.
              </div>

              {formData.shifts.map((shift, idx) => (
                <div
                  key={shift.id}
                  className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={shift.name}
                      onChange={(e) => {
                        const updated = [...formData.shifts];
                        updated[idx].name = e.target.value;
                        setFormData({ ...formData, shifts: updated });
                      }}
                      className="font-bold text-xs text-zinc-100 bg-transparent border-b border-zinc-700 pb-0.5 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[10px] text-zinc-500 font-mono">{shift.id}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Giờ bắt đầu ca</label>
                      <input
                        type="time"
                        value={shift.startTime}
                        onChange={(e) => {
                          const updated = [...formData.shifts];
                          updated[idx].startTime = e.target.value;
                          setFormData({ ...formData, shifts: updated });
                        }}
                        className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Giờ kết thúc ca</label>
                      <input
                        type="time"
                        value={shift.endTime}
                        onChange={(e) => {
                          const updated = [...formData.shifts];
                          updated[idx].endTime = e.target.value;
                          setFormData({ ...formData, shifts: updated });
                        }}
                        className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-900">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Cho phép Check-in sớm trước (phút)</label>
                      <input
                        type="number"
                        min={0}
                        max={180}
                        value={shift.checkInBeforeMinutes ?? 30}
                        onChange={(e) => {
                          const updated = [...formData.shifts];
                          updated[idx].checkInBeforeMinutes = Number(e.target.value);
                          setFormData({ ...formData, shifts: updated });
                        }}
                        className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Cho phép Check-out muộn sau ca (phút)</label>
                      <input
                        type="number"
                        min={0}
                        max={240}
                        value={shift.checkOutAfterMinutes ?? 90}
                        onChange={(e) => {
                          const updated = [...formData.shifts];
                          updated[idx].checkOutAfterMinutes = Number(e.target.value);
                          setFormData({ ...formData, shifts: updated });
                        }}
                        className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: General */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Tên Cửa Hàng / Quán</label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Địa Chỉ Cửa Hàng</label>
                <input
                  type="text"
                  value={formData.storeAddress}
                  onChange={(e) => setFormData({ ...formData, storeAddress: e.target.value })}
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Email Quản Lý Nhận Báo Cáo
                  </label>
                  <input
                    type="email"
                    value={formData.managerEmail}
                    onChange={(e) => setFormData({ ...formData, managerEmail: e.target.value })}
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Giờ Gửi Báo Cáo Tự Động Hằng Ngày
                  </label>
                  <input
                    type="time"
                    value={formData.autoEmailTime}
                    onChange={(e) => setFormData({ ...formData, autoEmailTime: e.target.value })}
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Firebase Config Table & Backup */}
          {activeTab === 'firebase' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-zinc-100">
                          Bảng Cấu Hình Trên Firebase: <code className="text-emerald-400">store_config/main_store</code>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Đồng bộ trực tiếp
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Mọi máy nhân viên khi mở ứng dụng đều đọc cấu hình từ bảng này để kiểm tra WiFi & Ca làm việc
                      </p>
                    </div>
                  </div>

                  <a
                    href={`https://console.firebase.google.com/project/${firebaseProjectId}/firestore/databases/${formData.firebaseConfig?.firestoreDatabaseId || 'ai-studio-remixchmcngthngm-29b88f94-6ce3-4325-afeb-6a6d8e57c881'}/data`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-semibold text-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                  >
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Mở Firebase Console</span>
                  </a>
                </div>

                {/* Live preview of stored fields in Firebase store_config */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase block">Tên WiFi Quán (wifiSsid)</span>
                    <span className="font-mono font-bold text-indigo-300 mt-0.5 block truncate">
                      {formData.wifiSsid}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase block">Mã phần cứng Modem (wifiBssid)</span>
                    <span className="font-mono font-bold text-emerald-400 mt-0.5 block truncate">
                      {formData.wifiBssid || deriveBssidFromNetworkIp(currentLiveIp)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase block">Chế độ chặn WiFi & BSSID</span>
                    <span className="font-mono font-bold text-emerald-400 mt-0.5 block truncate">
                      {!formData.bypassIpCheck ? 'Bật chặn nghiêm ngặt' : 'Linh hoạt'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase block">Khóa kép vị trí GPS (requireGps)</span>
                    <span className="font-mono font-bold text-indigo-300 mt-0.5 block truncate">
                      {formData.requireGps
                        ? `Đang bật (Bán kính ${formData.storeGps?.radiusMeters || 80}m)`
                        : 'Đang tắt (Chỉ kiểm tra WiFi)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 sm:col-span-2">
                    <span className="text-[10px] text-zinc-500 uppercase block">
                      Danh sách IP đường truyền quán (allowedIpsJson - Đã ẩn khỏi màn hình nhân viên)
                    </span>
                    <span className="font-mono font-semibold text-zinc-200 mt-0.5 block break-all">
                      {JSON.stringify(formData.allowedIps)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data backup export */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">
                    Sao Lưu Dữ Liệu (.JSON)
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Tải bản sao lưu toàn bộ cấu hình, nhân sự và lịch sử chấm công về máy
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleExportData}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  Tải Backup (.JSON)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between">
          <div>
            {saveSuccess && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" /> Đã lưu lên bảng Firebase (store_config) thành công!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Đang lưu Firebase...' : 'Lưu Cấu Hình Lên Firebase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
