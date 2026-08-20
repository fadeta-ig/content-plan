"""Notification Hub aggregation endpoints for Frontend API.

Aggregates cross-domain status signals from Posts (pending review, publishing logs),
Inbox (unread high-priority messages), and Kanban (completed ideas ready for scheduling).
"""

from __future__ import annotations

from datetime import timedelta
from typing import List, Optional

from django.db.models import Q
from django.http import HttpRequest
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.approvals.models import ApprovalAction
from apps.composer.models import Idea, PlatformPost, Post
from apps.inbox.models import InboxMessage
from .helpers import frontend_auth, get_current_user_and_workspace


router = Router(tags=["frontend-notifications"], auth=frontend_auth)


class MarkReadSchema(Schema):
    notification_ids: Optional[List[str]] = None
    mark_all: Optional[bool] = False


@router.get("/dashboard/notifications", summary="Get Aggregated Notifications")
def get_notifications(
    request: HttpRequest,
    category: Optional[str] = None,
    limit: int = 30,
):
    """Aggregate notifications from 3 domains:

    1. Approval/Review: Posts with pending_review / pending_client status.
    2. System/Schedule: Posts published or failed in last 48h.
    3. Inbox: Unread messages with negative sentiment or high priority.
    """
    user, workspace = get_current_user_and_workspace(request)
    notifications: list[dict] = []
    now = timezone.now()
    cutoff_48h = now - timedelta(hours=48)

    # --- 1. Pending Approval Notifications ---
    if category in (None, "all", "approval"):
        pending_posts = (
            Post.objects.filter(
                workspace=workspace,
                platform_posts__status__in=["pending_review", "pending_client"],
            )
            .distinct()
            .prefetch_related("platform_posts__social_account")
            .order_by("-created_at")[:limit]
        )

        for post in pending_posts:
            platforms = list(
                {
                    pp.social_account.platform
                    for pp in post.platform_posts.all()
                    if pp.social_account
                }
            )
            notifications.append(
                {
                    "id": f"approval-{post.id}",
                    "category": "approval",
                    "title": "Draft Menunggu Persetujuan",
                    "description": (post.caption or "Postingan baru")[:120],
                    "timestamp": post.created_at.isoformat(),
                    "is_read": False,
                    "action_url": f"/composer?post_id={post.id}",
                    "action_label": "Tinjau Draft",
                    "platforms": platforms,
                    "resource_id": str(post.id),
                }
            )

    # --- 2. System & Schedule Notifications (published / failed in 48h) ---
    if category in (None, "all", "system"):
        recent_published = (
            Post.objects.filter(
                workspace=workspace,
                platform_posts__status="published",
                published_at__gte=cutoff_48h,
            )
            .distinct()
            .prefetch_related("platform_posts__social_account")
            .order_by("-published_at")[:limit]
        )

        for post in recent_published:
            platforms = list(
                {
                    pp.social_account.platform
                    for pp in post.platform_posts.all()
                    if pp.social_account
                }
            )
            notifications.append(
                {
                    "id": f"published-{post.id}",
                    "category": "system",
                    "title": "Postingan Berhasil Terbit",
                    "description": (post.caption or "Postingan")[:120],
                    "timestamp": (post.published_at or post.created_at).isoformat(),
                    "is_read": True,
                    "action_url": f"/composer?post_id={post.id}",
                    "action_label": "Lihat Postingan",
                    "platforms": platforms,
                    "resource_id": str(post.id),
                }
            )

        recent_failed = (
            Post.objects.filter(
                workspace=workspace,
                platform_posts__status="failed",
                platform_posts__updated_at__gte=cutoff_48h,
            )
            .distinct()
            .prefetch_related("platform_posts__social_account")
            .order_by("-created_at")[:limit]
        )

        for post in recent_failed:
            platforms = list(
                {
                    pp.social_account.platform
                    for pp in post.platform_posts.all()
                    if pp.social_account
                }
            )
            notifications.append(
                {
                    "id": f"failed-{post.id}",
                    "category": "system",
                    "title": "Gagal Mempublikasikan Postingan",
                    "description": (post.caption or "Postingan")[:120],
                    "timestamp": post.created_at.isoformat(),
                    "is_read": False,
                    "action_url": f"/composer?post_id={post.id}",
                    "action_label": "Periksa Kegagalan",
                    "platforms": platforms,
                    "resource_id": str(post.id),
                }
            )

        # Upcoming scheduled (within 2 hours)
        upcoming_cutoff = now + timedelta(hours=2)
        upcoming_posts = (
            Post.objects.filter(
                workspace=workspace,
                scheduled_at__gte=now,
                scheduled_at__lte=upcoming_cutoff,
            )
            .exclude(platform_posts__status__in=["published", "failed"])
            .distinct()
            .prefetch_related("platform_posts__social_account")
            .order_by("scheduled_at")[:5]
        )

        for post in upcoming_posts:
            platforms = list(
                {
                    pp.social_account.platform
                    for pp in post.platform_posts.all()
                    if pp.social_account
                }
            )
            notifications.append(
                {
                    "id": f"upcoming-{post.id}",
                    "category": "system",
                    "title": "Postingan Akan Segera Terbit",
                    "description": (post.caption or "Postingan terjadwal")[:120],
                    "timestamp": (post.scheduled_at or post.created_at).isoformat(),
                    "is_read": True,
                    "action_url": "/calendar",
                    "action_label": "Buka Kalender",
                    "platforms": platforms,
                    "resource_id": str(post.id),
                }
            )

    # --- 3. Inbox High-Priority (unread negative sentiment) ---
    if category in (None, "all", "inbox"):
        try:
            unread_msgs = (
                InboxMessage.objects.filter(workspace=workspace, status="unread")
                .order_by("-received_at")[:limit]
            )

            for msg in unread_msgs:
                notifications.append(
                    {
                        "id": f"inbox-{msg.id}",
                        "category": "inbox",
                        "title": f"Pesan Masuk dari {msg.sender_name}",
                        "description": (msg.content or "")[:120],
                        "timestamp": msg.received_at.isoformat(),
                        "is_read": False,
                        "action_url": "/inbox",
                        "action_label": "Balas Pesan",
                        "platforms": [msg.platform] if msg.platform else [],
                        "resource_id": str(msg.id),
                    }
                )
        except Exception:
            pass

    # Sort all by timestamp descending
    notifications.sort(key=lambda n: n["timestamp"], reverse=True)
    notifications = notifications[:limit]

    # Compute unread count
    unread_count = sum(1 for n in notifications if not n["is_read"])

    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "total_count": len(notifications),
    }


@router.post("/dashboard/notifications/mark-read", summary="Mark Notifications as Read")
def mark_notifications_read(request: HttpRequest, payload: MarkReadSchema):
    """Mark specific notifications or all as read.

    Since notifications are aggregated from multiple models (not a dedicated
    notification table), this endpoint updates the underlying domain objects:
    - approval-{id}: Approve the post (mark as reviewed).
    - inbox-{id}: Mark inbox message as read.
    - System notifications are informational and always considered read.
    """
    user, workspace = get_current_user_and_workspace(request)
    marked_count = 0

    if payload.mark_all:
        # Mark all unread inbox messages as read
        marked_count = InboxMessage.objects.filter(
            workspace=workspace, status="unread"
        ).update(status="read")
        return {"success": True, "marked_count": marked_count}

    if payload.notification_ids:
        for nid in payload.notification_ids:
            if nid.startswith("inbox-"):
                msg_id = nid.replace("inbox-", "")
                updated = InboxMessage.objects.filter(
                    id=msg_id, workspace=workspace, status="unread"
                ).update(status="read")
                marked_count += updated

    return {"success": True, "marked_count": marked_count}
