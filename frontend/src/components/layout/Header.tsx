'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  LogOut,
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
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

const SEARCHABLE_PAGES = [
  { label: 'Overview', href: '/', keywords: 'dashboard ringkasan', roles: null },
  { label: 'Composer', href: '/composer', keywords: 'buat post konten', roles: ['owner', 'manager', 'editor', 'contributor'] },
  { label: 'Kalender & Shooting', href: '/calendar', keywords: 'jadwal produksi', roles: null },
  { label: 'Ide Kanban', href: '/kanban', keywords: 'ide workflow', roles: ['owner', 'manager', 'editor', 'contributor'] },
  { label: 'Kotak Masuk', href: '/inbox', keywords: 'pesan komentar mention', roles: ['owner', 'manager', 'editor'] },
  { label: 'Analitik', href: '/analytics', keywords: 'laporan insight', roles: null },
  { label: 'Media Library', href: '/media-library', keywords: 'gambar video berkas', roles: ['owner', 'manager', 'editor', 'contributor'] },
  { label: 'Saluran Akun', href: '/accounts', keywords: 'social oauth', roles: ['owner', 'manager'] },
  { label: 'Pengaturan', href: '/settings', keywords: 'anggota workspace konfigurasi', roles: ['owner', 'manager'] },
];

export default function Header({
  user,
  activeWorkspace,
  onToggleSidebar,
  isSidebarOpen,
}: HeaderProps) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');

  const searchablePages = SEARCHABLE_PAGES.filter(
    (page) => !page.roles || (activeWorkspace?.role && page.roles.includes(activeWorkspace.role))
  );
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('id-ID');
  const searchResults = normalizedQuery
    ? searchablePages.filter((page) => `${page.label} ${page.keywords}`.toLocaleLowerCase('id-ID').includes(normalizedQuery)).slice(0, 5)
    : [];

  const navigateToSearchResult = (href: string) => {
    setSearchQuery('');
    router.push(href);
  };

  const handleLogout = () => {
    confirm({
      title: 'Keluar dari Sistem?',
      message: 'Apakah Anda yakin ingin mengakhiri sesi kerja Anda saat ini?',
      confirmText: 'Ya, Keluar',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.logout();
          toast.info('Sesi Berakhir', 'Anda telah berhasil keluar.');
          router.replace('/login');
        } catch (error) {
          toast.error(
            'Gagal Keluar',
            error instanceof Error && error.message
              ? error.message
              : 'Sesi masih aktif. Periksa koneksi lalu coba lagi.'
          );
          throw error;
        }
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
          aria-label={isSidebarOpen ? 'Sembunyikan menu navigasi' : 'Tampilkan menu navigasi'}
          aria-expanded={isSidebarOpen}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-3 w-48 md:w-72">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (searchResults[0]) navigateToSearchResult(searchResults[0].href);
              }}
            >
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari menu..."
                aria-label="Cari menu aplikasi"
                role="combobox"
                aria-expanded={searchResults.length > 0}
                aria-controls="menu-search-results"
                aria-autocomplete="list"
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition"
              />
            </form>
            {searchResults.length > 0 && (
              <div id="menu-search-results" className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg p-1 z-50" role="listbox">
                {searchResults.map((page) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    key={page.href}
                    onClick={() => navigateToSearchResult(page.href)}
                    className="block w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100"
                  >
                    {page.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons & Profile */}
      <div className="flex items-center gap-3">
        <span className="hidden lg:block max-w-36 truncate text-[11px] text-slate-500" title={activeWorkspace?.name}>
          {activeWorkspace?.name}
        </span>

        {/* Quick Post Button */}
        {['owner', 'manager', 'editor', 'contributor'].includes(activeWorkspace?.role || '') && (
          <Link href="/composer" className="ui-btn ui-btn-primary">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Buat Post</span>
          </Link>
        )}

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
            type="button"
            onClick={handleLogout}
            aria-label="Keluar dari aplikasi"
            className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
