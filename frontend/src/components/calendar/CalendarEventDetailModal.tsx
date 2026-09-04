'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  X,
  Clapperboard,
  Share2,
  MapPin,
  Clock,
  Users,
  CheckSquare,
  Square,
  Sparkles,
  Trash2,
  PenSquare,
  Paperclip,
  ExternalLink,
  Plus,
  Check,
  Image as ImageIcon,
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
import SocialPostMockup from '@/components/ui/SocialPostMockup';
import RichContentEditor from '@/components/ui/RichContentEditor';
import RichTextRenderer from '@/components/ui/RichTextRenderer';
import AttachmentManager from '@/components/ui/AttachmentManager';
import AttachmentList from '@/components/ui/AttachmentList';
import MediaPickerModal from '@/components/composer/MediaPickerModal';
import { formatHandle } from '@/lib/format';
import SocialIcon from '@/components/ui/SocialIcon';

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface CalendarEventDetailModalProps {
  event: CalendarEvent | null;
  onClose: () => void;
  connectedAccounts: SocialAccount[];
  onEventUpdated: (updatedEvent: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onToggleEquipment: (itemIdx: number) => void;
}

export default function CalendarEventDetailModal({
  event,
  onClose,
  connectedAccounts,
  onEventUpdated,
  onDelete,
  onToggleEquipment,
}: CalendarEventDetailModalProps) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit Post State
  const [editPostCaption, setEditPostCaption] = useState('');
  const [editPostDate, setEditPostDate] = useState('');
  const [editPostAccountIds, setEditPostAccountIds] = useState<string[]>([]);
  const [editPostMedia, setEditPostMedia] = useState<MediaItem[]>([]);
  const [editPostAttachments, setEditPostAttachments] = useState<AttachmentItem[]>([]);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);

  // Edit Shooting State
  const [editShootTitle, setEditShootTitle] = useState('');
  const [editShootDescription, setEditShootDescription] = useState('');
  const [editShootLocation, setEditShootLocation] = useState('');
  const [editShootScheduledAt, setEditShootScheduledAt] = useState('');
  const [editShootEndAt, setEditShootEndAt] = useState('');
  const [editShootStatus, setEditShootStatus] = useState('planned');
  const [editShootCrew, setEditShootCrew] = useState<ShootingCrewMember[]>([]);
  const [editShootEquipment, setEditShootEquipment] = useState<ShootingEquipmentItem[]>([]);
  const [editShootAttachments, setEditShootAttachments] = useState<AttachmentItem[]>([]);
  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewRole, setNewCrewRole] = useState('Talent / Host');

  // Sync editing form with active event
  useEffect(() => {
    if (!event) return;
    setIsEditing(false);

    if (event.type === 'shooting') {
      setEditShootTitle(event.title || '');
      setEditShootDescription(event.description || '');
      setEditShootLocation(event.location || '');
      setEditShootScheduledAt(event.start ? formatDateTimeLocal(new Date(event.start)) : '');
      setEditShootEndAt(event.end ? formatDateTimeLocal(new Date(event.end)) : '');
      setEditShootStatus(event.status || 'planned');
      setEditShootCrew(event.crew_members || []);
      setEditShootEquipment(event.equipment_checklist || []);
      setEditShootAttachments(event.attachments || []);
    } else {
      setEditPostCaption(event.caption || event.title || '');
      setEditPostDate(event.start ? formatDateTimeLocal(new Date(event.start)) : '');
      const existingAccountIds = event.accounts?.map((a) => a.id) || [];
      if (existingAccountIds.length > 0) {
        setEditPostAccountIds(existingAccountIds);
      } else if (connectedAccounts.length > 0) {
        setEditPostAccountIds([connectedAccounts[0].id]);
      }
      setEditPostMedia(event.media || []);
      setEditPostAttachments(event.attachments || []);
    }
  }, [event, connectedAccounts]);

  // Trap focus and close on Escape
  useEffect(() => {
    if (!event) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [event, isSaving, onClose]);

  if (!event) return null;

  const isShooting = event.type === 'shooting';

  const toggleAccountSelection = (accountId: string) => {
    setEditPostAccountIds((prev) =>
      prev.includes(accountId)
        ? prev.length > 1
          ? prev.filter((id) => id !== accountId)
          : prev
        : [...prev, accountId]
    );
  };

  // Save Edit Post Handler
  const handleSaveEditPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPostCaption.trim()) {
      toast.error('Validasi Gagal', 'Caption postingan tidak boleh kosong.');
      return;
    }
    if (editPostAccountIds.length === 0) {
      toast.error('Validasi Gagal', 'Pilih minimal satu akun sosial tujuan.');
      return;
    }

    setIsSaving(true);
    try {
      await api.createPost({
        post_id: event.id,
        master_caption: editPostCaption,
        target_account_ids: editPostAccountIds,
        scheduled_at: editPostDate,
        media_ids: editPostMedia.map((m) => m.id),
        attachments: editPostAttachments,
      });

      const selectedAccObjects = connectedAccounts.filter((a) => editPostAccountIds.includes(a.id));
      const targetPlats = Array.from(new Set(selectedAccObjects.map((a) => a.platform)));

      const updatedEv: CalendarEvent = {
        ...event,
        title: editPostCaption.slice(0, 100),
        caption: editPostCaption,
        start: editPostDate,
        platforms: targetPlats.length > 0 ? targetPlats : event.platforms,
        accounts: selectedAccObjects.map((a) => ({
          id: a.id,
          platform: a.platform,
          account_name: a.account_name,
          account_handle: a.account_handle,
          avatar_url: a.avatar_url,
        })),
        media: editPostMedia,
        attachments: editPostAttachments,
      };

      onEventUpdated(updatedEv);
      setIsEditing(false);
      toast.success('Postingan Diperbarui', 'Perubahan konten postingan berhasil disimpan ke kalender.');
    } catch (error: unknown) {
      toast.error('Gagal Memperbarui', getErrorMessage(error, 'Tidak dapat memperbarui postingan.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Save Edit Shooting Handler
  const handleSaveEditShooting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShootTitle.trim()) {
      toast.error('Validasi Gagal', 'Judul sesi shooting wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      const cleanCrew = editShootCrew.filter((c) => c.name.trim().length > 0);
      const cleanEquipment = editShootEquipment.filter((eq) => eq.item.trim().length > 0);

      await api.updateShootingSession(event.id, {
        title: editShootTitle,
        description: editShootDescription,
        location: editShootLocation,
        scheduled_at: editShootScheduledAt,
        end_at: editShootEndAt || undefined,
        status: editShootStatus,
        crew_members: cleanCrew,
        equipment_checklist: cleanEquipment,
        attachments: editShootAttachments,
      });

      const updatedEv: CalendarEvent = {
        ...event,
        title: editShootTitle,
        description: editShootDescription,
        location: editShootLocation,
        start: editShootScheduledAt,
        end: editShootEndAt || null,
        status: editShootStatus,
        crew_members: cleanCrew,
        equipment_checklist: cleanEquipment,
        attachments: editShootAttachments,
      };

      onEventUpdated(updatedEv);
      setIsEditing(false);
      toast.success('Sesi Shooting Diperbarui', 'Perubahan rencana shooting berhasil disimpan.');
    } catch (error: unknown) {
      toast.error('Gagal Memperbarui', getErrorMessage(error, 'Tidak dapat memperbarui sesi shooting.'));
    } finally {
      setIsSaving(false);
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
        aria-labelledby="calendar-event-detail-title"
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              {isShooting ? <Clapperboard className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </div>
            <div>
              <h3 id="calendar-event-detail-title" className="text-sm font-bold text-slate-900">
                {isEditing
                  ? isShooting
                    ? 'Edit Sesi Shooting'
                    : 'Edit Postingan Terjadwal'
                  : isShooting
                  ? 'Detail Sesi Shooting'
                  : 'Detail & Pratinjau Postingan'}
              </h3>
              <span className="text-[10.5px] text-slate-500">
                {isShooting ? 'Produksi Studio & Take Konten' : 'Publikasi Multi-Channel'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="ui-btn ui-btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 font-semibold"
              >
                <PenSquare className="w-3.5 h-3.5 text-slate-700" />
                <span>Edit Agenda</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup detail agenda"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* ========================================================================= */}
          {/* VIEW MODE: REALISTIC SOCIAL MOCKUP & DETAILED METRICS                     */}
          {/* ========================================================================= */}
          {!isEditing ? (
            <div className="space-y-4">
              {/* Linked Idea / Brief Source Badge */}
              {event.related_idea_title && (
                <div className="flex items-center justify-between p-2.5 bg-blue-50/80 rounded-xl border border-blue-200/80 text-xs">
                  <div className="flex items-center gap-2 text-blue-900">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>
                      Diambil dari Ide / Brief: <strong>{event.related_idea_title}</strong>
                    </span>
                  </div>
                  {event.related_idea_id && (
                    <Link
                      href={`/kanban`}
                      className="text-[11px] font-semibold text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <span>Lihat Kanban</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              )}

              {/* POST VIEW: REALISTIC SOCIAL MEDIA MOCKUP (Poin 2!) */}
              {!isShooting ? (
                <div className="space-y-3">
                  {/* Account Badge Indicator (Poin 4!) */}
                  {event.accounts && event.accounts.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500 mr-1">Target Akun:</span>
                      {event.accounts.map((acc) => (
                        <span
                          key={acc.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800"
                        >
                          <SocialIcon platform={acc.platform} size={13} />
                          <span>{acc.account_name}</span>
                          <span className="text-slate-400 text-[10.5px]">({formatHandle(acc.account_handle || acc.account_name)})</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Realistic Mockup Component */}
                  <SocialPostMockup
                    platform={event.platforms?.[0] || 'instagram'}
                    caption={event.caption || event.title}
                    media={event.media || []}
                    accountName={event.accounts?.[0]?.account_name || 'PT Wijaya Inovasi Gemilang'}
                    accountHandle={formatHandle(event.accounts?.[0]?.account_handle) || 'wijaya_official'}
                    avatarUrl={event.accounts?.[0]?.avatar_url}
                    firstComment={event.first_comment}
                    scheduledAt={event.start}
                    availablePlatforms={event.platforms && event.platforms.length > 0 ? event.platforms : ['instagram', 'tiktok', 'linkedin', 'facebook']}
                  />

                  {/* Google Docs & Attachments in Detail View (Poin 3!) */}
                  {event.attachments && event.attachments.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-slate-600" />
                        <span>Dokumen &amp; Link Google Docs Terlampir ({event.attachments.length}):</span>
                      </h4>
                      <AttachmentList attachments={event.attachments} />
                    </div>
                  )}
                </div>
              ) : (
                /* SHOOTING SESSION VIEW */
                <div className="space-y-3.5 text-xs">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{event.title}</h3>
                    <div className="flex items-center gap-3 text-slate-500 mt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {event.start
                            ? new Date(event.start).toLocaleString('id-ID', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </span>
                      </span>

                      {event.location && (
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{event.location}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Formatted Shooting Description */}
                  {event.description && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                        Brief &amp; Rundown Produksi:
                      </span>
                      <RichTextRenderer content={event.description} />
                    </div>
                  )}

                  {/* Equipment Checklist */}
                  {event.equipment_checklist && event.equipment_checklist.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                        <CheckSquare className="w-3.5 h-3.5 text-slate-700" />
                        <span>Checklist Peralatan (Klik untuk centang)</span>
                      </span>
                      <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        {event.equipment_checklist.map((eq, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => onToggleEquipment(idx)}
                            aria-pressed={eq.checked}
                            className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-white text-left transition text-xs select-none"
                          >
                            {eq.checked ? (
                              <CheckSquare className="w-4 h-4 text-slate-900 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span
                              className={
                                eq.checked ? 'line-through text-slate-400 font-normal' : 'text-slate-800 font-medium'
                              }
                            >
                              {eq.item}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Crew List */}
                  {event.crew_members && event.crew_members.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-700" />
                        <span>Daftar Kru &amp; Talent:</span>
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {event.crew_members.map((c, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs text-slate-700 font-medium border border-slate-200"
                          >
                            <strong>{c.name}</strong> <span className="text-slate-400">({c.role})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {event.attachments && event.attachments.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                        <Paperclip className="w-3.5 h-3.5 text-slate-700" />
                        <span>Lampiran Dokumen &amp; Call Sheet ({event.attachments.length})</span>
                      </span>
                      <AttachmentList attachments={event.attachments} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* EDIT MODE: FULL INLINE EDITOR FOR POST & SHOOTING (Poin 5!)               */
            /* ========================================================================= */
            <div className="space-y-4">
              {!isShooting ? (
                /* FORM EDIT POSTINGAN */
                <form onSubmit={handleSaveEditPost} className="space-y-4">
                  {/* Account Selector in Edit Mode */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                        Target Akun Sosial <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-slate-500">
                        {editPostAccountIds.length} dari {connectedAccounts.length} Akun Dipilih
                      </span>
                    </div>

                    {/* Multi-Account Quick Selectors */}
                    {connectedAccounts.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] font-semibold text-slate-500 mr-1 uppercase tracking-wider">
                          Pilihan Cepat:
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditPostAccountIds(connectedAccounts.map((a) => a.id))}
                          className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition shadow-2xs"
                        >
                          Pilih Semua ({connectedAccounts.length})
                        </button>
                        {Array.from(new Set(connectedAccounts.map((a) => a.platform))).map((plat) => {
                          const platAccs = connectedAccounts.filter((a) => a.platform === plat);
                          const platLabel = plat.charAt(0).toUpperCase() + plat.slice(1);
                          const isAllPlatSelected = platAccs.every((a) => editPostAccountIds.includes(a.id));
                          return (
                            <button
                              key={plat}
                              type="button"
                              onClick={() => {
                                const platIds = platAccs.map((a) => a.id);
                                if (isAllPlatSelected) {
                                  const remaining = editPostAccountIds.filter((id) => !platIds.includes(id));
                                  setEditPostAccountIds(remaining.length > 0 ? remaining : [platIds[0]]);
                                } else {
                                  setEditPostAccountIds(Array.from(new Set([...editPostAccountIds, ...platIds])));
                                }
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border transition shadow-2xs ${
                                isAllPlatSelected
                                  ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <SocialIcon platform={plat} size={11} />
                              <span>Semua {platLabel} ({platAccs.length})</span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setEditPostAccountIds([connectedAccounts[0]?.id].filter(Boolean))}
                          className="px-2 py-0.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition ml-auto"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {connectedAccounts.map((account) => {
                        const isSelected = editPostAccountIds.includes(account.id);
                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => toggleAccountSelection(account.id)}
                            aria-pressed={isSelected}
                            className={`p-2 rounded-xl border text-left flex items-center justify-between gap-2 transition ${
                              isSelected
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                                {account.avatar_url ? (
                                  <Image src={account.avatar_url} alt="" width={24} height={24} className="w-full h-full object-cover" />
                                ) : (
                                  <SocialIcon platform={account.platform} size={12} />
                                )}
                              </div>
                              <span className="font-semibold text-xs truncate">
                                {account.account_name} ({formatHandle(account.account_handle)})
                              </span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* RichContentEditor for Caption in Edit Mode */}
                  <div>
                    <RichContentEditor
                      id="edit-post-caption"
                      label="Konten Caption"
                      value={editPostCaption}
                      onChange={setEditPostCaption}
                      minHeight="220px"
                      required
                    />
                  </div>

                  {/* Media Upload / Attachment in Edit Mode */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                        <span>Media Terlampir ({editPostMedia.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsMediaPickerOpen(true)}
                        className="ui-btn ui-btn-secondary py-1 px-2.5 text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Pilih / Upload Media</span>
                      </button>
                    </div>

                    {editPostMedia.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {editPostMedia.map((m) => (
                          <div
                            key={m.id}
                            className="relative group rounded-lg overflow-hidden border border-slate-300 bg-white w-20 h-20 shadow-xs"
                          >
                            <Image
                              src={m.thumbnail_url || m.file_url}
                              alt=""
                              width={80}
                              height={80}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setEditPostMedia((prev) => prev.filter((item) => item.id !== m.id))}
                              className="absolute top-1 right-1 bg-rose-600 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attachments in Edit Mode */}
                  <div className="pt-2 border-t border-slate-200">
                    <AttachmentManager
                      attachments={editPostAttachments}
                      onChange={setEditPostAttachments}
                      label="Lampiran Dokumen Google Docs / Drive"
                      helperText="Tautkan dokumen Google Docs naskah, link GDrive footage, dll."
                    />
                  </div>

                  {/* Scheduled Time */}
                  <div>
                    <label htmlFor="edit-post-time" className="block text-xs font-semibold text-slate-700 mb-1">
                      Waktu Tayang Terjadwal
                    </label>
                    <input
                      id="edit-post-time"
                      type="datetime-local"
                      value={editPostDate}
                      onChange={(e) => setEditPostDate(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono"
                      required
                    />
                  </div>

                  {/* Action Buttons in Edit Form */}
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setIsEditing(false)}
                      className="ui-btn ui-btn-secondary text-xs py-1.5"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="ui-btn ui-btn-primary text-xs py-1.5 px-3 font-semibold"
                    >
                      {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                </form>
              ) : (
                /* FORM EDIT SESI SHOOTING */
                <form onSubmit={handleSaveEditShooting} className="space-y-4">
                  <div>
                    <label htmlFor="edit-shoot-title" className="block text-xs font-semibold text-slate-700 mb-1">
                      Judul Sesi Shooting <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="edit-shoot-title"
                      type="text"
                      value={editShootTitle}
                      onChange={(e) => setEditShootTitle(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-shoot-location" className="block text-xs font-semibold text-slate-700 mb-1">
                        Lokasi Shooting
                      </label>
                      <input
                        id="edit-shoot-location"
                        type="text"
                        value={editShootLocation}
                        onChange={(e) => setEditShootLocation(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-shoot-status" className="block text-xs font-semibold text-slate-700 mb-1">
                        Status Produksi
                      </label>
                      <select
                        id="edit-shoot-status"
                        value={editShootStatus}
                        onChange={(e) => setEditShootStatus(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50"
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
                      <label htmlFor="edit-shoot-start" className="block text-xs font-semibold text-slate-700 mb-1">
                        Mulai Jam
                      </label>
                      <input
                        id="edit-shoot-start"
                        type="datetime-local"
                        value={editShootScheduledAt}
                        onChange={(e) => setEditShootScheduledAt(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-shoot-end" className="block text-xs font-semibold text-slate-700 mb-1">
                        Selesai Estimasi
                      </label>
                      <input
                        id="edit-shoot-end"
                        type="datetime-local"
                        value={editShootEndAt}
                        onChange={(e) => setEditShootEndAt(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono"
                      />
                    </div>
                  </div>

                  {/* RichContentEditor for Brief in Edit Mode */}
                  <div>
                    <RichContentEditor
                      id="edit-shoot-description"
                      label="Brief & Catatan Produksi"
                      value={editShootDescription}
                      onChange={setEditShootDescription}
                      minHeight="160px"
                    />
                  </div>

                  {/* Crew Manager */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-700" />
                      <span>Kru &amp; Talent Terlibat</span>
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
                          setEditShootCrew((prev) => [...prev, { name: newCrewName, role: newCrewRole }]);
                          setNewCrewName('');
                        }}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium"
                      >
                        + Tambah
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {editShootCrew.map((c, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 flex items-center gap-1.5"
                        >
                          <strong>{c.name}</strong> ({c.role})
                          <button
                            type="button"
                            onClick={() => setEditShootCrew((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-slate-400 hover:text-rose-500 ml-1 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Attachments */}
                  <div className="pt-2 border-t border-slate-200">
                    <AttachmentManager
                      attachments={editShootAttachments}
                      onChange={setEditShootAttachments}
                      label="Call Sheet & Dokumen Shooting"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setIsEditing(false)}
                      className="ui-btn ui-btn-secondary text-xs py-1.5"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="ui-btn ui-btn-primary text-xs py-1.5 px-3 font-semibold"
                    >
                      {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer (When NOT Editing) */}
        {!isEditing && (
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onDelete(event)}
              className="px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Agenda</span>
            </button>

            <div className="flex items-center gap-2">
              {!isShooting && (
                <Link
                  href={`/composer?post_id=${event.id}`}
                  className="ui-btn ui-btn-secondary text-xs py-1.5 flex items-center gap-1.5"
                  title="Buka postingan ini di Full Composer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka di Composer</span>
                </Link>
              )}

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="ui-btn ui-btn-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5 font-semibold shadow-xs"
              >
                <PenSquare className="w-3.5 h-3.5" />
                <span>Edit {isShooting ? 'Sesi Shooting' : 'Postingan'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="ui-btn ui-btn-secondary text-xs py-1.5"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        initialSelectedIds={editPostMedia.map((m) => m.id)}
        onSelectMedia={(items) => {
          setEditPostMedia(items);
          if (items.length > 0) {
            toast.success('Media Dilampirkan', `${items.length} file media ditambahkan.`);
          }
        }}
      />
    </div>
  );
}
