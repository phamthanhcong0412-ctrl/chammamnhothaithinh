import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, RefreshCw, Smile, Heart, Sparkles } from 'lucide-react';
import type { User as UserType } from '../types/index.ts';

export interface AvatarSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: UserType | null;
  onSaveAvatar: (newAvatarUrl: string) => Promise<void>;
}

export type AvatarCategory = 'all' | 'female' | 'male';

export interface ChibiAvatarPreset {
  id: string;
  name: string;
  seed: string;
  top: string;
  tag: string;
  gender: 'female' | 'male';
}

/**
 * 30 Mẫu Avatar Chibi Da Trắng Hồng Hào (24 Nữ Dễ Thương + 6 Nam Bảnh Bao)
 * Nguồn: Thư viện chuẩn DiceBear Avataaars (Open-source vector SVG, da trắng ffdbb4, không râu)
 */
export const CHIBI_AVATAR_PRESETS: ChibiAvatarPreset[] = [
  // -------------------------------------------------------------
  // 24 CÔ NÀNG DỄ THƯƠNG DA TRẮNG
  // -------------------------------------------------------------
  { id: 'g1', name: 'Cô nàng tóc dài thẳng', seed: 'MaiAnh', top: 'straight01', tag: 'Duyên dáng', gender: 'female' },
  { id: 'g2', name: 'Bé tóc búi củ tỏi', seed: 'LinhChi', top: 'bun', tag: 'Kute', gender: 'female' },
  { id: 'g3', name: 'Nữ sinh tóc bob', seed: 'ThuHa', top: 'bob', tag: 'Năng động', gender: 'female' },
  { id: 'g4', name: 'Nàng uốn sóng nhẹ', seed: 'ThuyTien', top: 'curvy', tag: 'Tiểu thư', gender: 'female' },
  { id: 'g5', name: 'Tóc dài tự nhiên', seed: 'NgocDiep', top: 'straight02', tag: 'Thanh lịch', gender: 'female' },
  { id: 'g6', name: 'Nữ thu ngân tóc ngắn', seed: 'PhuongThao', top: 'miaWallace', tag: 'Thu ngân', gender: 'female' },
  { id: 'g7', name: 'Bé hạt tiêu tóc mái', seed: 'BaoBao', top: 'longButNotTooLong', tag: 'Đáng yêu', gender: 'female' },
  { id: 'g8', name: 'Cô nàng kẹp tóc nơ', seed: 'KimNgan', top: 'straightAndStrand', tag: 'Ngọt ngào', gender: 'female' },
  { id: 'g9', name: 'Nữ phục vụ tươi tắn', seed: 'ThanhTruc', top: 'curvy', tag: 'Phục vụ', gender: 'female' },
  { id: 'g10', name: 'Cô gái mắt cười', seed: 'HaMy', top: 'bob', tag: 'Vui vẻ', gender: 'female' },
  { id: 'g11', name: 'Bé mầm nhỏ má hồng', seed: 'AnNhi', top: 'bun', tag: 'Siêu kute', gender: 'female' },
  { id: 'g12', name: 'Nữ pha chế dịu dàng', seed: 'KhanhLinh', top: 'straight01', tag: 'Pha chế', gender: 'female' },
  { id: 'g13', name: 'Cô nàng tóc xoăn bồng', seed: 'BichNgoc', top: 'curly', tag: 'Cá tính', gender: 'female' },
  { id: 'g14', name: 'Nữ quản lý thanh lịch', seed: 'ttlhong', top: 'bun', tag: 'Quản lý', gender: 'female' },
  { id: 'g15', name: 'Nụ cười tỏa nắng', seed: 'HuongGiang', top: 'straight02', tag: 'Tươi tắn', gender: 'female' },
  { id: 'g16', name: 'Nàng thơ má lúm', seed: 'YenNhi', top: 'curvy', tag: 'Dễ thương', gender: 'female' },
  { id: 'g17', name: 'Cô bé cài băng đô', seed: 'QuynhAnh', top: 'froBand', tag: 'Điệu đà', gender: 'female' },
  { id: 'g18', name: 'Nữ nhân viên duyên dáng', seed: 'MinhAnh', top: 'straightAndStrand', tag: 'Nhẹ nhàng', gender: 'female' },
  { id: 'g19', name: 'Tóc ngắn cá tính', seed: 'ThaoMy', top: 'miaWallace', tag: 'Cool ngầu', gender: 'female' },
  { id: 'g20', name: 'Bé chibi mắt tròn', seed: 'TieuBao', top: 'bun', tag: 'Tròn xoe', gender: 'female' },
  { id: 'g21', name: 'Trà sữa ngọt ngào', seed: 'TraSua', top: 'straight01', tag: 'Ngọt ngào', gender: 'female' },
  { id: 'g22', name: 'Nữ Barista tích cực', seed: 'HongNhung', top: 'curvy', tag: 'Năng nổ', gender: 'female' },
  { id: 'g23', name: 'Cô nàng kính tròn', seed: 'DieuLinh', top: 'bob', tag: 'Tri thức', gender: 'female' },
  { id: 'g24', name: 'Biểu tượng Mầm Nhỏ', seed: 'MamNho', top: 'straight02', tag: 'Mầm Nhỏ', gender: 'female' },

  // -------------------------------------------------------------
  // 6 ANH CHÀNG BẢNH BAO DA SÁNG
  // -------------------------------------------------------------
  { id: 'm1', name: 'Bếp trưởng kính cận', seed: 'ptcong', top: 'shortFlat', tag: 'Bếp trưởng', gender: 'male' },
  { id: 'm2', name: 'Nam phục vụ tươi cười', seed: 'Nv1', top: 'shortRound', tag: 'Phục vụ', gender: 'male' },
  { id: 'm3', name: 'Đầu bếp trẻ năng nổ', seed: 'TuanAnh', top: 'shortWaved', tag: 'Đầu bếp', gender: 'male' },
  { id: 'm4', name: 'Chàng pha chế bảnh bao', seed: 'HoangMinh', top: 'theCaesar', tag: 'Pha chế', gender: 'male' },
  { id: 'm5', name: 'Nam thu ngân hiền lành', seed: 'MinhTri', top: 'shortFlat', tag: 'Thu ngân', gender: 'male' },
  { id: 'm6', name: 'Chàng trai áo sơ mi', seed: 'VietAnh', top: 'shortRound', tag: 'Lịch lãm', gender: 'male' },
];

