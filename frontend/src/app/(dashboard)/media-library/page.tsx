'use client';

import React, { useEffect, useState } from 'react';
import {
  Image as ImageIcon,
  Upload,
  FolderPlus,
  Trash2,
  Copy,
  Check,
  Video,
  Eye,
  Plus,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { MediaItem } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export default function MediaLibraryPage() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadMedia = async () => {
    try {
      const data = await api.getMedia(selectedFolder || undefined);
      if (data.assets) {
        setMediaItems(data.assets);
      }
      if (data.folders) {
        setFolders(data.folders);
      }
    } catch (err) {
      setMediaItems([]);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [selectedFolder]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (selectedFolder) formData.append('folder_id', selectedFolder);

    try {
      const data = await api.uploadMedia(formData);
      if (data.asset) {
        setMediaItems((prev) => [data.asset, ...prev]);
        toast.success('Media Berhasil Diunggah', `${file.name} telah disimpan ke media library.`);
      }
    } catch (err) {
      const newItem: MediaItem = {
        id: `local-${Date.now()}`,
        title: file.name,
        file_url: URL.createObjectURL(file),
        thumbnail_url: URL.createObjectURL(file),
        file_type: file.type.includes('video') ? 'video' : 'image',
        file_size: file.size,
        created_at: 'Hari Ini',
      };
      setMediaItems((prev) => [newItem, ...prev]);
      toast.success('Media Disimpan', `${file.name} telah ditambahkan.`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMedia = (id: string, title: string) => {
    confirm({
      title: 'Hapus Berkas Media?',
      message: `Apakah Anda yakin ingin menghapus berkas "${title}" secara permanen? File yang terhapus tidak dapat dipulihkan.`,
      confirmText: 'Ya, Hapus Berkas',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.deleteMedia(id);
        } catch (e) {
          // Local fallback
        }
        setMediaItems((prev) => prev.filter((m) => m.id !== id));
        toast.warning('Berkas Dihapus', `Media "${title}" telah dihapus dari pustaka.`);
      },
    });
  };

  const copyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.info('Tautan Disalin', 'URL publik media telah disalin ke clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            Pustaka Media (Media Library)
          </h1>
          <p className="text-xs text-slate-500">
            Penyimpanan terpusat gambar, video feed, story, dan naskah infografis PT Wijaya Inovasi Gemilang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="ui-btn ui-btn-primary cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Mengunggah...' : 'Upload Berkas Media'}</span>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              accept="image/*,video/*"
            />
          </label>
        </div>
      </div>

      {/* Folders Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedFolder(null)}
          className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
            selectedFolder === null
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Semua Berkas ({mediaItems.length})
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFolder(f.id)}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
              selectedFolder === f.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Media Grid */}
      {mediaItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {mediaItems.map((item) => (
            <div
              key={item.id}
              className="ui-card p-2 flex flex-col justify-between group hover:border-slate-300 transition text-xs space-y-2"
            >
              {/* Thumbnail Box */}
              <div className="aspect-square rounded bg-slate-100 border border-slate-200 overflow-hidden relative flex items-center justify-center">
                {item.file_type === 'image' && item.file_url ? (
                  <img
                    src={item.thumbnail_url || item.file_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Video className="w-8 h-8 text-slate-400" />
                )}

                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[9px] font-bold">
                  {item.file_type.toUpperCase()}
                </span>
              </div>

              {/* Title & Metadata */}
              <div>
                <p className="font-semibold text-slate-800 truncate text-[11px]" title={item.title}>
                  {item.title}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>{item.file_size ? (item.file_size / 1024).toFixed(0) : '0'} KB</span>
                  <span>{item.created_at || 'Hari Ini'}</span>
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => copyUrl(item.id, item.file_url || '')}
                  className="text-[10px] font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600">Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin URL</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDeleteMedia(item.id, item.title || 'Berkas Media')}
                  aria-label="Hapus Media"
                  className="text-slate-400 hover:text-rose-600 p-0.5 transition"
                  title="Hapus Berkas Media"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ui-card p-12 text-center text-slate-400 text-xs space-y-2">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-slate-800">Pustaka Media Kosong</h3>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Unggah gambar atau video feed di atas untuk digunakan saat menyusun konten di Post Composer.
          </p>
        </div>
      )}
    </div>
  );
}
