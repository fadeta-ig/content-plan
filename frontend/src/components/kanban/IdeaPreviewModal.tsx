'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  PenSquare,
  ArrowRight,
  Trash2,
  Check,
  Copy,
  FileText,
  Clapperboard,
} from 'lucide-react';
import { KanbanCard } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { api, getErrorMessage } from '@/lib/api';

const STATUS_STEPS = [
  { id: 'unassigned', label: 'Ide / Backlog', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { id: 'todo', label: 'Rencana', color: 'bg-blue-50 text-blue-700 border-blue-300' },
  { id: 'in_progress', label: 'Dalam Penulisan', color: 'bg-amber-50 text-amber-700 border-amber-300' },
  { id: 'done', label: 'Siap Dijadwalkan', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
];

interface IdeaPreviewModalProps {
  idea: KanbanCard;
  columnId: string;
  onClose: () => void;
  onUpdateIdea: (updatedCard: KanbanCard, newColumnId?: string) => void;
  onDeleteIdea: (cardId: string, title: string) => void;
}

export default function IdeaPreviewModal({
  idea,
  columnId,
  onClose,
  onUpdateIdea,
  onDeleteIdea,
}: IdeaPreviewModalProps) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(idea.title);
  const [editContent, setEditContent] = useState(idea.content || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentColumn, setCurrentColumn] = useState(columnId || idea.status || 'unassigned');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const savingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      toast.error('Judul Diperlukan', 'Judul ide tidak boleh kosong.');
      return;
    }

    setSaving(true);
    try {
      await api.updateIdea(idea.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
      });

      const updated: KanbanCard = {
        ...idea,
        title: editTitle.trim(),
        content: editContent.trim(),
      };

      onUpdateIdea(updated);
      setIsEditing(false);
      toast.success('Naskah Diperbarui', 'Perubahan judul dan naskah ide berhasil disimpan.');
    } catch (error: unknown) {
      toast.error('Gagal Memperbarui', getErrorMessage(error, 'Gagal menyimpan perubahan.'));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentColumn) return;

    try {
      await api.updateIdeaStatus(idea.id, newStatus);
      const updated: KanbanCard = { ...idea, status: newStatus };
      setCurrentColumn(newStatus);
      onUpdateIdea(updated, newStatus);
      toast.success('Tahap Diperbarui', `Status ide dipindahkan ke "${STATUS_STEPS.find((s) => s.id === newStatus)?.label}".`);
    } catch (error: unknown) {
      toast.error('Gagal Memperbarui Status', getErrorMessage(error, 'Gagal memperbarui status ide.'));
    }
  };

  const handleCopyScript = () => {
    const textToCopy = `${idea.title}\n\n${idea.content || ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.info('Naskah Disalin', 'Judul dan brief naskah telah disalin ke clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoToComposer = () => {
    const queryParams = new URLSearchParams({
      idea_id: idea.id,
      title: idea.title,
      content: idea.content || '',
    });
    router.push(`/composer?${queryParams.toString()}`);
  };

  const handleGoToShooting = () => {
    onClose();
    const queryParams = new URLSearchParams({
      idea_id: idea.id,
      action: 'shoot',
    });
    router.push(`/calendar?${queryParams.toString()}`);
  };

  const handleDelete = () => {
    confirm({
      title: 'Hapus Ide Konten?',
      message: `Apakah Anda yakin ingin menghapus ide "${idea.title}"?`,
      confirmText: 'Ya, Hapus Ide',
      type: 'danger',
      onConfirm: () => {
        onDeleteIdea(idea.id, idea.title);
        onClose();
      },
    });
  };

  // Keyboard accessibility: Close on Escape
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingRef.current) {
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
  }, []);

  // Word count & read time estimations
  const totalWords = (idea.content || '').trim().split(/\s+/).filter(Boolean).length;
  const estimatedReadMinutes = Math.max(1, Math.ceil(totalWords / 130));

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
        aria-labelledby="idea-preview-title"
        className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/60">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 id="idea-preview-title" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Pratinjau Naskah &amp; Brief Ide
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white border border-slate-200 text-slate-600">
                  {idea.created_at || 'Hari Ini'}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900 truncate">
                {idea.title}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 p-1.5 rounded-lg transition"
            title="Tutup Pratinjau"
            aria-label="Tutup pratinjau ide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Status Stepper */}
          <div className="space-y-1.5">
            <p id="idea-status-label" className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide block">
              Tahap Produksi Ide:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="group" aria-labelledby="idea-status-label">
              {STATUS_STEPS.map((step) => {
                const isActive = currentColumn === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleStatusChange(step.id)}
                    aria-pressed={isActive}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border flex items-center justify-between transition ${
                      isActive
                        ? `${step.color} ring-2 ring-blue-500/20 shadow-xs`
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{step.label}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-current" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inline Edit Form vs Document Reader Sheet */}
          {isEditing ? (
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <PenSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>Edit Judul &amp; Naskah Brief</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label htmlFor="edit-idea-title" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Judul Ide / Topik:
                  </label>
                  <input
                    id="edit-idea-title"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="ui-input bg-white text-xs"
                    placeholder="Judul ide..."
                  />
                </div>

                <div>
                  <label htmlFor="edit-idea-content" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Rundown Naskah / Detail Brief:
                  </label>
                  <textarea
                    id="edit-idea-content"
                    rows={12}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-md p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                    placeholder="Rincian alur pembahasan, target audiens, poin-poin naskah..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveEdit}
                    className="ui-btn ui-btn-primary py-1.5 text-xs"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Document Reader Sheet */
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              {/* Document Sheet Header / Toolbar */}
              <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <span className="font-semibold text-slate-700">Naskah Konsep</span>
                  <span>•</span>
                  <span>{totalWords} kata</span>
                  <span>•</span>
                  <span>~{estimatedReadMinutes} mnt durasi</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-2 py-1 rounded-md flex items-center gap-1 transition shadow-2xs font-medium"
                    title="Salin seluruh naskah ke clipboard"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Tersalin!' : 'Salin Naskah'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditTitle(idea.title);
                      setEditContent(idea.content || '');
                      setIsEditing(true);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50/80 border border-blue-200 hover:bg-blue-100 px-2 py-1 rounded-md flex items-center gap-1 transition font-medium"
                  >
                    <PenSquare className="w-3 h-3" />
                    <span>Ubah Naskah</span>
                  </button>
                </div>
              </div>

              {/* Document Sheet Body */}
              <div className="p-5 space-y-4">
                {/* Title */}
                <h2 className="text-base font-bold text-slate-900 leading-snug tracking-tight">
                  {idea.title}
                </h2>

                {/* Brief Script Content */}
                {idea.content ? (
                  <div className="text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap selection:bg-blue-100">
                    {idea.content}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs italic bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    Belum ada naskah atau brief tertulis. Klik &ldquo;Ubah Naskah&rdquo; di atas untuk menambahkan catatan naskah.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus Ide</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="ui-btn ui-btn-secondary text-xs py-1.5"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handleGoToShooting}
              className="ui-btn ui-btn-secondary text-xs py-1.5 flex items-center gap-1.5"
              title="Jadwalkan rencana sesi shooting berdasarkan ide ini"
            >
              <Clapperboard className="w-3.5 h-3.5 text-slate-700" />
              <span>Jadwalkan Shooting</span>
            </button>

            <button
              type="button"
              onClick={handleGoToComposer}
              className="ui-btn ui-btn-primary text-xs py-1.5 shadow-sm"
              title="Konversi naskah ide ini menjadi draft postingan / jadwal tayang di Composer"
            >
              <PenSquare className="w-3.5 h-3.5" />
              <span>Tulis di Composer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
