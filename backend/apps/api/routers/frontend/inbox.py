"""Unified Social Inbox endpoints for Frontend API with sentiment scoring."""

from __future__ import annotations

import logging
import uuid

from django.http import HttpRequest
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.inbox.models import InboxMessage, InboxReply, InboxSLAConfig
from apps.inbox.services import InboxReplyDeliveryError, send_platform_reply

from .helpers import (
    analyze_sentiment,
    frontend_auth,
    get_current_user_and_workspace,
    require_workspace_permission,
)

logger = logging.getLogger(__name__)

router = Router(tags=["frontend-inbox"], auth=frontend_auth)


class InboxReplySchema(Schema):
    message_id: uuid.UUID
    content: str


@router.get("/dashboard/inbox", summary="Get Unified Inbox Messages")
def get_inbox_messages(request: HttpRequest, status: str | None = None, platform: str | None = None):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "use_inbox")

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

        messages_data.append(
            {
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
            }
        )

    return {"messages": messages_data}


@router.post("/dashboard/inbox/reply", summary="Send Reply to Inbox Message")
def reply_inbox_message(request: HttpRequest, payload: InboxReplySchema):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "reply_from_inbox")
    content = payload.content.strip()
    if not content:
        raise HttpError(422, "Isi balasan wajib diisi.")
    msg = InboxMessage.objects.filter(id=payload.message_id, workspace=workspace).first()
    if not msg:
        raise HttpError(404, "Pesan tidak ditemukan.")

    try:
        platform_reply_id = send_platform_reply(msg, content)
    except NotImplementedError as exc:
        raise HttpError(501, "Platform ini belum mendukung pengiriman balasan.") from exc
    except InboxReplyDeliveryError as exc:
        raise HttpError(409, str(exc)) from exc
    except (ConnectionError, TimeoutError, OSError) as exc:
        logger.warning("Inbox provider unavailable for message %s: %s", msg.id, exc)
        raise HttpError(502, "Platform tidak dapat dihubungi. Balasan belum dikirim.") from exc
    except Exception as exc:
        logger.exception("Unexpected inbox reply failure for message %s", msg.id)
        raise HttpError(502, "Platform menolak balasan. Balasan belum dikirim.") from exc

    reply = InboxReply.objects.create(
        inbox_message=msg,
        author=user,
        body=content,
        platform_reply_id=platform_reply_id,
    )
    sla_config = InboxSLAConfig.objects.filter(workspace=workspace, is_active=True).first()
    if sla_config and sla_config.auto_resolve_on_reply:
        msg.status = InboxMessage.Status.RESOLVED
    elif msg.status == InboxMessage.Status.UNREAD:
        msg.status = InboxMessage.Status.OPEN
    msg.save(update_fields=["status"])

    return {
        "success": True,
        "platform_reply_id": platform_reply_id,
        "status": msg.status,
        "reply": {
            "id": str(reply.id),
            "author_name": user.name or user.email.split("@")[0],
            "content": reply.body,
            "sent_at": reply.sent_at.isoformat(),
        },
    }


class InboxStatusUpdateSchema(Schema):
    message_id: uuid.UUID
    status: str


@router.post("/dashboard/inbox/update-status", summary="Update Inbox Message Status")
def update_inbox_message_status(request: HttpRequest, payload: InboxStatusUpdateSchema):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "use_inbox")

    msg = InboxMessage.objects.filter(id=payload.message_id, workspace=workspace).first()
    if not msg:
        raise HttpError(404, "Pesan tidak ditemukan.")

    valid_statuses = [choice[0] for choice in InboxMessage.Status.choices]
    if payload.status not in valid_statuses:
        raise HttpError(400, f"Status '{payload.status}' tidak valid.")

    msg.status = payload.status
    msg.save(update_fields=["status"])

    return {"success": True, "message_id": str(msg.id), "status": msg.status}

