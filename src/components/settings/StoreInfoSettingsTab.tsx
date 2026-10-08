/**
 * COMPONENT: StoreInfoSettingsTab
 * Quản lý thông tin chung: Tên quán, địa chỉ, email quản lý, giờ gửi báo cáo tự động (SRP)
 */

import React from 'react';
import type { StoreConfig } from '../../types/index.ts';

interface StoreInfoSettingsTabProps {
  formData: StoreConfig;
  setFormData: React.Dispatch<React.SetStateAction<StoreConfig | null>>;
}

export const StoreInfoSettingsTab: React.FC<StoreInfoSettingsTabProps> = ({
  formData,
  setFormData,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Tên Cửa Hàng / Quán</label>
        <input
          type="text"
          value={formData.storeName}
          onChange={(e) => setFormData((prev) => (prev ? { ...prev, storeName: e.target.value } : prev))}
          className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Địa Chỉ Cửa Hàng</label>
        <input
          type="text"
          value={formData.storeAddress}
          onChange={(e) => setFormData((prev) => (prev ? { ...prev, storeAddress: e.target.value } : prev))}
          className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
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
            onChange={(e) => setFormData((prev) => (prev ? { ...prev, managerEmail: e.target.value } : prev))}
            className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
            Giờ Gửi Báo Cáo Tự Động Hằng Ngày
          </label>
          <input
            type="time"
            value={formData.autoEmailTime}
            onChange={(e) => setFormData((prev) => (prev ? { ...prev, autoEmailTime: e.target.value } : prev))}
            className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-base sm:text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>
    </div>
  );
};
