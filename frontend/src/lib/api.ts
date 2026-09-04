import {
  User,
  Workspace,
  OverviewMetrics,
  Post,
  SocialAccount,
  CalendarEvent,
  PostingSlot,
  KanbanColumn,
  KanbanCard,
  InboxMessage,
  AnalyticsData,
  MediaItem,
  MediaFolder,
  NotificationItem,
  TeamMember,
  ShootingSession,
  AttachmentItem,
} from './types';

const API_BASE = '/api/v1/frontend';
let csrfToken: string | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) {
    throw new ApiError('Gagal menyiapkan perlindungan keamanan formulir. Muat ulang halaman.', response.status);
  }
  const data = (await response.json()) as { csrf_token: string };
  csrfToken = data.csrf_token;
  return csrfToken;
}

function toSearchParams(params?: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value);
  });
  return search.toString();
}

async function fetcher<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    defaultHeaders['X-CSRFToken'] = await ensureCsrfToken();
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers as Record<string, string>),
    },
    credentials: 'include',
  };

  const res = await fetch(`${API_BASE}${endpoint}`, config);
  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
    throw new ApiError(
      errorData.detail || errorData.message || `Permintaan gagal dengan status ${res.status}.`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

export const api = {
  // Auth
  async login(payload: { email: string; password: string }) {
    const result = await fetcher<{
      success: boolean;
      user?: User;
      requires_tos?: boolean;
      accept_terms_url?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    // Django rotates the CSRF secret on login; fetch the new token before the
    // next state-changing request.
    csrfToken = null;
    return result;
  },

  async getMe() {
    return fetcher<{ user: User; workspaces: Workspace[]; active_workspace: Workspace | null }>('/auth/me');
  },

  async logout() {
    const result = await fetcher<{ success: boolean }>('/auth/logout', { method: 'POST' });
    csrfToken = null;
    return result;
  },

  async switchWorkspace(workspaceId: string) {
    return fetcher<{ success: boolean; message: string; workspace_id: string }>('/auth/switch-workspace', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
  },

  // Dashboard Overview
  async getOverview() {
    return fetcher<OverviewMetrics>('/dashboard/overview');
  },

  // Posts & Composer
  async getPosts(params?: { status?: string; platform?: string; search?: string }) {
    const query = toSearchParams(params);
    return fetcher<{ posts: Post[] }>(`/dashboard/posts${query ? `?${query}` : ''}`);
  },

  async getPost(postId: string) {
    return fetcher<{ post: Post }>(`/dashboard/posts/${postId}`);
  },

  async createPost(payload: {
    post_id?: string;
    workspace_id?: string;
    master_caption: string;
    target_account_ids: string[];
    scheduled_at?: string;
    first_comment?: string;
    media_ids?: string[];
    attachments?: AttachmentItem[];
    related_idea_id?: string;
    post_now?: boolean;
  }) {
    return fetcher<{ success: boolean; message: string; post_id: string; status: string }>(
      '/dashboard/posts/create',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async deletePost(postId: string) {
    return fetcher<{ success: boolean; message: string }>(`/dashboard/posts/${postId}`, {
      method: 'DELETE',
    });
  },

  // Calendar
  async getCalendarEvents(params?: { start_date?: string; end_date?: string }) {
    const query = toSearchParams(params);
    return fetcher<{ events: CalendarEvent[]; slots: PostingSlot[] }>(
      `/dashboard/calendar${query ? `?${query}` : ''}`
    );
  },

  // Kanban
  async getKanbanIdeas() {
    return fetcher<{ columns: KanbanColumn[] }>('/dashboard/kanban');
  },

  async createIdea(payload: { workspace_id?: string; title: string; content?: string; status?: string; attachments?: AttachmentItem[] }) {
    return fetcher<{ success: boolean; idea: KanbanCard }>('/dashboard/kanban/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateIdeaStatus(ideaId: string, status: string) {
    return fetcher<{ success: boolean; status: string }>(`/dashboard/kanban/${ideaId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async updateIdea(ideaId: string, payload: { title?: string; content?: string; status?: string; attachments?: AttachmentItem[] }) {
    return fetcher<{ success: boolean; idea: KanbanCard }>(`/dashboard/kanban/${ideaId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteIdea(ideaId: string) {
    return fetcher<{ success: boolean; message: string }>(`/dashboard/kanban/${ideaId}`, {
      method: 'DELETE',
    });
  },

  // Social Accounts
  async getSocialAccounts() {
    return fetcher<{ accounts: SocialAccount[] }>('/dashboard/accounts');
  },

  async disconnectAccount(accountId: string) {
    return fetcher<{ success: boolean; message: string; revocation_confirmed: boolean }>(`/dashboard/accounts/${accountId}`, {
      method: 'DELETE',
    });
  },

  async initOAuth(platform: string) {
    return fetcher<{ configured: boolean; auth_url?: string; message?: string }>(
      `/dashboard/accounts/oauth-init?platform=${platform}`
    );
  },

  async connectAccount(payload: {
    platform: string;
    account_name?: string;
    account_handle?: string;
    follower_count?: number;
  }) {
    return fetcher<{ success: boolean; account: SocialAccount }>(
      '/dashboard/accounts/create-manual',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },


  // Unified Inbox
  async getInboxMessages(params?: { status?: string; platform?: string }) {
    const query = toSearchParams(params);
    return fetcher<{ messages: InboxMessage[] }>(`/dashboard/inbox${query ? `?${query}` : ''}`);
  },

  async replyInboxMessage(payload: { message_id: string; content: string }) {
    return fetcher<{
      success: boolean;
      platform_reply_id: string;
      status: InboxMessage['status'];
      reply: InboxMessage['replies'][number];
    }>('/dashboard/inbox/reply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Analytics
  async getAnalytics(periodDays = 30) {
    return fetcher<AnalyticsData>(`/dashboard/analytics?period_days=${periodDays}`);
  },

  // Media Library
  async getMedia(folderId?: string) {
    return fetcher<{ folders: MediaFolder[]; assets: MediaItem[] }>(
      `/dashboard/media${folderId ? `?folder_id=${folderId}` : ''}`
    );
  },

  async uploadMedia(formData: FormData) {
    const proxyUrl = `${API_BASE}/dashboard/media/upload`;
    const res = await fetch(proxyUrl, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: { 'X-CSRFToken': await ensureCsrfToken() },
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
      throw new ApiError(err.message || err.detail || 'Gagal mengunggah file media.', res.status);
    }
    return (await res.json()) as { success: boolean; asset: MediaItem };
  },

  async deleteMedia(assetId: string) {
    return fetcher<{ success: boolean; message: string }>(`/dashboard/media/${assetId}`, {
      method: 'DELETE',
    });
  },

  // Team Members & Roles
  async getMembers() {
    return fetcher<{
      members: TeamMember[];
      capabilities: { can_manage_global_accounts: boolean };
    }>('/dashboard/members');
  },

  async inviteMember(payload: { name: string; email: string; role?: string; password?: string }) {
    return fetcher<{
      success: boolean;
      member: TeamMember;
      temporary_password?: string;
      is_new_user: boolean;
      message: string;
    }>('/dashboard/members/invite', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateMemberRole(payload: { member_id: string; role: string }) {
    return fetcher<{ success: boolean; role: string }>('/dashboard/members/update-role', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async toggleMemberStatus(memberId: string, isActive: boolean) {
    return fetcher<{ success: boolean; is_active: boolean; status: string; message: string }>(
      `/dashboard/members/${memberId}/toggle-status`,
      {
        method: 'POST',
        body: JSON.stringify({ is_active: isActive }),
      }
    );
  },

  async resetMemberPassword(memberId: string, newPassword: string) {
    return fetcher<{ success: boolean; message: string }>(
      `/dashboard/members/${memberId}/reset-password`,
      {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      }
    );
  },

  async removeMember(memberId: string) {
    return fetcher<{ success: boolean; message: string }>(`/dashboard/members/${memberId}`, {
      method: 'DELETE',
    });
  },

  // Settings
  async getSettings() {
    return fetcher<{ organization_name: string; workspace_name: string; timezone: string; approval_workflow_mode: string }>('/dashboard/settings');
  },

  async updateSettings(payload: { organization_name?: string; workspace_name?: string; timezone?: string; approval_workflow_mode?: string }) {
    return fetcher<{ success: boolean; message: string }>('/dashboard/settings/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Notifications
  async getNotifications(category?: string) {
    const query = category && category !== 'all' ? `?category=${category}` : '';
    return fetcher<{ notifications: NotificationItem[]; unread_count: number; total_count: number }>(
      `/dashboard/notifications${query}`
    );
  },

  async markNotificationsRead(payload: { notification_ids?: string[]; mark_all?: boolean }) {
    return fetcher<{ success: boolean; marked_count: number }>('/dashboard/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Reschedule Post (Calendar Drag-and-Drop)
  async reschedulePost(postId: string, newScheduledAt: string) {
    return fetcher<{ success: boolean; message: string; post_id: string; scheduled_at: string }>(
      `/dashboard/posts/${postId}/reschedule`,
      {
        method: 'PATCH',
        body: JSON.stringify({ scheduled_at: newScheduledAt }),
      }
    );
  },

  // Shooting Sessions (Production Planner)
  async getShootingSessions(params?: { status?: string; start_date?: string; end_date?: string }) {
    const query = toSearchParams(params);
    return fetcher<{ sessions: ShootingSession[] }>(`/dashboard/shooting-sessions${query ? `?${query}` : ''}`);
  },

  async getShootingSessionDetail(sessionId: string) {
    return fetcher<{ session: ShootingSession }>(`/dashboard/shooting-sessions/${sessionId}`);
  },

  async createShootingSession(payload: {
    title: string;
    description?: string;
    location?: string;
    scheduled_at: string;
    end_at?: string;
    status?: string;
    crew_members?: { name: string; role: string }[];
    equipment_checklist?: { item: string; checked: boolean }[];
    attachments?: AttachmentItem[];
    related_idea_id?: string | null;
  }) {
    return fetcher<{ success: boolean; message: string; session: ShootingSession }>('/dashboard/shooting-sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateShootingSession(sessionId: string, payload: {
    title?: string;
    description?: string;
    location?: string;
    scheduled_at?: string;
    end_at?: string;
    status?: string;
    crew_members?: { name: string; role: string }[];
    equipment_checklist?: { item: string; checked: boolean }[];
    attachments?: AttachmentItem[];
    related_idea_id?: string | null;
  }) {
    return fetcher<{ success: boolean; message: string; session: ShootingSession }>(`/dashboard/shooting-sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async rescheduleShootingSession(sessionId: string, newScheduledAt: string) {
    return fetcher<{ success: boolean; message: string; session_id: string; scheduled_at: string }>(
      `/dashboard/shooting-sessions/${sessionId}/reschedule`,
      {
        method: 'PATCH',
        body: JSON.stringify({ scheduled_at: newScheduledAt }),
      }
    );
  },

  async deleteShootingSession(sessionId: string) {
    return fetcher<{ success: boolean; message: string }>(`/dashboard/shooting-sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },
};
