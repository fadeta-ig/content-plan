'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  X,
  Plus,
  Share2,
  Clapperboard,
  Sparkles,
  MapPin,
  Users,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import {
  CalendarEvent,
  SocialAccount,
  ShootingCrewMember,
  ShootingEquipmentItem,
  AttachmentItem,
  MediaItem,
} from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import SocialIcon from '@/components/ui/SocialIcon';
import RichContentEditor from '@/components/ui/RichContentEditor';
import AttachmentManager from '@/components/ui/AttachmentManager';
import MediaPickerModal from '@/components/composer/MediaPickerModal';
import { formatHandle } from '@/lib/format';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface CalendarScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDayNumber: number | null;
  month: number;
  year: number;
  kanbanIdeas: { id: string; title: string; content?: string }[];
  connectedAccounts: SocialAccount[];
  initialTab?: 'post' | 'shooting';
  initialPostIdeaId?: string;
  initialShootIdeaId?: string;
  initialPostCaption?: string;
  initialShootTitle?: string;
  initialShootDescription?: string;
  onPostCreated: (newEv: CalendarEvent) => void;
  onShootingCreated: (newEv: CalendarEvent) => void;
}

export default function CalendarScheduleModal({
  isOpen,
  onClose,
  selectedDayNumber,
  month,
  year,
  kanbanIdeas,
  connectedAccounts,
  initialTab = 'post',
  initialPostIdeaId = '',
  initialShootIdeaId = '',
  initialPostCaption = '',
  initialShootTitle = '',
  initialShootDescription = '',
  onPostCreated,
  onShootingCreated,
}: CalendarScheduleModalProps) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [activeTab, setActiveTab] = useState<'post' | 'shooting'>(initialTab);

  // Social Post Form State
  const [postCaption, setPostCaption] = useState(initialPostCaption);
  const [postSelectedIdeaId, setPostSelectedIdeaId] = useState(initialPostIdeaId);
  const [postDate, setPostDate] = useState(() => {
    const d = new Date(year, month, selectedDayNumber || new Date().getDate(), 10, 0, 0);
    return formatDateTimeLocal(d);
  });
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [postMedia, setPostMedia] = useState<MediaItem[]>([]);
  const [postAttachments, setPostAttachments] = useState<AttachmentItem[]>([]);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

  // Shooting Session Form State
  const [selectedIdeaId, setSelectedIdeaId] = useState(initialShootIdeaId);
  const [shootTitle, setShootTitle] = useState(initialShootTitle);
  const [shootLocation, setShootLocation] = useState('');
  const [shootScheduledAt, setShootScheduledAt] = useState(() => {
    const d = new Date(year, month, selectedDayNumber || new Date().getDate(), 14, 0, 0);
    return formatDateTimeLocal(d);
  });
  const [shootEndAt, setShootEndAt] = useState(() => {
    const d = new Date(year, month, selectedDayNumber || new Date().getDate(), 17, 0, 0);
    return formatDateTimeLocal(d);
  });
  const [shootDescription, setShootDescription] = useState(initialShootDescription);
  const [shootStatus, setShootStatus] = useState<string>('planned');
  const [shootAttachments, setShootAttachments] = useState<AttachmentItem[]>([]);
  const [crewList, setCrewList] = useState<ShootingCrewMember[]>([
    { name: '', role: 'Videografer' },
  ]);
  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewRole, setNewCrewRole] = useState('Talent / Host');
  const [equipmentList] = useState<ShootingEquipmentItem[]>([
    { item: 'Kamera Utama (Sony A7IV)', checked: true },
    { item: 'Mic Wireless Clip-on', checked: true },
    { item: 'Lighting Softbox & RGB', checked: false },
  ]);
  const [isSubmittingShoot, setIsSubmittingShoot] = useState(false);

  // Initialize selected accounts from connectedAccounts
  useEffect(() => {
    if (connectedAccounts.length > 0 && selectedAccountIds.length === 0) {
      setSelectedAccountIds([connectedAccounts[0].id]);
    }
  }, [connectedAccounts, selectedAccountIds.length]);

  // Sync initial state if modal opens with prefilled props
  useEffect(() => {
    if (initialPostCaption) setPostCaption(initialPostCaption);
    if (initialPostIdeaId) setPostSelectedIdeaId(initialPostIdeaId);
    if (initialShootTitle) setShootTitle(initialShootTitle);
    if (initialShootDescription) setShootDescription(initialShootDescription);
    if (initialShootIdeaId) setSelectedIdeaId(initialShootIdeaId);
    if (initialTab) setActiveTab(initialTab);
  }, [initialPostCaption, initialPostIdeaId, initialShootTitle, initialShootDescription, initialShootIdeaId, initialTab]);

  // Update date when selectedDayNumber changes
  useEffect(() => {
    if (selectedDayNumber) {
      const dPost = new Date(year, month, selectedDayNumber, 10, 0, 0);
      const dShoot = new Date(year, month, selectedDayNumber, 14, 0, 0);
      const dShootEnd = new Date(year, month, selectedDayNumber, 17, 0, 0);
      setPostDate(formatDateTimeLocal(dPost));
      setShootScheduledAt(formatDateTimeLocal(dShoot));
      setShootEndAt(formatDateTimeLocal(dShootEnd));
    }
  }, [selectedDayNumber, month, year]);

  // Trap focus and close on Escape
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId)
        ? prev.length > 1
          ? prev.filter((id) => id !== accountId)
          : prev
        : [...prev, accountId]
    );
  };

  // Submit Social Post Handler
  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postCaption.trim()) {
      toast.error('Validasi Gagal', 'Caption postingan tidak boleh kosong.');
      return;
    }
    if (selectedAccountIds.length === 0) {
      toast.error('Validasi Gagal', 'Pilih minimal satu akun sosial tujuan.');
      return;
    }

    setIsSubmittingPost(true);
    try {
      const linkedIdea = kanbanIdeas.find((i) => i.id === postSelectedIdeaId);

      const res = await api.createPost({
        master_caption: postCaption,
        target_account_ids: selectedAccountIds,
        scheduled_at: postDate,
        media_ids: postMedia.map((m) => m.id),
        attachments: postAttachments,
        related_idea_id: postSelectedIdeaId || undefined,
      });

      const selectedAccObjects = connectedAccounts.filter((a) => selectedAccountIds.includes(a.id));
      const targetPlats = Array.from(new Set(selectedAccObjects.map((a) => a.platform)));

      const newEv: CalendarEvent = {
        id: res.post_id || `post-${Date.now()}`,
        type: 'post',
        title: postCaption.slice(0, 100),
        caption: postCaption,
        start: postDate,
        platforms: targetPlats.length > 0 ? targetPlats : ['social'],
        accounts: selectedAccObjects.map((a) => ({
          id: a.id,
          platform: a.platform,
          account_name: a.account_name,
          account_handle: a.account_handle,
          avatar_url: a.avatar_url,
        })),
        media: postMedia,
        attachments: postAttachments,
        status: 'scheduled',
        related_idea_id: postSelectedIdeaId || null,
        related_idea_title: linkedIdea?.title || null,
      };

      onPostCreated(newEv);
      toast.success('Jadwal Ditambahkan', 'Postingan media sosial berhasil dijadwalkan ke kalender.');
      onClose();
    } catch (error: unknown) {
      toast.error('Gagal Menjadwalkan', getErrorMessage(error, 'Tidak dapat menyimpan postingan ke server.'));
    } finally {
      setIsSubmittingPost(false);
    }
  };

  // Submit Shooting Session Handler
  const handleShootingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shootTitle.trim()) {
      toast.error('Validasi Gagal', 'Judul rencana sesi shooting wajib diisi.');
      return;
    }

    setIsSubmittingShoot(true);
    try {
      const cleanCrew = crewList.filter((c) => c.name.trim().length > 0);
      const cleanEquipment = equipmentList.filter((eq) => eq.item.trim().length > 0);

      const res = await api.createShootingSession({
        title: shootTitle,
        description: shootDescription,
        location: shootLocation,
        scheduled_at: shootScheduledAt,
        end_at: shootEndAt || undefined,
        status: shootStatus,
        crew_members: cleanCrew,
        equipment_checklist: cleanEquipment,
        attachments: shootAttachments,
        related_idea_id: selectedIdeaId || null,
      });

      const newSession = res.session;
      const newEv: CalendarEvent = {
        id: newSession?.id || `shoot-${Date.now()}`,
        type: 'shooting',
        title: shootTitle,
        description: shootDescription,
        location: shootLocation,
        start: shootScheduledAt,
        end: shootEndAt,
        status: shootStatus,
        crew_members: cleanCrew,
        equipment_checklist: cleanEquipment,
        attachments: shootAttachments,
        related_idea_id: newSession?.related_idea_id || selectedIdeaId || null,
        related_idea_title: newSession?.related_idea_title || (kanbanIdeas.find((i) => i.id === selectedIdeaId)?.title) || null,
        platforms: ['shooting'],
      };

      onShootingCreated(newEv);
      toast.success('Sesi Shooting Dibuat', `Rencana shooting "${shootTitle}" berhasil disimpan.`);
      onClose();
    } catch (error: unknown) {
      toast.error('Gagal Menyimpan Shooting', getErrorMessage(error, 'Gagal menyimpan sesi shooting.'));
    } finally {
      setIsSubmittingShoot(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-agenda-title"
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 id="schedule-agenda-title" className="text-sm font-bold text-slate-900">
                Tambah Agenda Kalender
              </h2>
              <p className="text-[11px] text-slate-500">
                Tanggal: {selectedDayNumber} {MONTH_NAMES[month]} {year}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir tambah agenda"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1.5 text-xs gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('post')}
            aria-pressed={activeTab === 'post'}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'post'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Postingan Media Sosial</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shooting')}
            aria-pressed={activeTab === 'shooting'}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'shooting'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span>Rencana Sesi Shooting</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'post' ? (
            /* ========================================================================= */
            /* TAB 1: SOCIAL POST FORM                                                   */
            /* ========================================================================= */
            <form onSubmit={handlePostSubmit} className="space-y-4">
              {/* Kanban Idea / Brief Selector */}
              {kanbanIdeas.length > 0 && (
                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="schedule-post-kanban-idea" className="text-[11px] font-bold text-blue-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ambil dari Ide / Brief Kanban (Opsional)</span>
                    </label>
                    {postSelectedIdeaId && (
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold border border-blue-200">
                        Tersinkronisasi
                      </span>
                    )}
                  </div>
                  <select
                    id="schedule-post-kanban-idea"
                    value={postSelectedIdeaId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setPostSelectedIdeaId(id);
                      if (id) {
                        const found = kanbanIdeas.find((i) => i.id === id);
                        if (found) {
                          const initialText = found.content
                            ? `${found.title}\n\n${found.content}`
                            : found.title;
                          setPostCaption(initialText);
                        }
                      }
                    }}
                    className="w-full text-xs p-2 rounded-lg border border-blue-200 bg-white focus:outline-none focus:border-blue-500 font-sans"
                  >
                    <option value="">-- Buat Postingan Baru (Tanpa Referensi Ide) --</option>
                    {kanbanIdeas.map((idea) => (
                      <option key={idea.id} value={idea.id}>
                        💡 {idea.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Channels per Specific Account (Poin 4!) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Pilih Akun Sosial Target <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {connectedAccounts.length} Akun Terhubung
                  </span>
                </div>

                {connectedAccounts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {connectedAccounts.map((account) => {
                      const isSelected = selectedAccountIds.includes(account.id);
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => toggleAccountSelection(account.id)}
                          aria-pressed={isSelected}
                          className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                              {account.avatar_url ? (
                                <Image
                                  src={account.avatar_url}
                                  alt={account.account_name}
                                  width={28}
                                  height={28}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <SocialIcon platform={account.platform} size={14} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs truncate leading-tight">
                                {account.account_name}
                              </p>
                              <span className={`text-[10px] truncate block ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                {formatHandle(account.account_handle || account.account_name)} • {account.platform.toUpperCase()}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                              isSelected
                                ? 'bg-white text-slate-900 border-white'
                                : 'border-slate-300 text-transparent'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs">
                    Belum ada akun sosial yang terhubung. Buka menu Akun Sosial untuk menghubungkan platform.
                  </div>
                )}
              </div>

              {/* Master Caption with RichContentEditor (Poin 1!) */}
              <div>
                <RichContentEditor
                  id="schedule-post-caption"
                  label="Konten / Caption Utama"
                  value={postCaption}
                  onChange={setPostCaption}
                  minHeight="200px"
                  placeholder="Tulis draf caption konten lengkap dengan hashtag, mention, format tebal/miring..."
                  required
                  helperText="Gunakan tombol B untuk teks tebal, * untuk miring, atau alat Format Sosmed untuk font IG/TikTok."
                />
              </div>

              {/* Media Upload / Attachment (Poin 3!) */}
              <div className="space-y-2 p-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                    <span>Lampiran Gambar / Video ({postMedia.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMediaPickerOpen(true)}
                    className="ui-btn ui-btn-secondary py-1 px-2.5 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Pilih / Upload Media</span>
                  </button>
                </div>

                {postMedia.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {postMedia.map((m) => (
                      <div
                        key={m.id}
                        className="relative group rounded-lg overflow-hidden border border-slate-300 bg-white w-20 h-20 shadow-xs"
                      >
                        {m.file_type === 'video' ? (
                          <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white text-[10px] font-bold">
                            VIDEO
                          </div>
                        ) : (
                          <Image
                            src={m.thumbnail_url || m.file_url}
                            alt={m.title || 'Media'}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setPostMedia((prev) => prev.filter((item) => item.id !== m.id))}
                          className="absolute top-1 right-1 bg-rose-600 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow-xs"
                          title="Hapus Media"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    Belum ada media terlampir. Anda dapat mengupload foto/video atau memilih dari pustaka media.
                  </p>
                )}
              </div>

              {/* Google Docs & Cloud Links AttachmentManager (Poin 3!) */}
              <div className="pt-2 border-t border-slate-200">
                <AttachmentManager
                  attachments={postAttachments}
                  onChange={setPostAttachments}
                  label="Lampiran Google Docs & Dokumen Pendukung"
                  helperText="Tautkan file Google Docs naskah, folder footage Google Drive, atau link referensi."
                />
              </div>

              {/* Scheduled Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label htmlFor="schedule-post-time" className="block text-xs font-semibold text-slate-700 mb-1">
                    Waktu Tayang
                  </label>
                  <input
                    id="schedule-post-time"
                    type="datetime-local"
                    value={postDate}
                    onChange={(e) => setPostDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono focus:bg-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="ui-btn ui-btn-secondary py-1.5 text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPost}
                  className="ui-btn ui-btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmittingPost ? 'Menyimpan...' : 'Jadwalkan Postingan'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* ========================================================================= */
            /* TAB 2: SHOOTING SESSION FORM                                              */
            /* ========================================================================= */
            <form onSubmit={handleShootingSubmit} className="space-y-4">
              {/* Kanban Idea Selector */}
              {kanbanIdeas.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <label htmlFor="schedule-kanban-idea" className="block text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-slate-700" />
                    <span>Ambil dari Ide Kanban (Opsional)</span>
                  </label>
                  <select
                    id="schedule-kanban-idea"
                    value={selectedIdeaId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedIdeaId(id);
                      if (id) {
                        const found = kanbanIdeas.find((i) => i.id === id);
                        if (found) {
                          setShootTitle(found.title);
                          if (found.content) setShootDescription(found.content);
                        }
                      }
                    }}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:outline-none"
                  >
                    <option value="">-- Buat Manual / Tanpa Tautan Ide --</option>
                    {kanbanIdeas.map((idea) => (
                      <option key={idea.id} value={idea.id}>
                        {idea.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="shooting-title" className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Sesi Shooting <span className="text-rose-500">*</span>
                </label>
                <input
                  id="shooting-title"
                  type="text"
                  value={shootTitle}
                  onChange={(e) => setShootTitle(e.target.value)}
                  placeholder="Contoh: Shooting Video Reels Edukasi Ep. 12"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="shooting-location" className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>Lokasi Shooting</span>
                  </label>
                  <input
                    id="shooting-location"
                    type="text"
                    value={shootLocation}
                    onChange={(e) => setShootLocation(e.target.value)}
                    placeholder="Studio Utama WIG / Outdoor"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="shooting-status" className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Produksi
                  </label>
                  <select
                    id="shooting-status"
                    value={shootStatus}
                    onChange={(e) => setShootStatus(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                  >
                    <option value="planned">Rencana</option>
                    <option value="confirmed">Terkonfirmasi</option>
                    <option value="in_progress">Sedang Berlangsung</option>
                    <option value="completed">Selesai Shooting</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="shooting-start" className="block text-xs font-semibold text-slate-700 mb-1">
                    Mulai Jam
                  </label>
                  <input
                    id="shooting-start"
                    type="datetime-local"
                    value={shootScheduledAt}
                    onChange={(e) => setShootScheduledAt(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="shooting-end" className="block text-xs font-semibold text-slate-700 mb-1">
                    Selesai Estimasi
                  </label>
                  <input
                    id="shooting-end"
                    type="datetime-local"
                    value={shootEndAt}
                    onChange={(e) => setShootEndAt(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono"
                  />
                </div>
              </div>

              {/* Shooting Description with RichContentEditor (Poin 1!) */}
              <div>
                <RichContentEditor
                  id="shooting-description"
                  label="Brief & Catatan Produksi"
                  value={shootDescription}
                  onChange={setShootDescription}
                  minHeight="160px"
                  placeholder="Konsep visual, skrip singkat, alur video, atau catatan teknis untuk tim..."
                />
              </div>

              {/* Crew Members */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-700" />
                  <span>Kru & Talent Terlibat</span>
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCrewName}
                    onChange={(e) => setNewCrewName(e.target.value)}
                    placeholder="Nama kru / talent..."
                    className="flex-1 text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  />
                  <input
                    type="text"
                    value={newCrewRole}
                    onChange={(e) => setNewCrewRole(e.target.value)}
                    placeholder="Peran"
                    className="w-32 text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newCrewName.trim()) return;
                      setCrewList((prev) => [...prev, { name: newCrewName, role: newCrewRole }]);
                      setNewCrewName('');
                    }}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800"
                  >
                    + Tambah
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {crewList.map((c, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 flex items-center gap-1.5"
                    >
                      <strong>{c.name}</strong> ({c.role})
                      <button
                        type="button"
                        onClick={() => setCrewList((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-slate-400 hover:text-rose-500 ml-1 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Attachment Manager */}
              <div className="pt-2 border-t border-slate-200">
                <AttachmentManager
                  attachments={shootAttachments}
                  onChange={setShootAttachments}
                  label="Call Sheet & Tautan Dokumen Shooting"
                  helperText="Lampirkan Call Sheet PDF, script naskah, atau link Google Drive footage."
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="ui-btn ui-btn-secondary py-1.5 text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingShoot}
                  className="ui-btn ui-btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Clapperboard className="w-3.5 h-3.5" />
                  <span>{isSubmittingShoot ? 'Menyimpan...' : 'Simpan Sesi Shooting'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        initialSelectedIds={postMedia.map((m) => m.id)}
        onSelectMedia={(items) => {
          setPostMedia(items);
          if (items.length > 0) {
            toast.success('Media Dilampirkan', `${items.length} file media ditambahkan ke postingan.`);
          }
        }}
      />
    </div>
  );
}
