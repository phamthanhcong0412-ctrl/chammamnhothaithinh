import React, { useState, useEffect } from 'react';
import { X, Mail, Send, CheckCircle2, Clock, Calendar, Eye, AlertCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../services/api.ts';
import type { EmailLog } from '../types/index.ts';

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailReportModal: React.FC<EmailReportModalProps> = ({ isOpen, onClose }) => {
  const { storeConfig, sendEmailReport } = useApp();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [recipient, setRecipient] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'preview' | 'logs'>('schedule');
  const [previewHtml, setPreviewHtml] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    setRecipient(storeConfig?.managerEmail || 'boyeucongaibo.delpiero@gmail.com');
    loadLogs();
  }, [isOpen, storeConfig]);

  const loadLogs = async () => {
    try {
      const data = await api.getEmailLogs();
      setLogs(data);
      if (data.length > 0 && !previewHtml) {
        setPreviewHtml(data[0].htmlBody);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendNow = async () => {
    setIsSending(true);
    setSendSuccessMsg(null);
    try {
      const log = await sendEmailReport(recipient);
      setSendSuccessMsg(`Đã gửi thành công báo cáo chấm công tới ${recipient}!`);
      setPreviewHtml(log.htmlBody);
      loadLogs();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gửi email');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Báo Cáo Chấm Công Qua Email</h3>
              <p className="text-xs text-zinc-400">Tự động gửi báo cáo hằng ngày cho Quản lý</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-zinc-800 px-6 pt-3 bg-zinc-950/40">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'schedule'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Gửi Báo Cáo
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'preview'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Xem Trước
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Lịch Sử Gửi ({logs.length})
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'schedule' && (
            <div className="space-y-5">
              
              {/* Automated Schedule Card */}
              <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                        Lịch gửi tự động hằng ngày
                      </h4>
                      <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                        Tự động gửi lúc {storeConfig?.autoEmailTime || '21:00'} hằng ngày
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    Bật
                  </span>
                </div>

                <div className="text-xs text-zinc-400 leading-relaxed bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                  <p className="mb-1">
                    • <strong>Quy trình:</strong> Hệ thống tự động tổng hợp các ca làm việc trong ngày và số giờ tích lũy trong tháng của từng nhân viên.
                  </p>
                  <p>
                    • <strong>Nội dung:</strong> Danh sách ca, giờ vào/ra, tổng giờ công và tiền lương tạm tính gửi thẳng về email Quản lý.
                  </p>
                </div>
              </div>

              {/* Target recipient email config */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-zinc-300">
                  Email Quản Lý nhận báo cáo
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="quanly@gmail.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <button
                    onClick={handleSendNow}
                    disabled={isSending || !recipient}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all disabled:opacity-50 shrink-0"
                  >
                    {isSending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang gửi...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Gửi Ngay
                      </>
                    )}
                  </button>
                </div>
              </div>

              {sendSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{sendSuccessMsg}</span>
                </div>
              )}

              {/* Last sent date */}
              <div className="text-xs text-zinc-500 flex items-center justify-between pt-2 border-t border-zinc-800/80">
                <span>Lần gửi gần nhất:</span>
                <span className="font-medium text-zinc-400">
                  {storeConfig?.lastReportSentDate
                    ? `Ngày ${storeConfig.lastReportSentDate}`
                    : 'Chưa gửi hôm nay'}
                </span>
              </div>

            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Xem trước email gửi đến quản lý:</span>
                <button
                  onClick={handleSendNow}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  <Send className="w-3 h-3" /> Gửi mẫu này
                </button>
              </div>

              {previewHtml ? (
                <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-black max-h-[500px] overflow-y-auto">
                  <iframe
                    srcDoc={previewHtml}
                    title="Email Preview"
                    className="w-full min-h-[420px] border-0"
                  />
                </div>
              ) : (
                <div className="p-12 text-center text-zinc-500 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Bấm "Gửi Báo Cáo Ngay" để khởi tạo mẫu email đầu tiên</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="p-10 text-center text-zinc-500 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <p className="text-xs">Chưa có lịch sử email nào được ghi nhận.</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-200">{log.subject}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            log.trigger === 'auto_21h'
                              ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                          }`}
                        >
                          {log.trigger === 'auto_21h' ? 'Tự động 21h' : 'Thủ công'}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-[11px] mt-1">
                        Gửi tới: <span className="text-zinc-400">{log.recipient}</span> • {new Date(log.sentAt).toLocaleString('vi-VN')}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setPreviewHtml(log.htmlBody);
                        setActiveTab('preview');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Xem lại
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-zinc-950/80 border-t border-zinc-800/80 text-[11px] text-zinc-500 flex items-center justify-between">
          <span>Hệ thống hỗ trợ gửi cả khi trình duyệt đóng nhờ service nền.</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
