'use client';

import React from 'react';
import Link from 'next/link';
import {
  GripVertical,
  Trash2,
  ChevronRight,
  Calendar,
  Eye,
} from 'lucide-react';
import { KanbanCard } from '@/lib/types';

interface KanbanCardItemProps {
  card: KanbanCard;
  columnId: string;
  onDragStart: (e: React.DragEvent, cardId: string, columnId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onOpenPreview: (card: KanbanCard, columnId: string) => void;
  onMoveStatus: (cardId: string, currentStatus: string) => void;
  onDelete: (cardId: string, title: string) => void;
}

export default function KanbanCardItem({
  card,
  columnId,
  onDragStart,
  onDragEnd,
  onOpenPreview,
  onMoveStatus,
  onDelete,
}: KanbanCardItemProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card.id, columnId)}
      onDragEnd={onDragEnd}
      className="p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-150 text-xs space-y-2 group cursor-grab active:cursor-grabbing relative"
    >
      {/* Top Bar: Drag Handle, Title & Action buttons */}
      <div className="flex items-start justify-between gap-1.5">
        <button
          type="button"
          onClick={() => onOpenPreview(card, columnId)}
          className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer text-left"
          aria-label={`Buka pratinjau ${card.title}`}
        >
          <GripVertical className="w-3 h-3 text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 transition" />
          <h4 className="font-semibold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
            {card.title}
          </h4>
        </button>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition shrink-0">
          <button
            type="button"
            onClick={() => onOpenPreview(card, columnId)}
            title="Pratinjau Ide"
            aria-label={`Pratinjau ide ${card.title}`}
            className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(card.id, card.title)}
            title="Hapus Ide"
            aria-label={`Hapus ide ${card.title}`}
            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Brief Snippet */}
      {card.content && (
        <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2 font-sans">
          {card.content}
        </p>
      )}

      {/* Card Footer */}
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px] text-slate-400">
        <span className="font-mono text-slate-400">{card.created_at || 'Hari Ini'}</span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenPreview(card, columnId)}
            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-blue-50 transition"
          >
            <Eye className="w-3 h-3" />
            <span>Pratinjau</span>
          </button>

          {columnId !== 'done' ? (
            <button
              type="button"
              onClick={() => onMoveStatus(card.id, columnId)}
              className="text-slate-600 font-semibold hover:text-slate-900 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-slate-100 transition"
              title="Pindahkan ke status berikutnya"
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
    </div>
  );
}
