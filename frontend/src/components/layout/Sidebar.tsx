'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  ChevronDown,
  Building2,
} from 'lucide-react';
import { Workspace } from '@/lib/types';

interface SidebarProps {
  activeWorkspace?: Workspace | null;
  workspaces?: Workspace[];
  isOpen?: boolean;
  switchingWorkspaceId?: string | null;
  onSwitchWorkspace?: (workspaceId: string) => Promise<void>;
  onNavigate?: () => void;
}

const NAV_ITEMS = [
  { label: 'Overview', href: '/', icon: LayoutDashboard, roles: null },
  { label: 'Composer', href: '/composer', icon: PenSquare, roles: ['owner', 'manager', 'editor', 'contributor'] },
  { label: 'Kalender & Shooting', href: '/calendar', icon: CalendarIcon },
  { label: 'Ide Kanban', href: '/kanban', icon: KanbanIcon, roles: ['owner', 'manager', 'editor', 'contributor'] },
  { label: 'Kotak Masuk', href: '/inbox', icon: InboxIcon, roles: ['owner', 'manager', 'editor'] },
  { label: 'Analitik', href: '/analytics', icon: BarChart3, roles: null },
  { label: 'Media Library', href: '/media-library', icon: FolderOpen, roles: ['owner', 'manager', 'editor', 'contributor'] },
  { label: 'Saluran Akun', href: '/accounts', icon: Share2, roles: ['owner', 'manager'] },
  { label: 'Pengaturan', href: '/settings', icon: SettingsIcon, roles: ['owner', 'manager'] },
];

export default function Sidebar({
  activeWorkspace,
  workspaces = [],
  isOpen = true,
  switchingWorkspaceId,
  onSwitchWorkspace,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setWorkspaceMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWorkspaceMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [workspaceMenuOpen]);

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.roles || (activeWorkspace?.role && item.roles.includes(activeWorkspace.role))
  );

  return (
    <aside
      aria-hidden={!isOpen}
      className={`fixed lg:sticky top-0 left-0 z-50 lg:z-40 bg-white border-r border-slate-200 flex flex-col shrink-0 h-screen h-dvh max-h-screen text-slate-800 select-none transition-all duration-200 ease-in-out overflow-hidden ${
        isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:w-0'
      }`}
    >
      {/* Inner wrapper to prevent content from collapsing weirdly */}
      <div className="w-64 min-w-[16rem] flex flex-col h-full max-h-screen overflow-hidden">
        {/* Brand Header */}
        <div className="h-14 border-b border-slate-200 px-4 flex items-center shrink-0">
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
        <div className="p-3 border-b border-slate-100 relative shrink-0" ref={workspaceMenuRef}>
          <button
            type="button"
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
            aria-expanded={workspaceMenuOpen}
            aria-haspopup="menu"
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 transition text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-xs font-medium text-slate-800 truncate">
                {activeWorkspace?.name || 'Content Plan Studio'}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 ml-1 transition ${workspaceMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {workspaceMenuOpen && (
            <div className="absolute left-3 right-3 top-[calc(100%-0.5rem)] z-50 bg-white border border-slate-200 rounded-md shadow-lg p-1" role="menu">
              {workspaces.length > 0 ? workspaces.map((workspace) => {
                const isActive = workspace.id === activeWorkspace?.id;
                const isSwitching = switchingWorkspaceId === workspace.id;
                return (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    key={workspace.id}
                    disabled={isActive || Boolean(switchingWorkspaceId)}
                    onClick={async () => {
                      if (!onSwitchWorkspace) return;
                      await onSwitchWorkspace(workspace.id);
                      setWorkspaceMenuOpen(false);
                    }}
                    className="w-full px-2.5 py-2 rounded text-left hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="block text-xs font-medium text-slate-800 truncate">
                      {isSwitching ? 'Mengalihkan...' : workspace.name}
                    </span>
                    <span className="block text-[10px] text-slate-500 capitalize">{workspace.role}</span>
                  </button>
                );
              }) : (
                <p className="px-2.5 py-2 text-[11px] text-slate-500">Tidak ada workspace lain.</p>
              )}
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto min-h-0">
          <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Menu Utama
          </div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
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
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 shrink-0">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3 h-3" />
              <span className="capitalize">{activeWorkspace?.role || 'anggota'}</span>
            </span>
            <span>{workspaces.length} workspace</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
