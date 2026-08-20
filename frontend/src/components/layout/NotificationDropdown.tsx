'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  UserCheck,
  Send,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  X,
  Inbox,
  Calendar,
  FileText,
} from 'lucide-react';
import { api } from '@/lib/api';
import { NotificationItem, NotificationCategory } from '@/lib/types';
import SocialIcon from '@/components/ui/SocialIcon';

type FilterTab = 'all' | NotificationCategory;

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bgColor: string; borderColor: string }
> = {
  approval: {
    icon: UserCheck,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  system: {
    icon: Send,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  inbox: {
    icon: MessageSquare,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
  },
};

function formatRelativeTime(isoTimestamp: string): string {
  try {
    const date = new Date(isoTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);

    if (diffMinutes < 1) return 'Baru saja';
    if (diffMinutes < 60) return `${diffMinutes} menit lalu`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hari lalu`;

    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export default function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getNotifications(activeFilter !== 'all' ? activeFilter : undefined);
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await api.markNotificationsRead({ mark_all: true });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    if (item.action_url) {
      router.push(item.action_url);
      setIsOpen(false);
    }
  };

  const filteredNotifications =
    activeFilter === 'all'
      ? notifications
      : notifications.filter((n) => n.category === activeFilter);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'approval', label: 'Persetujuan' },
    { key: 'system', label: 'Sistem' },
    { key: 'inbox', label: 'Pesan Masuk' },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifikasi"
        className={`relative p-1.5 rounded-md border transition ${
          isOpen
            ? 'border-slate-400 bg-slate-100 text-slate-900'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center leading-none shadow-sm animate-in fade-in zoom-in-75">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-slate-600" />
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Pusat Notifikasi
              </h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold border border-rose-200">
                  {unreadCount} baru
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] font-medium text-slate-500 hover:text-slate-800 transition px-1.5 py-0.5 rounded hover:bg-slate-100"
                >
                  Tandai Dibaca
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-0.5 rounded text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tab Filters */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 bg-white">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                  activeFilter === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {isLoading && filteredNotifications.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                <Clock className="w-5 h-5 text-slate-300 mx-auto mb-2 animate-pulse" />
                <span>Memuat notifikasi...</span>
              </div>
            ) : filteredNotifications.length > 0 ? (
              filteredNotifications.map((item) => {
                const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.system;
                const IconComp = config.icon;
                const isTitleFailed = item.title.toLowerCase().includes('gagal');

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition group ${
                      !item.is_read ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    {/* Category Icon */}
                    <div
                      className={`shrink-0 mt-0.5 w-7 h-7 rounded-md flex items-center justify-center border ${
                        isTitleFailed
                          ? 'bg-rose-50 border-rose-200 text-rose-600'
                          : `${config.bgColor} ${config.borderColor} ${config.color}`
                      }`}
                    >
                      {isTitleFailed ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <IconComp className="w-3.5 h-3.5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-semibold leading-tight ${
                            !item.is_read ? 'text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          {item.title}
                        </span>
                        {!item.is_read && (
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-600" />
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between pt-0.5">
                        <div className="flex items-center gap-1.5">
                          {item.platforms.slice(0, 3).map((p) => (
                            <SocialIcon key={p} platform={p} size={10} className="text-slate-400" />
                          ))}
                          <span className="text-[10px] text-slate-400 font-medium">
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        </div>

                        <span className="text-[10px] font-semibold text-slate-600 group-hover:text-slate-900 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          {item.action_label}
                          <ChevronRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-12 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-300 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Semua agenda telah selesai.</p>
                <p className="text-[10px] text-slate-400">
                  Tidak ada notifikasi yang memerlukan perhatian saat ini.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {filteredNotifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/40 text-center">
              <span className="text-[10px] text-slate-400 font-medium">
                Menampilkan {filteredNotifications.length} notifikasi terbaru
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
