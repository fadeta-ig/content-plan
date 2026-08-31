'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BarChart3, RefreshCw, Share2 } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { AnalyticsData } from '@/lib/types';

function formatTrendDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function formatDelta(value: number): string {
  return `${value > 0 ? '+' : ''}${value}%`;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setAnalytics(await api.getAnalytics(period));
    } catch (error: unknown) {
      setAnalytics(null);
      setLoadError(getErrorMessage(error, 'Data analitik tidak dapat dimuat. Periksa koneksi lalu coba lagi.'));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const kpis = analytics?.kpis || {
    total_followers: 0,
    follower_growth_percent: 0,
    total_impressions: 0,
    impressions_growth_percent: 0,
    total_engagement: 0,
    engagement_rate: 0,
  };

  const trends = analytics?.trends || [];
  const channels = analytics?.channel_breakdown || [];

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            Analitik & Performa Publikasi
          </h1>
          <p className="text-xs text-slate-500">
            Laporan jangkauan, impresi, dan interaksi audiens pada saluran PT Wijaya Inovasi Gemilang.
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-md">
          {[7, 14, 30, 90].map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                period === p
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p} Hari
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="ui-card border-rose-200 bg-rose-50 text-rose-800 p-3 flex items-center justify-between gap-3" role="alert">
          <span className="text-xs flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{loadError}</span>
          <button type="button" className="ui-btn ui-btn-secondary shrink-0" onClick={() => void loadAnalytics()}>
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      {loading && (
        <div className="ui-card py-8 text-center text-xs text-slate-500" role="status">Memuat metrik analitik...</div>
      )}

      {/* KPI Cards Row */}
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
        <div className="ui-card space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Total Pengikut
          </span>
          <p className="text-xl font-bold text-slate-900 tracking-tight">
            {kpis.total_followers.toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Pertumbuhan: {formatDelta(kpis.follower_growth_percent)}
          </span>
        </div>

        <div className="ui-card space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Total Impresi
          </span>
          <p className="text-xl font-bold text-slate-900 tracking-tight">
            {kpis.total_impressions.toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Pertumbuhan: {formatDelta(kpis.impressions_growth_percent)}
          </span>
        </div>

        <div className="ui-card space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Total Interaksi
          </span>
          <p className="text-xl font-bold text-slate-900 tracking-tight">
            {kpis.total_engagement.toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Likes, komentar, & share
          </span>
        </div>

        <div className="ui-card space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Rasio Interaksi (ER)
          </span>
          <p className="text-xl font-bold text-slate-900 tracking-tight">
            {kpis.engagement_rate}%
          </p>
          <span className="text-[11px] text-slate-500 block">
            Engagement rate rata-rata
          </span>
        </div>
      </div>

      {/* Main Analytics Grid: Trends Table & Channels Share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Performance Trends */}
        <div className="lg:col-span-2 ui-card space-y-3">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
              Tren Kinerja Publikasi ({period} Hari Terakhir)
            </h2>
            <span className="text-[11px] text-slate-400">Data Harian</span>
          </div>

          {trends.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Tanggal</th>
                    <th className="py-2 px-3">Impresi</th>
                    <th className="py-2 px-3">Jangkauan</th>
                    <th className="py-2 px-3">Interaksi</th>
                    <th className="py-2 px-3 text-right">Klik Tautan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {trends.map((t) => (
                    <tr key={t.date} className="hover:bg-slate-50/50 transition">
                      <td className="py-2 px-3 font-semibold text-slate-800">{formatTrendDate(t.date)}</td>
                      <td className="py-2 px-3 text-slate-600">{t.impressions.toLocaleString('id-ID')}</td>
                      <td className="py-2 px-3 text-slate-600">{t.reach.toLocaleString('id-ID')}</td>
                      <td className="py-2 px-3 text-slate-600">{t.engagement.toLocaleString('id-ID')}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-900">{t.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-slate-400 space-y-1">
              <BarChart3 className="w-6 h-6 text-slate-300 mx-auto" />
              <p>Belum ada rekaman metrik untuk periode ini.</p>
            </div>
          )}
        </div>

        {/* Right: Channel Breakdown */}
        <div className="ui-card space-y-3">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
              Distribusi Saluran
            </h2>
            <span className="text-[11px] text-slate-400">Pangsa Audiens</span>
          </div>

          {channels.length > 0 ? (
            <div className="space-y-3">
              {channels.map((ch, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span>{ch.platform}</span>
                    <span className="text-slate-500 font-mono text-[11px]">{ch.followers.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-slate-900 h-1.5 rounded-full"
                      style={{ width: `${ch.share}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Porsi: {ch.share}%</span>
                    <span className="text-emerald-600 font-medium">{ch.growth}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400 space-y-1">
              <Share2 className="w-6 h-6 text-slate-300 mx-auto" />
              <p>Belum ada saluran aktif.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
