'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  Plus,
  LogOut,
  User as UserIcon,
  Menu,
} from 'lucide-react';
import { User, Workspace } from '@/lib/types';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import NotificationDropdown from '@/components/layout/NotificationDropdown';

interface HeaderProps {
  user?: User | null;
  activeWorkspace?: Workspace | null;
  isBackendConnected?: boolean;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function Header({
  user,
  activeWorkspace,
  isBackendConnected = true,
  onToggleSidebar,
  isSidebarOpen,
}: HeaderProps) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();

  const handleLogout = () => {
    confirm({
      title: 'Keluar dari Sistem?',
      message: 'Apakah Anda yakin ingin mengakhiri sesi kerja Anda saat ini?',
      confirmText: 'Ya, Keluar',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.logout();
        } catch (e) {
          // Proceed anyway
        }
        toast.info('Sesi Berakhir', 'Anda telah berhasil keluar.');
        router.push('/login');
      },
    });
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-3 md:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left side: Hamburger Toggle & Search Bar */}
      <div className="flex items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 focus:outline-none transition"
          title={isSidebarOpen ? 'Sembunyikan Sidebar' : 'Tampilkan Sidebar'}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-3 w-48 md:w-72">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari post, akun, ide..."
              className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons & Profile */}
      <div className="flex items-center gap-3">
        {/* Backend Status Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isBackendConnected ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span>{isBackendConnected ? 'Engine Siap' : 'Mode Offline'}</span>
        </div>

        {/* Quick Post Button */}
        <Link
          href="/composer"
          className="ui-btn ui-btn-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Buat Post</span>
        </Link>

        {/* Notifications */}
        <NotificationDropdown />

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-xs font-semibold">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'WI'}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-800 leading-tight">
              {user?.name || 'Admin Wijaya'}
            </span>
            <span className="text-[10px] text-slate-500 truncate max-w-[120px] leading-tight">
              {user?.email || 'admin@wijayagroup.id'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Keluar / Logout"
            className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
