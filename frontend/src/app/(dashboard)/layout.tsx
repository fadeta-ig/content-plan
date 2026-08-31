'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { api, ApiError } from '@/lib/api';
import { User, Workspace } from '@/lib/types';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [authError, setAuthError] = useState('');
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);

  const loadUserData = useCallback(async () => {
    setIsCheckingAuth(true);
    setAuthError('');
    try {
      const data = await api.getMe();
      if (data && data.user) {
        setUser(data.user);
        setActiveWorkspace(data.active_workspace);
        setWorkspaces(data.workspaces || []);
      } else {
        router.replace('/login');
      }
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        router.replace('/login');
        return;
      }
      setAuthError(
        error instanceof Error && error.message
          ? error.message
          : 'Server tidak dapat dihubungi. Sesi Anda belum dapat diverifikasi.'
      );
    } finally {
      setIsCheckingAuth(false);
    }
  }, [router]);

  useEffect(() => {
    void loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const syncSidebar = () => setIsSidebarOpen(desktop.matches);
    syncSidebar();
    desktop.addEventListener('change', syncSidebar);
    return () => desktop.removeEventListener('change', syncSidebar);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen || window.innerWidth >= 1024) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isSidebarOpen]);

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (workspaceId === activeWorkspace?.id) return;
    setSwitchingWorkspaceId(workspaceId);
    try {
      await api.switchWorkspace(workspaceId);
      const workspace = workspaces.find((item) => item.id === workspaceId);
      toast.success('Workspace Dialihkan', `Membuka ${workspace?.name || 'workspace yang dipilih'}...`);
      window.location.reload();
    } catch (error) {
      toast.error(
        'Gagal Mengalihkan Workspace',
        error instanceof Error && error.message ? error.message : 'Akses workspace tidak dapat diverifikasi.'
      );
      setSwitchingWorkspaceId(null);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center text-xs font-semibold animate-pulse">
          CP
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
          <span>Memverifikasi sesi aman...</span>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="ui-card max-w-md w-full p-6 text-center space-y-3" role="alert">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <div>
            <h1 className="text-sm font-semibold text-slate-900">Sistem belum dapat dibuka</h1>
            <p className="text-xs text-slate-500 mt-1">{authError}</p>
          </div>
          <button type="button" className="ui-btn ui-btn-primary" onClick={loadUserData}>
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-800">
      <Sidebar
        activeWorkspace={activeWorkspace}
        workspaces={workspaces}
        isOpen={isSidebarOpen}
        switchingWorkspaceId={switchingWorkspaceId}
        onSwitchWorkspace={handleSwitchWorkspace}
        onNavigate={() => {
          if (window.innerWidth < 1024) setIsSidebarOpen(false);
        }}
      />
      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Tutup menu navigasi"
        />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          user={user}
          activeWorkspace={activeWorkspace}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto w-full max-w-7xl mx-auto space-y-4">
          {children}
        </main>
      </div>
    </div>
  );
}
