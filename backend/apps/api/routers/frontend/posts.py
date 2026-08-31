"""Posts, Composer & Approval workflow endpoints for Frontend API."""

from __future__ import annotations

import uuid
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db import transaction
from django.db.models import Q
from django.http import HttpRequest
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.accounts.models import User
from apps.approvals.models import ApprovalAction
from apps.composer.models import PlatformPost, Post, PostMedia
from apps.media_library.models import MediaAsset
from apps.social_accounts.models import SocialAccount

from .helpers import frontend_auth, get_current_user_and_workspace, require_workspace_permission

router = Router(tags=["frontend-posts"], auth=frontend_auth)


class PostCreateSchema(Schema):
    post_id: uuid.UUID | None = None
    workspace_id: str | None = None
    master_caption: str
    target_account_ids: list[str]
    scheduled_at: str | None = None
    first_comment: str | None = None
    media_ids: list[str] | None = None
    category_id: str | None = None
    tags: list[str] | None = None
    post_now: bool = False


def _parse_scheduled_at(value: str, workspace) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, ZoneInfo(workspace.effective_timezone or "UTC"))
        return parsed
    except (TypeError, ValueError, ZoneInfoNotFoundError) as exc:
        raise HttpError(422, "Format tanggal atau zona waktu penjadwalan tidak valid.") from exc


def _require_post_edit(request: HttpRequest, post: Post, user: User) -> None:
    membership = require_workspace_permission(request, "create_posts")
    if post.author_id != user.id and not membership.effective_permissions.get("edit_others_posts", False):
        raise HttpError(403, "Anda hanya dapat mengubah postingan yang Anda buat sendiri.")


@router.get("/dashboard/posts", summary="List Workspace Posts")
def list_posts(
    request: HttpRequest,
    status: str | None = None,
    platform: str | None = None,
    search: str | None = None,
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
                media_list.append(
                    {
                        "id": str(m.media_asset.id),
                        "file_url": m.media_asset.file.url,
                        "thumbnail_url": m.media_asset.thumbnail.url
                        if m.media_asset.thumbnail
                        else m.media_asset.file.url,
                        "file_type": m.media_asset.media_type,
                        "title": m.media_asset.title or m.media_asset.filename,
                    }
                )

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

        posts_data.append(
            {
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
            }
        )

    return {"posts": posts_data}


@router.post("/dashboard/posts/create", summary="Create or Schedule a Post")
def create_dashboard_post(request: HttpRequest, payload: PostCreateSchema):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "create_posts")
    caption = payload.master_caption.strip()
    if not caption:
        raise HttpError(422, "Caption postingan wajib diisi.")
    if len(caption) > 63_206:
        raise HttpError(422, "Caption postingan melebihi batas maksimum 63.206 karakter.")
    if payload.post_now:
        require_workspace_permission(request, "publish_directly")

    scheduled_dt = None
    if payload.scheduled_at:
        scheduled_dt = _parse_scheduled_at(payload.scheduled_at, workspace)
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

    target_accounts = (
        SocialAccount.objects.filter(
            q_filter,
            workspace=workspace,
            connection_status=SocialAccount.ConnectionStatus.CONNECTED,
        )
        if (valid_uuids or platform_names)
        else SocialAccount.objects.none()
    )
    if not target_accounts.exists():
        raise HttpError(422, "Pilih minimal satu akun sosial yang benar-benar terhubung.")

    with transaction.atomic():
        if payload.post_id:
            post = Post.objects.filter(id=payload.post_id, workspace=workspace).first()
            if post is None:
                raise HttpError(404, "Postingan yang akan diedit tidak ditemukan.")
            _require_post_edit(request, post, user)
            if post:
                post.caption = caption
                post.first_comment = payload.first_comment.strip() if payload.first_comment else ""
                post.scheduled_at = scheduled_dt
                post.save()
                post.platform_posts.all().delete()
                post.media_attachments.all().delete()
        else:
            post = Post.objects.create(
                workspace=workspace,
                author=user,
                caption=caption,
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
            parsed_media_ids = []
            for media_id in payload.media_ids:
                try:
                    parsed_media_ids.append(uuid.UUID(str(media_id)))
                except (TypeError, ValueError, AttributeError) as exc:
                    raise HttpError(422, "Terdapat ID media yang tidak valid.") from exc
            allowed_assets = MediaAsset.objects.filter(id__in=parsed_media_ids).filter(
                Q(workspace=workspace) | Q(workspace__isnull=True, organization=workspace.organization)
            )
            asset_map = {asset.id: asset for asset in allowed_assets}
            missing_media = [str(media_id) for media_id in parsed_media_ids if media_id not in asset_map]
            if missing_media:
                raise HttpError(422, "Satu atau lebih media tidak tersedia di workspace ini.")
            for idx, parsed_media_id in enumerate(parsed_media_ids):
                PostMedia.objects.create(post=post, media_asset=asset_map[parsed_media_id], position=idx)

    return {
        "success": True,
        "message": (
            "Postingan disimpan dan masuk antrean publikasi."
            if payload.post_now
            else "Postingan berhasil disimpan."
        ),
        "post_id": str(post.id),
        "status": "queued_for_publishing" if payload.post_now else ("scheduled" if post.scheduled_at else "draft"),
    }


@router.get("/dashboard/posts/{post_id}", summary="Get Single Post Detail")
def get_post_detail(request: HttpRequest, post_id: uuid.UUID):
    user, workspace = get_current_user_and_workspace(request)
    p = (
        Post.objects.filter(id=post_id, workspace=workspace)
        .prefetch_related("platform_posts__social_account", "media_attachments__media_asset", "approval_actions")
        .first()
    )
    if not p:
        raise HttpError(404, "Postingan tidak ditemukan.")

    p_posts = list(p.platform_posts.all())
    media_list = []
    for m in p.media_attachments.all():
        if m.media_asset and m.media_asset.file:
            media_list.append(
                {
                    "id": str(m.media_asset.id),
                    "file_url": m.media_asset.file.url,
                    "thumbnail_url": m.media_asset.thumbnail.url if m.media_asset.thumbnail else m.media_asset.file.url,
                    "file_type": m.media_asset.media_type,
                    "title": m.media_asset.title or m.media_asset.filename,
                }
            )

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
def approve_dashboard_post(request: HttpRequest, post_id: uuid.UUID):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "approve_posts")
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
def reject_dashboard_post(request: HttpRequest, post_id: uuid.UUID):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "approve_posts")
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
def delete_dashboard_post(request: HttpRequest, post_id: uuid.UUID):
    user, workspace = get_current_user_and_workspace(request)
    post = Post.objects.filter(id=post_id, workspace=workspace).first()
    if not post:
        raise HttpError(404, "Postingan tidak ditemukan.")
    _require_post_edit(request, post, user)
    post.delete()
    return {"success": True, "message": "Postingan berhasil dihapus."}


class RescheduleSchema(Schema):
    scheduled_at: str


@router.patch("/dashboard/posts/{post_id}/reschedule", summary="Reschedule Post")
def reschedule_post(request: HttpRequest, post_id: uuid.UUID, payload: RescheduleSchema):
    """Move a post to a new date/time (Calendar Drag-and-Drop)."""
    user, workspace = get_current_user_and_workspace(request)

    post = Post.objects.filter(id=post_id, workspace=workspace).first()
    if not post:
        raise HttpError(404, "Postingan tidak ditemukan.")
    _require_post_edit(request, post, user)

    new_dt = _parse_scheduled_at(payload.scheduled_at, workspace)

    with transaction.atomic():
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
