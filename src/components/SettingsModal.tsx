import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Wifi,
  MapPin,
  Clock,
  Shield,
  Save,
  Database,
  Download,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Radio,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { getCurrentPosition } from '../utils/geo.ts';
import type { StoreConfig } from '../types/index.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    storeConfig,
    updateConfig,
    networkInfo,
    attendance,
    users,
    isFirebaseConnected,
    firebaseUser,
    firebaseProjectId,
    syncUsersToFirebase,
  } = useApp();
  const [formData, setFormData] = useState<StoreConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'network' | 'gps' | 'shifts' | 'firebase'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncMsg, setCloudSyncMsg] = useState<string | null>(null);

  const handleSyncFirebaseCloud = async () => {
    setIsSyncingCloud(true);
    setCloudSyncMsg(null);
    try {
      const count = await syncUsersToFirebase();
      setCloudSyncMsg(`Đã đồng bộ thành công ${count} tài khoản nhân sự lên Firebase Firestore!`);
      setTimeout(() => setCloudSyncMsg(null), 4000);
    } catch (err: any) {
      setCloudSyncMsg(err.message || 'Lỗi khi đồng bộ Firebase');
    } finally {
      setIsSyncingCloud(false);
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
      await updateConfig(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu cấu hình');
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

  const handleGetCurrentGps = async () => {
    setIsLocating(true);
    try {
      const pos = await getCurrentPosition();
      setFormData({
        ...formData,
        storeGps: {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          radiusMeters: formData.storeGps.radiusMeters || 120,
        },
      });
      alert(`Đã nhận diện tọa độ cửa hàng: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
    } catch (err: any) {
      alert(err.message || 'Không thể lấy GPS');
    } finally {
      setIsLocating(false);
    }
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
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Cấu Hình Hệ Thống Cửa Hàng</h3>
              <p className="text-xs text-zinc-400">Xác thực WiFi, định vị GPS, ca làm & kết nối cơ sở dữ liệu</p>
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
            onClick={() => setActiveTab('gps')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'gps'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" /> Định Vị GPS Quán
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
              {/* Quick Firebase Summary Banner right inside General Tab */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Database className="w-4 h-4 shrink-0" />
                    <span>Firebase Firestore Đã Cấu Hình Lưu Trữ User</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {isFirebaseConnected ? `Đã kết nối (${firebaseUser?.email})` : 'Active'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-300 font-mono">
                    Project ID: <strong className="text-white">{firebaseProjectId || formData.firebaseConfig?.projectId}</strong> • DB: <strong className="text-indigo-300">{formData.firebaseConfig?.firestoreDatabaseId || 'default'}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('firebase')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer"
                >
                  Xem Chi Tiết Firebase →
                </button>
              </div>

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

          {/* TAB 3: GPS Geofence */}
          {activeTab === 'gps' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-zinc-300 flex items-start gap-3">
                <MapPin className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-indigo-300">Cơ chế Hàng Rào Địa Lý (Geofence):</span>
                  <p className="mt-0.5 text-zinc-400 leading-relaxed">
                    Nhân viên bắt buộc phải có mặt trong bán kính cho phép quanh cửa hàng mới có thể bấm Check-in/Check-out. Điều này đảm bảo 100% người chấm công đang đứng tại quán.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-zinc-300">Tọa Độ Cửa Hàng Hiện Tại</span>
                <button
                  type="button"
                  onClick={handleGetCurrentGps}
                  disabled={isLocating}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {isLocating ? 'Đang lấy vị trí GPS...' : 'Lấy Tọa Độ Hiện Tại Của Tôi'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Vĩ Độ (Latitude)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.storeGps.lat}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        storeGps: { ...formData.storeGps, lat: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Kinh Độ (Longitude)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.storeGps.lng}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        storeGps: { ...formData.storeGps, lng: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Bán Kính Cho Phép Chấm Công: <strong className="text-indigo-400">{formData.storeGps.radiusMeters} mét</strong>
                </label>
                <input
                  type="range"
                  min={30}
                  max={500}
                  step={10}
                  value={formData.storeGps.radiusMeters}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      storeGps: { ...formData.storeGps, radiusMeters: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                  <span>30m (Cực chuẩn trong quán)</span>
                  <span>120m (Khuyến nghị)</span>
                  <span>500m (Rộng)</span>
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

                  <div className="grid grid-cols-3 gap-3">
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

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Ân hạn trễ (phút)</label>
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={shift.lateGraceMinutes}
                        onChange={(e) => {
                          const updated = [...formData.shifts];
                          updated[idx].lateGraceMinutes = Number(e.target.value);
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
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-zinc-300">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <Database className="w-4 h-4" />
                    Đã Cấu Hình Firebase Firestore ({firebaseProjectId})
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isFirebaseConnected
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {isFirebaseConnected ? `Đã kết nối (${firebaseUser?.email})` : 'Sẵn sàng kết nối'}
                  </span>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Dự án Firebase Firestore đã được khởi tạo và triển khai quy tắc bảo mật (Security Rules) cho bảng <code>users</code>, <code>attendance</code> và <code>store_config</code>.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSyncFirebaseCloud}
                    disabled={isSyncingCloud}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isSyncingCloud
                      ? 'Đang đồng bộ lên Firestore...'
                      : isFirebaseConnected
                      ? `Đồng Bộ Toàn Bộ ${users.length} User Lên Firestore Ngay`
                      : 'Xác Thực Google & Đồng Bộ User Lên Firestore'}
                  </button>
                </div>

                {cloudSyncMsg && (
                  <p className="mt-2 text-xs text-emerald-300 font-semibold">{cloudSyncMsg}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Firebase Project ID
                  </label>
                  <input
                    type="text"
                    value={formData.firebaseConfig?.projectId || firebaseProjectId || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        firebaseConfig: {
                          ...formData.firebaseConfig,
                          projectId: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Firestore Database ID
                  </label>
                  <input
                    type="text"
                    value={
                      formData.firebaseConfig?.firestoreDatabaseId ||
                      'ai-studio-remixchmcngthngm-29b88f94-6ce3-4325-afeb-6a6d8e57c881'
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        firebaseConfig: {
                          ...formData.firebaseConfig,
                          firestoreDatabaseId: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-indigo-300 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Firebase API Key
                  </label>
                  <input
                    type="text"
                    value={formData.firebaseConfig?.apiKey || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        firebaseConfig: {
                          ...formData.firebaseConfig,
                          apiKey: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Firebase App ID
                  </label>
                  <input
                    type="text"
                    value={formData.firebaseConfig?.appId || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        firebaseConfig: {
                          ...formData.firebaseConfig,
                          appId: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Firebase Auth Domain
                  </label>
                  <input
                    type="text"
                    value={formData.firebaseConfig?.authDomain || `${firebaseProjectId}.firebaseapp.com`}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        firebaseConfig: {
                          ...formData.firebaseConfig,
                          authDomain: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Storage Bucket
                  </label>
                  <input
                    type="text"
                    value={formData.firebaseConfig?.storageBucket || `${firebaseProjectId}.firebasestorage.app`}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        firebaseConfig: {
                          ...formData.firebaseConfig,
                          storageBucket: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Synced Users Summary */}
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-200">
                    Danh Sách Tài Khoản User Đang Quản Lý ({users.length} tài khoản)
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono">Collection: /users</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {users.map((u) => (
                    <span
                      key={u.id}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 font-mono"
                    >
                      {u.username} ({u.role === 'admin' ? 'QL' : 'NV'})
                    </span>
                  ))}
                </div>
              </div>

              {/* Data backup export */}
              <div className="pt-2 border-t border-zinc-800">
                <span className="text-xs font-semibold text-zinc-300 block mb-2">
                  Sao Lưu & Xuất Dữ Liệu Chấm Công
                </span>
                <button
                  type="button"
                  onClick={handleExportData}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  Tải Về File Sao Lưu (.JSON) Toàn Bộ Nhân Sự & Bảng Công
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
