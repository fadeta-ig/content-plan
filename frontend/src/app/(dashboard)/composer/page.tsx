'use client';

import React, { useCallback, useEffect, useState, useRef, Suspense } from 'react';
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
  X,
  Sparkles,
  Copy,
  AlertCircle,
  RotateCcw,
  Upload,
  Loader2,
  Check,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { MediaItem, SocialAccount, KanbanCard, AttachmentItem } from '@/lib/types';
import SocialIcon from '@/components/ui/SocialIcon';
import MediaPickerModal from '@/components/composer/MediaPickerModal';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import RichContentEditor from '@/components/ui/RichContentEditor';
import SocialPostMockup from '@/components/ui/SocialPostMockup';
import AttachmentManager from '@/components/ui/AttachmentManager';
import {
  DRAFT_KEYS,
  ComposerDraftData,
  StoredDraftEnvelope,
  getDraft,
  saveDraft,
  clearDraft,
  formatDraftTimeAgo,
} from '@/lib/draftStorage';

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

function extractCleanText(text: string): string {
  return text
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function ComposerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postIdParam = searchParams.get('post_id');
  const ideaIdParam = searchParams.get('idea_id');
  const titleParam = searchParams.get('title');
  const contentParam = searchParams.get('content');

  const toast = useToast();
  const { confirm } = useConfirm();
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [showFirstComment, setShowFirstComment] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [activePreviewTab, setActivePreviewTab] = useState('instagram');
  const [submitting, setSubmitting] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<MediaItem[]>([]);
  const [attachedDocs, setAttachedDocs] = useState<AttachmentItem[]>([]);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState('');
  const [kanbanIdeas, setKanbanIdeas] = useState<KanbanCard[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(ideaIdParam || null);
  const [linkedIdea, setLinkedIdea] = useState<{ id: string; title: string; content?: string } | null>(null);

  // Auto-Save Draft State
  const [savedDraftEnvelope, setSavedDraftEnvelope] = useState<StoredDraftEnvelope<ComposerDraftData> | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Direct Drag & Drop Media Upload State
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploadingDirect, setIsUploadingDirect] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setSelectedAccountIds(accounts.map((a) => a.id));
        if (availablePlatforms[0]) {
          setActivePreviewTab(availablePlatforms[0]);
        }
      }
    } catch (error) {
      setConnectedAccounts([]);
      setSelectedPlatforms([]);
      setSelectedAccountIds([]);
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
          if (res.post.attachments && res.post.attachments.length > 0) {
            setAttachedDocs(res.post.attachments);
          }
          if (res.post.related_idea_id) {
            setSelectedIdeaId(res.post.related_idea_id);
            setLinkedIdea({
              id: res.post.related_idea_id,
              title: res.post.related_idea_title || 'Ide / Brief Terhubung',
            });
          }
          if (res.post.targets && res.post.targets.length > 0) {
            const plats = Array.from(new Set(res.post.targets.map((t) => t.platform)));
            const accIds = res.post.targets.map((t) => t.id).filter(Boolean);
            setSelectedPlatforms(plats);
            if (accIds.length > 0) setSelectedAccountIds(accIds);
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

  // Load Kanban ideas for pre-filling & linking
  useEffect(() => {
    async function loadIdeas() {
      try {
        const res = await api.getKanbanIdeas();
        const allCards: KanbanCard[] = [];
        res.columns?.forEach((col) => {
          if (col.cards) allCards.push(...col.cards);
        });
        setKanbanIdeas(allCards);
        if (ideaIdParam) {
          const found = allCards.find((c) => c.id === ideaIdParam);
          if (found) {
            setLinkedIdea({ id: found.id, title: found.title, content: found.content });
            setSelectedIdeaId(found.id);
          } else if (titleParam) {
            setLinkedIdea({ id: ideaIdParam, title: titleParam, content: contentParam || undefined });
            setSelectedIdeaId(ideaIdParam);
          }
        }
      } catch {
        // silent fallback
      }
    }
    void loadIdeas();
  }, [ideaIdParam, titleParam, contentParam]);

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

  // Check for auto-saved draft on mount (only for new posts)
  useEffect(() => {
    if (postIdParam || titleParam || contentParam) return;
    const draft = getDraft<ComposerDraftData>(DRAFT_KEYS.COMPOSER);
    if (
      draft &&
      (draft.data.caption?.trim() ||
        draft.data.firstComment?.trim() ||
        (draft.data.attachedMedia && draft.data.attachedMedia.length > 0) ||
        (draft.data.attachedDocs && draft.data.attachedDocs.length > 0))
    ) {
      setSavedDraftEnvelope(draft);
    }
  }, [postIdParam, titleParam, contentParam]);

  // Restore draft content
  const handleRestoreDraft = () => {
    if (!savedDraftEnvelope) return;
    const d = savedDraftEnvelope.data;
    if (d.caption !== undefined) setCaption(d.caption);
    if (d.firstComment !== undefined) setFirstComment(d.firstComment);
    if (d.showFirstComment !== undefined) setShowFirstComment(d.showFirstComment);
    if (d.scheduledAt !== undefined) setScheduledAt(d.scheduledAt);
    if (d.attachedMedia) setAttachedMedia(d.attachedMedia);
    if (d.attachedDocs) setAttachedDocs(d.attachedDocs);
    if (d.selectedPlatforms && d.selectedPlatforms.length > 0) setSelectedPlatforms(d.selectedPlatforms);
    if (d.selectedAccountIds && d.selectedAccountIds.length > 0) setSelectedAccountIds(d.selectedAccountIds);
    if (d.selectedIdeaId) setSelectedIdeaId(d.selectedIdeaId);
    setSavedDraftEnvelope(null);
    toast.success('Draf Dipulihkan', 'Naskah, media, dan pengaturan postingan berhasil dimuat.');
  };

  // Discard draft content
  const handleDiscardDraft = () => {
    clearDraft(DRAFT_KEYS.COMPOSER);
    setSavedDraftEnvelope(null);
    toast.info('Draf Dihapus', 'Draf lokal telah dibersihkan dari penyimpanan browser.');
  };

  // Debounced auto-save effect (1000ms)
  useEffect(() => {
    if (editingPostId || postIdParam) return;
    const hasContent =
      caption.trim().length > 0 ||
      firstComment.trim().length > 0 ||
      attachedMedia.length > 0 ||
      attachedDocs.length > 0;
    if (!hasContent) return;

    const timer = setTimeout(() => {
      const payload: ComposerDraftData = {
        caption,
        firstComment,
        showFirstComment,
        scheduledAt,
        attachedMedia,
        attachedDocs,
        selectedPlatforms,
        selectedAccountIds,
        selectedIdeaId,
      };
      saveDraft(DRAFT_KEYS.COMPOSER, payload);
      const now = new Date();
      setLastSavedTime(
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    caption,
    firstComment,
    showFirstComment,
    scheduledAt,
    attachedMedia,
    attachedDocs,
    selectedPlatforms,
    selectedAccountIds,
    selectedIdeaId,
    editingPostId,
    postIdParam,
  ]);

  // Direct Drag-and-Drop & Direct File Upload Handlers
  const handleDirectUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (fileArray.length === 0) {
      toast.warning('Format Tidak Didukung', 'Silakan pilih file gambar atau video (JPEG, PNG, WebP, MP4, MOV).');
      return;
    }

    setIsUploadingDirect(true);
    let successCount = 0;
    const newlyUploaded: MediaItem[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadProgressText(`Mengunggah (${i + 1}/${fileArray.length}): ${file.name}...`);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await api.uploadMedia(formData);
        if (res?.asset) {
          newlyUploaded.push(res.asset);
          successCount++;
        }
      } catch (err: unknown) {
        toast.error(`Gagal Unggah ${file.name}`, getErrorMessage(err, 'Server menolak file.'));
      }
    }

    if (newlyUploaded.length > 0) {
      setAttachedMedia((prev) => [...prev, ...newlyUploaded]);
      toast.success(
        'Media Terlampir',
        `${successCount} file media berhasil diunggah langsung dan ditambahkan ke draf postingan.`
      );
    }
    setIsUploadingDirect(false);
    setUploadProgressText('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleDirectUploadFiles(e.dataTransfer.files);
    }
  };

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => {
      const willSelect = !prev.includes(id);
      const next = willSelect ? [...prev, id] : (prev.length > 1 ? prev.filter((p) => p !== id) : prev);
      if (!next.includes(activePreviewTab)) {
        setActivePreviewTab(next[0] || 'instagram');
      }
      setSelectedAccountIds((prevAccIds) => {
        const platformAccountIds = connectedAccounts.filter((a) => a.platform === id).map((a) => a.id);
        if (willSelect) {
          return Array.from(new Set([...prevAccIds, ...platformAccountIds]));
        } else {
          const remaining = prevAccIds.filter((accId) => !platformAccountIds.includes(accId));
          return remaining.length > 0 ? remaining : prevAccIds;
        }
      });
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
        target_account_ids: selectedAccountIds.length > 0 ? selectedAccountIds : selectedPlatforms,
        scheduled_at: postNow ? undefined : scheduledAt,
        first_comment: showFirstComment ? firstComment : undefined,
        media_ids: attachedMedia.map((m) => m.id),
        attachments: attachedDocs,
        related_idea_id: selectedIdeaId || undefined,
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
        clearDraft(DRAFT_KEYS.COMPOSER);
        setSavedDraftEnvelope(null);
        setLastSavedTime(null);
        setCaption('');
        setFirstComment('');
        setAttachedMedia([]);
        setAttachedDocs([]);
        setSelectedIdeaId(null);
        setLinkedIdea(null);
      }
    } catch (error: unknown) {
      toast.error('Gagal Menyimpan', getErrorMessage(error, 'Gagal menyimpan postingan ke database.'));
    } finally {
      setSubmitting(false);
    }
  };

  const exceededPlatforms = selectedPlatforms
    .map((platId) => {
      const platObj = PLATFORMS.find((p) => p.id === platId);
      const max = platObj?.maxChars || 2200;
      return {
        id: platId,
        label: platObj?.label || platId,
        max,
        current: caption.length,
        diff: caption.length - max,
      };
    })
    .filter((p) => p.diff > 0);

  const handleCopyCleanText = async () => {
    if (!caption.trim()) {
      toast.warning('Caption Kosong', 'Tidak ada teks caption yang dapat disalin.');
      return;
    }
    const clean = extractCleanText(caption);
    try {
      await navigator.clipboard.writeText(clean);
      toast.success('Teks Bersih Disalin', 'Teks caption berhasil disalin ke clipboard tanpa format tag HTML.');
    } catch {
      toast.error('Gagal Menyalin', 'Izin akses clipboard ditolak peramban.');
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

    if (exceededPlatforms.length > 0) {
      toast.warning(
        'Batas Karakter Terlampaui',
        `Caption melebihi batas untuk ${exceededPlatforms.map((p) => `${p.label} (maks. ${p.max})`).join(', ')}. Harap sesuaikan naskah sebelum menyimpan.`
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
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold text-slate-900 tracking-tight">
              Post Composer Multi-Channel
            </h1>
            {editingPostId ? (
              <span className="ui-badge bg-blue-50 border-blue-200 text-blue-700 text-xs flex items-center gap-1 font-mono">
                <PenSquare className="w-3 h-3" />
                Mode Edit (Terhubung Kalender)
              </span>
            ) : (
              lastSavedTime && (
                <span className="ui-badge bg-emerald-50 border-emerald-200 text-emerald-700 text-[11px] flex items-center gap-1 font-medium">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Draf tersimpan ({lastSavedTime})</span>
                </span>
              )
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
                clearDraft(DRAFT_KEYS.COMPOSER);
                setSavedDraftEnvelope(null);
                setLastSavedTime(null);
                setCaption('');
                setFirstComment('');
                setAttachedMedia([]);
                setAttachedDocs([]);
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

      {/* Auto-Save Draft Restoration Banner */}
      {savedDraftEnvelope && !editingPostId && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-bold text-amber-900">
                  Draf Otomatis Ditemukan ({formatDraftTimeAgo(savedDraftEnvelope.savedAt)})
                </p>
                <span className="text-[10px] bg-amber-200/70 text-amber-900 font-semibold px-2 py-0.5 rounded-full">
                  LocalStorage Tersimpan
                </span>
              </div>
              <p className="text-[11px] text-amber-800 truncate">
                Anda memiliki naskah draf lokal yang belum diterbitkan. Ingin melanjutkan draf ini?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Pulihkan Draf</span>
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-2.5 py-1.5 text-xs text-amber-800 hover:text-amber-950 font-medium hover:bg-amber-200/50 rounded-lg transition"
            >
              Abaikan / Buang
            </button>
          </div>
        </div>
      )}

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

            {/* Specific Account Selection Chips for Multi-Account Setup */}
            {connectedAccounts.length > 0 && selectedPlatforms.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Target Akun Spesifik ({selectedAccountIds.length} dipilih):
                  </span>
                  {connectedAccounts.filter((acc) => selectedPlatforms.includes(acc.platform)).length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allAvailableIds = connectedAccounts
                          .filter((acc) => selectedPlatforms.includes(acc.platform))
                          .map((acc) => acc.id);
                        const isAllSelected = allAvailableIds.every((id) => selectedAccountIds.includes(id));
                        setSelectedAccountIds(
                          isAllSelected
                            ? [allAvailableIds[0]] // sisakan minimal 1
                            : Array.from(new Set([...selectedAccountIds, ...allAvailableIds]))
                        );
                      }}
                      className="text-[10px] text-blue-600 hover:underline font-semibold"
                    >
                      Pilih Semua / Reset
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {connectedAccounts
                    .filter((acc) => selectedPlatforms.includes(acc.platform))
                    .map((acc) => {
                      const isAccSelected = selectedAccountIds.includes(acc.id);
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setSelectedAccountIds((prev) =>
                              prev.includes(acc.id)
                                ? (prev.length > 1 ? prev.filter((id) => id !== acc.id) : prev)
                                : [...prev, acc.id]
                            );
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                            isAccSelected
                              ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold shadow-2xs'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <SocialIcon platform={acc.platform} size={11} />
                          <span>{acc.account_handle || acc.account_name}</span>
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isAccSelected ? 'bg-blue-600' : 'bg-slate-300'
                            }`}
                          />
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Idea / Brief Linker Box */}
          {linkedIdea ? (
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                    Sumber Ide / Brief Terhubung
                  </span>
                  <p className="text-xs font-bold text-blue-950 truncate">
                    {linkedIdea.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedIdeaId(null);
                  setLinkedIdea(null);
                }}
                className="text-[11px] text-slate-500 hover:text-rose-600 px-2 py-1 rounded hover:bg-white/80 transition font-medium shrink-0"
                title="Lepas tautan brief dari postingan ini"
              >
                Lepas Tautan
              </button>
            </div>
          ) : (
            kanbanIdeas.length > 0 && (
              <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1.5">
                <label htmlFor="composer-idea-select" className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ambil Naskah dari Ide / Brief Kanban (Opsional)</span>
                </label>
                <select
                  id="composer-idea-select"
                  value={selectedIdeaId || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) {
                      const found = kanbanIdeas.find((i) => i.id === id);
                      if (found) {
                        setSelectedIdeaId(found.id);
                        setLinkedIdea({ id: found.id, title: found.title, content: found.content });
                        const initialText = found.content
                          ? `${found.title}\n\n${found.content}`
                          : found.title;
                        setCaption(initialText);
                      }
                    }
                  }}
                  className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-500 font-sans"
                >
                  <option value="">-- Hubungkan dengan Ide / Brief Kanban --</option>
                  {kanbanIdeas.map((idea) => (
                    <option key={idea.id} value={idea.id}>
                      💡 {idea.title}
                    </option>
                  ))}
                </select>
              </div>
            )
          )}

          {/* Master Caption Box */}
          <div className="ui-card space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <label htmlFor="composer-caption" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Konten Caption Utama
                </label>
                <button
                  type="button"
                  onClick={handleCopyCleanText}
                  className="text-[11px] text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50 transition flex items-center gap-1 font-medium shadow-2xs"
                  title="Salin isi caption bersih tanpa tag HTML ke clipboard"
                >
                  <Copy className="w-3 h-3 text-slate-500" />
                  <span>Salin Teks Bersih</span>
                </button>
              </div>

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
                          ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold animate-pulse'
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

            {/* Over-the-Limit Warning Banner */}
            {exceededPlatforms.length > 0 && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    Teks Melebihi Batas Karakter Platform
                  </p>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    Caption Anda ({caption.length} karakter) melebihi batas untuk:{' '}
                    <span className="font-semibold">
                      {exceededPlatforms.map((p) => `${p.label} (maks. ${p.max} karakter, lebih ${p.diff})`).join(', ')}
                    </span>
                    . Harap persingkat naskah agar tidak ditolak oleh server sosial media.
                  </p>
                </div>
              </div>
            )}

            <RichContentEditor
              id="composer-caption"
              value={caption}
              onChange={setCaption}
              minHeight="220px"
              placeholder="Tulis caption postingan, informasi acara, dan hashtag di sini..."
            />

            {/* First Comment Toggle & Character Count Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
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
                <RichContentEditor
                  id="composer-first-comment"
                  value={firstComment}
                  onChange={setFirstComment}
                  minHeight="100px"
                  placeholder="Masukkan link website, hashtag tambahan, atau call-to-action..."
                />
              </div>
            )}
          </div>

          {/* Direct Media Upload & Visual Content Card */}
          <div className="ui-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-slate-700" />
                <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Lampiran Media & Konten Visual
                </h2>
                {attachedMedia.length > 0 && (
                  <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                    {attachedMedia.length} File Terlampir
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsMediaModalOpen(true)}
                className="ui-btn ui-btn-secondary text-xs flex items-center gap-1.5"
              >
                <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                <span>Pilih dari Media Library</span>
              </button>
            </div>

            {/* Direct Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploadingDirect && fileInputRef.current?.click()}
              className={`group relative border-2 border-dashed rounded-xl p-5 transition-all duration-150 cursor-pointer text-center ${
                isDraggingOver
                  ? 'border-blue-500 bg-blue-50/80 shadow-md scale-[1.01]'
                  : 'border-slate-200 hover:border-blue-300 bg-slate-50/60 hover:bg-blue-50/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    void handleDirectUploadFiles(e.target.files);
                  }
                }}
                className="hidden"
              />

              {isUploadingDirect ? (
                <div className="py-4 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  <p className="text-xs font-semibold text-blue-900">{uploadProgressText || 'Mengunggah file media...'}</p>
                  <span className="text-[10px] text-slate-500">File langsung disimpan ke database media workspace</span>
                </div>
              ) : (
                <div className="py-2 flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      <span className="text-blue-600 underline">Klik untuk telusuri file</span> atau seret & lepas (drag-and-drop) ke sini
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Mendukung Gambar (PNG, JPG, WebP) & Video (MP4, MOV). Langsung diunggah & dilampirkan.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Attached Media Grid */}
            {attachedMedia.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-700 block">
                  Media yang Dilampirkan ({attachedMedia.length}):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {attachedMedia.map((media) => (
                    <div
                      key={media.id}
                      className="group relative rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex flex-col aspect-video shadow-2xs"
                    >
                      {media.file_type === 'image' ? (
                        <Image
                          src={media.thumbnail_url || media.file_url}
                          alt={media.title || 'Media terlampir'}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-500 p-2 bg-slate-900/10">
                          <ImageIcon className="w-6 h-6 text-slate-600" />
                          <span className="text-[10px] font-mono font-semibold uppercase text-slate-700">VIDEO</span>
                        </div>
                      )}

                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMedia(media.id, media.title);
                          }}
                          aria-label={`Hapus media ${media.title || 'terlampir'}`}
                          className="self-end p-1 rounded-md bg-rose-600 text-white hover:bg-rose-700 transition shadow-xs"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <p className="text-[11px] text-white font-medium truncate drop-shadow">
                          {media.title}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Google Docs & Cloud Links Attachment Card */}
          <div className="ui-card space-y-2">
            <AttachmentManager
              attachments={attachedDocs}
              onChange={setAttachedDocs}
              label="Lampiran Google Docs & Dokumen Pendukung"
              helperText="Tautkan file Google Docs naskah, folder footage Google Drive, atau link referensi."
            />
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
            {/* Social Post Feed Mockup with Realistic UI (Poin 2!) */}
            <SocialPostMockup
              platform={activePreviewTab}
              caption={caption}
              media={attachedMedia}
              accountName={
                connectedAccounts.find((a) => a.platform === activePreviewTab)?.account_name ||
                'PT Wijaya Inovasi Gemilang'
              }
              accountHandle={
                connectedAccounts.find((a) => a.platform === activePreviewTab)?.account_handle ||
                'wijaya_official'
              }
              avatarUrl={connectedAccounts.find((a) => a.platform === activePreviewTab)?.avatar_url}
              firstComment={showFirstComment ? firstComment : undefined}
              scheduledAt={scheduledAt}
              availablePlatforms={selectedPlatforms}
              activePlatform={activePreviewTab}
              onSelectPlatform={setActivePreviewTab}
            />
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
