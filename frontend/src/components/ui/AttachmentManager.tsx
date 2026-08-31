'use client';

import React, { useState, useRef } from 'react';
import {
  Upload,
  Link as LinkIcon,
  Plus,
  Trash2,
  ExternalLink,
  Download,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { AttachmentItem } from '@/lib/types';
import { api, getErrorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { detectProvider } from '@/components/ui/AttachmentList';

interface AttachmentManagerProps {
  attachments: AttachmentItem[];
  onChange: (attachments: AttachmentItem[]) => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function AttachmentManager({
  attachments = [],
  onChange,
  disabled = false,
  label = 'Lampiran & Tautan Referensi',
  helperText = 'Upload dokumen brief (PDF/Word), Call Sheet, atau tautan Google Drive/Docs.',
}: AttachmentManagerProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeMode, setActiveMode] = useState<'none' | 'file' | 'link'>('none');
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlTitle, setUrlTitle] = useState('');

  // Handle local file upload via existing media API
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    // Cap at 100MB
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File Terlalu Besar', 'Ukuran file maksimal adalah 100 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.uploadMedia(formData);
      if (res.success && res.asset) {
        const newAttachment: AttachmentItem = {
          id: res.asset.id || `att-${Date.now()}`,
          type: 'file',
          title: res.asset.title || file.name,
          url: res.asset.file_url,
          file_size: res.asset.file_size || file.size,
          mime_type: res.asset.file_type || file.type,
        };

        onChange([...attachments, newAttachment]);
        toast.success('File Terlampir', `"${file.name}" berhasil diunggah.`);
        setActiveMode('none');
      }
    } catch (error: unknown) {
      toast.error('Gagal Mengunggah', getErrorMessage(error, 'Terjadi kesalahan saat mengunggah file.'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle external URL link addition
  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    const rawUrl = urlInput.trim();
    if (!rawUrl) {
      toast.error('URL Diperlukan', 'Masukkan tautan URL dokumen.');
      return;
    }

    let validUrl = rawUrl;
    if (!/^https?:\/\//i.test(validUrl)) {
      validUrl = `https://${validUrl}`;
    }

    try {
      new URL(validUrl);
    } catch {
      toast.error('URL Tidak Valid', 'Pastikan format URL web sudah benar.');
      return;
    }

    const providerInfo = detectProvider(validUrl);
    const title = urlTitle.trim() || providerInfo.name || 'Dokumen Tautan';

    let providerKey: AttachmentItem['provider'] = 'custom';
    if (validUrl.includes('docs.google.com/document')) providerKey = 'google_docs';
    else if (validUrl.includes('docs.google.com/spreadsheets')) providerKey = 'google_sheets';
    else if (validUrl.includes('drive.google.com')) providerKey = 'google_drive';
    else if (validUrl.includes('notion.so') || validUrl.includes('notion.site')) providerKey = 'notion';
    else if (validUrl.includes('figma.com')) providerKey = 'figma';
    else if (validUrl.includes('canva.com')) providerKey = 'canva';

    const newAttachment: AttachmentItem = {
      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'link',
      title,
      url: validUrl,
      provider: providerKey,
    };

    onChange([...attachments, newAttachment]);
    setUrlInput('');
    setUrlTitle('');
    setActiveMode('none');
    toast.success('Tautan Ditambahkan', `Tautan "${title}" berhasil dilampirkan.`);
  };

  const handleRemove = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-slate-500" />
          <span>{label}</span>
          {attachments.length > 0 && (
            <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200">
              {attachments.length}
            </span>
          )}
        </label>

        {!disabled && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveMode((prev) => (prev === 'file' ? 'none' : 'file'));
                fileInputRef.current?.click();
              }}
              disabled={isUploading}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition"
              title="Upload file dari komputer"
            >
              {isUploading ? (
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              ) : (
                <Upload className="w-3 h-3 text-slate-500" />
              )}
              <span>{isUploading ? 'Mengunggah...' : 'Upload File'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode((prev) => (prev === 'link' ? 'none' : 'link'))}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition ${
                activeMode === 'link'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
              title="Tambah tautan Google Docs / GDrive / Notion"
            >
              <LinkIcon className="w-3 h-3" />
              <span>Link Docs/GDrive</span>
            </button>
          </div>
        )}
      </div>

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.mp4,.mov,.zip"
        className="hidden"
      />

      {/* Form Input URL Eksternal */}
      {activeMode === 'link' && !disabled && (
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
              <LinkIcon className="w-3 h-3 text-blue-600" />
              <span>Tautkan Dokumen Cloud (Google Docs, GDrive, Notion, dll.)</span>
            </span>
            <button
              type="button"
              onClick={() => setActiveMode('none')}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://docs.google.com/document/d/... atau https://drive.google.com/..."
                className="w-full text-xs p-2 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                placeholder="Judul / Label Tautan (contoh: Naskah Final, Call Sheet Talent)"
                className="flex-1 text-xs p-2 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddLink}
                className="px-3 py-2 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 transition flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Lampirkan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daftar Lampiran yang sudah ada */}
      {attachments.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          {attachments.map((att) => {
            const info = detectProvider(att.url, att.provider);
            const isFile = att.type === 'file';

            return (
              <div
                key={att.id}
                className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 transition"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                  <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                    {info.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-slate-800 hover:text-blue-600 flex items-center gap-1 truncate"
                    >
                      <span className="truncate">{att.title}</span>
                      <ExternalLink className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                    </a>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                      <span className={`px-1 rounded border text-[9px] font-medium ${info.badgeClass}`}>
                        {info.name}
                      </span>
                      {att.file_size && att.file_size > 0 ? (
                        <span>• {formatBytes(att.file_size)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={isFile ? att.title : undefined}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                    title={isFile ? 'Unduh' : 'Buka Tab Baru'}
                  >
                    {isFile ? <Download className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  </a>

                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemove(att.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Hapus Lampiran"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic">
          {helperText}
        </p>
      )}
    </div>
  );
}
