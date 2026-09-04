'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  PenSquare,
  Calendar,
  Trash2,
  Clock,
  Share2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { Post, AttachmentItem } from '@/lib/types';
import SocialPostMockup from '@/components/ui/SocialPostMockup';
import AttachmentList from '@/components/ui/AttachmentList';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatHandle } from '@/lib/format';

interface DashboardPostPreviewModalProps {
  postId: string | null;
  onClose: () => void;
  onDeleted?: (postId: string) => void;
}

export default function DashboardPostPreviewModal({
  postId,
  onClose,
  onDeleted,
}: DashboardPostPreviewModalProps) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePlatform, setActivePlatform] = useState<string>('instagram');

  useEffect(() => {
    if (!postId) return;

    let isMounted = true;
    setLoading(true);
    setError('');

    async function fetchPost() {
      try {
        const res = await api.getPost(postId!);
        if (!isMounted) return;
        if (res.post) {
          setPost(res.post);
          const initialPlat = res.post.targets?.[0]?.platform || 'instagram';
          setActivePlatform(initialPlat);
        } else {
          setError('Data postingan tidak ditemukan.');
        }
      } catch (err) {
        if (!isMounted) return;
        setError(getErrorMessage(err, 'Gagal memuat detail postingan.'));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchPost();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  if (!postId) return null;

  const handleDelete = () => {
    if (!post) return;
    confirm({
      title: 'Hapus Postingan?',
      message: `Apakah Anda yakin ingin menghapus postingan "${post.master_caption.slice(0, 45)}..." secara permanen?`,
      confirmText: 'Ya, Hapus Post',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.deletePost(post.id);
          toast.warning('Postingan Dihapus', 'Konten berhasil dihapus dari database.');
          onDeleted?.(post.id);
          onClose();
        } catch (err) {
          toast.error('Gagal Menghapus', getErrorMessage(err, 'Gagal menghapus postingan.'));
        }
      },
    });
  };

  const handleEditInComposer = () => {
    if (!post) return;
    router.push(`/composer?post_id=${post.id}`);
  };

  const handleOpenCalendar = () => {
    router.push('/calendar');
  };

  const platforms = post?.targets?.map((t) => t.platform) || ['instagram'];
  const primaryTarget = post?.targets?.[0];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Pratinjau Postingan
            </span>
            {primaryTarget?.status && (
              <span className="ui-badge bg-blue-50 border-blue-200 text-blue-700 text-[10px] uppercase font-bold">
                {primaryTarget.status}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
            aria-label="Tutup pratinjau"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-slate-700 mx-auto" />
              <p>Memuat visual postingan...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-rose-700 bg-rose-50 rounded-xl border border-rose-200 space-y-2">
              <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
              <p className="font-semibold">{error}</p>
            </div>
          ) : post ? (
            <div className="space-y-4">
              {/* Meta Info Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Jadwal:{' '}
                    {post.scheduled_at
                      ? new Date(post.scheduled_at).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : 'Draft (Belum dijadwalkan)'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] font-medium text-slate-500">
                    {post.targets?.length || 1} Saluran Target
                  </span>
                </div>
              </div>

              {/* Realistic Social Post Mockup */}
              <SocialPostMockup
                platform={activePlatform}
                caption={post.master_caption}
                media={post.media || []}
                accountName={primaryTarget?.account_name || 'PT Wijaya Inovasi Gemilang'}
                accountHandle={
                  formatHandle((primaryTarget as unknown as { account_handle?: string })?.account_handle) ||
                  'wijaya_official'
                }
                avatarUrl={(primaryTarget as unknown as { avatar_url?: string })?.avatar_url}
                firstComment={post.first_comment || undefined}
                scheduledAt={post.scheduled_at}
                availablePlatforms={platforms}
                activePlatform={activePlatform}
                onSelectPlatform={setActivePlatform}
              />

              {/* Attachments Section if exists */}
              {post.attachments && post.attachments.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700 block">
                    Dokumen & Lampiran Naskah:
                  </span>
                  <AttachmentList
                    attachments={post.attachments as AttachmentItem[]}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading || !post}
            className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1.5 py-1 px-2.5 rounded hover:bg-rose-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCalendar}
              className="ui-btn ui-btn-secondary text-xs flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Kalender</span>
            </button>
            <button
              type="button"
              onClick={handleEditInComposer}
              disabled={loading || !post}
              className="ui-btn ui-btn-primary text-xs flex items-center gap-1.5"
            >
              <PenSquare className="w-3.5 h-3.5" />
              <span>Edit di Composer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