/**
 * Tạo link avatar Chibi da trắng tự nhiên (#ffdbb4), không râu
 */
export function getChibiAvatarUrl(seed: string, top?: string): string {
  const topParam = top ? `&top=${encodeURIComponent(top)}` : '';
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}${topParam}&skinColor=ffdbb4&facialHairProbability=0`;
}

export const AvatarSelectionModal: React.FC<AvatarSelectionModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSaveAvatar,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<AvatarCategory>('all');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && targetUser) {
      setSelectedAvatar(targetUser.avatar || getChibiAvatarUrl(targetUser.username || 'staff'));
      setActiveCategory('all');
      setErrorMessage(null);
    }
  }, [isOpen, targetUser]);

  const filteredPresets = useMemo(() => {
    return CHIBI_AVATAR_PRESETS.filter((p) => {
      if (activeCategory === 'female') return p.gender === 'female';
      if (activeCategory === 'male') return p.gender === 'male';
      return true;
    });
  }, [activeCategory]);

  const activePreset = useMemo(() => {
    return CHIBI_AVATAR_PRESETS.find(
      (p) => getChibiAvatarUrl(p.seed, p.top) === selectedAvatar || getChibiAvatarUrl(p.seed) === selectedAvatar
    );
  }, [selectedAvatar]);

  if (!isOpen) return null;

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

      {/* Modal Container: Bottom-Sheet on mobile, centered card on desktop */}
      <div className="relative w-full sm:max-w-2xl bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        
        {/* Mobile drag handle indicator */}
        <div className="sm:hidden pt-3 pb-1">
          <div className="w-12 h-1.5 bg-zinc-700/80 rounded-full mx-auto" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Smile className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                Bộ Sưu Tập Avatar Chibi Da Trắng ({CHIBI_AVATAR_PRESETS.length} mẫu)
              </h3>
              <p className="text-[11px] text-zinc-400">
                Tài khoản: <strong className="text-zinc-200">{targetUser?.name || targetUser?.username}</strong>
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

        {/* Live Preview & Category Filters Bar */}
        <div className="px-5 pt-3 pb-2 border-b border-zinc-800/80 bg-zinc-950/40 space-y-3">
          
          {/* Live Preview Strip */}
          <div className="flex items-center justify-between gap-3 bg-zinc-900/90 p-3 rounded-2xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <img
                  src={selectedAvatar}
                  alt="Selected Avatar Preview"
                  className="w-13 h-13 rounded-2xl bg-zinc-800 object-cover border-2 border-emerald-500 shadow-md shadow-emerald-950/50"
                />
                <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-600 text-white shadow">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                  <span>{activePreset ? activePreset.name : 'Avatar Đang Chọn'}</span>
                  {activePreset && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {activePreset.tag}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                  Chibi da trắng dễ thương • Không râu • Nét vẽ Vector
                </p>
              </div>
            </div>

            <span className="text-[11px] text-zinc-500 font-mono hidden sm:block">
              Chạm ảnh để chọn
            </span>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                activeCategory === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tất cả ({CHIBI_AVATAR_PRESETS.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('female')}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer active:scale-95 flex items-center gap-1 ${
                activeCategory === 'female'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              <span>Cô nàng dễ thương (24)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('male')}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer active:scale-95 flex items-center gap-1 ${
                activeCategory === 'male'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Anh chàng bảnh bao (6)</span>
            </button>
          </div>

        </div>

        {/* Modal Body - Scrollable Presets Grid */}
        <div className="p-5 overflow-y-auto space-y-4 no-scrollbar flex-1">

          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMessage}
            </div>
          )}

          {/* 30 Presets Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
            {filteredPresets.map((preset) => {
              const url = getChibiAvatarUrl(preset.seed, preset.top);
              const isSelected = selectedAvatar === url;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedAvatar(url)}
                  className={`relative p-2 rounded-2xl flex flex-col items-center gap-1 transition-all cursor-pointer active:scale-95 group ${
                    isSelected
                      ? 'bg-emerald-500/15 border-2 border-emerald-500 shadow-lg shadow-emerald-950/30'
                      : 'bg-zinc-950/50 hover:bg-zinc-800/60 border border-zinc-800/80'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={url}
                      alt={preset.name}
                      className="w-13 h-13 rounded-xl bg-zinc-800/80 object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-zinc-300 text-center line-clamp-1 w-full mt-0.5">
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

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-500 hidden sm:block">
            Đồng bộ tự động lên tài khoản & cơ sở dữ liệu Supabase
          </p>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
            >
              Hủy
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
    </div>
  );
};
