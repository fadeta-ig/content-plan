'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  X,
  Upload,
  Image as ImageIcon,
  Video,
  Check,
  FolderOpen,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { MediaItem } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (items: MediaItem[]) => void;
  initialSelectedIds?: string[];
}

export default function MediaPickerModal({
  isOpen,
  onClose,
  onSelectMedia,
  initialSelectedIds = [],
}: MediaPickerModalProps) {
  const toast = useToast();
  const [assets, setAssets] = useState<MediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const initialSelectedKey = initialSelectedIds.join(',');
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const uploadingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    uploadingRef.current = uploading;
  }, [uploading]);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.getMedia();
      setAssets(data.assets || []);
    } catch (error) {
      setAssets([]);
      setLoadError(
        error instanceof Error && error.message
          ? error.message
          : 'Media tidak dapat dimuat. Periksa koneksi lalu coba lagi.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(initialSelectedKey ? initialSelectedKey.split(',') : []);
    void loadAssets();
  }, [isOpen, initialSelectedKey, loadAssets]);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !uploadingRef.current) {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
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

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await api.uploadMedia(formData);
      if (data.asset) {
        setAssets((prev) => [data.asset, ...prev]);
        setSelectedIds((prev) => [...prev, data.asset.id]);
        toast.success('Media Terunggah', `${file.name} berhasil diunggah dan dipilih.`);
      }
    } catch (error) {
      toast.error(
        'Unggah Media Gagal',
        error instanceof Error && error.message
          ? error.message
          : `${file.name} belum tersimpan. Periksa format, ukuran, dan koneksi lalu coba lagi.`
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleConfirm = () => {
    const selectedItems = assets.filter((a) => selectedIds.includes(a.id));
    onSelectMedia(selectedItems);
    toast.info('Lampiran Diperbarui', `${selectedItems.length} media dilampirkan ke composer.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        ref={dialogRef}
        className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 my-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-picker-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-slate-700" />
            <h3 id="media-picker-title" className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
              Pilih Media untuk Postingan
            </h3>
          </div>

          <button type="button" onClick={onClose} disabled={uploading} className="text-slate-400 hover:text-slate-600" aria-label="Tutup pemilih media">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-white">
          <span className="text-xs text-slate-500 font-medium">
            Terpilih: <strong className="text-slate-900">{selectedIds.length}</strong> media
          </span>

          <label className="ui-btn ui-btn-primary cursor-pointer text-xs">
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Mengunggah...' : 'Unggah File Baru'}</span>
            <input
              type="file"
              className="hidden"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Media Grid */}
        <div className="p-3.5 flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/30">
          {loading && (
            <div className="col-span-full py-10 text-center text-xs text-slate-500" role="status">
              Memuat pustaka media...
            </div>
          )}
          {!loading && loadError && (
            <div className="col-span-full py-8 text-center space-y-3" role="alert">
              <AlertCircle className="w-7 h-7 text-rose-500 mx-auto" />
              <div>
                <p className="text-xs font-semibold text-slate-800">Pustaka media gagal dimuat</p>
                <p className="text-[11px] text-slate-500 mt-1">{loadError}</p>
              </div>
              <button type="button" className="ui-btn ui-btn-secondary" onClick={() => void loadAssets()}>
                <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
              </button>
            </div>
          )}
          {!loading && !loadError && assets.length === 0 && (
            <div className="col-span-full py-10 text-center space-y-2">
              <ImageIcon className="w-7 h-7 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">Pustaka media masih kosong</p>
              <p className="text-[11px] text-slate-500">Unggah gambar atau video untuk mulai menambahkan lampiran.</p>
            </div>
          )}
          {assets.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => toggleSelect(item.id)}
                aria-pressed={isSelected}
                aria-label={`${isSelected ? 'Batalkan pilihan' : 'Pilih'} ${item.title}`}
                className={`rounded-md border p-1.5 bg-white cursor-pointer transition relative group flex flex-col justify-between ${
                  isSelected
                    ? 'border-slate-900 ring-1 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Checkbox indicator */}
                <div
                  className={`absolute top-2.5 right-2.5 w-4 h-4 rounded flex items-center justify-center text-[10px] z-10 transition ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'bg-white/90 border border-slate-300 text-transparent group-hover:border-slate-400'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>

                <div className="aspect-square rounded bg-slate-100 overflow-hidden flex items-center justify-center relative">
                  {item.file_type === 'image' && item.file_url ? (
                    <Image
                      src={item.thumbnail_url || item.file_url}
                      alt={item.title || 'Media pustaka'}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Video className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <p className="text-[10px] font-medium text-slate-700 truncate mt-1.5 px-0.5">
                  {item.title}
                </p>
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-end gap-2">
          <button ref={cancelButtonRef} type="button" onClick={onClose} className="ui-btn ui-btn-secondary">
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="ui-btn ui-btn-primary"
          >
            <span>Terapkan ke Postingan ({selectedIds.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
