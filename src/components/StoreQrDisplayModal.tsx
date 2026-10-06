import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { X, RefreshCw, Printer, Wifi, MapPin, Shield, Check, Copy } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';

interface StoreQrDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StoreQrDisplayModal: React.FC<StoreQrDisplayModalProps> = ({ isOpen, onClose }) => {
  const { storeConfig } = useApp();
  const [tokenData, setTokenData] = useState<{
    token: string;
    generatedAt: number;
    expiresAt: number;
    storeName: string;
  } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(45);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch rotating token
  const fetchToken = async () => {
    try {
      const res = await fetch('/api/qr/token');
      const data = await res.json();
      setTokenData(data);

      const remaining = Math.max(0, Math.round((data.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);

      // Generate QR Code data URL
      const qrUrl = await QRCode.toDataURL(data.token, {
        width: 320,
        margin: 2,
        color: {
          dark: '#09090b',
          light: '#ffffff',
        },
      });
      setQrDataUrl(qrUrl);
    } catch (err) {
      console.error('Failed to fetch QR token:', err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchToken();

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchToken();
          return 45;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    if (tokenData?.token) {
      navigator.clipboard.writeText(tokenData.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-100">
        
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Màn Hình Điểm Chấm Công</span>
              <h2 className="text-base font-bold text-zinc-100">{storeConfig?.storeName || 'Cửa Hàng'}</h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrint}
              title="In biển mã QR"
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Counter Display Body */}
        <div className="p-6 flex flex-col items-center text-center">
          
          <div className="mb-4 space-y-1">
            <p className="text-xs text-zinc-400 flex items-center justify-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
              {storeConfig?.storeAddress || '88 Đường Đồng Khởi, Quận 1'}
            </p>
            <p className="text-xs text-indigo-400 font-medium flex items-center justify-center gap-1.5">
              <Wifi className="w-3.5 h-3.5" />
              Yêu cầu kết nối WiFi: <span className="font-bold underline">{storeConfig?.wifiSsid}</span>
            </p>
          </div>

          {/* QR Code Container with High-Contrast White Background */}
          <div className="relative p-4 bg-white rounded-2xl shadow-xl border-4 border-zinc-700/60 my-2">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Store QR Code"
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-lg"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin" />
              </div>
            )}

            {/* Corner security badge */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 shadow-md whitespace-nowrap">
              <Shield className="w-3 h-3 text-emerald-400" /> Mã Động Tự Làm Mới: {timeLeft}s
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 space-y-2 max-w-sm">
            <h4 className="text-sm font-semibold text-zinc-200">Hướng dẫn nhân viên:</h4>
            <div className="text-xs text-zinc-400 space-y-1 text-left bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <p className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center">1</span>
                Kết nối điện thoại vào WiFi quán: <strong className="text-zinc-200">{storeConfig?.wifiSsid}</strong>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center">2</span>
                Mở app chấm công và bấm nút <strong className="text-emerald-400">Quét QR Check-in/Check-out</strong>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center">3</span>
                Đưa camera quét mã trên để ghi nhận giờ làm việc chính xác
              </p>
            </div>
          </div>

          {/* Quick copy token for test / manual */}
          <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
            <span>Mã token: <code className="text-zinc-400 font-mono text-[11px]">{tokenData?.token.slice(0, 18)}...</code></span>
            <button
              onClick={handleCopyCode}
              className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Sao chép mã"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-950/60 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Quầy thu ngân đã sẵn sàng
          </span>
          <button
            onClick={fetchToken}
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
          >
            <RefreshCw className="w-3 h-3" /> Làm mới mã ngay
          </button>
        </div>

      </div>
    </div>
  );
};
