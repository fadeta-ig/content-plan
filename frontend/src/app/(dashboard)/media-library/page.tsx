'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Search,
  UploadCloud,
  X,
  Download,
  PenSquare,
  Maximize2,
  Film,
} from 'lucide-react';
import { api } from '@/lib/api';
import { MediaFolder, MediaItem } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatBytes } from '@/lib/format';

export default function MediaLibraryPage() {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [fileTypeFilter, setFileTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.getMedia(selectedFolder || undefined);
      if (data.assets) {
        setMediaItems(data.assets);
      }
      if (data.folders) {
        setFolders(data.folders);
      }
    } catch (error) {
      setMediaItems([]);
      setLoadError(
        error instanceof Error && error.message
          ? error.message
          : 'Pustaka media tidak dapat dimuat. Periksa koneksi lalu coba lagi.'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedFolder]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (selectedFolder) formData.append('folder_id', selectedFolder);

    try {
      const data = await api.uploadMedia(formData);
      if (data.asset) {
        setMediaItems((prev) => [data.asset, ...prev]);
        toast.success('Media Berhasil Diunggah', `${file.name} telah disimpan ke pustaka.`);
      }
    } catch (error) {
      toast.error(
        'Unggah Media Gagal',
        error instanceof Error && error.message
          ? error.message
          : `${file.name} belum tersimpan. Periksa format dan ukuran file.`
      );
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      await uploadFile(files[i]);
    }
    e.target.value = '';
  };

  // Drag-and-Drop Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        await uploadFile(file);
      } else {
        toast.error('Format Tidak Didukung', `${file.name} bukan berkas gambar atau video.`);
      }
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
          setMediaItems((prev) => prev.filter((m) => m.id !== id));
          if (previewItem?.id === id) setPreviewItem(null);
          toast.warning('Berkas Dihapus', `Media "${title}" telah dihapus dari pustaka.`);
        } catch (error) {
          toast.error(
            'Gagal Menghapus Berkas',
            error instanceof Error && error.message
              ? error.message
              : `Media "${title}" belum dihapus. Silakan coba kembali.`
          );
        }
      },
    });
  };

  const copyUrl = async (id: string, url: string) => {
    if (!url) {
      toast.error('URL Tidak Tersedia', 'Berkas ini belum memiliki URL publik.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.info('Tautan Disalin', 'URL publik media telah disalin ke clipboard.');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Gagal Menyalin URL', 'Browser menolak akses clipboard.');
    }
  };

  // Filter & Search Logic
  const filteredItems = mediaItems.filter((item) => {
    const matchesSearch = searchQuery.trim() === '' ||
      (item.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const isVideo = item.file_type === 'video' || /\.(mp4|webm|mov|m4v)($|\?)/i.test(item.file_url || '');
    const matchesType =
      fileTypeFilter === 'all' ||
      (fileTypeFilter === 'video' && isVideo) ||
      (fileTypeFilter === 'image' && !isVideo);
    return matchesSearch && matchesType;
  });

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="space-y-4 relative min-h-[85vh]"
    >
      {/* Fullscreen Drag Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-blue-600/20 backdrop-blur-xs border-4 border-dashed border-blue-500 rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-2xl flex items-center justify-center text-blue-600 mb-3 animate-bounce">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Lepaskan Berkas di Sini</h2>
          <p className="text-xs text-slate-600 mt-1 max-w-sm">
            Foto atau video akan otomatis diunggah dan disimpan ke Pustaka Media.
          </p>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            Pustaka Media (Media Library)
          </h1>
          <p className="text-xs text-slate-500">
            Penyimpanan aset terpusat untuk foto feed, reels, story, dan naskah visual PT Wijaya Inovasi Gemilang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="ui-btn ui-btn-primary cursor-pointer flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Mengunggah...' : 'Upload Berkas Media'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
            accept="image/*,video/*"
          />
        </div>
      </div>

      {/* Drag & Drop Quick Upload Zone Banner */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="p-4 rounded-xl border border-dashed border-slate-300 bg-white hover:bg-slate-50/80 hover:border-blue-400 transition cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition shrink-0">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div className="text-center sm:text-left">
            <h4 className="text-xs font-semibold text-slate-800">
              Tarik & Letakkan berkas gambar atau video di sini
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Mendukung upload banyak file sekaligus (JPG, PNG, WebP, MP4, MOV).
            </p>
          </div>
        </div>

        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
          Pilih dari Komputer
        </span>
      </div>

      {/* Controls Bar: Search & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari media berdasarkan judul..."
            className="ui-input text-xs pl-8 pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* File Type Filter */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFileTypeFilter('all')}
              className={`px-2.5 py-1 rounded-md transition ${
                fileTypeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({mediaItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFileTypeFilter('image')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition ${
                fileTypeFilter === 'image'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>Gambar</span>
            </button>
            <button
              type="button"
              onClick={() => setFileTypeFilter('video')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition ${
                fileTypeFilter === 'video'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Film className="w-3 h-3" />
              <span>Video</span>
            </button>
          </div>

          {/* Folder Filter Bar if exists */}
          {folders.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedFolder(null)}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                  selectedFolder === null
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Semua Folder
              </button>
              {folders.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setSelectedFolder(f.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                    selectedFolder === f.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="ui-card p-12 text-center text-xs text-slate-500" role="status">
          Memuat pustaka media...
        </div>
      ) : loadError ? (
        <div className="ui-card p-10 text-center space-y-3" role="alert">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <div>
            <h3 className="text-xs font-semibold text-slate-800">Pustaka media gagal dimuat</h3>
            <p className="text-[11px] text-slate-500 mt-1">{loadError}</p>
          </div>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={loadMedia}>
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredItems.map((item) => {
            const isVideo = item.file_type === 'video' || /\.(mp4|webm|mov|m4v)($|\?)/i.test(item.file_url || '');
            return (
              <div
                key={item.id}
                className="ui-card p-2 flex flex-col justify-between group hover:border-slate-300 hover:shadow-xs transition text-xs space-y-2 relative bg-white"
              >
                {/* Thumbnail Box (Click to open Lightbox) */}
                <div
                  onClick={() => setPreviewItem(item)}
                  className="aspect-square rounded-lg bg-slate-900 border border-slate-200 overflow-hidden relative flex items-center justify-center cursor-pointer"
                  title="Klik untuk memperbesar / memutar"
                >
                  {!isVideo && item.file_url ? (
                    <Image
                      src={item.thumbnail_url || item.file_url}
                      alt={item.title || 'Media pustaka'}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-white transition">
                      <Film className="w-8 h-8 mb-1" />
                      <span className="text-[9px] font-bold tracking-wider uppercase">Video</span>
                    </div>
                  )}

                  {/* Top Badge: File Type */}
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[9px] font-bold uppercase backdrop-blur-xs">
                    {isVideo ? 'VIDEO' : item.file_type.toUpperCase()}
                  </span>

                  {/* Hover Overlay with Preview Icon */}
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                    <Maximize2 className="w-5 h-5 drop-shadow-md" />
                  </div>
                </div>

                {/* Title & Metadata */}
                <div>
                  <p
                    onClick={() => setPreviewItem(item)}
                    className="font-semibold text-slate-800 truncate text-[11px] cursor-pointer hover:text-blue-600 transition"
                    title={item.title}
                  >
                    {item.title}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>{formatBytes(item.file_size || 0)}</span>
                    <span>{item.created_at || 'Hari Ini'}</span>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
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
                    type="button"
                    onClick={() => handleDeleteMedia(item.id, item.title || 'Berkas Media')}
                    aria-label={`Hapus media ${item.title || 'tanpa judul'}`}
                    className="text-slate-400 hover:text-rose-600 p-0.5 transition"
                    title="Hapus Berkas Media"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ui-card p-12 text-center text-slate-400 text-xs space-y-2">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-slate-800">Tidak Ada Berkas Media Ditemukan</h3>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `Tidak ada berkas yang cocok dengan pencarian "${searchQuery}".`
              : 'Unggah foto atau video baru di atas untuk mulai membangun pustaka media Anda.'}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="ui-btn ui-btn-secondary text-xs mt-2"
            >
              Reset Pencarian
            </button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* LIGHTBOX MODAL PREVIEW (High-Res Image & Native Video Player)              */}
      {/* ========================================================================= */}
      {previewItem && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewItem(null);
          }}
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 text-white rounded-2xl max-w-4xl w-full border border-slate-800 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Lightbox Header */}
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="px-2 py-0.5 rounded bg-blue-600 text-[10px] font-bold uppercase tracking-wider">
                  {previewItem.file_type}
                </span>
                <h3 className="text-xs font-semibold text-slate-200 truncate" title={previewItem.title}>
                  {previewItem.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                aria-label="Tutup pratinjau media"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lightbox Main Media View */}
            <div className="flex-1 bg-black flex items-center justify-center p-4 min-h-[320px] max-h-[65vh] overflow-hidden">
              {previewItem.file_type === 'video' || /\.(mp4|webm|mov|m4v)($|\?)/i.test(previewItem.file_url || '') ? (
                <video
                  src={previewItem.file_url}
                  controls
                  autoPlay
                  className="max-h-[60vh] max-w-full rounded-lg shadow-2xl object-contain"
                >
                  Browser Anda tidak mendukung pemutar video HTML5.
                </video>
              ) : (
                <div className="relative w-full h-[60vh] flex items-center justify-center">
                  <Image
                    src={previewItem.file_url}
                    alt={previewItem.title || 'Pratinjau media'}
                    fill
                    unoptimized
                    className="object-contain"
                  />
                </div>
              )}
            </div>

            {/* Lightbox Footer & Actions */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 text-slate-400 text-[11px]">
                <span>Ukuran: <strong className="text-slate-200">{formatBytes(previewItem.file_size || 0)}</strong></span>
                <span>Diunggah: <strong className="text-slate-200">{previewItem.created_at || 'Hari ini'}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                {/* Copy URL Button */}
                <button
                  type="button"
                  onClick={() => copyUrl(previewItem.id, previewItem.file_url || '')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {copiedId === previewItem.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">URL Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin URL</span>
                    </>
                  )}
                </button>

                {/* Download File Button */}
                {previewItem.file_url && (
                  <a
                    href={previewItem.file_url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh</span>
                  </a>
                )}

                {/* Create Post with this media */}
                <button
                  type="button"
                  onClick={() => router.push('/composer')}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <PenSquare className="w-3.5 h-3.5" />
                  <span>Buat Postingan</span>
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => handleDeleteMedia(previewItem.id, previewItem.title || 'Berkas Media')}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Hapus berkas permanen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
