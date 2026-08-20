export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  is_staff: boolean;
  active_workspace_id?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  color: string;
  logo_url: string;
  role: string;
  organization_name: string;
  approval_workflow_mode?: string;
}

export interface TeamMember {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'editor' | 'contributor' | 'client' | 'viewer';
  joined_at: string;
  is_active: boolean;
  status: 'active' | 'inactive' | 'invited';
  is_owner?: boolean;
}

export interface SocialAccount {
  id: string;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'pinterest' | 'threads' | 'bluesky' | 'google_business' | 'mastodon';
  account_name: string;
  account_handle: string;
  avatar_url: string;
  follower_count: number;
  connection_status: 'connected' | 'token_expiring' | 'disconnected' | 'error';
  is_token_expiring_soon: boolean;
  connected_at: string;
}

export interface MediaItem {
  id: string;
  file_url: string;
  thumbnail_url: string;
  file_type: 'image' | 'video';
  file_size?: number;
  title?: string;
  created_at?: string;
}

export interface PlatformPostTarget {
  id: string;
  platform: string;
  account_name: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'publishing' | 'published' | 'failed';
  error_message?: string;
  platform_post_url?: string;
}

export interface Post {
  id: string;
  master_caption: string;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  approval_status: 'none' | 'pending_approval' | 'approved' | 'rejected' | 'changes_requested';
  first_comment?: string;
  media: MediaItem[];
  targets: PlatformPostTarget[];
}

export interface OverviewMetrics {
  total_posts: number;
  scheduled_posts: number;
  published_posts: number;
  failed_posts: number;
  connected_accounts_count: number;
  pending_approvals_count: number;
  inbox_unread_count: number;
  total_reach: number;
  total_engagement: number;
  engagement_rate: number;
  recent_posts: {
    id: string;
    caption: string;
    platforms: string[];
    status: string;
    scheduled_at: string | null;
    published_at?: string | null;
    created_at: string;
    thumbnail_url?: string;
  }[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  caption?: string;
  first_comment?: string;
  start: string;
  platforms: string[];
  status: string;
  thumbnail_url?: string;
  media?: MediaItem[];
}

export interface PostingSlot {
  id: string;
  day_of_week: number;
  time: string;
  account_name: string;
  platform: string;
}

export interface KanbanCard {
  id: string;
  title: string;
  content: string;
  created_at: string;
  status?: string;
  tags?: string[];
  media_url?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface InboxReply {
  id: string;
  author_name: string;
  content: string;
  sent_at: string;
}

export interface InboxMessage {
  id: string;
  sender_name: string;
  sender_avatar_url: string;
  content: string;
  message_type: 'comment' | 'mention' | 'direct_message' | 'dm' | 'review';
  status: 'unread' | 'read' | 'in_progress' | 'resolved';
  sentiment: 'positive' | 'neutral' | 'negative';
  platform: string;
  account_name: string;
  received_at: string;
  replies: InboxReply[];
}

export interface AnalyticsTrend {
  date: string;
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
}

export interface ChannelBreakdown {
  platform: string;
  followers: number;
  growth: string;
  share: number;
}

export interface AnalyticsData {
  period_days: number;
  kpis: {
    total_followers: number;
    follower_growth_percent: number;
    total_impressions: number;
    impressions_growth_percent: number;
    total_engagement: number;
    engagement_rate: number;
  };
  trends: AnalyticsTrend[];
  channel_breakdown: ChannelBreakdown[];
}

export type NotificationCategory = 'approval' | 'system' | 'inbox';

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  timestamp: string;
  is_read: boolean;
  action_url: string;
  action_label: string;
  platforms: string[];
  resource_id: string;
}
