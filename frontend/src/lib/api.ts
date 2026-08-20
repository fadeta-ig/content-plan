import {
  User,
  Workspace,
  OverviewMetrics,
  Post,
  SocialAccount,
  CalendarEvent,
  PostingSlot,
  KanbanColumn,
  InboxMessage,
  AnalyticsData,
  MediaItem,
  NotificationItem,
  TeamMember,
} from './types';

const API_BASE = '/api/backend/frontend';

async function fetcher<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers as Record<string, string>),
    },
    credentials: 'include',
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || `Request failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    console.warn(`API Error [${endpoint}]:`, err.message);
    throw err;
  }
}

export const api = {
  // Auth
  async login(payload: { email: string; password: string }) {
    return fetcher<{ success: boolean; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async register(payload: { email: string; name: string; password: string; workspace_name?: string }) {
    return fetcher<{ success: boolean; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMe() {
    return fetcher<{ user: User; workspaces: Workspace[]; active_workspace: Workspace | null }>('/auth/me');
  },

  async logout() {
    return fetcher<{ success: boolean }>('/auth/logout', { method: 'POST' });
  },

  // Dashboard Overview
  async getOverview() {
    return fetcher<OverviewMetrics>('/dashboard/overview');
  },

  // Posts & Composer
  async getPosts(params?: { status?: string; platform?: string; search?: string }) {
    const query = new URLSearchParams(params as any).toString();
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
    const query = new URLSearchParams(params as any).toString();
    return fetcher<{ events: CalendarEvent[]; slots: PostingSlot[] }>(
      `/dashboard/calendar${query ? `?${query}` : ''}`
    );
  },

  // Kanban
  async getKanbanIdeas() {
    return fetcher<{ columns: KanbanColumn[] }>('/dashboard/kanban');
  },

  async getKanban() {
    return this.getKanbanIdeas();
  },

  async createIdea(payload: { workspace_id?: string; title: string; content?: string; status?: string }) {
    return fetcher<{ success: boolean; idea: any }>('/dashboard/kanban/create', {
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

  async deleteIdea(ideaId: string) {
    return fetcher<{ success: boolean; message: string }>(`/dashboard/kanban/${ideaId}`, {
      method: 'DELETE',
    });
  },

  // Social Accounts
  async getSocialAccounts() {
    return fetcher<{ accounts: SocialAccount[] }>('/dashboard/accounts');
  },

  async createManualAccount(payload: { platform: string; account_name?: string; account_handle?: string }) {
    return fetcher<{ success: boolean; account: SocialAccount }>('/dashboard/accounts/create-manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async disconnectAccount(accountId: string) {
    return fetcher<{ success: boolean; message: string }>(`/dashboard/accounts/${accountId}`, {
      method: 'DELETE',
    });
  },

  async initOAuth(platform: string) {
    return fetcher<{ configured: boolean; auth_url?: string; message?: string }>(
      `/dashboard/accounts/oauth-init?platform=${platform}`
    );
  },


  // Unified Inbox
  async getInboxMessages(params?: { status?: string; platform?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return fetcher<{ messages: InboxMessage[] }>(`/dashboard/inbox${query ? `?${query}` : ''}`);
  },

  async getInbox(params?: { status?: string; platform?: string }) {
    return this.getInboxMessages(params);
  },

  async replyInboxMessage(payload: { message_id: string; content: string }) {
    return fetcher<{ success: boolean; reply_id: string; status: string }>('/dashboard/inbox/reply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async replyInbox(payload: { message_id: string; content: string }) {
    return this.replyInboxMessage(payload);
  },

  // Analytics
  async getAnalytics(periodDays = 30) {
    return fetcher<AnalyticsData>(`/dashboard/analytics?period_days=${periodDays}`);
  },

  // Media Library
  async getMedia(folderId?: string) {
    return fetcher<{ folders: any[]; assets: MediaItem[] }>(
      `/dashboard/media${folderId ? `?folder_id=${folderId}` : ''}`
    );
  },

  async uploadMedia(formData: FormData) {
    const proxyUrl = `${API_BASE}/dashboard/media/upload`;
    const res = await fetch(proxyUrl, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.detail || 'Gagal mengunggah file media.');
    }
    return await res.json();
  },

  async deleteMedia(assetId: string) {
    return fetcher<{ success: boolean; message: string }>(`/dashboard/media/${assetId}`, {
      method: 'DELETE',
    });
  },

  // Team Members & Roles
  async getMembers() {
    return fetcher<{ members: TeamMember[] }>('/dashboard/members');
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
};
