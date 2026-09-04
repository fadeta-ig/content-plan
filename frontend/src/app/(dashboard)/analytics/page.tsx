'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  RefreshCw,
  Share2,
  Download,
  Eye,
  TrendingUp,
  MousePointerClick,
  Users,
  Calendar,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { AnalyticsData } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';

function formatTrendDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function formatDelta(value: number): string {
  return `${value > 0 ? '+' : ''}${value}%`;
}

type MetricType = 'impressions' | 'engagement' | 'reach' | 'clicks';

const METRIC_CONFIG: Record<
  MetricType,
  {
    label: string;
    icon: React.ElementType;
    barColor: string;
    activeTabClass: string;
    badgeColor: string;
    unit: string;
  }
> = {
  impressions: {
    label: 'Impresi',
    icon: Eye,
    barColor: 'bg-blue-600 hover:bg-blue-700',
    activeTabClass: 'bg-blue-600 text-white',
    badgeColor: 'text-blue-600 bg-blue-50 border-blue-200',
    unit: 'tayangan',
  },
  engagement: {
    label: 'Interaksi',
    icon: TrendingUp,
    barColor: 'bg-emerald-600 hover:bg-emerald-700',
    activeTabClass: 'bg-emerald-600 text-white',
    badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    unit: 'interaksi',
  },
  reach: {
    label: 'Jangkauan',
    icon: Users,
    barColor: 'bg-indigo-600 hover:bg-indigo-700',
    activeTabClass: 'bg-indigo-600 text-white',
    badgeColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    unit: 'akun',
  },
  clicks: {
    label: 'Klik Tautan',
    icon: MousePointerClick,
    barColor: 'bg-amber-500 hover:bg-amber-600',
    activeTabClass: 'bg-amber-600 text-white',
    badgeColor: 'text-amber-600 bg-amber-50 border-amber-200',
    unit: 'klik',
  },
};

