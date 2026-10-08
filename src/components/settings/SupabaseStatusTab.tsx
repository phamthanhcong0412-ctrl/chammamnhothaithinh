/**
 * COMPONENT: SupabaseStatusTab
 * Quản lý trạng thái kết nối Supabase Cloud, xem bảng store_config và xuất bản sao lưu (SRP)
 */

import React from 'react';
import { Cpu, Globe, Database, Download } from 'lucide-react';
import type { StoreConfig } from '../../types/index.ts';
import { deriveBssidFromNetworkIp } from '../../domain/index.ts';

interface SupabaseStatusTabProps {
  formData: StoreConfig;
  isSupabaseConnected: boolean;
  currentLiveIp: string;
  onExportData: () => void;
}

export const SupabaseStatusTab: React.FC<SupabaseStatusTabProps> = ({
  formData,
  isSupabaseConnected,
  currentLiveIp,
  onExportData,
}) => {
  return (
    <div className="space-y-4">
      {/* SUPABASE STATUS CARD */}
      <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-zinc-100">
                  Cơ Sở Dữ Liệu Supabase (PostgreSQL + RLS + Realtime)
                </span>
                {isSupabaseConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Đã kết nối Supabase Cloud
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Chờ cấu hình VITE_SUPABASE_URL trong .env
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Kiến trúc Lựa chọn A: Cấp phát tài khoản nội bộ (Username/Password) + Supabase Realtime Channels
              </p>
            </div>
          </div>

          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-semibold text-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mở Supabase Dashboard</span>
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 uppercase block">Trạng thái kết nối</span>
            <span className={`font-mono font-bold mt-0.5 block truncate ${isSupabaseConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isSupabaseConnected ? 'Sẵn sàng hoạt động' : 'Chưa cấu hình .env'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 uppercase block">Script khởi tạo CSDL</span>
            <span className="font-mono text-zinc-300 mt-0.5 block truncate">
              supabase/schema.sql
            </span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 uppercase block">Lệnh chuyển dữ liệu</span>
            <span className="font-mono font-bold text-indigo-400 mt-0.5 block truncate">
              npm run migrate:supabase
            </span>
          </div>
        </div>
      </div>

      {/* SUPABASE STORE_CONFIG LIVE CARD */}
      <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-zinc-100">
                  Bảng Cấu Hình Trên Supabase: <code className="text-emerald-400">store_config (id: config_default)</code>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Đồng bộ Realtime
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Mọi máy nhân viên khi mở ứng dụng đều đọc cấu hình từ bảng này để kiểm tra WiFi & Ca làm việc
              </p>
            </div>
          </div>

          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-semibold text-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>Xem Bảng Dữ Liệu</span>
          </a>
        </div>

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
              Danh sách IP đường truyền quán (allowedIps - Đã ẩn khỏi màn hình nhân viên)
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
          onClick={onExportData}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          Tải Backup (.JSON)
        </button>
      </div>
    </div>
  );
};
