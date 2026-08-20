'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Kanban as KanbanIcon,
  Plus,
  ArrowRight,
  Trash2,
  ChevronRight,
  Layers,
  Calendar,
  X,
  Send,
  GripVertical,
} from 'lucide-react';
import { api } from '@/lib/api';
import { KanbanColumn, KanbanCard } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const STATUS_FLOW = ['unassigned', 'todo', 'in_progress', 'done'];

const COLUMN_LABELS: Record<string, string> = {
  unassigned: 'Ide / Backlog',
  todo: 'Rencana',
  in_progress: 'Dalam Penulisan',
  done: 'Siap Dijadwalkan',
};

const COLUMN_ACCENT: Record<string, string> = {
  unassigned: 'border-t-slate-400',
  todo: 'border-t-blue-500',
  in_progress: 'border-t-amber-500',
  done: 'border-t-emerald-500',
};

export default function KanbanPage() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [columns, setColumns] = useState<KanbanColumn[]>([
    { id: 'unassigned', title: 'Ide / Backlog', cards: [] },
    { id: 'todo', title: 'Rencana', cards: [] },
    { id: 'in_progress', title: 'Dalam Penulisan', cards: [] },
    { id: 'done', title: 'Siap Dijadwalkan', cards: [] },
  ]);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const dragDataRef = useRef<{ cardId: string; sourceColumnId: string } | null>(null);

  const loadKanban = async () => {
    try {
      const data = await api.getKanban();
      if (data.columns && data.columns.length > 0) {
        setColumns(data.columns);
      }
    } catch {
      // Default clean columns
    }
  };

  useEffect(() => {
    loadKanban();
  }, []);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      const res = await api.createIdea({
        title: newTitle.trim(),
        content: newContent.trim(),
        status: 'unassigned',
      });

      const newCard: KanbanCard = {
        id: res.idea?.id || `c-${Date.now()}`,
        title: newTitle.trim(),
        content: newContent.trim(),
        created_at: 'Hari Ini',
      };

      setColumns((prev) =>
        prev.map((col) => {
          if (col.id === 'unassigned') {
            return { ...col, cards: [newCard, ...col.cards] };
          }
          return col;
        })
      );

      toast.success('Ide Ditambahkan', `Ide "${newTitle}" berhasil disimpan ke database.`);
      setNewTitle('');
      setNewContent('');
      setShowModal(false);
    } catch (err: any) {
      toast.error('Gagal Menyimpan Ide', err.message || 'Gagal menyimpan ke database.');
    } finally {
      setCreating(false);
    }
  };

  const handleMoveStatus = async (cardId: string, currentStatus: string) => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex >= STATUS_FLOW.length - 1) return;

    const nextStatus = STATUS_FLOW[currentIndex + 1];
    moveCardOptimistic(cardId, currentStatus, nextStatus);
    try {
      await api.updateIdeaStatus(cardId, nextStatus);
      toast.success('Status Diperbarui', 'Ide dipindahkan ke tahap berikutnya.');
    } catch (e: any) {
      // Rollback
      moveCardOptimistic(cardId, nextStatus, currentStatus);
      toast.error('Gagal Memperbarui Status', e.message || 'Terjadi kesalahan.');
    }
  };

  const moveCardOptimistic = (cardId: string, fromColumnId: string, toColumnId: string) => {
    setColumns((prev) => {
      let card: KanbanCard | null = null;
      const updated = prev.map((col) => {
        if (col.id === fromColumnId) {
          const found = col.cards.find((c) => c.id === cardId);
          if (found) card = found;
          return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
        }
        return col;
      });

      if (!card) return prev;

      return updated.map((col) => {
        if (col.id === toColumnId) {
          return { ...col, cards: [...col.cards, card!] };
        }
        return col;
      });
    });
  };

  const handleDeleteCard = (cardId: string, title: string) => {
    confirm({
      title: 'Hapus Ide Konten?',
      message: `Apakah Anda yakin ingin menghapus ide "${title}" dari papan Kanban?`,
      confirmText: 'Ya, Hapus Ide',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.deleteIdea(cardId);
          setColumns((prev) =>
            prev.map((col) => ({
              ...col,
              cards: col.cards.filter((c) => c.id !== cardId),
            }))
          );
          toast.warning('Ide Dihapus', `Ide "${title}" berhasil dihapus dari database.`);
        } catch (e: any) {
          toast.error('Gagal Menghapus', e.message || 'Gagal menghapus ide dari database.');
        }
      },
    });
  };

  // --- Drag-and-Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, cardId: string, sourceColumnId: string) => {
    dragDataRef.current = { cardId, sourceColumnId };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);

    // Make the dragged element semi-transparent
    const target = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      target.style.opacity = '0.4';
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    setDragOverColumnId(null);
    dragDataRef.current = null;
  };

  const handleColumnDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleColumnDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column container entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (relatedTarget && currentTarget.contains(relatedTarget)) return;
    setDragOverColumnId(null);
  };

  const handleColumnDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    setDragOverColumnId(null);

    const dragData = dragDataRef.current;
    if (!dragData) return;

    const { cardId, sourceColumnId } = dragData;
    if (sourceColumnId === targetColumnId) return;

    // Optimistic update
    moveCardOptimistic(cardId, sourceColumnId, targetColumnId);

    try {
      await api.updateIdeaStatus(cardId, targetColumnId);
      toast.success(
        'Ide Dipindahkan',
        `Ide berhasil dipindahkan ke "${COLUMN_LABELS[targetColumnId] || targetColumnId}".`
      );
    } catch (e: any) {
      // Rollback
      moveCardOptimistic(cardId, targetColumnId, sourceColumnId);
      toast.error('Gagal Memindahkan', e.message || 'Terjadi kesalahan saat memperbarui status.');
    }

    dragDataRef.current = null;
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            Papan Ide &amp; Alur Kerja Kanban
          </h1>
          <p className="text-xs text-slate-500">
            Kelola ide konten kreatif, status penulisan naskah, dan antrean produksi konten PT Wijaya Inovasi Gemilang.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="ui-btn ui-btn-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Ide Baru</span>
        </button>
      </div>

      {/* Drag-and-Drop hint */}
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
        <GripVertical className="w-3 h-3" />
        <span>Geser kartu antar kolom untuk memperbarui status secara langsung</span>
      </div>

      {/* Kanban Board Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {columns.map((col) => {
          const isDragOver = dragOverColumnId === col.id;
          const accentClass = COLUMN_ACCENT[col.id] || 'border-t-slate-300';

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleColumnDragOver(e, col.id)}
              onDragLeave={handleColumnDragLeave}
              onDrop={(e) => handleColumnDrop(e, col.id)}
              className={`flex flex-col rounded-lg border border-t-2 p-2.5 space-y-2.5 min-h-[480px] transition-all duration-200 ${accentClass} ${
                isDragOver
                  ? 'bg-blue-50/50 border-blue-300 border-dashed shadow-inner'
                  : 'bg-slate-50/70 border-slate-200/90'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                    {col.title}
                  </span>
                  <span className="w-4.5 h-4.5 rounded-full bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 flex items-center justify-center">
                    {col.cards.length}
                  </span>
                </div>
              </div>

              {/* Drop Zone Indicator */}
              {isDragOver && (
                <div className="flex items-center justify-center py-2 text-[10px] font-semibold text-blue-600 bg-blue-100/60 rounded border border-dashed border-blue-300 animate-pulse">
                  Letakkan kartu di sini
                </div>
              )}

              {/* Cards List */}
              <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">
                {col.cards.length > 0 ? (
                  col.cards.map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, card.id, col.id)}
                      onDragEnd={handleDragEnd}
                      className="p-3 bg-white rounded-md border border-slate-200 hover:border-slate-300 hover:shadow-sm transition text-xs space-y-2 shadow-xs group cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="w-3 h-3 text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                          <h4 className="font-semibold text-slate-900 leading-snug">
                            {card.title}
                          </h4>
                        </div>
                        <button
                          onClick={() => handleDeleteCard(card.id, card.title)}
                          title="Hapus Ide"
                          className="text-slate-300 hover:text-rose-600 p-0.5 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {card.content && (
                        <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-3 font-sans">
                          {card.content}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                        <span>{card.created_at}</span>
                        {col.id !== 'done' ? (
                          <button
                            onClick={() => handleMoveStatus(card.id, col.id)}
                            className="text-slate-700 font-semibold hover:text-slate-900 flex items-center gap-0.5"
                          >
                            <span>Lanjut</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <Link
                            href="/calendar"
                            className="text-emerald-700 font-semibold hover:text-emerald-900 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 transition"
                          >
                            <Calendar className="w-3 h-3" />
                            <span>Jadwalkan</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-32 border border-dashed border-slate-200 rounded-md flex flex-col items-center justify-center p-3 text-center text-slate-400 text-xs space-y-1">
                    <span>Belum ada ide</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Idea Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Tambah Ide Konten Baru
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCard} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Judul Ide Konten:
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Seri Tips Teknologi Enterprise"
                  className="ui-input"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Deskripsi / Brief Singkat:
                </label>
                <textarea
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Rincian topik pembahasan, target audiens, format konten..."
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="ui-btn ui-btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="ui-btn ui-btn-primary"
                >
                  {creating ? 'Menyimpan...' : 'Simpan Ide'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