export default function AnalyticsPage() {
  const toast = useToast();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeMetric, setActiveMetric] = useState<MetricType>('impressions');
  const [hoveredTrend, setHoveredTrend] = useState<{
    date: string;
    impressions: number;
    reach: number;
    engagement: number;
    clicks: number;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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

  // Calculate Chart Heights
  const metricValues = trends.map((t) => t[activeMetric]);
  const maxMetricValue = Math.max(...metricValues, 1);
  const totalMetricSum = metricValues.reduce((acc, val) => acc + val, 0);
  const avgMetricPerDay = trends.length > 0 ? Math.round(totalMetricSum / trends.length) : 0;

  // CSV Export Handler
  const handleExportCSV = () => {
    if (trends.length === 0) {
      toast.warning('Tidak Ada Data', 'Belum ada rekaman metrik untuk diekspor pada periode ini.');
      return;
    }

    setIsExporting(true);
    try {
      const headers = ['Tanggal', 'Impresi', 'Jangkauan', 'Interaksi', 'Klik Tautan'];
      const rows = trends.map((t) => [
        t.date,
        t.impressions,
        t.reach,
        t.engagement,
        t.clicks,
      ]);

      const csvContent =
        '\uFEFF' + // UTF-8 BOM for Excel compatibility
        [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `Laporan_Analitik_ContentPlan_${period}Hari_${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Laporan CSV Siap', `Data analitik ${period} hari berhasil diekspor.`);
    } catch {
      toast.error('Gagal Mengekspor', 'Terjadi kesalahan saat menyusun berkas CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            Analitik &amp; Performa Publikasi
          </h1>
          <p className="text-xs text-slate-500">
            Laporan jangkauan, impresi, dan interaksi audiens pada saluran PT Wijaya Inovasi Gemilang.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={loading || trends.length === 0 || isExporting}
            className="ui-btn ui-btn-secondary text-xs flex items-center gap-1.5 shadow-2xs"
            title="Download Rekap Data CSV untuk Excel / Sheets"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>{isExporting ? 'Mengekspor...' : 'Export CSV'}</span>
          </button>

          {/* Period Selector Tabs */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-0.5 rounded-lg shadow-2xs">
            {[7, 14, 30, 90].map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  period === p
                    ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p} Hari
              </button>
            ))}
          </div>
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
            Likes, komentar, &amp; share
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

      {/* Interactive Visual Bar Chart Card */}
      <div className="ui-card p-4 space-y-3 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-700" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Grafik Tren Performa Harian
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Total {totalMetricSum.toLocaleString('id-ID')} {METRIC_CONFIG[activeMetric].unit} • Rata-rata {avgMetricPerDay.toLocaleString('id-ID')} / hari
            </p>
          </div>

          {/* Metric Switcher Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            {(['impressions', 'engagement', 'reach', 'clicks'] as MetricType[]).map((m) => {
              const cfg = METRIC_CONFIG[m];
              const Icon = cfg.icon;
              const isActive = activeMetric === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setActiveMetric(m)}
                  className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition text-[11px] ${
                    isActive ? `${cfg.activeTabClass} font-bold shadow-2xs` : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Visual Bars Container */}
        {trends.length > 0 ? (
          <div className="space-y-2 pt-2">
            {/* Active Hover Inspector Tooltip */}
            <div className="h-6 flex items-center justify-between text-xs px-2 bg-slate-50 rounded-lg border border-slate-200/80">
              {hoveredTrend ? (
                <>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-[11px]">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {formatTrendDate(hoveredTrend.date)}:
                  </span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-blue-700">Impresi: <strong>{hoveredTrend.impressions.toLocaleString('id-ID')}</strong></span>
                    <span className="text-emerald-700">Interaksi: <strong>{hoveredTrend.engagement.toLocaleString('id-ID')}</strong></span>
                    <span className="text-indigo-700">Jangkauan: <strong>{hoveredTrend.reach.toLocaleString('id-ID')}</strong></span>
                    <span className="text-amber-700">Klik: <strong>{hoveredTrend.clicks}</strong></span>
                  </div>
                </>
              ) : (
                <span className="text-[11px] text-slate-400 italic">
                  Arahkan kursor ke batang grafik di bawah untuk melihat rincian angka harian...
                </span>
              )}
            </div>

            {/* Bars Area with Y Baseline */}
            <div className="relative h-44 flex items-end gap-1 sm:gap-1.5 pt-4 pb-6 px-1 border-b border-slate-200">
              {/* Horizontal Gridlines */}
              <div className="absolute inset-x-0 top-4 bottom-6 flex flex-col justify-between pointer-events-none opacity-40">
                <div className="border-b border-slate-200 border-dashed w-full" />
                <div className="border-b border-slate-200 border-dashed w-full" />
                <div className="border-b border-slate-200 border-dashed w-full" />
              </div>

              {trends.map((t, idx) => {
                const val = t[activeMetric];
                const heightPercent = maxMetricValue > 0 ? Math.max(Math.round((val / maxMetricValue) * 100), 4) : 4;
                const isHovered = hoveredTrend?.date === t.date;

                return (
                  <div
                    key={t.date}
                    onMouseEnter={() => setHoveredTrend(t)}
                    onMouseLeave={() => setHoveredTrend(null)}
                    className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                  >
                    {/* The Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-sm transition-all duration-200 ${
                        isHovered
                          ? 'ring-2 ring-slate-900 brightness-110 z-10'
                          : METRIC_CONFIG[activeMetric].barColor
                      }`}
                    />

                    {/* X-axis Date Label (sample dates if long) */}
                    {(trends.length <= 14 || idx % Math.ceil(trends.length / 10) === 0 || idx === trends.length - 1) && (
                      <span className="absolute -bottom-5 text-[9px] text-slate-400 font-medium truncate max-w-[32px] text-center">
                        {formatTrendDate(t.date).split(' ')[0]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-400 space-y-1">
            <BarChart3 className="w-6 h-6 text-slate-300 mx-auto" />
            <p>Belum ada data visual untuk rentang waktu ini.</p>
          </div>
        )}
      </div>

      {/* Main Analytics Grid: Trends Table & Channels Share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Performance Trends Data Table */}
        <div className="lg:col-span-2 ui-card space-y-3">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
              Rincian Tabel Kinerja Harian ({period} Hari)
            </h2>
            <span className="text-[11px] text-slate-400">{trends.length} Catatan</span>
          </div>

          {trends.length > 0 ? (
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
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
                    <tr
                      key={t.date}
                      onMouseEnter={() => setHoveredTrend(t)}
                      onMouseLeave={() => setHoveredTrend(null)}
                      className={`hover:bg-slate-50 transition ${
                        hoveredTrend?.date === t.date ? 'bg-blue-50/50 font-semibold' : ''
                      }`}
                    >
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
