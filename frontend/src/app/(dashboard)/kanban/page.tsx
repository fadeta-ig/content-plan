'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Plus,
  GripVertical,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { KanbanColumn, KanbanCard } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import KanbanCardItem from '@/components/kanban/KanbanCardItem';
import CreateIdeaModal from '@/components/kanban/CreateIdeaModal';
import IdeaPreviewModal from '@/components/kanban/IdeaPreviewModal';

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

  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<{
    card: KanbanCard;
    columnId: string;
  } | null>(null);

  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const dragDataRef = useRef<{ cardId: string; sourceColumnId: string } | null>(null);

  const loadKanban = async () => {
    try {
      const data = await api.getKanbanIdeas();
      if (data.columns && data.columns.length > 0) {
        setColumns(data.columns);
      }
    } catch {
      // Keep default columns
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKanban();
  }, []);

  const handleIdeaCreated = (newCard: KanbanCard, targetColumnId: string) => {
    setColumns((prev) =>
      prev.map((col) => {
        if (col.id === targetColumnId) {
          return { ...col, cards: [newCard, ...col.cards] };
        }
        return col;
      })
    );
    setIsCreateModalOpen(false);
    // Automatically open preview after creating an idea
    setSelectedPreview({ card: newCard, columnId: targetColumnId });
  };

  const handleUpdateIdeaCard = (updatedCard: KanbanCard, newColumnId?: string) => {
    setColumns((prev) => {
      let foundCard = updatedCard;
      let fromColId = selectedPreview?.columnId || updatedCard.status || 'unassigned';
      let toColId = newColumnId || fromColId;

      if (newColumnId && newColumnId !== fromColId) {
        // Move card to new column
        return prev.map((col) => {
          if (col.id === fromColId) {
            return { ...col, cards: col.cards.filter((c) => c.id !== updatedCard.id) };
          }
          if (col.id === toColId) {
            return { ...col, cards: [foundCard, ...col.cards.filter((c) => c.id !== updatedCard.id)] };
          }
          return col;
        });
      }

      // Update in-place
      return prev.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === updatedCard.id ? { ...c, ...updatedCard } : c)),
      }));
    });

    if (selectedPreview && selectedPreview.card.id === updatedCard.id) {
      setSelectedPreview({
        card: updatedCard,
        columnId: newColumnId || selectedPreview.columnId,
      });
    }
  };

  const handleMoveStatus = async (cardId: string, currentStatus: string) => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex >= STATUS_FLOW.length - 1) return;

    const nextStatus = STATUS_FLOW[currentIndex + 1];
    moveCardOptimistic(cardId, currentStatus, nextStatus);

    try {
      await api.updateIdeaStatus(cardId, nextStatus);
      toast.success('Status Diperbarui', `Ide dipindahkan ke "${COLUMN_LABELS[nextStatus]}".`);
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
          return { ...col, cards: [...col.cards, { ...card!, status: toColumnId }] };
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
          if (selectedPreview?.card.id === cardId) {
            setSelectedPreview(null);
          }
          toast.warning('Ide Dihapus', `Ide "${title}" berhasil dihapus.`);
        } catch (e: any) {
          toast.error('Gagal Menghapus', e.message || 'Gagal menghapus ide.');
        }
      },
    });
  };

  // --- Drag-and-Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, cardId: string, sourceColumnId: string) => {
    dragDataRef.current = { cardId, sourceColumnId };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);

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
      toast.error('Gagal Memindahkan', e.message || 'Terjadi kesalahan.');
    }

    dragDataRef.current = null;
  };

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            Papan Ide &amp; Alur Kerja Kanban
          </h1>
          <p className="text-xs text-slate-500">
            Kelola ide konten kreatif, alur penulisan naskah brief, dan rencana produksi konten.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="ui-btn ui-btn-primary shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Ide Baru</span>
        </button>
      </div>

      {/* Drag Hint & Feature Indicator */}
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 font-medium">
        <div className="flex items-center gap-1.5">
          <GripVertical className="w-3 h-3" />
          <span>Geser kartu antar kolom untuk memperbarui status alur kerja</span>
        </div>
        <div className="flex items-center gap-1 text-blue-600 font-semibold">
          <Sparkles className="w-3 h-3" />
          <span>Klik kartu untuk melihat naskah brief &amp; ringkasan konsep</span>
        </div>
      </div>

      {/* Kanban Board Columns Grid / Skeleton Loader */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3 min-h-[480px]"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-slate-200 rounded w-24" />
                <div className="w-5 h-5 bg-slate-200 rounded-full" />
              </div>
              <div className="space-y-2 flex-1 pt-2">
                <div className="h-20 bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-100 rounded w-full" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                </div>
                <div className="h-20 bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-2/3" />
                  <div className="h-2.5 bg-slate-100 rounded w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
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
              className={`flex flex-col rounded-xl border border-t-2 p-2.5 space-y-2.5 min-h-[480px] transition-all duration-200 ${accentClass} ${
                isDragOver
                  ? 'bg-blue-50/50 border-blue-300 border-dashed shadow-inner'
                  : 'bg-slate-50/70 border-slate-200/90'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    {col.title}
                  </span>
                  <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600 flex items-center justify-center shadow-2xs">
                    {col.cards.length}
                  </span>
                </div>
              </div>

              {/* Drop Zone Indicator */}
              {isDragOver && (
                <div className="flex items-center justify-center py-2 text-[10px] font-semibold text-blue-600 bg-blue-100/60 rounded-md border border-dashed border-blue-300 animate-pulse">
                  Letakkan kartu di sini
                </div>
              )}

              {/* Cards List */}
              <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">
                {col.cards.length > 0 ? (
                  col.cards.map((card) => (
                    <KanbanCardItem
                      key={card.id}
                      card={card}
                      columnId={col.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onOpenPreview={(c, colId) => setSelectedPreview({ card: c, columnId: colId })}
                      onMoveStatus={handleMoveStatus}
                      onDelete={handleDeleteCard}
                    />
                  ))
                ) : (
                  <div className="h-32 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-3 text-center text-slate-400 text-xs space-y-1 bg-white/50">
                    <span>Belum ada ide di tahap ini</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Create New Idea Modal (with real-time live preview) */}
      <CreateIdeaModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleIdeaCreated}
      />

      {/* Idea Preview Modal (Rich Social Simulator & Actions) */}
      {selectedPreview && (
        <IdeaPreviewModal
          idea={selectedPreview.card}
          columnId={selectedPreview.columnId}
          onClose={() => setSelectedPreview(null)}
          onUpdateIdea={handleUpdateIdeaCard}
          onDeleteIdea={handleDeleteCard}
        />
      )}
    </div>
  );
}
