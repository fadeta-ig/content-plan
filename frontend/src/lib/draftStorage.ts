/**
 * Utility for managing form draft persistence across the Content Plan workspace.
 * Automatically handles serialization, 7-day expiration policy, and time formatting.
 */

import { MediaItem, AttachmentItem, ShootingCrewMember, ShootingEquipmentItem } from '@/lib/types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface StoredDraftEnvelope<T> {
  data: T;
  savedAt: number;
}

export interface ComposerDraftData {
  caption: string;
  firstComment: string;
  showFirstComment: boolean;
  scheduledAt: string;
  attachedMedia: MediaItem[];
  attachedDocs: AttachmentItem[];
  selectedPlatforms: string[];
  selectedAccountIds: string[];
  selectedIdeaId: string | null;
}

export interface CalendarPostDraftData {
  caption: string;
  selectedAccountIds: string[];
  scheduledAt: string;
  media: MediaItem[];
  attachments: AttachmentItem[];
  selectedIdeaId?: string;
}

export interface CalendarShootingDraftData {
  title: string;
  description: string;
  location: string;
  scheduledAt: string;
  endAt: string;
  status: string;
  crewList: ShootingCrewMember[];
  equipmentList: ShootingEquipmentItem[];
  attachments: AttachmentItem[];
  selectedIdeaId?: string;
}

export interface KanbanIdeaDraftData {
  title: string;
  content: string;
  status: string;
  attachments: AttachmentItem[];
}

export const DRAFT_KEYS = {
  COMPOSER: 'cp_draft_composer_v1',
  CALENDAR_POST: 'cp_draft_calendar_post_v1',
  CALENDAR_SHOOTING: 'cp_draft_calendar_shooting_v1',
  KANBAN_IDEA: 'cp_draft_kanban_idea_v1',
} as const;

export function saveDraft<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const envelope: StoredDraftEnvelope<T> = {
      data,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Gracefully handle storage quota or private browsing exceptions
  }
}

export function getDraft<T>(key: string): StoredDraftEnvelope<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const envelope = JSON.parse(raw) as StoredDraftEnvelope<T>;
    if (!envelope || typeof envelope.savedAt !== 'number') {
      window.localStorage.removeItem(key);
      return null;
    }

    // Check expiration (7 days)
    if (Date.now() - envelope.savedAt > SEVEN_DAYS_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return envelope;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

export function formatDraftTimeAgo(timestamp: number): string {
  const diffSecs = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSecs < 60) return 'beberapa detik yang lalu';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins} menit yang lalu`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} hari yang lalu`;
}
