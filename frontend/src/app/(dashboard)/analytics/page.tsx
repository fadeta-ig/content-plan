'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  MousePointer,
  Calendar,
  Share2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { AnalyticsData } from '@/lib/types';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<number>(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const data = await api.getAnalytics(period);
        setAnalytics(data);
      } catch (err) {
        setAnalytics({
          period_days: period,
          kpis: {
            total_followers: 0,
            follower_growth_percent: 0.0,
            total_impressions: 0,
            impressions_growth_percent: 0.0,
            total_engagement: 0,
            engagement_rate: 0.0,
          },
          trends: [],
          channel_breakdown: [],
        });
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [period]);

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
              key={p}
              onClick={() => setPeriod(p)}
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

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="ui-card space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Total Pengikut
          </span>
          <p className="text-xl font-bold text-slate-900 tracking-tight">
            {kpis.total_followers.toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Pertumbuhan: +{kpis.follower_growth_percent}%
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
            Pertumbuhan: +{kpis.impressions_growth_percent}%
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
                  {trends.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="py-2 px-3 font-semibold text-slate-800">{t.date}</td>
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
