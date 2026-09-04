'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Share2,
  Plus,
  CheckCircle2,
  RefreshCw,
  Trash2,
  ExternalLink,
  Lock,
  X,
  Key,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { SocialAccount } from '@/lib/types';
import SocialIcon from '@/components/ui/SocialIcon';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const PLATFORM_LIST = [
  { id: 'instagram', name: 'Instagram Business', description: 'Posting Feed, Reels, Carousel, Insights' },
  { id: 'facebook', name: 'Facebook Pages', description: 'Halaman Bisnis, Video, Analytics' },
  { id: 'linkedin', name: 'LinkedIn Company', description: 'Post Perusahaan & Profil Personal' },
  { id: 'tiktok', name: 'TikTok Creator', description: 'Video Pendek & TikTok Insights' },
  { id: 'youtube', name: 'YouTube Channel', description: 'Video Utama, YouTube Shorts' },
  { id: 'threads', name: 'Meta Threads', description: 'Post Teks, Gambar, dan Thread' },
  { id: 'bluesky', name: 'Bluesky Social', description: 'Federated Social Media Integration' },
  { id: 'pinterest', name: 'Pinterest Business', description: 'Pin Gambar & Papan Board' },
  { id: 'google_business', name: 'Google Business Profile', description: 'Post Update & Lokasi Usaha' },
];

