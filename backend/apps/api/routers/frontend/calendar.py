"""Content Calendar endpoints for Frontend API."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from django.http import HttpRequest
from ninja import Router

from apps.calendar.models import PostingSlot
from apps.composer.models import Post
from .helpers import frontend_auth, get_current_user_and_workspace


router = Router(tags=["frontend-calendar"], auth=frontend_auth)


@router.get("/dashboard/calendar", summary="Get Scheduled Calendar Posts")
def get_calendar_posts(request: HttpRequest, start_date: Optional[str] = None, end_date: Optional[str] = None):
    user, workspace = get_current_user_and_workspace(request)

    posts_qs = Post.objects.filter(workspace=workspace, scheduled_at__isnull=False)

    if start_date:
        try:
            st = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            posts_qs = posts_qs.filter(scheduled_at__gte=st)
        except Exception:
            pass

    if end_date:
        try:
            et = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            posts_qs = posts_qs.filter(scheduled_at__lte=et)
        except Exception:
            pass

    posts = (
        posts_qs.prefetch_related("platform_posts__social_account", "media_attachments__media_asset")
        .order_by("scheduled_at")
    )

    events = []
    for p in posts:
        p_posts = list(p.platform_posts.all())
        platforms = list({pp.social_account.platform for pp in p_posts if pp.social_account})
        statuses = [pp.status for pp in p_posts]
        primary_status = statuses[0] if statuses else "scheduled"
        thumbnail = ""
        media_list = []
        for m in p.media_attachments.all():
            if m.media_asset and m.media_asset.file:
                thumb = m.media_asset.thumbnail.url if m.media_asset.thumbnail else m.media_asset.file.url
                if not thumbnail:
                    thumbnail = thumb
                media_list.append({
                    "id": str(m.media_asset.id),
                    "file_url": m.media_asset.file.url,
                    "thumbnail_url": thumb,
                    "file_type": m.media_asset.media_type,
                    "title": m.media_asset.title or m.media_asset.filename,
                })

        events.append({
            "id": str(p.id),
            "title": p.title or (p.caption[:120] if p.caption else "Postingan Terjadwal"),
            "caption": p.caption,
            "first_comment": p.first_comment or "",
            "start": p.scheduled_at.isoformat() if p.scheduled_at else "",
            "platforms": platforms or ["social"],
            "status": primary_status,
            "thumbnail_url": thumbnail,
            "media": media_list,
        })

    slots = [
        {"id": str(s.id), "day_of_week": s.day_of_week, "time": str(s.time), "account_name": s.social_account.account_name if s.social_account else "All Accounts", "platform": s.social_account.platform if s.social_account else "general"}
        for s in PostingSlot.objects.filter(social_account__workspace=workspace).select_related("social_account")
    ]

    return {"events": events, "slots": slots}
