"""Unified Social Inbox endpoints for Frontend API with sentiment scoring."""

from __future__ import annotations

from typing import Optional
from django.http import HttpRequest
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.inbox.models import InboxMessage, InboxReply
from .helpers import analyze_sentiment, frontend_auth, get_current_user_and_workspace


router = Router(tags=["frontend-inbox"], auth=frontend_auth)


class InboxReplySchema(Schema):
    message_id: str
    content: str


@router.get("/dashboard/inbox", summary="Get Unified Inbox Messages")
def get_inbox_messages(request: HttpRequest, status: Optional[str] = None, platform: Optional[str] = None):
    user, workspace = get_current_user_and_workspace(request)

    qs = InboxMessage.objects.filter(workspace=workspace).select_related("social_account").prefetch_related("replies")
    if status:
        qs = qs.filter(status=status)
    if platform:
        qs = qs.filter(social_account__platform=platform)

    messages_data = []
    for m in qs.order_by("-received_at")[:50]:
        replies_data = [
            {
                "id": str(r.id),
                "author_name": (r.author.name or r.author.email.split("@")[0]) if r.author else "Admin",
                "content": r.body,
                "sent_at": r.sent_at.isoformat(),
            }
            for r in m.replies.all().order_by("sent_at")
        ]

        # Real sentiment analysis based on message text
        computed_sentiment = m.sentiment if m.sentiment and m.sentiment != "neutral" else analyze_sentiment(m.body)

        messages_data.append({
            "id": str(m.id),
            "sender_name": m.sender_name,
            "sender_avatar_url": m.sender_avatar_url,
            "content": m.body,
            "message_type": m.message_type,
            "status": m.status,
            "sentiment": computed_sentiment,
            "platform": m.social_account.platform if m.social_account else "social",
            "account_name": m.social_account.account_name if m.social_account else "Official Account",
            "received_at": m.received_at.isoformat() if m.received_at else m.created_at.isoformat(),
            "replies": replies_data,
        })

    return {"messages": messages_data}


@router.post("/dashboard/inbox/reply", summary="Send Reply to Inbox Message")
def reply_inbox_message(request: HttpRequest, payload: InboxReplySchema):
    user, workspace = get_current_user_and_workspace(request)
    msg = InboxMessage.objects.filter(id=payload.message_id, workspace=workspace).first()
    if not msg:
        raise HttpError(404, "Pesan tidak ditemukan.")

    reply = InboxReply.objects.create(
        inbox_message=msg,
        author=user,
        body=payload.content.strip(),
    )
    msg.status = InboxMessage.Status.RESOLVED
    msg.save(update_fields=["status"])

    return {"success": True, "reply_id": str(reply.id), "status": "resolved"}
