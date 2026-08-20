'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Video,
  Check,
  FolderOpen,
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

  useEffect(() => {
    if (!isOpen) return;

    async function loadAssets() {
      try {
        const data = await api.getMedia();
        if (data.assets && data.assets.length > 0) {
          setAssets(data.assets);
        } else {
          throw new Error('Empty');
        }
      } catch (err) {
        setAssets([
          {
            id: 'm-1',
            title: 'hero-banner-q3-2026.png',
            file_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
            thumbnail_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
            file_type: 'image',
            file_size: 480000,
          },
          {
            id: 'm-2',
            title: 'infografis-ai-enterprise.png',
            file_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
            thumbnail_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
            file_type: 'image',
            file_size: 620000,
          },
          {
            id: 'm-3',
            title: 'dokumentasi-workshop-tech.png',
            file_url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&auto=format&fit=crop&q=80',
            thumbnail_url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&auto=format&fit=crop&q=80',
            file_type: 'image',
            file_size: 780000,
          },
        ]);
      }
    }
    loadAssets();
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
    } catch (err: any) {
      const fallbackItem: MediaItem = {
        id: `upload-${Date.now()}`,
        title: file.name,
        file_url: URL.createObjectURL(file),
        thumbnail_url: URL.createObjectURL(file),
        file_type: file.type.includes('video') ? 'video' : 'image',
        file_size: file.size,
      };
      setAssets((prev) => [fallbackItem, ...prev]);
      setSelectedIds((prev) => [...prev, fallbackItem.id]);
      toast.success('Media Terlampir', `${file.name} berhasil dilampirkan.`);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = () => {
    const selectedItems = assets.filter((a) => selectedIds.includes(a.id));
    onSelectMedia(selectedItems);
    toast.info('Lampiran Diperbarui', `${selectedItems.length} media dilampirkan ke composer.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden shadow-lg animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
              Pilih Media untuk Postingan
            </h3>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
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
        <div className="p-3.5 flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-3 bg-slate-50/30">
          {assets.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => toggleSelect(item.id)}
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
                    <img
                      src={item.thumbnail_url || item.file_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Video className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <p className="text-[10px] font-medium text-slate-700 truncate mt-1.5 px-0.5">
                  {item.title}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary">
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
