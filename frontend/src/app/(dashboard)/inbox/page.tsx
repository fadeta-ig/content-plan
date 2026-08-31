'use client';

import React, { useEffect, useState } from 'react';
import {
  Inbox as InboxIcon,
  MessageSquare,
  Send,
  CheckCircle2,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { InboxMessage } from '@/lib/types';
import SocialIcon from '@/components/ui/SocialIcon';
import { useToast } from '@/components/ui/Toast';

const INBOX_STATUS_CONFIG: Record<
  InboxMessage['status'],
  { label: string; detailLabel: string; className: string }
> = {
  unread: {
    label: 'Baru',
    detailLabel: 'Menunggu Balasan',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  open: {
    label: 'Ditangani',
    detailLabel: 'Sedang Ditangani',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  resolved: {
    label: 'Selesai',
    detailLabel: 'Terselesaikan',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  archived: {
    label: 'Arsip',
    detailLabel: 'Diarsipkan',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

export default function InboxPage() {
  const toast = useToast();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadInbox = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.getInboxMessages();
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
        setSelectedMessage(data.messages[0]);
      } else {
        setMessages([]);
        setSelectedMessage(null);
      }
    } catch (error) {
      setMessages([]);
      setSelectedMessage(null);
      setLoadError(
        error instanceof Error && error.message
          ? error.message
          : 'Kotak masuk tidak dapat dimuat. Periksa koneksi lalu coba lagi.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !selectedMessage) return;

    setSending(true);
    try {
      const result = await api.replyInboxMessage({
        message_id: selectedMessage.id,
        content: replyContent,
      });

      const newReply = result.reply;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === selectedMessage.id
            ? { ...m, status: result.status, replies: [...m.replies, newReply] }
            : m
        )
      );

      setSelectedMessage((prev) =>
        prev ? { ...prev, status: result.status, replies: [...prev.replies, newReply] } : null
      );

      toast.success(
        'Balasan Terkirim',
        `Platform mengonfirmasi balasan kepada ${selectedMessage.sender_name} dengan ID ${result.platform_reply_id}.`
      );
      setReplyContent('');
    } catch (error) {
      toast.error(
        'Gagal Mengirim',
        error instanceof Error && error.message
          ? error.message
          : 'Balasan belum terkirim. Periksa koneksi dan status akun lalu coba lagi.'
      );
    } finally {
      setSending(false);
    }
  };

  const filteredMessages = messages.filter((m) =>
    filterPlatform === 'all' ? true : m.platform === filterPlatform
  );
  const selectedStatus = selectedMessage ? INBOX_STATUS_CONFIG[selectedMessage.status] : null;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            Kotak Masuk Terpadu (Unified Social Inbox)
          </h1>
          <p className="text-xs text-slate-500">
            Pusat interaksi komentar, direct messages (DM), dan mention dari seluruh saluran PT Wijaya Inovasi Gemilang.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium bg-white px-2.5 py-1 rounded border border-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Data Terisolasi per Workspace</span>
        </div>
      </div>

      {/* Main Inbox 2-Column Layout */}
      {loadError && (
        <div className="ui-card border-rose-200 bg-rose-50 text-rose-800 p-3 flex items-center justify-between gap-3" role="alert">
          <span className="text-xs">{loadError}</span>
          <button type="button" className="ui-btn ui-btn-secondary shrink-0" onClick={loadInbox}>Coba Lagi</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start" aria-busy={loading}>
        {/* Left Column: Messages List (5 Cols) */}
        <div className="lg:col-span-5 ui-card p-0 overflow-hidden space-y-0">
          {/* Filter Bar */}
          <div className="p-2 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              {['all', 'instagram', 'linkedin', 'facebook', 'tiktok'].map((plat) => (
                <button
                  type="button"
                  key={plat}
                  onClick={() => setFilterPlatform(plat)}
                  className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition shrink-0 ${
                    filterPlatform === plat
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {plat !== 'all' && (
                    <SocialIcon platform={plat} size={11} className={filterPlatform === plat ? 'text-white' : undefined} />
                  )}
                  <span>{plat === 'all' ? 'Semua' : plat.toUpperCase()}</span>
                </button>
              ))}
            </div>

            <span className="text-[11px] font-semibold text-slate-500 shrink-0">
              {filteredMessages.length} Pesan
            </span>
          </div>

          {/* List of Messages */}
          <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto bg-white">
            {loading ? (
              <div className="py-16 text-center text-xs text-slate-500 space-y-2" role="status">
                <Clock className="w-6 h-6 text-slate-300 mx-auto animate-pulse" />
                <p>Memuat pesan dan percakapan...</p>
              </div>
            ) : loadError ? (
              <div className="py-16 text-center text-xs text-rose-700 space-y-1" role="alert">
                <InboxIcon className="w-6 h-6 text-rose-300 mx-auto" />
                <p>Pesan belum dapat ditampilkan.</p>
              </div>
            ) : filteredMessages.length > 0 ? (
              filteredMessages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                const statusConfig = INBOX_STATUS_CONFIG[msg.status];
                return (
                  <button
                    type="button"
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className={`w-full text-left p-3 cursor-pointer transition flex items-start justify-between gap-2.5 select-none ${
                      isSelected
                        ? 'bg-slate-50 border-l-2 border-slate-900'
                        : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-1.5">
                        <SocialIcon platform={msg.platform} size={13} />
                        <span className="font-semibold text-slate-900 text-xs">{msg.sender_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          • {new Date(msg.received_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-slate-600 text-[11px] line-clamp-2 leading-relaxed">
                        {msg.content}
                      </p>
                    </div>

                    <span
                      className={`ui-badge text-[9px] shrink-0 ${statusConfig.className}`}
                    >
                      {statusConfig.label}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 space-y-1">
                <InboxIcon className="w-6 h-6 text-slate-300 mx-auto" />
                <p>Belum ada pesan atau komentar masuk.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Chat Conversation Thread (7 Cols) */}
        <div className="lg:col-span-7 ui-card p-0 overflow-hidden flex flex-col justify-between min-h-[560px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs space-y-2" role="status">
              <Clock className="w-8 h-8 text-slate-300 animate-pulse" />
              <p>Memuat detail percakapan...</p>
            </div>
          ) : selectedMessage && selectedStatus ? (
            <>
              {/* Message Header */}
              <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-xs text-slate-700">
                    {selectedMessage.sender_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 leading-tight">
                      {selectedMessage.sender_name}
                    </h3>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <SocialIcon platform={selectedMessage.platform} size={11} />
                      <span>{selectedMessage.account_name}</span>
                    </p>
                  </div>
                </div>

                <span className={`ui-badge text-[10px] ${selectedStatus.className}`}>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{selectedStatus.detailLabel}</span>
                </span>
              </div>

              {/* Message Body & Replies Thread */}
              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                {/* Incoming Message Bubble */}
                <div className="space-y-1 max-w-[85%]">
                  <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans">
                    {selectedMessage.content}
                  </div>
                  <span className="text-[10px] text-slate-400 block px-1">
                    Diterima: {new Date(selectedMessage.received_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>

                {/* Sent Replies Thread */}
                {selectedMessage.replies.map((rep) => (
                  <div key={rep.id} className="space-y-1 ml-auto max-w-[85%] text-right">
                    <div className="p-3 rounded-lg bg-slate-900 text-white text-xs leading-relaxed text-left font-sans">
                      {rep.content}
                    </div>
                    <span className="text-[10px] text-slate-400 block px-1">
                      Dibalas oleh {rep.author_name} • {new Date(rep.sent_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="p-3 border-t border-slate-200 bg-white space-y-2">
                <textarea
                  rows={3}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`Ketik balasan resmi kepada ${selectedMessage.sender_name}...`}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white leading-relaxed"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Balasan hanya ditandai berhasil setelah {selectedMessage.platform.toUpperCase()} mengonfirmasi pengiriman.
                  </span>

                  <button
                    type="submit"
                    disabled={sending || !replyContent.trim()}
                    className="ui-btn ui-btn-primary text-xs py-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sending ? 'Mengirim...' : 'Kirim Balasan'}</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
              <p>Pilih pesan dari daftar untuk melihat percakapan dan membalas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
