/**
 * COMPONENT: ShiftSettingsTab
 * Quản lý các ca làm việc: Ca sáng, ca chiều, giờ bắt đầu/kết thúc, ân hạn (SRP)
 */

import React from 'react';
import type { StoreConfig } from '../../types/index.ts';

interface ShiftSettingsTabProps {
  formData: StoreConfig;
  setFormData: React.Dispatch<React.SetStateAction<StoreConfig | null>>;
}

export const ShiftSettingsTab: React.FC<ShiftSettingsTabProps> = ({
  formData,
  setFormData,
}) => {
  return (
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
                setFormData((prev) => (prev ? { ...prev, shifts: updated } : prev));
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
                  setFormData((prev) => (prev ? { ...prev, shifts: updated } : prev));
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
                  setFormData((prev) => (prev ? { ...prev, shifts: updated } : prev));
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
                  setFormData((prev) => (prev ? { ...prev, shifts: updated } : prev));
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
                  setFormData((prev) => (prev ? { ...prev, shifts: updated } : prev));
                }}
                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
