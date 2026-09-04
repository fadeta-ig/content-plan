'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  ThumbsUp,
  Globe,
  Repeat2,
  Send,
  Music,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';
import { MediaItem } from '@/lib/types';
import RichTextRenderer from './RichTextRenderer';
import SocialIcon from './SocialIcon';

interface SocialPostMockupProps {
  platform?: string;
  caption: string;
  media?: MediaItem[];
  accountName?: string;
  accountHandle?: string;
  avatarUrl?: string;
  firstComment?: string;
  scheduledAt?: string | null;
  className?: string;
  availablePlatforms?: string[];
  activePlatform?: string;
  onSelectPlatform?: (platform: string) => void;
}

export default function SocialPostMockup({
  platform = 'instagram',
  caption,
  media = [],
  accountName = 'PT Wijaya Inovasi Gemilang',
  accountHandle = 'wijaya_official',
  avatarUrl,
  firstComment,
  scheduledAt,
  className = '',
  availablePlatforms,
  activePlatform,
  onSelectPlatform,
}: SocialPostMockupProps) {
  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const effectivePlatform = (activePlatform || platform || 'instagram').toLowerCase();
  const hasMedia = media && media.length > 0;
  const currentMedia = hasMedia ? media[Math.min(currentMediaIdx, media.length - 1)] : null;

  const nextMedia = () => {
    if (media.length > 1) {
      setCurrentMediaIdx((prev) => (prev + 1) % media.length);
    }
  };

  const prevMedia = () => {
    if (media.length > 1) {
      setCurrentMediaIdx((prev) => (prev - 1 + media.length) % media.length);
    }
  };

  const formattedDate = scheduledAt
    ? new Date(scheduledAt).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Baru saja';

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Platform Selector Header Tabs if multiple platforms are available */}
      {availablePlatforms && availablePlatforms.length > 0 && onSelectPlatform && (
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Mockup Pratinjau
          </span>
          <div className="flex items-center gap-1">
            {availablePlatforms.map((p) => {
              const isActive = effectivePlatform === p.toLowerCase();
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onSelectPlatform(p)}
                  className={`p-1.5 rounded-md text-xs transition flex items-center gap-1 ${
                    isActive
                      ? 'bg-slate-900 text-white font-semibold shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title={p.toUpperCase()}
                >
                  <SocialIcon platform={p} size={12} className={isActive ? 'text-white' : undefined} />
                  <span className="capitalize text-[11px] font-medium hidden sm:inline">{p}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. INSTAGRAM FEED CARD MOCKUP                                             */}
      {/* ========================================================================= */}
      {effectivePlatform === 'instagram' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs text-xs">
          {/* Instagram Header */}
          <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-slate-100/80">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Avatar with IG Story Gradient Ring */}
              <div className="w-8 h-8 rounded-full p-[1.5px] bg-linear-to-tr from-amber-500 via-rose-500 to-purple-600 shrink-0">
                <div className="w-full h-full rounded-full bg-white p-[1.5px]">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={accountName}
                      width={28}
                      height={28}
                      unoptimized
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                      {accountName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1 leading-none">
                  <span className="font-bold text-slate-900 text-[11.5px] truncate">
                    {accountHandle.replace(/^@/, '')}
                  </span>
                  <CheckCircle2 className="w-3 h-3 text-blue-500 fill-blue-500 shrink-0" />
                </div>
                <span className="text-[10px] text-slate-400 leading-tight block truncate mt-0.5">
                  Jakarta, Indonesia • {formattedDate}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400">
              <SocialIcon platform="instagram" size={14} className="text-slate-400 mr-1" />
              <MoreHorizontal className="w-4 h-4 cursor-pointer hover:text-slate-700 transition" />
            </div>
          </div>

          {/* Media Section */}
          <div className="relative bg-slate-950 flex items-center justify-center overflow-hidden min-h-[200px] max-h-[380px]">
            {hasMedia && currentMedia ? (
              currentMedia.file_type === 'video' ||
              /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(currentMedia.file_url || '') ? (
                <video
                  controls
                  preload="metadata"
                  poster={currentMedia.thumbnail_url || undefined}
                  src={currentMedia.file_url}
                  className="max-h-[360px] w-full object-contain mx-auto"
                >
                  Browser Anda tidak mendukung video HTML5.
                </video>
              ) : (
                <Image
                  src={currentMedia.thumbnail_url || currentMedia.file_url}
                  alt={currentMedia.title || 'Media postingan'}
                  width={640}
                  height={640}
                  unoptimized
                  className="max-h-[360px] w-auto max-w-full object-contain mx-auto"
                />
              )
            ) : (
              <div className="py-12 px-6 text-center text-slate-400 space-y-1.5 bg-slate-50 w-full">
                <ImageIcon className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-[11px] font-medium text-slate-500">Tampilan Pratinjau Gambar / Video</p>
                <p className="text-[10px] text-slate-400">Lampirkan file media untuk melihat visual penuh</p>
              </div>
            )}

            {/* Carousel Arrows */}
            {hasMedia && media.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevMedia}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900/60 text-white flex items-center justify-center hover:bg-slate-900 transition"
                  title="Media Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextMedia}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900/60 text-white flex items-center justify-center hover:bg-slate-900 transition"
                  title="Media Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 right-2 bg-slate-900/75 text-white px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider">
                  {currentMediaIdx + 1}/{media.length}
                </div>
              </>
            )}
          </div>

          {/* Action Bar */}
          <div className="px-3.5 pt-2.5 pb-1 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setIsLiked(!isLiked)}
                className={`transition active:scale-125 ${
                  isLiked ? 'text-rose-500 fill-rose-500' : 'text-slate-800 hover:text-slate-600'
                }`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              <button type="button" className="text-slate-800 hover:text-slate-600 transition">
                <MessageCircle className="w-5 h-5" />
              </button>
              <button type="button" className="text-slate-800 hover:text-slate-600 transition">
                <Send className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsBookmarked(!isBookmarked)}
              className={`transition active:scale-125 ${
                isBookmarked ? 'text-slate-900 fill-slate-900' : 'text-slate-800 hover:text-slate-600'
              }`}
            >
              <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Likes and Caption */}
          <div className="px-3.5 pb-3 space-y-1.5">
            <p className="font-bold text-[11px] text-slate-900">
              1.428 suka
            </p>

            {/* Rich Caption Box with author prefix */}
            <div className="text-[11.5px] text-slate-800 leading-relaxed font-sans">
              <span className="font-bold text-slate-900 mr-1.5">
                {accountHandle.replace(/^@/, '')}
              </span>

              {caption ? (
                <div className="inline">
                  <div className={!isCaptionExpanded && caption.length > 160 ? 'line-clamp-2 inline' : 'inline'}>
                    <RichTextRenderer content={caption} className="inline space-y-2 mt-1" />
                  </div>

                  {caption.length > 160 && (
                    <button
                      type="button"
                      onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                      className="ml-1 text-[11px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                    >
                      {isCaptionExpanded ? ' (lebih sedikit)' : '...selengkapnya'}
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-slate-400 italic">
                  Tulis caption Anda untuk melihat tampilan postingan di sini...
                </span>
              )}
            </div>

            {/* First Comment Mockup */}
            {firstComment && (
              <div className="pt-1 text-[11px] text-slate-700 leading-relaxed flex items-start gap-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="font-bold text-slate-900 shrink-0">
                  {accountHandle.replace(/^@/, '')}:
                </span>
                <span className="text-slate-600">{firstComment}</span>
              </div>
            )}

            {/* Timestamp */}
            <div className="pt-1 text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider">
              {scheduledAt ? `Dijadwalkan: ${formattedDate}` : 'Baru Saja'}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TIKTOK FEED MOCKUP                                                     */}
      {/* ========================================================================= */}
      {effectivePlatform === 'tiktok' && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 text-white overflow-hidden shadow-md text-xs relative">
          {/* Top Bar */}
          <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-800 text-slate-400">
            <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <SocialIcon platform="tiktok" size={12} />
              <span>TikTok Feed Preview</span>
            </span>
            <span className="text-[10px] text-slate-400">{formattedDate}</span>
          </div>

          {/* Media / Video Stage */}
          <div className="relative min-h-[260px] max-h-[420px] bg-slate-900 flex items-center justify-center overflow-hidden">
            {hasMedia && currentMedia ? (
              currentMedia.file_type === 'video' ||
              /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(currentMedia.file_url || '') ? (
                <video
                  controls
                  preload="metadata"
                  poster={currentMedia.thumbnail_url || undefined}
                  src={currentMedia.file_url}
                  className="max-h-[400px] w-full object-contain mx-auto"
                >
                  Browser Anda tidak mendukung video.
                </video>
              ) : (
                <Image
                  src={currentMedia.thumbnail_url || currentMedia.file_url}
                  alt={currentMedia.title || 'Media TikTok'}
                  width={640}
                  height={900}
                  unoptimized
                  className="max-h-[400px] w-auto max-w-full object-contain mx-auto"
                />
              )
            ) : (
              <div className="py-16 text-center text-slate-400 space-y-1">
                <Music className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
                <p className="text-xs text-slate-300 font-medium">Pratinjau Video TikTok</p>
                <p className="text-[10px] text-slate-500">Format vertikal 9:16 ideal untuk konten TikTok</p>
              </div>
            )}

            {/* Side Action Rail */}
            <div className="absolute right-3 bottom-14 flex flex-col items-center gap-3 select-none">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-white p-[1px] shadow-md">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" width={36} height={36} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                      WI
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold">
                  +
                </div>
              </div>

              <div className="flex flex-col items-center">
                <Heart className="w-6 h-6 text-white fill-white" />
                <span className="text-[10px] font-semibold mt-0.5">24.5K</span>
              </div>

              <div className="flex flex-col items-center">
                <MessageCircle className="w-6 h-6 text-white fill-white" />
                <span className="text-[10px] font-semibold mt-0.5">1.2K</span>
              </div>

              <div className="flex flex-col items-center">
                <Bookmark className="w-6 h-6 text-white fill-white" />
                <span className="text-[10px] font-semibold mt-0.5">856</span>
              </div>

              <div className="flex flex-col items-center">
                <Share2 className="w-6 h-6 text-white fill-white" />
                <span className="text-[10px] font-semibold mt-0.5">412</span>
              </div>
            </div>

            {/* Bottom Overlay (Account & Caption) */}
            <div className="absolute left-0 right-14 bottom-0 p-3.5 bg-linear-to-t from-black/85 via-black/40 to-transparent space-y-1">
              <div className="flex items-center gap-1 font-bold text-white text-xs">
                <span>@{accountHandle.replace(/^@/, '')}</span>
                <CheckCircle2 className="w-3 h-3 text-cyan-400 fill-cyan-400 shrink-0" />
              </div>

              <div className="text-[11px] text-slate-100 leading-snug line-clamp-3 font-sans">
                {caption ? (
                  <RichTextRenderer content={caption} className="text-white" highlightMentionsAndTags={false} />
                ) : (
                  <span className="text-slate-400 italic">Tulis caption untuk melihat teks overlay...</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-slate-300 pt-0.5">
                <Music className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="truncate">Suara Asli - {accountName}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. LINKEDIN FEED CARD MOCKUP                                              */}
      {/* ========================================================================= */}
      {effectivePlatform === 'linkedin' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs shadow-xs">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <div className="w-10 h-10 rounded-md bg-blue-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="" width={40} height={40} className="w-full h-full rounded-md object-cover" />
                ) : (
                  accountName.substring(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h4 className="font-bold text-slate-900 text-xs">{accountName}</h4>
                  <span className="text-[10px] text-slate-400">• 1st</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Inovasi Teknologi &amp; Solusi Konten Digital • 14.250 pengikut
                </p>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                  <span>{formattedDate}</span>
                  <span>•</span>
                  <Globe className="w-3 h-3 text-slate-400" />
                </div>
              </div>
            </div>

            <MoreHorizontal className="w-4 h-4 text-slate-400 cursor-pointer" />
          </div>

          {/* Rich Caption Body */}
          <div className="text-slate-800 leading-relaxed font-sans text-xs">
            {caption ? (
              <RichTextRenderer content={caption} />
            ) : (
              <span className="text-slate-400 italic">Tulis caption untuk melihat pratinjau di LinkedIn...</span>
            )}
          </div>

          {/* Media Showcase */}
          {hasMedia && currentMedia && (
            <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-950 flex items-center justify-center min-h-[160px] max-h-[320px]">
              {currentMedia.file_type === 'video' ||
              /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(currentMedia.file_url || '') ? (
                <video controls preload="metadata" src={currentMedia.file_url} className="max-h-[300px] w-full object-contain">
                  Browser Anda tidak mendukung video.
                </video>
              ) : (
                <Image
                  src={currentMedia.thumbnail_url || currentMedia.file_url}
                  alt={currentMedia.title || 'Media'}
                  width={640}
                  height={360}
                  unoptimized
                  className="max-h-[300px] w-auto max-w-full object-contain mx-auto"
                />
              )}
            </div>
          )}

          {/* Reactions Count */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1">
              <span className="flex -space-x-1">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold">
                  👍
                </span>
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">
                  💡
                </span>
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[9px] font-bold">
                  ❤️
                </span>
              </span>
              <span className="ml-1 font-semibold text-slate-700">89</span>
            </div>
            <span>24 komentar • 11 repost</span>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between text-slate-600 font-semibold text-[11px] pt-0.5">
            <button type="button" className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-slate-100 transition">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Suka</span>
            </button>
            <button type="button" className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-slate-100 transition">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Komentar</span>
            </button>
            <button type="button" className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-slate-100 transition">
              <Repeat2 className="w-3.5 h-3.5" />
              <span>Repost</span>
            </button>
            <button type="button" className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-slate-100 transition">
              <Send className="w-3.5 h-3.5" />
              <span>Kirim</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FACEBOOK & DEFAULT SOCIAL CARD MOCKUP                                  */}
      {/* ========================================================================= */}
      {['facebook', 'threads', 'bluesky', 'youtube', 'pinterest'].includes(effectivePlatform) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="" width={36} height={36} className="w-full h-full rounded-full object-cover" />
                ) : (
                  accountName.substring(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs leading-tight">{accountName}</h4>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                  <span>{formattedDate}</span>
                  <span>•</span>
                  <Globe className="w-3 h-3 text-slate-400" />
                </div>
              </div>
            </div>
            <SocialIcon platform={effectivePlatform} size={14} className="text-slate-400" />
          </div>

          <div className="text-slate-800 leading-relaxed font-sans text-xs">
            {caption ? (
              <RichTextRenderer content={caption} />
            ) : (
              <span className="text-slate-400 italic">Tulis caption postingan...</span>
            )}
          </div>

          {hasMedia && currentMedia && (
            <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-950 flex items-center justify-center min-h-[160px] max-h-[320px]">
              {currentMedia.file_type === 'video' ||
              /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(currentMedia.file_url || '') ? (
                <video controls preload="metadata" src={currentMedia.file_url} className="max-h-[300px] w-full object-contain">
                  Browser Anda tidak mendukung video.
                </video>
              ) : (
                <Image
                  src={currentMedia.thumbnail_url || currentMedia.file_url}
                  alt=""
                  width={640}
                  height={360}
                  unoptimized
                  className="max-h-[300px] w-auto max-w-full object-contain mx-auto"
                />
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-slate-600 font-semibold text-[11px] pt-2 border-t border-slate-100">
            <button type="button" className="flex items-center gap-1.5 py-1 px-3 rounded hover:bg-slate-100 transition">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Suka</span>
            </button>
            <button type="button" className="flex items-center gap-1.5 py-1 px-3 rounded hover:bg-slate-100 transition">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Komentari</span>
            </button>
            <button type="button" className="flex items-center gap-1.5 py-1 px-3 rounded hover:bg-slate-100 transition">
              <Share2 className="w-3.5 h-3.5" />
              <span>Bagikan</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
