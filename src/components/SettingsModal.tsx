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
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
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
  const [activeTab, setActiveTab] = useState<'general' | 'network' | 'shifts' | 'firebase'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [toast, setToast] = useState<SyncToastState | null>(null);

  const showToast = (nextToast: SyncToastState, autoHideMs = 6000) => {
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
    }
  }, [storeConfig, isOpen]);

  if (!isOpen || !formData) return null;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateConfig({ ...formData, requireGps: false });
      setSaveSuccess(true);
      showToast({
        type: 'success',
        title: 'Đã lưu cấu hình hệ thống!',
        description: 'Mọi thiết lập WiFi, ca làm việc và cửa hàng đã được cập nhật.',
      });
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Lỗi khi lưu cấu hình',
        description: err.message || 'Không thể lưu cấu hình cửa hàng',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetCurrentIpAsStore = () => {
    if (!networkInfo?.clientIp) return;
    const currentIp = networkInfo.clientIp;
    if (!formData.allowedIps.includes(currentIp)) {
      setFormData({
        ...formData,
        allowedIps: [...formData.allowedIps, currentIp],
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Cấu Hình Hệ Thống Cửa Hàng</h3>
              <p className="text-xs text-zinc-400">Xác thực WiFi, ca làm việc & kết nối cơ sở dữ liệu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-800 px-6 bg-zinc-950/40 overflow-x-auto">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> Thông Tin Chung
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'network'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" /> Xác Thực WiFi & IP
          </button>
          <button
            onClick={() => setActiveTab('shifts')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'shifts'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Ca Làm Việc
          </button>
          <button
            onClick={() => setActiveTab('firebase')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'firebase'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-amber-400" /> Firebase & Backup
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* TAB 1: General */}
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

              <div className="grid grid-cols-2 gap-4">
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
                  <span className="text-[11px] text-zinc-500 mt-1 block">Mặc định: 21:00</span>
                </div>
              </div>

              {/* QR Token Refresh Rate */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Thời Gian Đổi Mã QR Chống Gian Lận (Giây)
                </label>
                <input
                  type="number"
                  min={15}
                  max={300}
                  value={formData.qrRefreshSeconds}
                  onChange={(e) => setFormData({ ...formData, qrRefreshSeconds: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Mã QR tại quầy tự động thay đổi sau mỗi {formData.qrRefreshSeconds} giây để chống việc chụp ảnh mã gửi về nhà chấm công.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: WiFi & IP */}
          {activeTab === 'network' && (
            <div className="space-y-5">
              
              {/* WiFi SSID */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Tên Sóng WiFi Của Quán (SSID)
                </label>
                <div className="relative">
                  <Wifi className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formData.wifiSsid}
                    onChange={(e) => setFormData({ ...formData, wifiSsid: e.target.value })}
                    placeholder="Artisans_Coffee_Staff_5G"
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Nhân viên bắt buộc phải kết nối đúng tên mạng WiFi này khi quét mã.
                </span>
              </div>

              {/* Current IP status */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-400">Địa chỉ IP thiết bị của bạn hiện tại:</span>
                  <div className="font-mono text-sm font-bold text-indigo-300 mt-0.5">
                    {networkInfo?.clientIp || '127.0.0.1'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSetCurrentIpAsStore}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs font-semibold text-indigo-300 flex items-center gap-1.5 transition-colors"
                >
                  <Radio className="w-3.5 h-3.5" /> Thêm IP này làm IP Quán
                </button>
              </div>

              {/* IP Bypass toggle */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-zinc-200">Chế độ Linh Hoạt (Bypass Kiểm Tra IP Router)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-md">
                    Khi BẬT: Hệ thống xác thực qua Quét QR + Tên WiFi + Định vị GPS thực tế mà không chặn nếu IP mạng thay đổi (rất tiện khi test hoặc khi mạng quán dùng 4G router).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, bypassIpCheck: !formData.bypassIpCheck })}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    formData.bypassIpCheck ? 'bg-indigo-600' : 'bg-zinc-800'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      formData.bypassIpCheck ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Allowed IP list */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Danh Sách IP Modem WiFi Cửa Hàng Hợp Lệ
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={ipInput}
                    onChange={(e) => setIpInput(e.target.value)}
                    placeholder="VD: 14.161.45.88"
                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleAddIp}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200"
                  >
                    Thêm IP
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.allowedIps.map((ip) => (
                    <span
                      key={ip}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300"
                    >
                      {ip}
                      <button
                        type="button"
                        onClick={() => handleRemoveIp(ip)}
                        className="text-zinc-500 hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: Shifts */}
          {activeTab === 'shifts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">Cấu Hình Các Ca Làm Việc</span>
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
                      className="font-semibold text-xs text-zinc-200 bg-transparent border-b border-zinc-700 pb-0.5 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[10px] text-zinc-500 font-mono">{shift.id}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Bắt đầu ca</label>
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
                      <label className="block text-[11px] text-zinc-400 mb-1">Kết thúc ca</label>
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
                      <label className="block text-[11px] text-zinc-400 mb-1">Mở Check-in trước (phút)</label>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={shift.checkInBeforeMinutes ?? 30}
                        onChange={(e) => {
                          const updated = [...formData.shifts];
                          updated[idx].checkInBeforeMinutes = Number(e.target.value);
                          setFormData({ ...formData, shifts: updated });
                        }}
                        className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                      />
                      <span className="text-[10px] text-zinc-500">Mặc định 30 phút</span>
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Mở Check-out sau ca (phút)</label>
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
                      <span className="text-[10px] text-zinc-500">Mặc định 90 phút (1.5h)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: Firebase & Backup */}
          {activeTab === 'firebase' && (
            <div className="space-y-4">
              {/* Simple Project Information Card */}
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-zinc-100">
                          Thông Tin Project Firebase
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Đã kết nối • Full Quyền
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Tự động tải dữ liệu khi load trang và lưu trực tiếp lên Firebase khi thao tác
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase block">Project ID</span>
                    <span className="font-mono font-bold text-emerald-400 mt-0.5 block truncate">
                      {firebaseProjectId}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase block">Database ID</span>
                    <span className="font-mono font-semibold text-indigo-300 mt-0.5 block truncate">
                      {formData.firebaseConfig?.firestoreDatabaseId ||
                        'ai-studio-remixchmcngthngm-29b88f94-6ce3-4325-afeb-6a6d8e57c881'}
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
                    Tải bản sao lưu toàn bộ dữ liệu hệ thống về máy
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
                <CheckCircle2 className="w-4 h-4" /> Đã lưu cấu hình thành công!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
