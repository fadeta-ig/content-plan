'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
} from 'lucide-react';
import { KanbanCard } from '@/lib/types';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

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
  const [creating, setCreating] = useState(false);

  // Keyboard accessibility: Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
      });

      const newCard: KanbanCard = {
        id: res.idea?.id || `c-${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        status: status || 'unassigned',
        created_at: res.idea?.created_at || 'Hari Ini',
      };

      toast.success('Ide Disimpan', `Ide "${title}" berhasil ditambahkan ke database.`);
      setTitle('');
      setContent('');
      setStatus('unassigned');
      onSuccess(newCard, status || 'unassigned');
    } catch (err: any) {
      toast.error('Gagal Menyimpan Ide', err.message || 'Terjadi kesalahan saat menyimpan ide.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center border border-blue-200/60">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Tambah Ide Konten Baru
            </h3>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Judul Ide / Topik Konten <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Ngobrol Santai: Cerita di Balik Layar"
                className="ui-input text-xs"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Naskah Brief / Rundown Konsep:
              </label>
              <textarea
                rows={7}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tema, durasi, format, naskah alur pembicaraan, outline poin-poin ide..."
                className="w-full bg-slate-50 border border-slate-200 rounded-md p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 leading-relaxed font-sans"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Tahap Awal Kanban:
              </label>
              <select
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
