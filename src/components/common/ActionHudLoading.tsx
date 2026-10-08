import React from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

export interface ActionHudLoadingProps {
  message: string | null;
}

export const ActionHudLoading: React.FC<ActionHudLoadingProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none pointer-events-auto animate-in fade-in duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-xs rounded-3xl bg-zinc-900/95 border border-indigo-500/40 shadow-2xl shadow-indigo-950/60 p-6 text-center space-y-3.5">
        <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 animate-ping" />
          <div className="relative w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-bold text-zinc-100 leading-snug">
            {message}
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Hệ thống đang xử lý, vui lòng chờ...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
