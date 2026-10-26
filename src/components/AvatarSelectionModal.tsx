import React, { useState, useEffect } from 'react';
import { X, Check, Sparkles, RefreshCw, Smile, User, Camera } from 'lucide-react';
import type { User as UserType } from '../types/index.ts';

export interface AvatarSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: UserType | null;
  onSaveAvatar: (newAvatarUrl: string) => Promise<void>;
}

export interface ChibiAvatarPreset {
  id: string;
  name: string;
  seed: string;
  tag: string;
}

export const CHIBI_AVATAR_PRESETS: ChibiAvatarPreset[] = [
  { id: 'av_1', name: 'Bếp trưởng kính cận', seed: 'ptcong', tag: 'Bếp' },
  { id: 'av_2', name: 'Nữ quản lý tóc búi', seed: 'ttlhong', tag: 'Quản lý' },
  { id: 'av_3', name: 'Nam phục vụ tươi cười', seed: 'Nv1', tag: 'Phục vụ' },
  { id: 'av_4', name: 'Nữ phục vụ tóc sóng', seed: 'MaiAnh', tag: 'Phục vụ' },
  { id: 'av_5', name: 'Đầu bếp mũ phong cách', seed: 'TuanAnh', tag: 'Bếp' },
  { id: 'av_6', name: 'Nữ thu ngân năng động', seed: 'ThuHa', tag: 'Thu ngân' },
  { id: 'av_7', name: 'Nam pha chế lịch lãm', seed: 'HoangMinh', tag: 'Pha chế' },
  { id: 'av_8', name: 'Chibi cá tính', seed: 'BaoBao', tag: 'Đồng đội' },
  { id: 'av_9', name: 'Nữ nhân viên dịu dàng', seed: 'LinhChi', tag: 'Phục vụ' },
  { id: 'av_10', name: 'Chàng trai áo hoodie', seed: 'QuangDuy', tag: 'Năng động' },
  { id: 'av_11', name: 'Cô gái kính tròn vui vẻ', seed: 'PhuongThao', tag: 'Thu ngân' },
  { id: 'av_12', name: 'Nam phục vụ tóc xoăn', seed: 'DucThang', tag: 'Phục vụ' },
  { id: 'av_13', name: 'Nữ lễ tân thanh lịch', seed: 'NgocDiep', tag: 'Lễ tân' },
  { id: 'av_14', name: 'Nữ Barista tích cực', seed: 'KimNgan', tag: 'Pha chế' },
  { id: 'av_15', name: 'Nam nhân viên điềm tĩnh', seed: 'MinhQuan', tag: 'Kế toán' },
  { id: 'av_16', name: 'Nữ phục vụ tóc đuôi ngựa', seed: 'ThanhTruc', tag: 'Phục vụ' },
];

export function getChibiAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