type PlatformOption = (typeof PLATFORM_LIST)[number];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AccountsPage() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlatformToConnect, setSelectedPlatformToConnect] = useState<PlatformOption | null>(null);
  const [connectMode, setConnectMode] = useState<'oauth' | 'manual'>('manual');
  const [accountNameInput, setAccountNameInput] = useState('');
  const [accountHandleInput, setAccountHandleInput] = useState('');
  const [followerCountInput, setFollowerCountInput] = useState('0');
  const [connecting, setConnecting] = useState(false);
  const connectionDialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const connectingRef = useRef(false);

  useEffect(() => {
    connectingRef.current = connecting;
  }, [connecting]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const accountsData = await api.getSocialAccounts();
      setAccounts(accountsData.accounts);
    } catch (err) {
      setAccounts([]);
      toast.error(
        'Gagal Memuat Saluran',
        errorMessage(err, 'Data akun media sosial tidak dapat dimuat. Periksa koneksi lalu coba lagi.')
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (!selectedPlatformToConnect) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      connectionDialogRef.current?.querySelector<HTMLElement>('[data-modal-initial-focus]')?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !connectingRef.current) {
        setSelectedPlatformToConnect(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = connectionDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [selectedPlatformToConnect]);

  const handleReconnect = (account: SocialAccount) => {
    const platform = PLATFORM_LIST.find((item) => item.id === account.platform);
    if (!platform) {
      toast.error('Platform Tidak Didukung', 'Platform akun ini belum memiliki alur OAuth yang tersedia.');
      return;
    }
    setSelectedPlatformToConnect(platform);
    setAccountNameInput(account.account_name || `PT Wijaya Inovasi Gemilang (${platform.name})`);
    setAccountHandleInput(account.account_handle || `@wijaya.${platform.id}`);
    setFollowerCountInput(account.follower_count ? String(account.follower_count) : '0');
    setConnectMode('manual');
  };

  const handleDisconnect = (id: string, name: string) => {
    confirm({
      title: 'Putuskan Koneksi Saluran?',
      message: `Apakah Anda yakin ingin memutuskan integrasi akun "${name}" dari workspace Content Plan Studio? Penjadwalan pada saluran ini akan dinonaktifkan.`,
      confirmText: 'Ya, Putuskan Saluran',
      type: 'danger',
      onConfirm: async () => {
        try {
          const result = await api.disconnectAccount(id);
          setAccounts((prev) => prev.filter((a) => a.id !== id));
          if (result.revocation_confirmed) {
            toast.success('Saluran Berhasil Dilepas', result.message);
          } else {
            toast.info('Saluran Dilepas', result.message);
          }
        } catch (error) {
          toast.error(
            'Gagal Memutuskan Saluran',
            errorMessage(error, `Koneksi akun ${name} belum berubah. Silakan coba kembali.`)
          );
          throw error;
        }
      },
    });
  };

  const handleManualConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlatformToConnect) return;

    setConnecting(true);
    try {
      const res = await api.connectAccount({
        platform: selectedPlatformToConnect.id,
        account_name: accountNameInput.trim() || `PT Wijaya Inovasi Gemilang (${selectedPlatformToConnect.name})`,
        account_handle: accountHandleInput.trim() || `@wijaya.${selectedPlatformToConnect.id}`,
        follower_count: parseInt(followerCountInput, 10) || 0,
      });

      toast.success(
        'Saluran Berhasil Terhubung',
        `Akun ${res.account.account_name} (${res.account.account_handle}) kini aktif di workspace.`
      );
      setAccounts((prev) => {
        const filtered = prev.filter(
          (a) => a.id !== res.account.id && a.account_handle.toLowerCase() !== res.account.account_handle.toLowerCase()
        );
        return [res.account, ...filtered];
      });
      setSelectedPlatformToConnect(null);
    } catch (error: unknown) {
      toast.error(
        'Gagal Menghubungkan Saluran',
        errorMessage(error, 'Terjadi kesalahan saat menambahkan saluran media sosial.')
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleRealOAuthRedirect = async (platformId: string) => {
    setConnecting(true);
    try {
      const res = await api.initOAuth(platformId);
      if (res.configured && res.auth_url) {
        toast.info('Mengarahkan ke OAuth Resmi...', `Membuka halaman login resmi ${selectedPlatformToConnect?.name || platformId}`);
        window.location.href = res.auth_url;
      } else {
        toast.error(
          'OAuth Belum Tersedia',
          res.message || `Kredensial OAuth ${selectedPlatformToConnect?.name || platformId} belum dikonfigurasi di file .env backend.`
        );
      }
    } catch (error) {
      toast.error(
        'Gagal Memulai OAuth',
        errorMessage(error, 'Permintaan otorisasi tidak dapat dimulai. Periksa koneksi lalu coba lagi.')
      );
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            Saluran Media Sosial Terhubung
          </h1>
          <p className="text-xs text-slate-500">
            Integrasi resmi first-party API dengan enkripsi token AES-256-GCM.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadAccounts()}
            disabled={loading}
            className="ui-btn ui-btn-secondary text-xs flex items-center gap-1.5"
            title="Sinkronkan dan periksa kesehatan saluran"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Periksa & Sinkronkan</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium bg-white px-2.5 py-1 rounded border border-slate-200">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Enkripsi Token Aktif ({accounts.length} Saluran)</span>
          </div>
        </div>
      </div>

      {/* Connected Accounts Cards Grid */}
      {loading ? (
        <div className="ui-card p-6 text-center text-xs text-slate-500" role="status">
          Memuat saluran media sosial...
        </div>
      ) : accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="ui-card flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center">
                    <SocialIcon platform={acc.platform} size={16} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-xs leading-tight">{acc.account_name}</h3>
                    <p className="text-[11px] text-slate-500">{acc.account_handle}</p>
                  </div>
                </div>

                <span
                  className={`ui-badge ${
                    acc.connection_status === 'connected'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : acc.connection_status === 'token_expiring'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {acc.connection_status === 'connected' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <AlertCircle className="w-3 h-3" />
                  )}
                  <span>
                    {acc.connection_status === 'connected'
                      ? 'Aktif'
                      : acc.connection_status === 'token_expiring'
                        ? 'Perlu Otorisasi'
                        : 'Bermasalah'}
                  </span>
                </span>
              </div>

              {acc.last_error && acc.connection_status === 'error' && (
                <div className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-1.5 flex items-start gap-1.5 leading-tight">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span>{acc.last_error}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500">Total Pengikut:</span>
                <span className="font-semibold text-slate-900">{acc.follower_count.toLocaleString('id-ID')}</span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                <span>Terhubung: {acc.connected_at}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleReconnect(acc)}
                    className="text-slate-700 font-medium hover:underline flex items-center gap-1"
                    aria-label={`Otorisasi ulang akun ${acc.account_name}`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Otorisasi Ulang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(acc.id, acc.account_name)}
                    className="text-slate-400 hover:text-rose-600 p-0.5"
                    aria-label={`Putuskan koneksi akun ${acc.account_name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ui-card p-6 text-center space-y-2">
          <Share2 className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-xs font-semibold text-slate-800">Belum Ada Saluran yang Terhubung</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Hubungkan saluran media sosial PT Wijaya Inovasi Gemilang di bawah ini untuk memulai penjadwalan dan publikasi otomatis.
          </p>
        </div>
      )}

      {/* Available Platforms to Connect */}
      <div className="ui-card space-y-3">
        <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
            Hubungkan Saluran Baru
          </h2>
          <span className="text-[11px] text-slate-400">Pilih platform untuk memulai otorisasi</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {PLATFORM_LIST.map((p) => {
            const platformAccounts = accounts.filter((a) => a.platform === p.id);
            const count = platformAccounts.length;
            return (
              <div
                key={p.id}
                className="p-3 rounded-md bg-white border border-slate-200 flex items-start justify-between gap-2.5 hover:border-slate-300 transition"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    <SocialIcon platform={p.id} size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-semibold text-slate-900 leading-tight">{p.name}</h4>
                      {count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold leading-none">
                          {count} Akun
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{p.description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlatformToConnect(p);
                    const defaultSuffix = count > 0 ? ` ${count + 1}` : '';
                    const handleSuffix = count > 0 ? `_${count + 1}` : '';
                    setAccountNameInput(`PT Wijaya Inovasi Gemilang (${p.name}${defaultSuffix})`);
                    setAccountHandleInput(`@wijaya.${p.id}${handleSuffix}`);
                    setFollowerCountInput('0');
                    setConnectMode('manual');
                  }}
                  className="ui-btn ui-btn-secondary text-[11px] py-1 px-2 shrink-0"
                  aria-label={`${count > 0 ? 'Tambah akun lagi untuk' : 'Hubungkan'} ${p.name}`}
                >
                  <Plus className="w-3 h-3" />
                  <span>{count > 0 ? '+ Tambah Akun' : 'Hubungkan'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Connection Modal Dialog */}
      {selectedPlatformToConnect && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            ref={connectionDialogRef}
            className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-account-title"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <SocialIcon platform={selectedPlatformToConnect.id} size={18} />
                <h3 id="connect-account-title" className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Hubungkan {selectedPlatformToConnect.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlatformToConnect(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
                aria-label="Tutup dialog koneksi akun"
                disabled={connecting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold gap-1">
              <button
                type="button"
                data-modal-initial-focus
                onClick={() => setConnectMode('manual')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  connectMode === 'manual'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>Tambah Akun Manual</span>
              </button>

              <button
                type="button"
                onClick={() => setConnectMode('oauth')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  connectMode === 'oauth'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                <span>Login Resmi (OAuth 2.0)</span>
              </button>
            </div>

            {/* Option 1: Manual Account Connect Mode (Immediate Persistence to Database) */}
            {connectMode === 'manual' && (
              <form onSubmit={handleManualConnectSubmit} className="space-y-3.5">
                <div className="text-xs text-slate-600 space-y-1 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                  <span className="font-bold text-blue-950 block">Daftarkan Saluran Siap Pakai</span>
                  <p className="text-[11px] text-blue-800/80 leading-relaxed">
                    Daftarkan akun media sosial Anda ke dalam workspace agar siap dipilih saat menyusun rencana konten, kalender, dan postingan di Composer tanpa perlu menunggu API resmi.
                  </p>
                </div>

                <div>
                  <label htmlFor="account-name-input" className="text-xs font-semibold text-slate-700 block mb-1">
                    Nama Akun / Brand:
                  </label>
                  <input
                    id="account-name-input"
                    type="text"
                    required
                    value={accountNameInput}
                    onChange={(e) => setAccountNameInput(e.target.value)}
                    placeholder={`PT Wijaya Inovasi Gemilang (${selectedPlatformToConnect.name})`}
                    className="ui-input text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="account-handle-input" className="text-xs font-semibold text-slate-700 block mb-1">
                    Handle / Username Akun:
                  </label>
                  <input
                    id="account-handle-input"
                    type="text"
                    required
                    value={accountHandleInput}
                    onChange={(e) => setAccountHandleInput(e.target.value)}
                    placeholder={`@wijaya.${selectedPlatformToConnect.id}`}
                    className="ui-input text-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Gunakan handle unik untuk masing-masing akun (contoh: @brand_utama, @brand_lifestyle).
                  </p>
                </div>

                <div>
                  <label htmlFor="account-followers-input" className="text-xs font-semibold text-slate-700 block mb-1">
                    Jumlah Pengikut (Followers):
                  </label>
                  <input
                    id="account-followers-input"
                    type="number"
                    min="0"
                    value={followerCountInput}
                    onChange={(e) => setFollowerCountInput(e.target.value)}
                    placeholder="0"
                    className="ui-input text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedPlatformToConnect(null)}
                    className="ui-btn ui-btn-secondary py-1.5 text-xs"
                    disabled={connecting}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={connecting}
                    className="ui-btn ui-btn-primary py-1.5 px-4 text-xs font-semibold"
                  >
                    {connecting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan Saluran...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Simpan &amp; Hubungkan Saluran</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Option 2: Official OAuth 2.0 Redirect Mode */}
            {connectMode === 'oauth' && (
              <div className="space-y-3">
                <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                    <span>Otorisasi Resmi OAuth 2.0</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Sistem akan mengarahkan browser Anda ke halaman login resmi <strong>{selectedPlatformToConnect.name}</strong> untuk memberikan izin token API otomatis.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                  <div className="flex items-center gap-1 font-bold">
                    <Key className="w-3.5 h-3.5 text-amber-700" />
                    <span>Konfigurasi Developer API:</span>
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    Pastikan App ID &amp; App Secret untuk {selectedPlatformToConnect.name} telah dimasukkan ke file <code>.env</code> server backend jika ingin menggunakan alur otomatis ini.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedPlatformToConnect(null)}
                    className="ui-btn ui-btn-secondary py-1.5 text-xs"
                    disabled={connecting}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRealOAuthRedirect(selectedPlatformToConnect.id)}
                    className="ui-btn ui-btn-primary py-1.5 px-4 text-xs font-semibold"
                    disabled={connecting}
                  >
                    {connecting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyiapkan OAuth...</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Lanjutkan ke {selectedPlatformToConnect.name}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
