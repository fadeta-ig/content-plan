'use client';

import React from 'react';
import {
  FileText,
  HardDrive,
  Table,
  ExternalLink,
  Download,
  File,
  Image as ImageIcon,
  Video,
  FileSpreadsheet,
  Layers,
  Sparkles,
} from 'lucide-react';
import { AttachmentItem } from '@/lib/types';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function detectProvider(url: string, providerProp?: string): {
  name: string;
  badgeClass: string;
  icon: React.ReactNode;
} {
  const lowerUrl = (url || '').toLowerCase();
  const provider = providerProp || '';

  if (provider === 'google_docs' || lowerUrl.includes('docs.google.com/document')) {
    return {
      name: 'Google Docs',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />,
    };
  }

  if (provider === 'google_sheets' || lowerUrl.includes('docs.google.com/spreadsheets')) {
    return {
      name: 'Google Sheets',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
    };
  }

  if (provider === 'google_drive' || lowerUrl.includes('drive.google.com')) {
    return {
      name: 'Google Drive',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <HardDrive className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
    };
  }

  if (provider === 'notion' || lowerUrl.includes('notion.so') || lowerUrl.includes('notion.site')) {
    return {
      name: 'Notion',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      icon: <Table className="w-3.5 h-3.5 text-slate-700 shrink-0" />,
    };
  }

  if (provider === 'figma' || lowerUrl.includes('figma.com')) {
    return {
      name: 'Figma',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />,
    };
  }

  if (provider === 'canva' || lowerUrl.includes('canva.com')) {
    return {
      name: 'Canva',
      badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      icon: <Sparkles className="w-3.5 h-3.5 text-cyan-600 shrink-0" />,
    };
  }

  // File extension checks
  if (lowerUrl.match(/\.(pdf)($|\?)/)) {
    return {
      name: 'PDF Doc',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />,
    };
  }

  if (lowerUrl.match(/\.(docx?|odt|rtf)($|\?)/)) {
    return {
      name: 'Word Doc',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />,
    };
  }

  if (lowerUrl.match(/\.(xlsx?|csv)($|\?)/)) {
    return {
      name: 'Spreadsheet',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
    };
  }

  if (lowerUrl.match(/\.(jpe?g|png|webp|gif|svg)($|\?)/)) {
    return {
      name: 'Gambar',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <ImageIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
    };
  }

  if (lowerUrl.match(/\.(mp4|mov|webm|avi)($|\?)/)) {
    return {
      name: 'Video',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: <Video className="w-3.5 h-3.5 text-purple-600 shrink-0" />,
    };
  }

  return {
    name: 'Link Web',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: <File className="w-3.5 h-3.5 text-slate-500 shrink-0" />,
  };
}

interface AttachmentListProps {
  attachments?: AttachmentItem[];
  compact?: boolean;
  emptyMessage?: string;
}

export default function AttachmentList({
  attachments = [],
  compact = false,
  emptyMessage,
}: AttachmentListProps) {
  if (!attachments || attachments.length === 0) {
    if (!emptyMessage) return null;
    return <p className="text-xs text-slate-400 italic">{emptyMessage}</p>;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {attachments.map((att) => {
          const info = detectProvider(att.url, att.provider);
          return (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${att.title} (${info.name})`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition hover:opacity-80 max-w-[200px] truncate ${info.badgeClass}`}
            >
              {info.icon}
              <span className="truncate">{att.title}</span>
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {attachments.map((att) => {
        const info = detectProvider(att.url, att.provider);
        const isDownloadable = att.type === 'file' || (!att.url.startsWith('http://') && !att.url.startsWith('https://'));

        return (
          <div
            key={att.id}
            className="group flex items-center justify-between p-2 rounded-lg border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-2xs transition"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
              <div className="w-8 h-8 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
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
                  <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                </a>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                  <span className={`px-1 rounded border text-[9.5px] font-medium ${info.badgeClass}`}>
                    {info.name}
                  </span>
                  {att.file_size && att.file_size > 0 ? (
                    <span>• {formatBytes(att.file_size)}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <a
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              download={isDownloadable ? att.title : undefined}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
              title={isDownloadable ? 'Unduh / Buka Dokumen' : 'Buka Tautan di Tab Baru'}
            >
              {isDownloadable ? <Download className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
            </a>
          </div>
        );
      })}
    </div>
  );
}
