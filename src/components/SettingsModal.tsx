/**
 * COMPONENT: SettingsModal
 * Quản lý hộp thoại Cài đặt cửa hàng, tích hợp Clean Architecture & Component Decomposition (SRP & ISP)
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Wifi,
  Clock,
  Settings,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import {
  api,
  deriveBssidFromNetworkIp,
  getDualBandWifiProfile,
} from '../services/api.ts';
import type { StoreConfig } from '../types/index.ts';
import { NetworkSettingsTab } from './settings/NetworkSettingsTab.tsx';
import { ShiftSettingsTab } from './settings/ShiftSettingsTab.tsx';
import { StoreInfoSettingsTab } from './settings/StoreInfoSettingsTab.tsx';
import { SupabaseStatusTab } from './settings/SupabaseStatusTab.tsx';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SyncToastState {
  type: 'success' | 'error' | 'loading';
  title: string;
  description: string;
  timestamp?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    storeConfig,
    updateConfig,
    networkInfo,
    attendance,
    users,
    isSupabaseConnected,
    runWithHudLoading,
  } = useApp();

  const [formData, setFormData] = useState<StoreConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'network' | 'shifts' | 'general' | 'supabase'>('network');
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
  const liveDualBandProfile = getDualBandWifiProfile(
    formData.wifiSsid,
    currentLiveIp,
    formData.storeName
  );

  const handleScanConnectedWifi = async () => {
    setIsDetectingWifi(true);
    try {
      const net = await runWithHudLoading('Đang quét Tên WiFi (2.4G / 5G) & BSSID đang kết nối...', async () => {
        return await api.getNetworkInfo(true);
      });
      const activeIp = net.clientIp || currentLiveIp;
      setDetectedClientIp(activeIp);

      // Tự động ưu tiên tên WiFi quét được từ card mạng thực tế
      const scannedSsid = net.rawSsid || net.detectedSsid || formData.wifiSsid || 'ChaoMamNho_ThaiThinh';
      const dualProfile = getDualBandWifiProfile(
        scannedSsid,
        activeIp,
        formData.storeName
      );
      const finalBssid = net.detectedBssid || dualProfile.dualBssid;

      setFormData((prev) => {
        if (!prev) return prev;
        const currentList = Array.isArray(prev.allowedIps) ? prev.allowedIps : [];
        const nextList = currentList.includes(activeIp) ? currentList : [...currentList, activeIp];
        return {
          ...prev,
          wifiSsid: dualProfile.dualSsidLabel,
          wifiBssid: finalBssid,
          allowedIps: nextList,
        };
      });

      showToast({
        type: 'success',
        title: 'Đã tự động lấy Tên WiFi & IP',
        description: `Tên WiFi: ${dualProfile.dualSsidLabel} | IP: ${activeIp}`,
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Không thể quét WiFi',
        description: 'Vui lòng kiểm tra lại kết nối mạng.',
      });
    } finally {
      setIsDetectingWifi(false);
    }
  };

  const handleQuickSelectConnectedWifiAndSave = async () => {
    setIsSaving(true);
    try {
      const net = await runWithHudLoading('Đang lưu cài đặt WiFi kép...', async () => {
        return await api.getNetworkInfo(true);
      });
      const activeIp = net.clientIp || currentLiveIp;
      const scannedSsid = net.rawSsid || net.detectedSsid || formData.wifiSsid || 'ChaoMamNho_ThaiThinh';
      const dualProfile = getDualBandWifiProfile(
        scannedSsid,
        activeIp,
        formData.storeName
      );
      const finalBssid = net.detectedBssid || dualProfile.dualBssid;

      const nextAllowedIps = Array.from(new Set([...formData.allowedIps, activeIp]));
      const nextConfig: StoreConfig = {
        ...formData,
        wifiSsid: dualProfile.dualSsidLabel,
        wifiBssid: finalBssid,
        allowedIps: nextAllowedIps,
        requireWifi: true,
        bypassIpCheck: false,
      };

      setFormData(nextConfig);
      await updateConfig(nextConfig);
      setSaveSuccess(true);
      showToast({
        type: 'success',
        title: 'Đã nhận diện & lưu cấu hình WiFi thành công!',
        description: `Tên: ${dualProfile.dualSsidLabel} | IP: ${activeIp}`,
      });
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Lỗi khi lưu cấu hình',
        description: err.message || 'Không thể cập nhật cấu hình.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCaptureCurrentStoreGps = async () => {
    if (!navigator.geolocation) {
      showToast({
        type: 'error',
        title: 'Trình duyệt không hỗ trợ GPS',
        description: 'Vui lòng nhập tọa độ thủ công.',
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
                  ...(prev.storeGps || { radiusMeters: 80 }),
                  lat,
                  lng,
                },
              }
            : prev
        );
        showToast({
          type: 'success',
          title: 'Đã lấy tọa độ GPS thành công',
          description: `Vĩ độ: ${lat}, Kinh độ: ${lng}`,
        });
      },
      () => {
        setIsDetectingGps(false);
        showToast({
          type: 'error',
          title: 'Lỗi lấy vị trí GPS',
          description: 'Vui lòng cho phép quyền truy cập vị trí trên trình duyệt.',
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateConfig({
        ...formData,
        wifiBssid: (formData.wifiBssid || deriveBssidFromNetworkIp(currentLiveIp)).trim().toUpperCase(),
      });
      setSaveSuccess(true);
      showToast({
        type: 'success',
        title: 'Đã lưu cài đặt thành công!',
        description: 'Thông tin cửa hàng, WiFi, GPS và ca làm việc đã được cập nhật.',
      });
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Lỗi khi lưu cấu hình',
        description: err.message || 'Không thể lưu cài đặt cửa hàng.',
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-[110] max-w-md w-full sm:w-96 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start gap-3 ${
              toast.type === 'success'
                ? 'bg-zinc-900/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/50'
                : toast.type === 'error'
                ? 'bg-zinc-900/95 border-rose-500/50 text-rose-100 shadow-rose-950/50'
                : 'bg-zinc-900/95 border-amber-500/50 text-amber-100 shadow-amber-950/50'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
              {toast.type === 'loading' && <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />}
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

      <div className="relative w-full sm:max-w-3xl max-h-[92vh] bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-100 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
        {/* Mobile drag handle */}
        <div className="sm:hidden w-10 h-1 bg-zinc-700 rounded-full mx-auto my-2 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 sm:py-4 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-zinc-100">Cài Đặt Cửa Hàng</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Đã kết nối
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Cấu hình WiFi quán, định vị GPS, ca làm việc và thông tin hiển thị
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
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" /> WiFi & Định Vị
          </button>
          <button
            onClick={() => setActiveTab('shifts')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'shifts'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Ca Làm Việc
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'general'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> Thông Tin Quán
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'supabase'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" /> Dữ Liệu & Sao Lưu
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'network' && (
            <NetworkSettingsTab
              formData={formData}
              setFormData={setFormData}
              currentLiveIp={currentLiveIp}
              isCurrentIpInAllowedList={isCurrentIpInAllowedList}
              liveDualBandProfile={liveDualBandProfile}
              isDetectingWifi={isDetectingWifi}
              isDetectingGps={isDetectingGps}
              isSaving={isSaving}
              ipInput={ipInput}
              setIpInput={setIpInput}
              handleScanConnectedWifi={handleScanConnectedWifi}
              handleQuickSelectConnectedWifiAndSave={handleQuickSelectConnectedWifiAndSave}
              handleCaptureCurrentStoreGps={handleCaptureCurrentStoreGps}
              handleAddConnectedIpToList={handleAddConnectedIpToList}
              handleAddIp={handleAddIp}
              handleRemoveIp={handleRemoveIp}
            />
          )}

          {activeTab === 'shifts' && (
            <ShiftSettingsTab
              formData={formData}
              setFormData={setFormData}
            />
          )}

          {activeTab === 'general' && (
            <StoreInfoSettingsTab
              formData={formData}
              setFormData={setFormData}
            />
          )}

          {activeTab === 'supabase' && (
            <SupabaseStatusTab
              formData={formData}
              isSupabaseConnected={isSupabaseConnected}
              currentLiveIp={currentLiveIp}
              onExportData={handleExportData}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between">
          <div>
            {saveSuccess && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" /> Đã lưu cài đặt thành công!
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
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Đang lưu...' : 'Lưu Cài Đặt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
