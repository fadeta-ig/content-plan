"""Posts, Composer & Approval workflow endpoints for Frontend API."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from django.db import transaction
from django.db.models import Q
from django.http import HttpRequest
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.approvals.models import ApprovalAction
from apps.composer.models import PlatformPost, Post, PostMedia
from apps.media_library.models import MediaAsset
from apps.social_accounts.models import SocialAccount
from .helpers import frontend_auth, get_current_user_and_workspace


router = Router(tags=["frontend-posts"], auth=frontend_auth)


class PostCreateSchema(Schema):
    post_id: Optional[str] = None
    workspace_id: Optional[str] = None
    master_caption: str
    target_account_ids: List[str]
    scheduled_at: Optional[str] = None
    first_comment: Optional[str] = None
    media_ids: Optional[List[str]] = []
    category_id: Optional[str] = None
    tags: Optional[List[str]] = []
    post_now: Optional[bool] = False


@router.get("/dashboard/posts", summary="List Workspace Posts")
def list_posts(
    request: HttpRequest,
    status: Optional[str] = None,
    platform: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
):
    user, workspace = get_current_user_and_workspace(request)

    qs = Post.objects.filter(workspace=workspace).prefetch_related(
        "platform_posts__social_account", "media_attachments__media_asset", "approval_actions"
    )

    if status:
        qs = qs.filter(platform_posts__status=status).distinct()
    if platform:
        qs = qs.filter(platform_posts__social_account__platform=platform).distinct()
    if search:
        qs = qs.filter(caption__icontains=search)

    posts_data = []
    for p in qs.order_by("-scheduled_at", "-created_at")[:limit]:
        p_posts = list(p.platform_posts.all())
        media_list = []
        for m in p.media_attachments.all():
            if m.media_asset and m.media_asset.file:
                media_list.append({
                    "id": str(m.media_asset.id),
                    "file_url": m.media_asset.file.url,
                    "thumbnail_url": m.media_asset.thumbnail.url if m.media_asset.thumbnail else m.media_asset.file.url,
                    "file_type": m.media_asset.media_type,
                    "title": m.media_asset.title or m.media_asset.filename,
                })

        # Calculate actual approval status from platform posts and actions
        last_action = p.approval_actions.order_by("-created_at").first()
        actual_approval_status = "approved"
        if any(pp.status in ["pending_review", "pending_client"] for pp in p_posts):
            actual_approval_status = "pending_approval"
        elif last_action:
            if last_action.action == ApprovalAction.ActionType.REJECTED:
                actual_approval_status = "rejected"
            elif last_action.action == ApprovalAction.ActionType.CHANGES_REQUESTED:
                actual_approval_status = "changes_requested"

        posts_data.append({
            "id": str(p.id),
            "master_caption": p.caption,
            "scheduled_at": p.scheduled_at.isoformat() if p.scheduled_at else None,
            "published_at": p.published_at.isoformat() if p.published_at else None,
            "created_at": p.created_at.isoformat(),
            "approval_status": actual_approval_status,
            "first_comment": p.first_comment,
            "media": media_list,
            "targets": [
                {
                    "id": str(pp.id),
                    "platform": pp.social_account.platform if pp.social_account else "social",
                    "account_name": pp.social_account.account_name if pp.social_account else "Social Account",
                    "status": pp.status,
                    "error_message": pp.publish_error or "",
                    "platform_post_url": getattr(pp, "platform_post_url", "") or pp.platform_post_id or "",
                }
                for pp in p_posts
            ],
        })

    return {"posts": posts_data}


@router.post("/dashboard/posts/create", summary="Create or Schedule a Post")
def create_dashboard_post(request: HttpRequest, payload: PostCreateSchema):
    user, workspace = get_current_user_and_workspace(request)

    scheduled_dt = None
    if payload.scheduled_at:
        try:
            scheduled_dt = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
        except Exception:
            scheduled_dt = timezone.now() + timedelta(hours=1)
    elif payload.post_now:
        scheduled_dt = timezone.now()

    # Separate valid UUIDs from platform string identifiers
    valid_uuids = []
    platform_names = []
    for item in payload.target_account_ids:
        try:
            valid_uuids.append(uuid.UUID(str(item)))
        except (ValueError, AttributeError):
            platform_names.append(str(item).lower())

    q_filter = Q()
    if valid_uuids:
        q_filter |= Q(id__in=valid_uuids)
    if platform_names:
        q_filter |= Q(platform__in=platform_names)

    target_accounts = SocialAccount.objects.filter(q_filter, workspace=workspace) if (valid_uuids or platform_names) else SocialAccount.objects.none()
    if not target_accounts.exists():
        target_accounts = SocialAccount.objects.filter(workspace=workspace, connection_status="connected")

    with transaction.atomic():
        if payload.post_id:
            try:
                target_uuid = uuid.UUID(str(payload.post_id))
                post = Post.objects.filter(id=target_uuid, workspace=workspace).first()
            except Exception:
                post = None
            if post:
                post.caption = payload.master_caption.strip()
                post.first_comment = payload.first_comment.strip() if payload.first_comment else ""
                post.scheduled_at = scheduled_dt
                post.save()
                post.platform_posts.all().delete()
                post.media_attachments.all().delete()
            else:
                post = Post.objects.create(
                    workspace=workspace,
                    author=user,
                    caption=payload.master_caption.strip(),
                    first_comment=payload.first_comment.strip() if payload.first_comment else "",
                    scheduled_at=scheduled_dt,
                )
        else:
            post = Post.objects.create(
                workspace=workspace,
                author=user,
                caption=payload.master_caption.strip(),
                first_comment=payload.first_comment.strip() if payload.first_comment else "",
                scheduled_at=scheduled_dt,
            )

        for account in target_accounts:
            PlatformPost.objects.create(
                post=post,
                social_account=account,
                status=PlatformPost.Status.SCHEDULED if post.scheduled_at else PlatformPost.Status.DRAFT,
                scheduled_at=post.scheduled_at,
            )

        if payload.media_ids:
            for idx, media_id in enumerate(payload.media_ids):
                try:
                    asset = MediaAsset.objects.filter(id=uuid.UUID(str(media_id))).first()
                    if asset:
                        PostMedia.objects.create(post=post, media_asset=asset, position=idx)
                except (ValueError, AttributeError):
                    pass

    return {
        "success": True,
        "message": "Post saved and queued successfully.",
        "post_id": str(post.id),
        "status": "scheduled" if post.scheduled_at else "draft",
    }


@router.get("/dashboard/posts/{post_id}", summary="Get Single Post Detail")
def get_post_detail(request: HttpRequest, post_id: str):
    user, workspace = get_current_user_and_workspace(request)
    p = Post.objects.filter(id=post_id, workspace=workspace).prefetch_related(
        "platform_posts__social_account", "media_attachments__media_asset", "approval_actions"
    ).first()
    if not p:
        raise HttpError(404, "Postingan tidak ditemukan.")

    p_posts = list(p.platform_posts.all())
    media_list = []
    for m in p.media_attachments.all():
        if m.media_asset and m.media_asset.file:
            media_list.append({
                "id": str(m.media_asset.id),
                "file_url": m.media_asset.file.url,
                "thumbnail_url": m.media_asset.thumbnail.url if m.media_asset.thumbnail else m.media_asset.file.url,
                "file_type": m.media_asset.media_type,
                "title": m.media_asset.title or m.media_asset.filename,
            })

    return {
        "post": {
            "id": str(p.id),
            "master_caption": p.caption,
            "scheduled_at": p.scheduled_at.isoformat() if p.scheduled_at else None,
            "published_at": p.published_at.isoformat() if p.published_at else None,
            "created_at": p.created_at.isoformat(),
            "first_comment": p.first_comment,
            "media": media_list,
            "targets": [
                {
                    "id": str(pp.id),
                    "platform": pp.social_account.platform if pp.social_account else "social",
                    "account_name": pp.social_account.account_name if pp.social_account else "Social Account",
                    "status": pp.status,
                }
                for pp in p_posts
            ],
        }
    }


@router.post("/dashboard/posts/{post_id}/approve", summary="Approve Post")
def approve_dashboard_post(request: HttpRequest, post_id: str):
    user, workspace = get_current_user_and_workspace(request)
    post = Post.objects.filter(id=post_id, workspace=workspace).first()
    if not post:
        raise HttpError(404, "Postingan tidak ditemukan.")

    with transaction.atomic():
        ApprovalAction.objects.create(
            post=post,
            user=user,
            action=ApprovalAction.ActionType.APPROVED,
            comment="Disetujui untuk publikasi.",
        )
        post.platform_posts.filter(status__in=["pending_review", "pending_client"]).update(
            status=PlatformPost.Status.SCHEDULED if post.scheduled_at else PlatformPost.Status.DRAFT
        )

    return {"success": True, "message": "Postingan berhasil disetujui.", "approval_status": "approved"}


@router.post("/dashboard/posts/{post_id}/reject", summary="Reject Post")
def reject_dashboard_post(request: HttpRequest, post_id: str):
    user, workspace = get_current_user_and_workspace(request)
    post = Post.objects.filter(id=post_id, workspace=workspace).first()
    if not post:
        raise HttpError(404, "Postingan tidak ditemukan.")

    with transaction.atomic():
        ApprovalAction.objects.create(
            post=post,
            user=user,
            action=ApprovalAction.ActionType.REJECTED,
            comment="Postingan ditolak oleh reviewer.",
        )
        post.platform_posts.all().update(status=PlatformPost.Status.DRAFT)

    return {"success": True, "message": "Postingan ditolak.", "approval_status": "rejected"}


@router.delete("/dashboard/posts/{post_id}", summary="Delete Post")
def delete_dashboard_post(request: HttpRequest, post_id: str):
    user, workspace = get_current_user_and_workspace(request)
    post = Post.objects.filter(id=post_id, workspace=workspace).first()
    if not post:
        raise HttpError(404, "Postingan tidak ditemukan.")
    post.delete()
    return {"success": True, "message": "Postingan berhasil dihapus."}


class RescheduleSchema(Schema):
    scheduled_at: str


@router.patch("/dashboard/posts/{post_id}/reschedule", summary="Reschedule Post")
def reschedule_post(request: HttpRequest, post_id: str, payload: RescheduleSchema):
    """Move a post to a new date/time (Calendar Drag-and-Drop)."""
    user, workspace = get_current_user_and_workspace(request)
    post = Post.objects.filter(id=post_id, workspace=workspace).first()
    if not post:
        raise HttpError(404, "Postingan tidak ditemukan.")

    try:
        new_dt = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
    except Exception:
        raise HttpError(422, "Format tanggal tidak valid.")

    post.scheduled_at = new_dt
    post.save(update_fields=["scheduled_at"])

    # Update platform posts scheduled_at too
    post.platform_posts.filter(
        status__in=[
            PlatformPost.Status.SCHEDULED,
            PlatformPost.Status.DRAFT,
        ]
    ).update(scheduled_at=new_dt)

    return {
        "success": True,
        "message": "Jadwal berhasil diperbarui.",
        "post_id": str(post.id),
        "scheduled_at": new_dt.isoformat(),
    }

