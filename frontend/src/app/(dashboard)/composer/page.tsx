'use client';

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  PenSquare,
  Image as ImageIcon,
  Calendar,
  Clock,
  Send,
  MessageSquare,
  Smartphone,
  X,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { MediaItem, SocialAccount } from '@/lib/types';
import SocialIcon from '@/components/ui/SocialIcon';
import MediaPickerModal from '@/components/composer/MediaPickerModal';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', maxChars: 2200 },
  { id: 'facebook', label: 'Facebook', maxChars: 5000 },
  { id: 'linkedin', label: 'LinkedIn', maxChars: 3000 },
  { id: 'tiktok', label: 'TikTok', maxChars: 2200 },
  { id: 'threads', label: 'Threads', maxChars: 500 },
  { id: 'youtube', label: 'YouTube', maxChars: 5000 },
  { id: 'bluesky', label: 'Bluesky', maxChars: 300 },
  { id: 'pinterest', label: 'Pinterest', maxChars: 500 },
  { id: 'google_business', label: 'Google Business', maxChars: 1500 },
];

function ComposerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postIdParam = searchParams.get('post_id');
  const titleParam = searchParams.get('title');
  const contentParam = searchParams.get('content');

  const toast = useToast();
  const { confirm } = useConfirm();
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [showFirstComment, setShowFirstComment] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [activePreviewTab, setActivePreviewTab] = useState('instagram');
  const [submitting, setSubmitting] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<MediaItem[]>([]);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState('');

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError('');
    try {
      const data = await api.getSocialAccounts();
      const accounts = data.accounts || [];
      setConnectedAccounts(accounts);
      if (!postIdParam) {
        const availablePlatforms = Array.from(new Set(accounts.map((account) => account.platform)));
        setSelectedPlatforms(availablePlatforms);
        if (availablePlatforms[0]) {
          setActivePreviewTab(availablePlatforms[0]);
        }
      }
    } catch (error) {
      setConnectedAccounts([]);
      setSelectedPlatforms([]);
      setAccountsError(
        error instanceof Error && error.message
          ? error.message
          : 'Daftar akun sosial tidak dapat dimuat. Periksa koneksi lalu coba lagi.'
      );
    } finally {
      setAccountsLoading(false);
    }
  }, [postIdParam]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  // Load existing post if post_id is provided in URL
  useEffect(() => {
    if (!postIdParam) {
      setEditingPostId(null);
      return;
    }
    async function loadPostToEdit() {
      try {
        const res = await api.getPost(postIdParam!);
        if (res && res.post) {
          setEditingPostId(res.post.id);
          setCaption(res.post.master_caption || '');
          if (res.post.first_comment) {
            setFirstComment(res.post.first_comment);
            setShowFirstComment(true);
          }
          if (res.post.scheduled_at) {
            setScheduledAt(res.post.scheduled_at);
          }
          if (res.post.media && res.post.media.length > 0) {
            setAttachedMedia(res.post.media);
          }
          if (res.post.targets && res.post.targets.length > 0) {
            const plats = Array.from(new Set(res.post.targets.map((t) => t.platform)));
            setSelectedPlatforms(plats);
            if (plats[0]) setActivePreviewTab(plats[0]);
          }
          toast.info('Mode Edit Aktif', 'Data postingan berhasil dimuat dari kalender.');
        }
      } catch (error: unknown) {
        toast.error('Gagal Memuat Post', getErrorMessage(error, 'Postingan tidak ditemukan.'));
      }
    }
    loadPostToEdit();
  }, [postIdParam, toast]);

  // Prefill title & content from query params if available (e.g. from Kanban)
  useEffect(() => {
    if (!postIdParam && (titleParam || contentParam)) {
      const initialText = titleParam
        ? contentParam
          ? `${titleParam}\n\n${contentParam}`
          : titleParam
        : contentParam || '';
      setCaption(initialText);
    }
  }, [postIdParam, titleParam, contentParam]);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => {
      const next = prev.includes(id) ? (prev.length > 1 ? prev.filter((p) => p !== id) : prev) : [...prev, id];
      if (!next.includes(activePreviewTab)) {
        setActivePreviewTab(next[0] || 'instagram');
      }
      return next;
    });
  };

  const removeMedia = (id: string, title?: string) => {
    confirm({
      title: 'Lepas Lampiran Media?',
      message: `Apakah Anda yakin ingin melepas file "${title || 'media'}" dari draft postingan ini?`,
      confirmText: 'Ya, Lepas Media',
      type: 'danger',
      onConfirm: () => {
        setAttachedMedia((prev) => prev.filter((m) => m.id !== id));
        toast.info('Lampiran Dihapus', 'File media telah dilepas dari draft postingan.');
      },
    });
  };

  const executePostCreation = async (postNow: boolean) => {
    setSubmitting(true);
    try {
      await api.createPost({
        post_id: editingPostId || undefined,
        master_caption: caption,
        target_account_ids: selectedPlatforms,
        scheduled_at: postNow ? undefined : scheduledAt,
        first_comment: showFirstComment ? firstComment : undefined,
        media_ids: attachedMedia.map((m) => m.id),
        post_now: postNow,
      });

      if (postNow) {
        toast.success(
          'Masuk Antrean Publikasi',
          'Konten telah disimpan dan dijadwalkan untuk diproses segera. Status terbit akan diperbarui setelah platform mengonfirmasi.'
        );
      } else {
        toast.success(
          editingPostId ? 'Perubahan Disimpan' : 'Postingan Dijadwalkan',
          'Konten berhasil disimpan ke database dan jadwal kalender telah diperbarui.'
        );
      }

      if (editingPostId) {
        router.push('/calendar');
      } else {
        setCaption('');
        setFirstComment('');
        setAttachedMedia([]);
      }
    } catch (error: unknown) {
      toast.error('Gagal Menyimpan', getErrorMessage(error, 'Gagal menyimpan postingan ke database.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (postNow: boolean = false) => {
    if (!caption.trim()) {
      toast.warning('Caption Kosong', 'Mohon isi konten postingan terlebih dahulu sebelum menerbitkan.');
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast.warning(
        'Saluran Belum Dipilih',
        accountsError
          ? 'Daftar akun belum berhasil dimuat. Coba lagi sebelum menyimpan postingan.'
          : 'Hubungkan dan pilih minimal satu akun sosial aktif sebelum menyimpan postingan.'
      );
      return;
    }

    if (postNow) {
      confirm({
        title: 'Konfirmasi Terbitkan Sekarang',
        message: `Postingan ini akan disimpan lalu dimasukkan ke antrean publikasi segera untuk ${selectedPlatforms.length} saluran aktif. Status berhasil hanya diberikan setelah platform mengonfirmasi. Lanjutkan?`,
        confirmText: 'Ya, Antrekan Sekarang',
        type: 'publish',
        onConfirm: () => executePostCreation(true),
      });
    } else {
      confirm({
        title: editingPostId ? 'Konfirmasi Simpan Perubahan' : 'Konfirmasi Penjadwalan Konten',
        message: scheduledAt
          ? `Postingan ini akan dijadwalkan tayang pada ${new Date(scheduledAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} sesuai zona waktu workspace ke ${selectedPlatforms.length} saluran aktif. Simpan jadwal?`
          : 'Postingan ini akan disimpan sebagai draft ke dalam antrean kalender. Simpan draft?',
        confirmText: editingPostId ? 'Ya, Simpan Perubahan' : 'Ya, Simpan Jadwal',
        type: 'info',
        onConfirm: () => executePostCreation(false),
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-900 tracking-tight">
              Post Composer Multi-Channel
            </h1>
            {editingPostId && (
              <span className="ui-badge bg-blue-50 border-blue-200 text-blue-700 text-xs flex items-center gap-1 font-mono">
                <PenSquare className="w-3 h-3" />
                Mode Edit (Terhubung Kalender)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Tulis satu kali, sesuaikan, dan jadwalkan ke seluruh saluran media sosial resmi PT Wijaya Inovasi Gemilang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {editingPostId && (
            <button
              type="button"
              onClick={() => {
                setEditingPostId(null);
                setCaption('');
                setFirstComment('');
                setAttachedMedia([]);
                router.push('/composer');
                toast.info('Mode Baru', 'Beralih ke pembuatan postingan baru.');
              }}
              className="ui-btn ui-btn-secondary text-xs"
            >
              + Buat Post Baru
            </button>
          )}

          <Link href="/calendar" className="ui-btn ui-btn-secondary text-xs flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Lihat di Kalender</span>
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Editor & Config (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Target Platforms Selector */}
          <div className="ui-card space-y-2.5">
            <div className="flex items-center justify-between">
              <p id="platform-selection-label" className="text-xs font-semibold text-slate-700 uppercase tracking-wide block">
                Pilih Saluran Publikasi
              </p>
              {connectedAccounts.length > 0 && (
                <span className="text-[11px] text-slate-500 font-medium">
                  {connectedAccounts.length} Akun Terhubung Aktif
                </span>
              )}
            </div>

            {accountsLoading && (
              <p className="text-xs text-slate-500" role="status">Memuat akun sosial terhubung...</p>
            )}
            {!accountsLoading && accountsError && (
              <div className="rounded border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800" role="alert">
                <p><strong>Akun sosial gagal dimuat.</strong> {accountsError}</p>
                <button type="button" className="ui-btn ui-btn-secondary mt-2" onClick={() => void loadAccounts()}>
                  Coba Lagi
                </button>
              </div>
            )}
            {!accountsLoading && !accountsError && connectedAccounts.length === 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800" role="status">
                Belum ada akun sosial aktif. <Link href="/accounts" className="font-semibold underline">Hubungkan akun</Link> sebelum membuat postingan.
              </div>
            )}

            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="platform-selection-label">
              {PLATFORMS.filter((platform) =>
                connectedAccounts.some((account) => account.platform === platform.id)
              ).map((p) => {
                const isSelected = selectedPlatforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    disabled={accountsLoading}
                    aria-pressed={isSelected}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <SocialIcon platform={p.id} size={14} className={isSelected ? 'text-white' : 'text-slate-600'} />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Master Caption Box */}
          <div className="ui-card space-y-2.5">
            <div className="flex items-center justify-between">
              <label htmlFor="composer-caption" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Konten Caption Utama
              </label>

              {/* Character Limit Counters */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedPlatforms.map((platId) => {
                  const platObj = PLATFORMS.find((p) => p.id === platId);
                  const chars = caption.length;
                  const max = platObj?.maxChars || 2200;
                  const isOver = chars > max;
                  return (
                    <span
                      key={platId}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 ${
                        isOver
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      <SocialIcon platform={platId} size={11} />
                      <span>{chars}/{max}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            <textarea
              id="composer-caption"
              rows={6}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tulis caption postingan, informasi acara, dan hashtag di sini..."
              className="w-full bg-slate-50/50 border border-slate-200 rounded-md p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 leading-relaxed font-sans"
            />

            {/* Attached Media List */}
            {attachedMedia.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-700 block">
                  Media Terlampir ({attachedMedia.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {attachedMedia.map((media) => (
                    <div
                      key={media.id}
                      className="flex items-center gap-2 p-1.5 rounded border border-slate-200 bg-slate-50 text-xs text-slate-800"
                    >
                      {media.file_type === 'image' ? (
                        <Image
                          src={media.thumbnail_url || media.file_url}
                          alt={media.title || 'Media terlampir'}
                          width={24}
                          height={24}
                          unoptimized
                          className="w-6 h-6 object-cover rounded"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-500" />
                      )}
                      <span className="max-w-[120px] truncate text-[11px] font-medium">{media.title}</span>
                      <button
                        type="button"
                        onClick={() => removeMedia(media.id)}
                        aria-label={`Hapus media ${media.title || 'terlampir'}`}
                        className="text-slate-400 hover:text-rose-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Media Upload & First Comment Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMediaModalOpen(true)}
                  className="ui-btn ui-btn-secondary text-xs"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Pilih / Upload Media</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowFirstComment(!showFirstComment)}
                  aria-expanded={showFirstComment}
                  className={`ui-btn text-xs ${
                    showFirstComment ? 'bg-slate-900 text-white' : 'ui-btn-secondary'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>First Comment</span>
                </button>
              </div>

              <span className="text-[11px] text-slate-400 font-mono">
                {caption.length} Karakter
              </span>
            </div>

            {/* First Comment Box */}
            {showFirstComment && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <label htmlFor="composer-first-comment" className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide block">
                  First Comment (Otomatis Diposting di Kolom Komentar):
                </label>
                <textarea
                  id="composer-first-comment"
                  rows={2}
                  value={firstComment}
                  onChange={(e) => setFirstComment(e.target.value)}
                  placeholder="Masukkan link website, hashtag tambahan, atau call-to-action..."
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white"
                />
              </div>
            )}
          </div>

          {/* Schedule Time Card with Smart Auto Placement Dropup/Dropdown */}
          <div className="ui-card space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Waktu Penjadwalan Tayang
              </p>
              <span className="text-[11px] text-slate-500 font-mono">Zona waktu mengikuti pengaturan workspace</span>
            </div>

            <DateTimePicker
              value={scheduledAt}
              onChange={(val) => setScheduledAt(val)}
              placement="top"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
              className="ui-btn ui-btn-secondary"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Jadwalkan Post</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(true)}
              className="ui-btn ui-btn-primary"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Memproses...' : 'Terbitkan Sekarang'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Device Mockup Live Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="ui-card space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                  Pratinjau Tampilan Feed
                </h2>
              </div>

              {/* Preview Tabs */}
              <div className="flex items-center gap-1">
                {selectedPlatforms.map((plat) => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setActivePreviewTab(plat)}
                    className={`p-1 rounded transition ${
                      activePreviewTab === plat
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                    title={plat.toUpperCase()}
                  >
                    <SocialIcon platform={plat} size={13} className={activePreviewTab === plat ? 'text-white' : undefined} />
                  </button>
                ))}
              </div>
            </div>

            {/* Social Post Feed Mockup */}
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3 text-xs shadow-xs">
              {/* Post Author Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                    WI
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 leading-tight">PT Wijaya Inovasi Gemilang</p>
                    <p className="text-[10px] text-slate-400 leading-tight">Baru saja • {activePreviewTab.toUpperCase()}</p>
                  </div>
                </div>

                <SocialIcon platform={activePreviewTab} size={14} className="text-slate-400" />
              </div>

              {/* Caption Preview */}
              <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
                {caption || (
                  <span className="text-slate-400 italic">
                    Teks caption yang Anda tulis di sebelah kiri akan muncul secara real-time di sini...
                  </span>
                )}
              </p>

              {/* Media Preview Box (Uncropped & Playable Video) */}
              {attachedMedia.length > 0 ? (
                <div className="rounded-md border border-slate-800 overflow-hidden bg-slate-950 flex items-center justify-center p-1 min-h-[160px] max-h-72">
                  {attachedMedia[0].file_type === 'video' ||
                  /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(attachedMedia[0].file_url || '') ? (
                    <video
                      controls
                      autoPlay={false}
                      preload="metadata"
                      poster={attachedMedia[0].thumbnail_url || undefined}
                      src={attachedMedia[0].file_url}
                      className="max-h-64 w-full object-contain rounded"
                    >
                      Browser Anda tidak mendukung video HTML5.
                    </video>
                  ) : (
                    <Image
                      src={attachedMedia[0].thumbnail_url || attachedMedia[0].file_url}
                      alt={attachedMedia[0].title || 'Pratinjau media'}
                      width={640}
                      height={360}
                      unoptimized
                      className="max-h-64 w-auto max-w-full object-contain rounded mx-auto"
                    />
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-[11px] text-slate-400">
                  Belum ada gambar/video yang dilampirkan
                </div>
              )}

              {/* Mock Interaction Metrics */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                <span>0 Suka</span>
                <span>0 Komentar • 0 Bagikan</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        initialSelectedIds={attachedMedia.map((m) => m.id)}
        onSelectMedia={(items) => {
          setAttachedMedia(items);
          if (items.length > 0) {
            toast.success('Media Dilampirkan', `${items.length} file media berhasil ditambahkan ke draft.`);
          }
        }}
      />
    </div>
  );
}

export default function ComposerPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
          Memuat Composer...
        </div>
      }
    >
      <ComposerForm />
    </Suspense>
  );
}
