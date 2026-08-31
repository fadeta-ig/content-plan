'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Mohon isi email dan kata sandi Anda.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.login({ email: email.trim(), password });
      if (res?.success && res.requires_tos && res.accept_terms_url?.startsWith('/accounts/')) {
        window.location.assign(res.accept_terms_url);
      } else if (res && res.success) {
        router.push('/');
        router.refresh();
      } else {
        setError('Email atau kata sandi tidak sesuai.');
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Email atau kata sandi tidak sesuai. Silakan coba lagi.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg p-6 space-y-5 shadow-sm">
        {/* Brand Header */}
        <div className="text-center space-y-1.5 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded bg-slate-900 text-white flex items-center justify-center text-sm font-semibold mx-auto">
            CP
          </div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight pt-1">
            Content Plan Studio
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            PT Wijaya Inovasi Gemilang
          </p>
        </div>

        {error && (
          <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in" role="alert" aria-live="assertive">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label htmlFor="login-email" className="text-xs font-semibold text-slate-700 block mb-1">
              Email Perusahaan:
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@wijayagroup.id"
                className="ui-input pl-8"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="text-xs font-semibold text-slate-700 block mb-1">
              Kata Sandi:
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="ui-input pl-8"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full ui-btn ui-btn-primary py-2 justify-center"
          >
            <span>{loading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="pt-3 text-center border-t border-slate-100">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Sistem Otentikasi Terisolasi & Terenkripsi</span>
          </p>
        </div>
      </div>
    </div>
  );
}
