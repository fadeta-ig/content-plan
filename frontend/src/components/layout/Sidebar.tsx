'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PenSquare,
  Calendar as CalendarIcon,
  Kanban as KanbanIcon,
  Inbox as InboxIcon,
  BarChart3,
  FolderOpen,
  Share2,
  Settings as SettingsIcon,
  Layers,
  ChevronDown,
  Building2,
} from 'lucide-react';
import { Workspace } from '@/lib/types';

interface SidebarProps {
  activeWorkspace?: Workspace | null;
  workspaces?: Workspace[];
  isOpen?: boolean;
}

const NAV_ITEMS = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Composer', href: '/composer', icon: PenSquare },
  { label: 'Kalender & Shooting', href: '/calendar', icon: CalendarIcon },
  { label: 'Ide Kanban', href: '/kanban', icon: KanbanIcon },
  { label: 'Kotak Masuk', href: '/inbox', icon: InboxIcon },
  { label: 'Analitik', href: '/analytics', icon: BarChart3 },
  { label: 'Media Library', href: '/media-library', icon: FolderOpen },
  { label: 'Saluran Akun', href: '/accounts', icon: Share2 },
  { label: 'Pengaturan', href: '/settings', icon: SettingsIcon },
];

export default function Sidebar({
  activeWorkspace,
  workspaces = [],
  isOpen = true,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-screen text-slate-800 select-none transition-all duration-200 ease-in-out overflow-hidden ${
        isOpen ? 'w-64' : 'w-0'
      }`}
    >
      {/* Inner wrapper to prevent content from collapsing weirdly */}
      <div className="w-64 min-w-[16rem] flex flex-col min-h-screen">
        {/* Brand Header */}
        <div className="h-14 border-b border-slate-200 px-4 flex items-center">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-semibold text-xs tracking-tight shrink-0">
              CP
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-900 tracking-tight truncate leading-tight">
                Content Plan
              </span>
              <span className="text-[10px] font-medium text-slate-500 truncate leading-tight">
                PT Wijaya Inovasi Gemilang
              </span>
            </div>
          </div>
        </div>

        {/* Workspace Switcher */}
        <div className="p-3 border-b border-slate-100">
          <button className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 transition text-left">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-xs font-medium text-slate-800 truncate">
                {activeWorkspace?.name || 'Content Plan Studio'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Menu Utama
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition ${
                  isActive
                    ? 'bg-slate-900 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-normal'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Sistem Normal</span>
            </span>
            <span>v2.1</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
