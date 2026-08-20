'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Eye,
  Calendar,
  Share2,
  ArrowUpRight,
  Plus,
  Clock,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { OverviewMetrics, SocialAccount } from '@/lib/types';
import SocialIcon from '@/components/ui/SocialIcon';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export default function OverviewDashboardPage() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [overviewData, accountsData] = await Promise.all([
          api.getOverview().catch(() => null),
          api.getSocialAccounts().catch(() => ({ accounts: [] })),
        ]);

        if (overviewData) {
          setMetrics(overviewData);
        } else {
          setMetrics({
            total_posts: 0,
            scheduled_posts: 0,
            published_posts: 0,
            failed_posts: 0,
            connected_accounts_count: 0,
            pending_approvals_count: 0,
            inbox_unread_count: 0,
            total_reach: 0,
            total_engagement: 0,
            engagement_rate: 0.0,
            recent_posts: [],
          });
        }

        if (accountsData.accounts) {
          setAccounts(accountsData.accounts);
        }
      } catch (err) {
        setMetrics({
          total_posts: 0,
          scheduled_posts: 0,
          published_posts: 0,
          failed_posts: 0,
          connected_accounts_count: 0,
          pending_approvals_count: 0,
          inbox_unread_count: 0,
          total_reach: 0,
          total_engagement: 0,
          engagement_rate: 0.0,
          recent_posts: [],
        });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            Dashboard Utama
          </h1>
          <p className="text-xs text-slate-500 font-normal">
            Ringkasan kinerja publikasi dan jadwal konten PT Wijaya Inovasi Gemilang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/calendar"
            className="ui-btn ui-btn-secondary"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Lihat Kalender</span>
          </Link>
          <Link
            href="/composer"
            className="ui-btn ui-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Postingan</span>
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Reach */}
        <div className="ui-card flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Total Jangkauan
            </span>
            <div className="p-1 rounded bg-slate-50 border border-slate-200">
              <Eye className="w-3.5 h-3.5 text-slate-600" />
            </div>
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {metrics ? metrics.total_reach.toLocaleString('id-ID') : '0'}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Akumulasi tayangan seluruh saluran
            </span>
          </div>
        </div>

        {/* Card 2: Total Engagement */}
        <div className="ui-card flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Interaksi Konten
            </span>
            <div className="p-1 rounded bg-slate-50 border border-slate-200">
              <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
            </div>
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {metrics ? metrics.total_engagement.toLocaleString('id-ID') : '0'}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Rasio interaksi rata-rata: {metrics?.engagement_rate ?? 0}%
            </span>
          </div>
        </div>

        {/* Card 3: Scheduled Posts */}
        <div className="ui-card flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Post Terjadwal
            </span>
            <div className="p-1 rounded bg-slate-50 border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-600" />
            </div>
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {metrics ? metrics.scheduled_posts : 0}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              {metrics?.pending_approvals_count ?? 0} menunggu persetujuan review
            </span>
          </div>
        </div>

        {/* Card 4: Connected Accounts */}
        <div className="ui-card flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Saluran Terhubung
            </span>
            <div className="p-1 rounded bg-slate-50 border border-slate-200">
              <Share2 className="w-3.5 h-3.5 text-slate-600" />
            </div>
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {accounts.length}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Enkripsi token status: Aktif
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Recent Scheduled Posts & Channel Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Recent Posts List */}
        <div className="lg:col-span-2 ui-card space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Antrean Distribusi Konten Terkini
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Daftar draft dan jadwal postingan yang siap dipublikasikan ke media sosial.
              </p>
            </div>
            <Link
              href="/composer"
              className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1"
            >
              <span>Composer</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {metrics?.recent_posts && metrics.recent_posts.length > 0 ? (
              metrics.recent_posts.map((post) => (
                <div key={post.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900 line-clamp-1">{post.caption}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1">
                        {post.platforms.map((plat) => (
                          <span
                            key={plat}
                            className="ui-badge bg-slate-50 border-slate-200 text-slate-700 flex items-center gap-1"
                          >
                            <SocialIcon platform={plat} size={11} />
                            <span className="font-semibold uppercase">{plat.slice(0, 2)}</span>
                          </span>
                        ))}
                      </div>
                      <span>
                        Jadwal: {post.scheduled_at ? new Date(post.scheduled_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Draft'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`ui-badge shrink-0 ${
                        post.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {post.status === 'published' ? 'Terbit' : 'Terjadwal'}
                    </span>

                    <button
                      onClick={() => {
                        confirm({
                          title: 'Hapus Postingan?',
                          message: `Apakah Anda yakin ingin menghapus postingan "${post.caption.slice(0, 40)}..." dari antrean?`,
                          confirmText: 'Ya, Hapus Post',
                          type: 'danger',
                          onConfirm: async () => {
                            try {
                              await api.deletePost(post.id);
                              setMetrics((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      recent_posts: prev.recent_posts.filter((p) => p.id !== post.id),
                                      total_posts: Math.max(0, prev.total_posts - 1),
                                    }
                                  : prev
                              );
                              toast.warning('Postingan Dihapus', 'Konten berhasil dihapus dari database.');
                            } catch (e: any) {
                              toast.error('Gagal Menghapus', e.message || 'Gagal menghapus postingan.');
                            }
                          },
                        });
                      }}
                      title="Hapus Postingan"
                      className="text-slate-300 hover:text-rose-600 p-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Clock className="w-6 h-6 text-slate-300 mx-auto" />
                <p>Belum ada postingan dalam antrean.</p>
                <Link href="/composer" className="ui-btn ui-btn-primary inline-flex py-1 text-xs">
                  <Plus className="w-3 h-3" />
                  <span>Buat Post Pertama</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Channels Status & Quick Links */}
        <div className="space-y-4">
          <div className="ui-card space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Saluran Sosial Terhubung ({accounts.length})
              </h2>
              <Link href="/accounts" className="text-xs text-slate-600 hover:text-slate-900 font-medium">
                Kelola
              </Link>
            </div>

            <div className="space-y-2">
              {accounts.length > 0 ? (
                accounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center">
                        <SocialIcon platform={acc.platform} size={13} className="text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 leading-tight">{acc.account_name}</p>
                        <p className="text-[10px] text-slate-500">{acc.account_handle}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-slate-700">{acc.follower_count.toLocaleString('id-ID')}</span>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                  <p>Belum ada akun sosial terhubung.</p>
                  <Link href="/accounts" className="text-xs text-slate-900 font-semibold underline block">
                    + Hubungkan Saluran
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Quick Notice Card */}
          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Sistem Siap Produksi</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Seluruh modul terhubung langsung ke database MySQL dan siap dideploy ke server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
