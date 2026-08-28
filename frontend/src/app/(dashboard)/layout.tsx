'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { api } from '@/lib/api';
import { User, Workspace } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  const loadUserData = async () => {
    try {
      const data = await api.getMe();
      if (data && data.user) {
        setUser(data.user);
        setActiveWorkspace(data.active_workspace);
        setWorkspaces(data.workspaces || []);
        setIsCheckingAuth(false);
      } else {
        router.push('/login');
      }
    } catch (e) {
      router.push('/login');
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

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

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-800">
      <Sidebar
        activeWorkspace={activeWorkspace}
        workspaces={workspaces}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          user={user}
          activeWorkspace={activeWorkspace}
          isBackendConnected={true}
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