export const AvatarSelectionModal: React.FC<AvatarSelectionModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSaveAvatar,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [customSeed, setCustomSeed] = useState<string>('');
  const [randomList, setRandomList] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && targetUser) {
      setSelectedAvatar(targetUser.avatar || getChibiAvatarUrl(targetUser.username || 'staff'));
      setCustomSeed('');
      setErrorMessage(null);
    }
  }, [isOpen, targetUser]);

  if (!isOpen) return null;

  const handleGenerateRandom = () => {
    const randomSeed = 'chibi_' + Math.random().toString(36).substring(2, 9);
    setRandomList((prev) => [randomSeed, ...prev.slice(0, 5)]);
    setSelectedAvatar(getChibiAvatarUrl(randomSeed));
  };

  const handleApplyCustomSeed = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customSeed.trim();
    if (!trimmed) return;
    const url = getChibiAvatarUrl(trimmed);
    setSelectedAvatar(url);
  };

  const handleSave = async () => {
    if (!selectedAvatar) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onSaveAvatar(selectedAvatar);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Backdrop click to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Container: Docked to bottom on mobile (Bottom-Sheet), centered card on desktop */}
      <div className="relative w-full sm:max-w-xl bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        
        {/* Mobile drag handle indicator */}
        <div className="sm:hidden pt-3 pb-1">
          <div className="w-12 h-1.5 bg-zinc-700/80 rounded-full mx-auto" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Smile className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                Chọn Ảnh Đại Diện Chibi
              </h3>
              <p className="text-[11px] text-zinc-400">
                Cho tài khoản: <strong className="text-zinc-200">{targetUser?.name || targetUser?.username}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer active:scale-95"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-5 overflow-y-auto space-y-5 no-scrollbar">

          {/* Current Selection Live Preview */}
          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <img
                  src={selectedAvatar}
                  alt="Selected Chibi Avatar"
                  className="w-16 h-16 rounded-2xl bg-zinc-800 object-cover border-2 border-emerald-500 shadow-md shadow-emerald-950/40"
                />
                <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-600 text-white shadow">
                  <Camera className="w-3 h-3" />
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-200">Avatar Đang Chọn</p>
                <p className="text-[11px] text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Phong cách Chibi dễ thương
                </p>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  Vector SVG sắc nét trên mọi màn hình
                </p>
              </div>
            </div>

            <button
              onClick={handleGenerateRandom}
              type="button"
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700/80 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Tạo ngẫu nhiên một chibi độc đáo"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Ngẫu nhiên</span>
            </button>
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Preset Chibi Avatars Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Smile className="w-3.5 h-3.5 text-emerald-400" />
                Bộ Sưu Tập Chibi Mầm Nhỏ ({CHIBI_AVATAR_PRESETS.length} mẫu)
              </label>
              <span className="text-[10px] text-zinc-500">Chạm để chọn</span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 gap-2.5">
              {CHIBI_AVATAR_PRESETS.map((preset) => {
                const url = getChibiAvatarUrl(preset.seed);
                const isSelected = selectedAvatar === url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedAvatar(url)}
                    className={`relative p-2 rounded-2xl flex flex-col items-center gap-1.5 transition-all cursor-pointer active:scale-95 group ${
                      isSelected
                        ? 'bg-emerald-500/15 border-2 border-emerald-500 shadow-lg shadow-emerald-950/30'
                        : 'bg-zinc-950/50 hover:bg-zinc-800/60 border border-zinc-800/80'
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={url}
                        alt={preset.name}
                        className="w-12 h-12 rounded-xl bg-zinc-800/80 object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-zinc-300 text-center line-clamp-1 w-full">
                      {preset.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-mono text-zinc-400 bg-zinc-900 border border-zinc-800">
                      {preset.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Randomly generated extras if any */}
          {randomList.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-zinc-800/70">
              <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Chibi Độc Quyền Vừa Tạo ({randomList.length})
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {randomList.map((seed) => {
                  const url = getChibiAvatarUrl(seed);
                  const isSelected = selectedAvatar === url;
                  return (
                    <button
                      key={seed}
                      type="button"
                      onClick={() => setSelectedAvatar(url)}
                      className={`relative p-2 rounded-2xl flex flex-col items-center shrink-0 transition-all cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-amber-500/15 border-2 border-amber-500 shadow-md'
                          : 'bg-zinc-950/60 border border-zinc-800'
                      }`}
                    >
                      <img
                        src={url}
                        alt={seed}
                        className="w-11 h-11 rounded-xl bg-zinc-800/80 object-cover"
                      />
                      {isSelected && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Seed Generator Input */}
          <form onSubmit={handleApplyCustomSeed} className="space-y-1.5 pt-2 border-t border-zinc-800/70">
            <label className="text-xs font-semibold text-zinc-400">
              Hoặc nhập tên/biệt danh để tạo hình riêng:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customSeed}
                onChange={(e) => setCustomSeed(e.target.value)}
                placeholder="Ví dụ: hoa_tieu, minhanh, chao_mam_nho..."
                className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 text-base sm:text-xs focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer active:scale-95"
              >
                Tạo
              </button>
            </div>
          </form>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
          >
            Hủy Bỏ
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || !selectedAvatar}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-950/40"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang Lưu...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Lưu Ảnh Đại Diện</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
