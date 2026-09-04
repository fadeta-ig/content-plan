'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { KanbanCard, AttachmentItem } from '@/lib/types';
import { api, getErrorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import AttachmentManager from '@/components/ui/AttachmentManager';
import RichContentEditor from '@/components/ui/RichContentEditor';
import {
  DRAFT_KEYS,
  KanbanIdeaDraftData,
  StoredDraftEnvelope,
  getDraft,
  saveDraft,
  clearDraft,
  formatDraftTimeAgo,
} from '@/lib/draftStorage';

interface CreateIdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCard: KanbanCard, targetColumnId: string) => void;
}

export default function CreateIdeaModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateIdeaModalProps) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('unassigned');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [ideaDraftEnvelope, setIdeaDraftEnvelope] = useState<StoredDraftEnvelope<KanbanIdeaDraftData> | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const creatingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    creatingRef.current = creating;
  }, [creating]);

  // Keyboard accessibility: Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    titleInputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creatingRef.current) {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  // Check for saved draft on modal open
  useEffect(() => {
    if (!isOpen) return;
    const draft = getDraft<KanbanIdeaDraftData>(DRAFT_KEYS.KANBAN_IDEA);
    if (
      draft &&
      (draft.data.title?.trim() ||
        draft.data.content?.trim() ||
        (draft.data.attachments && draft.data.attachments.length > 0))
    ) {
      setIdeaDraftEnvelope(draft);
    }
  }, [isOpen]);

  // Restore draft handler
  const handleRestoreDraft = () => {
    if (!ideaDraftEnvelope) return;
    const d = ideaDraftEnvelope.data;
    if (d.title !== undefined) setTitle(d.title);
    if (d.content !== undefined) setContent(d.content);
    if (d.status !== undefined) setStatus(d.status);
    if (d.attachments) setAttachments(d.attachments);
    setIdeaDraftEnvelope(null);
    toast.success('Draf Ide Dipulihkan', 'Judul dan catatan naskah ide dari draf lokal berhasil dipulihkan.');
  };

  // Discard draft handler
  const handleDiscardDraft = () => {
    clearDraft(DRAFT_KEYS.KANBAN_IDEA);
    setIdeaDraftEnvelope(null);
    toast.info('Draf Dihapus', 'Draf ide lokal telah dibersihkan.');
  };

  // Debounced auto-save effect
  useEffect(() => {
    if (!isOpen) return;
    const hasContent = title.trim().length > 0 || content.trim().length > 0 || attachments.length > 0;
    if (!hasContent) return;

    const timer = setTimeout(() => {
      saveDraft<KanbanIdeaDraftData>(DRAFT_KEYS.KANBAN_IDEA, {
        title,
        content,
        status,
        attachments,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, title, content, status, attachments]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Judul Diperlukan', 'Harap masukkan judul ide konten.');
      return;
    }

    setCreating(true);
    try {
      const res = await api.createIdea({
        title: title.trim(),
        content: content.trim(),
        status: status || 'unassigned',
        attachments,
      });

      const newCard: KanbanCard = {
        id: res.idea?.id || `c-${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        status: status || 'unassigned',
        attachments,
        created_at: res.idea?.created_at || 'Hari Ini',
      };

      clearDraft(DRAFT_KEYS.KANBAN_IDEA);
      setIdeaDraftEnvelope(null);
      toast.success('Ide Disimpan', `Ide "${title}" berhasil ditambahkan ke database.`);
      setTitle('');
      setContent('');
      setStatus('unassigned');
      setAttachments([]);
      onSuccess(newCard, status || 'unassigned');
    } catch (error: unknown) {
      toast.error('Gagal Menyimpan Ide', getErrorMessage(error, 'Terjadi kesalahan saat menyimpan ide.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-idea-title"
        className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center border border-blue-200/60">
              <Plus className="w-4 h-4" />
            </div>
            <h3 id="create-idea-title" className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Tambah Ide Konten Baru
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir tambah ide"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
            {/* Draft Restoration Banner */}
            {ideaDraftEnvelope && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-900">
                      Draf Ide Ditemukan ({formatDraftTimeAgo(ideaDraftEnvelope.savedAt)})
                    </p>
                    <p className="text-[11px] text-amber-700 truncate">
                      Pulihkan judul & naskah ide dari draf lokal Anda?
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleRestoreDraft}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded-lg shadow-xs transition flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Pulihkan</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="px-2 py-1 text-[11px] text-amber-800 hover:text-amber-950 font-medium hover:bg-amber-100 rounded-lg transition"
                  >
                    Abaikan
                  </button>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="idea-title" className="text-xs font-semibold text-slate-700 block mb-1">
                Judul Ide / Topik Konten <span className="text-rose-500">*</span>:
              </label>
              <input
                ref={titleInputRef}
                type="text"
                id="idea-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Ngobrol Santai: Cerita di Balik Layar"
                className="ui-input text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Naskah Brief / Rundown Konsep:
              </label>
              <RichContentEditor
                value={content}
                onChange={setContent}
                placeholder="Tema, durasi, format, naskah alur pembicaraan, outline poin-poin ide, hook..."
                minHeight="200px"
              />
            </div>

            {/* Attachment Manager */}
            <div className="pt-1 border-t border-slate-100">
              <AttachmentManager
                attachments={attachments}
                onChange={setAttachments}
                disabled={creating}
                label="Lampiran & Tautan Referensi"
                helperText="Lampirkan dokumen naskah (PDF/Word), link Google Docs/Drive, atau Notion."
              />
            </div>

            <div>
              <label htmlFor="idea-status" className="text-xs font-semibold text-slate-700 block mb-1">
                Tahap Awal Kanban:
              </label>
              <select
                id="idea-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="ui-input text-xs"
              >
                <option value="unassigned">Ide / Backlog</option>
                <option value="todo">Rencana</option>
                <option value="in_progress">Dalam Penulisan</option>
                <option value="done">Siap Dijadwalkan</option>
              </select>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              Naskah ide dapat langsung ditinjau dan diedit setelah disimpan.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="ui-btn ui-btn-secondary text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={creating}
                className="ui-btn ui-btn-primary text-xs"
              >
                {creating ? 'Menyimpan...' : 'Simpan & Buka Naskah'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
