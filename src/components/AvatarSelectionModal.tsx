import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Sparkles, RefreshCw, Smile, Camera, Search, Filter } from 'lucide-react';
import type { User as UserType } from '../types/index.ts';

export interface AvatarSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: UserType | null;
  onSaveAvatar: (newAvatarUrl: string) => Promise<void>;
}

export type AvatarCategory = 'all' | 'cute' | 'kitchen' | 'service' | 'cashier' | 'active';

export interface ChibiAvatarPreset {
  id: string;
  name: string;
  seed: string;
  tag: string;
  category: 'cute' | 'kitchen' | 'service' | 'cashier' | 'active';
}

export const CHIBI_AVATAR_PRESETS: ChibiAvatarPreset[] = [
  // 1. Nhóm Dễ thương & Siêu Kute (11 mẫu)
  { id: 'av_8', name: 'Bé hạt tiêu tóc vàng', seed: 'BaoBao', tag: 'Kute', category: 'cute' },
  { id: 'av_17', name: 'Bé tóc hai chùm', seed: 'AnNhi', tag: 'Kute', category: 'cute' },
  { id: 'av_18', name: 'Nam chibi mũ len', seed: 'GiaBao', tag: 'Kute', category: 'cute' },
  { id: 'av_19', name: 'Cô nàng tóc bob xinh', seed: 'BichNgoc', tag: 'Kute', category: 'cute' },
  { id: 'av_21', name: 'Nữ sinh tóc mái ngố', seed: 'HaMy', tag: 'Kute', category: 'cute' },
  { id: 'av_24', name: 'Tóc búi củ tỏi dễ thương', seed: 'KhanhLinh', tag: 'Kute', category: 'cute' },
  { id: 'av_29', name: 'Cô gái uốn sóng nhẹ', seed: 'ThuyTien', tag: 'Kute', category: 'cute' },
  { id: 'av_31', name: 'Má lúm đồng tiền', seed: 'YenNhi', tag: 'Kute', category: 'cute' },
  { id: 'av_32', name: 'Mũ tai gấu siêu kute', seed: 'CongChua', tag: 'Kute', category: 'cute' },
  { id: 'av_34', name: 'Mắt tròn xoe mầm nhỏ', seed: 'TieuBao', tag: 'Kute', category: 'cute' },
  { id: 'av_36', name: 'Biểu tượng Mầm Nhỏ', seed: 'MamNho', tag: 'Kute', category: 'cute' },

  // 2. Nhóm Bếp & Pha chế (8 mẫu)
  { id: 'av_1', name: 'Bếp trưởng kính cận', seed: 'ptcong', tag: 'Bếp', category: 'kitchen' },
  { id: 'av_5', name: 'Đầu bếp mũ phong cách', seed: 'TuanAnh', tag: 'Bếp', category: 'kitchen' },
  { id: 'av_7', name: 'Nam pha chế lịch lãm', seed: 'HoangMinh', tag: 'Pha chế', category: 'kitchen' },
  { id: 'av_14', name: 'Nữ Barista tích cực', seed: 'KimNgan', tag: 'Pha chế', category: 'kitchen' },
  { id: 'av_22', name: 'Chàng đầu bếp năng nổ', seed: 'HaiDang', tag: 'Bếp', category: 'kitchen' },
  { id: 'av_26', name: 'Pha chế tóc rẽ ngôi', seed: 'NhatMinh', tag: 'Pha chế', category: 'kitchen' },
  { id: 'av_28', name: 'Phụ bếp mũ lưỡi trai', seed: 'ThanhTung', tag: 'Bếp', category: 'kitchen' },
  { id: 'av_35', name: 'Barista trà sữa ngọt ngào', seed: 'TraSua', tag: 'Pha chế', category: 'kitchen' },

  // 3. Nhóm Phục vụ & Chăm sóc (8 mẫu)
  { id: 'av_3', name: 'Nam phục vụ tươi cười', seed: 'Nv1', tag: 'Phục vụ', category: 'service' },
  { id: 'av_4', name: 'Nữ phục vụ tóc sóng', seed: 'MaiAnh', tag: 'Phục vụ', category: 'service' },
  { id: 'av_9', name: 'Nữ nhân viên dịu dàng', seed: 'LinhChi', tag: 'Phục vụ', category: 'service' },
  { id: 'av_12', name: 'Nam phục vụ tóc xoăn', seed: 'DucThang', tag: 'Phục vụ', category: 'service' },
  { id: 'av_16', name: 'Nữ phục vụ tóc đuôi ngựa', seed: 'ThanhTruc', tag: 'Phục vụ', category: 'service' },
  { id: 'av_23', name: 'Phục vụ nụ cười tỏa nắng', seed: 'HuongGiang', tag: 'Phục vụ', category: 'service' },
  { id: 'av_25', name: 'Phục vụ kính cận hiền lành', seed: 'MinhTri', tag: 'Phục vụ', category: 'service' },
  { id: 'av_30', name: 'Chàng trai sơ mi tươi vui', seed: 'VietAnh', tag: 'Phục vụ', category: 'service' },

  // 4. Nhóm Quản lý & Thu ngân (6 mẫu)
  { id: 'av_2', name: 'Nữ quản lý tóc búi', seed: 'ttlhong', tag: 'Quản lý', category: 'cashier' },
  { id: 'av_6', name: 'Nữ thu ngân năng động', seed: 'ThuHa', tag: 'Thu ngân', category: 'cashier' },
  { id: 'av_11', name: 'Cô gái kính tròn vui vẻ', seed: 'PhuongThao', tag: 'Thu ngân', category: 'cashier' },
  { id: 'av_13', name: 'Nữ lễ tân thanh lịch', seed: 'NgocDiep', tag: 'Lễ tân', category: 'cashier' },
  { id: 'av_15', name: 'Nam điềm tĩnh kính vuông', seed: 'MinhQuan', tag: 'Kế toán', category: 'cashier' },
  { id: 'av_27', name: 'Thu ngân tóc kẹp nơ', seed: 'QuynhAnh', tag: 'Thu ngân', category: 'cashier' },

  // 5. Nhóm Năng động & Cá tính (3 mẫu)
  { id: 'av_10', name: 'Chàng trai áo hoodie', seed: 'QuangDuy', tag: 'Cá tính', category: 'active' },
  { id: 'av_20', name: 'Chàng trai tai nghe nhạc', seed: 'DuyKhang', tag: 'Cá tính', category: 'active' },
  { id: 'av_33', name: 'Chàng trai tóc xù lãng tử', seed: 'HoangTu', tag: 'Cá tính', category: 'active' },
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
  const [activeCategory, setActiveCategory] = useState<AvatarCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customSeed, setCustomSeed] = useState<string>('');
  const [randomList, setRandomList] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && targetUser) {
      setSelectedAvatar(targetUser.avatar || getChibiAvatarUrl(targetUser.username || 'staff'));
      setCustomSeed('');
      setSearchQuery('');
      setActiveCategory('all');
      setErrorMessage(null);
    }
  }, [isOpen, targetUser]);

  const filteredPresets = useMemo(() => {
    return CHIBI_AVATAR_PRESETS.filter((p) => {
      const matchCat = activeCategory === 'all' || p.category === activeCategory;
      const matchSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tag.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  if (!isOpen) return null;

  const handleGenerateRandom = () => {
    const randomSeed = 'chibi_' + Math.random().toString(36).substring(2, 9);
    setRandomList((prev) => [randomSeed, ...prev.slice(0, 7)]);
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
                Bộ Sưu Tập Avatar Chibi ({CHIBI_AVATAR_PRESETS.length} mẫu)
              </h3>
              <p className="text-[11px] text-zinc-400">
                Đổi ảnh đại diện cho: <strong className="text-zinc-200">{targetUser?.name || targetUser?.username}</strong>
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
                  <span>Ảnh Đang Chọn</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Sắc nét SVG
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                  Bấm vào bất kỳ ảnh bên dưới hoặc tạo ngẫu nhiên
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
              <span className="hidden sm:inline">Tạo ngẫu nhiên</span>
            </button>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {[
              { id: 'all', label: `Tất cả (${CHIBI_AVATAR_PRESETS.length})` },
              { id: 'cute', label: 'Siêu Kute (11)' },
              { id: 'kitchen', label: 'Bếp & Pha Chế (8)' },
              { id: 'service', label: 'Phục Vụ (8)' },
              { id: 'cashier', label: 'Quản Lý & Thu Ngân (6)' },
              { id: 'active', label: 'Cá Tính (3)' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id as AvatarCategory)}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                  activeCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
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

          {/* Randomly generated chibi strip if available */}
          {randomList.length > 0 && (
            <div className="space-y-2 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Chibi Độc Quyền Vừa Tạo Ngẫu Nhiên ({randomList.length})
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
                      className={`relative p-1.5 rounded-2xl flex flex-col items-center shrink-0 transition-all cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-amber-500/20 border-2 border-amber-500 shadow-md'
                          : 'bg-zinc-950/70 border border-zinc-800'
                      }`}
                    >
                      <img
                        src={url}
                        alt={seed}
                        className="w-12 h-12 rounded-xl bg-zinc-800/80 object-cover"
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

          {/* 36 Presets Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
            {filteredPresets.map((preset) => {
              const url = getChibiAvatarUrl(preset.seed);
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

          {/* Custom Seed Input Generator */}
          <form onSubmit={handleApplyCustomSeed} className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/80 space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">
              Hoặc nhập biệt danh/từ khóa bất kỳ để tạo Chibi riêng:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customSeed}
                onChange={(e) => setCustomSeed(e.target.value)}
                placeholder="Ví dụ: hoa_tieu, cobe_mamnho, bep_truong..."
                className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 text-base sm:text-xs focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer active:scale-95"
              >
                Tạo
              </button>
            </div>
          </form>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-500 hidden sm:block">
            Đã đồng bộ tự động lên tài khoản & cơ sở dữ liệu
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
