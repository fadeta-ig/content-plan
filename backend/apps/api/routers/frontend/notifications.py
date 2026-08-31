"""Persistent notification hub endpoints for the frontend application."""

from __future__ import annotations

from django.http import HttpRequest
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.notifications.models import EventType, Notification

from .helpers import frontend_auth, get_current_user_and_workspace

router = Router(tags=["frontend-notifications"], auth=frontend_auth)


class MarkReadSchema(Schema):
    notification_ids: list[str] | None = None
    mark_all: bool = False


APPROVAL_EVENTS = {
    EventType.POST_SUBMITTED,
    EventType.POST_APPROVED,
    EventType.POST_CHANGES_REQUESTED,
    EventType.POST_REJECTED,
    EventType.CLIENT_APPROVAL_REQUESTED,
    EventType.APPROVAL_REMINDER,
    EventType.APPROVAL_STALLED,
    EventType.APPROVAL_HOLD_REQUESTED,
}
INBOX_EVENTS = {
    EventType.NEW_INBOX_MESSAGE,
    EventType.INBOX_SLA_OVERDUE,
    EventType.COMMENT_MENTION,
}


def _category(event_type: str) -> str:
    if event_type in APPROVAL_EVENTS:
        return "approval"
    if event_type in INBOX_EVENTS:
        return "inbox"
    return "system"


def _action(notification: Notification) -> tuple[str, str]:
    data = notification.data or {}
    if data.get("message_id"):
        return "/inbox", "Buka Pesan"
    if data.get("post_id"):
        return f"/composer?post_id={data['post_id']}", "Buka Postingan"
    if notification.event_type in {EventType.TEAM_MEMBER_INVITED, EventType.CLIENT_CONNECTED_ACCOUNTS}:
        return "/settings", "Buka Pengaturan"
    if notification.event_type == EventType.SOCIAL_ACCOUNT_DISCONNECTED:
        return "/accounts", "Periksa Saluran"
    return "/", "Buka Overview"


@router.get("/dashboard/notifications", summary="Get Persistent Notifications")
def get_notifications(
    request: HttpRequest,
    category: str | None = None,
    limit: int = 30,
):
    user, workspace = get_current_user_and_workspace(request)
    if category not in {None, "all", "approval", "system", "inbox"}:
        raise HttpError(422, "Kategori notifikasi tidak valid.")
    if limit < 1 or limit > 100:
        raise HttpError(422, "Batas notifikasi harus antara 1 dan 100.")

    queryset = Notification.objects.filter(
        user=user,
        data__workspace_id=str(workspace.id),
    ).order_by("-created_at")

    results = []
    # Fetch a bounded superset because category is derived from event type.
    for notification in queryset[: min(limit * 4, 400)]:
        item_category = _category(notification.event_type)
        if category not in (None, "all", item_category):
            continue
        action_url, action_label = _action(notification)
        data = notification.data or {}
        platforms = data.get("platforms", [])
        if isinstance(platforms, str):
            platforms = [platforms]
        elif not isinstance(platforms, list):
            platforms = []

        results.append(
            {
                "id": str(notification.id),
                "category": item_category,
                "title": notification.title,
                "description": notification.body,
                "timestamp": notification.created_at.isoformat(),
                "is_read": notification.is_read,
                "action_url": action_url,
                "action_label": action_label,
                "platforms": platforms[:3],
                "resource_id": str(data.get("post_id") or data.get("message_id") or ""),
            }
        )
        if len(results) >= limit:
            break

    unread_count = queryset.filter(is_read=False).count()
    return {
        "notifications": results,
        "unread_count": unread_count,
        "total_count": queryset.count(),
    }


@router.post("/dashboard/notifications/mark-read", summary="Mark Notifications as Read")
def mark_notifications_read(request: HttpRequest, payload: MarkReadSchema):
    user, workspace = get_current_user_and_workspace(request)
    queryset = Notification.objects.filter(
        user=user,
        data__workspace_id=str(workspace.id),
        is_read=False,
    )

    if payload.mark_all:
        marked_count = queryset.update(is_read=True, read_at=timezone.now())
        return {"success": True, "marked_count": marked_count}

    notification_ids = payload.notification_ids or []
    if not notification_ids:
        raise HttpError(422, "Pilih setidaknya satu notifikasi untuk ditandai.")
    if len(notification_ids) > 100:
        raise HttpError(422, "Maksimal 100 notifikasi dapat ditandai sekaligus.")

    marked_count = queryset.filter(id__in=notification_ids).update(
        is_read=True,
        read_at=timezone.now(),
    )
    return {"success": True, "marked_count": marked_count}
