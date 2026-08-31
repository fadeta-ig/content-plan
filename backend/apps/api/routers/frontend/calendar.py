"""Content Calendar & Shooting Session endpoints for Frontend API."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.http import HttpRequest
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.calendar.models import PostingSlot, ShootingSession
from apps.composer.models import Idea, Post

from .helpers import frontend_auth, get_current_user_and_workspace, require_workspace_permission

router = Router(tags=["frontend-calendar"], auth=frontend_auth)


class ShootingSessionCreateSchema(Schema):
    title: str
    description: str | None = ""
    location: str | None = ""
    scheduled_at: str
    end_at: str | None = None
    status: str | None = "planned"
    crew_members: list[dict[str, Any]] | None = None
    equipment_checklist: list[dict[str, Any]] | None = None
    related_idea_id: str | None = None


class ShootingSessionUpdateSchema(Schema):
    title: str | None = None
    description: str | None = None
    location: str | None = None
    scheduled_at: str | None = None
    end_at: str | None = None
    status: str | None = None
    crew_members: list[dict[str, Any]] | None = None
    equipment_checklist: list[dict[str, Any]] | None = None
    related_idea_id: str | None = None


class RescheduleSchema(Schema):
    scheduled_at: str


def _parse_datetime(value: str, workspace, field_label: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, ZoneInfo(workspace.effective_timezone or "UTC"))
        return parsed
    except (TypeError, ValueError, ZoneInfoNotFoundError) as exc:
        raise HttpError(422, f"Format {field_label} atau zona waktu tidak valid.") from exc


def _require_session_edit(request: HttpRequest, session: ShootingSession, user) -> None:
    membership = require_workspace_permission(request, "create_posts")
    if session.created_by_id != user.id and not membership.effective_permissions.get("edit_others_posts", False):
        raise HttpError(403, "Anda hanya dapat mengubah sesi shooting yang Anda buat sendiri.")


@router.get("/dashboard/calendar", summary="Get Scheduled Calendar Posts & Shooting Sessions")
def get_calendar_posts(request: HttpRequest, start_date: str | None = None, end_date: str | None = None):
    user, workspace = get_current_user_and_workspace(request)

    start_dt = _parse_datetime(start_date, workspace, "tanggal mulai") if start_date else None
    end_dt = _parse_datetime(end_date, workspace, "tanggal selesai") if end_date else None
    if start_dt and end_dt and end_dt < start_dt:
        raise HttpError(422, "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.")

    # 1. Fetch Scheduled Social Posts
    posts_qs = Post.objects.filter(workspace=workspace, scheduled_at__isnull=False)

    if start_dt:
        posts_qs = posts_qs.filter(scheduled_at__gte=start_dt)

    if end_dt:
        posts_qs = posts_qs.filter(scheduled_at__lte=end_dt)

    posts = posts_qs.prefetch_related("platform_posts__social_account", "media_attachments__media_asset").order_by(
        "scheduled_at"
    )

    events: list[dict[str, Any]] = []
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
                media_list.append(
                    {
                        "id": str(m.media_asset.id),
                        "file_url": m.media_asset.file.url,
                        "thumbnail_url": thumb,
                        "file_type": m.media_asset.media_type,
                        "title": m.media_asset.title or m.media_asset.filename,
                    }
                )

        events.append(
            {
                "id": str(p.id),
                "type": "post",
                "title": p.title or (p.caption[:120] if p.caption else "Postingan Terjadwal"),
                "caption": p.caption,
                "first_comment": p.first_comment or "",
                "start": p.scheduled_at.isoformat() if p.scheduled_at else "",
                "platforms": platforms or ["social"],
                "status": primary_status,
                "thumbnail_url": thumbnail,
                "media": media_list,
            }
        )

    # 2. Fetch Shooting Sessions
    shoots_qs = ShootingSession.objects.filter(workspace=workspace).select_related("related_idea")
    if start_dt:
        shoots_qs = shoots_qs.filter(scheduled_at__gte=start_dt)
    if end_dt:
        shoots_qs = shoots_qs.filter(scheduled_at__lte=end_dt)

    for s in shoots_qs.order_by("scheduled_at"):
        events.append(
            {
                "id": str(s.id),
                "type": "shooting",
                "title": s.title,
                "description": s.description,
                "location": s.location,
                "start": s.scheduled_at.isoformat() if s.scheduled_at else "",
                "end": s.end_at.isoformat() if s.end_at else None,
                "status": s.status,
                "crew_members": s.crew_members or [],
                "equipment_checklist": s.equipment_checklist or [],
                "related_idea_id": str(s.related_idea_id) if s.related_idea_id else None,
                "related_idea_title": s.related_idea.title if s.related_idea else None,
                "platforms": ["shooting"],
                "thumbnail_url": "",
                "media": [],
            }
        )

    # 3. Fetch Time Slots
    slots = [
        {
            "id": str(s.id),
            "day_of_week": s.day_of_week,
            "time": str(s.time),
            "account_name": s.social_account.account_name if s.social_account else "All Accounts",
            "platform": s.social_account.platform if s.social_account else "general",
        }
        for s in PostingSlot.objects.filter(social_account__workspace=workspace).select_related("social_account")
    ]

    return {"events": events, "slots": slots}


# ---------------------------------------------------------------------------
# Shooting Sessions CRUD Endpoints
# ---------------------------------------------------------------------------


@router.get("/dashboard/shooting-sessions", summary="List Shooting Sessions")
def list_shooting_sessions(
    request: HttpRequest,
    status: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    user, workspace = get_current_user_and_workspace(request)
    qs = ShootingSession.objects.filter(workspace=workspace).select_related("related_idea")

    if status and status != "all":
        if status not in {choice for choice, _ in ShootingSession.Status.choices}:
            raise HttpError(422, "Status sesi shooting tidak valid.")
        qs = qs.filter(status=status)
    start_dt = _parse_datetime(start_date, workspace, "tanggal mulai") if start_date else None
    end_dt = _parse_datetime(end_date, workspace, "tanggal selesai") if end_date else None
    if start_dt and end_dt and end_dt < start_dt:
        raise HttpError(422, "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.")
    if start_dt:
        qs = qs.filter(scheduled_at__gte=start_dt)
    if end_dt:
        qs = qs.filter(scheduled_at__lte=end_dt)

    sessions = [
        {
            "id": str(s.id),
            "title": s.title,
            "description": s.description,
            "location": s.location,
            "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
            "end_at": s.end_at.isoformat() if s.end_at else None,
            "status": s.status,
            "crew_members": s.crew_members or [],
            "equipment_checklist": s.equipment_checklist or [],
            "related_idea_id": str(s.related_idea_id) if s.related_idea_id else None,
            "related_idea_title": s.related_idea.title if s.related_idea else None,
            "created_at": s.created_at.isoformat(),
        }
        for s in qs.order_by("scheduled_at")
    ]
    return {"sessions": sessions}


@router.post("/dashboard/shooting-sessions", summary="Create Shooting Session")
def create_shooting_session(request: HttpRequest, payload: ShootingSessionCreateSchema):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "create_posts")

    if not payload.title.strip():
        raise HttpError(422, "Judul sesi shooting wajib diisi.")

    start_dt = _parse_datetime(payload.scheduled_at, workspace, "waktu mulai shooting")

    end_dt = None
    if payload.end_at:
        end_dt = _parse_datetime(payload.end_at, workspace, "waktu selesai shooting")
        if end_dt <= start_dt:
            raise HttpError(422, "Waktu selesai harus setelah waktu mulai shooting.")

    selected_status = payload.status or ShootingSession.Status.PLANNED
    if selected_status not in {choice for choice, _ in ShootingSession.Status.choices}:
        raise HttpError(422, "Status sesi shooting tidak valid.")

    related_idea = None
    if payload.related_idea_id:
        try:
            i_uuid = uuid.UUID(str(payload.related_idea_id))
            related_idea = Idea.objects.filter(id=i_uuid, workspace=workspace).first()
        except (TypeError, ValueError, AttributeError) as exc:
            raise HttpError(422, "ID ide terkait tidak valid.") from exc
        if related_idea is None:
            raise HttpError(404, "Ide terkait tidak ditemukan di workspace ini.")

    session = ShootingSession.objects.create(
        workspace=workspace,
        title=payload.title.strip(),
        description=(payload.description or "").strip(),
        location=(payload.location or "").strip(),
        scheduled_at=start_dt,
        end_at=end_dt,
        status=selected_status,
        crew_members=payload.crew_members or [],
        equipment_checklist=payload.equipment_checklist or [],
        related_idea=related_idea,
        created_by=user,
    )

    return {
        "success": True,
        "message": "Sesi shooting berhasil dijadwalkan.",
        "session": {
            "id": str(session.id),
            "title": session.title,
            "description": session.description,
            "location": session.location,
            "scheduled_at": session.scheduled_at.isoformat(),
            "end_at": session.end_at.isoformat() if session.end_at else None,
            "status": session.status,
            "crew_members": session.crew_members,
            "equipment_checklist": session.equipment_checklist,
            "related_idea_id": str(session.related_idea_id) if session.related_idea_id else None,
            "related_idea_title": session.related_idea.title if session.related_idea else None,
        },
    }


@router.get("/dashboard/shooting-sessions/{session_id}", summary="Get Shooting Session Detail")
def get_shooting_session_detail(request: HttpRequest, session_id: uuid.UUID):
    user, workspace = get_current_user_and_workspace(request)
    session = ShootingSession.objects.filter(id=session_id, workspace=workspace).select_related("related_idea").first()
    if not session:
        raise HttpError(404, "Sesi shooting tidak ditemukan.")

    return {
        "session": {
            "id": str(session.id),
            "title": session.title,
            "description": session.description,
            "location": session.location,
            "scheduled_at": session.scheduled_at.isoformat() if session.scheduled_at else None,
            "end_at": session.end_at.isoformat() if session.end_at else None,
            "status": session.status,
            "crew_members": session.crew_members or [],
            "equipment_checklist": session.equipment_checklist or [],
            "related_idea_id": str(session.related_idea_id) if session.related_idea_id else None,
            "related_idea_title": session.related_idea.title if session.related_idea else None,
            "created_at": session.created_at.isoformat(),
        }
    }


@router.patch("/dashboard/shooting-sessions/{session_id}", summary="Update Shooting Session")
def update_shooting_session(request: HttpRequest, session_id: uuid.UUID, payload: ShootingSessionUpdateSchema):
    user, workspace = get_current_user_and_workspace(request)
    session = ShootingSession.objects.filter(id=session_id, workspace=workspace).select_related("related_idea").first()
    if not session:
        raise HttpError(404, "Sesi shooting tidak ditemukan.")
    _require_session_edit(request, session, user)

    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HttpError(422, "Judul sesi shooting wajib diisi.")
        session.title = title
    if payload.description is not None:
        session.description = payload.description.strip()
    if payload.location is not None:
        session.location = payload.location.strip()
    if payload.scheduled_at is not None:
        session.scheduled_at = _parse_datetime(payload.scheduled_at, workspace, "waktu mulai")
    if payload.end_at is not None:
        session.end_at = _parse_datetime(payload.end_at, workspace, "waktu selesai") if payload.end_at else None
    if payload.status is not None:
        if payload.status not in {choice for choice, _ in ShootingSession.Status.choices}:
            raise HttpError(422, "Status sesi shooting tidak valid.")
        session.status = payload.status
    if payload.crew_members is not None:
        session.crew_members = payload.crew_members
    if payload.equipment_checklist is not None:
        session.equipment_checklist = payload.equipment_checklist
    if payload.related_idea_id is not None:
        if payload.related_idea_id:
            try:
                i_uuid = uuid.UUID(str(payload.related_idea_id))
                session.related_idea = Idea.objects.filter(id=i_uuid, workspace=workspace).first()
            except (TypeError, ValueError, AttributeError) as exc:
                raise HttpError(422, "ID ide terkait tidak valid.") from exc
            if session.related_idea is None:
                raise HttpError(404, "Ide terkait tidak ditemukan di workspace ini.")
        else:
            session.related_idea = None

    if session.end_at and session.end_at <= session.scheduled_at:
        raise HttpError(422, "Waktu selesai harus setelah waktu mulai shooting.")

    session.save()

    return {
        "success": True,
        "message": "Sesi shooting berhasil diperbarui.",
        "session": {
            "id": str(session.id),
            "title": session.title,
            "description": session.description,
            "location": session.location,
            "scheduled_at": session.scheduled_at.isoformat() if session.scheduled_at else None,
            "end_at": session.end_at.isoformat() if session.end_at else None,
            "status": session.status,
            "crew_members": session.crew_members,
            "equipment_checklist": session.equipment_checklist,
            "related_idea_id": str(session.related_idea_id) if session.related_idea_id else None,
            "related_idea_title": session.related_idea.title if session.related_idea else None,
        },
    }


@router.patch("/dashboard/shooting-sessions/{session_id}/reschedule", summary="Reschedule Shooting Session")
def reschedule_shooting_session(request: HttpRequest, session_id: uuid.UUID, payload: RescheduleSchema):
    """Move a shooting session to a new date/time (Calendar Drag-and-Drop)."""
    user, workspace = get_current_user_and_workspace(request)
    session = ShootingSession.objects.filter(id=session_id, workspace=workspace).first()
    if not session:
        raise HttpError(404, "Sesi shooting tidak ditemukan.")
    _require_session_edit(request, session, user)

    new_dt = _parse_datetime(payload.scheduled_at, workspace, "tanggal shooting")

    session.scheduled_at = new_dt
    session.save(update_fields=["scheduled_at"])

    return {
        "success": True,
        "message": "Jadwal sesi shooting berhasil dipindahkan.",
        "session_id": str(session.id),
        "scheduled_at": new_dt.isoformat(),
    }


@router.delete("/dashboard/shooting-sessions/{session_id}", summary="Delete Shooting Session")
def delete_shooting_session(request: HttpRequest, session_id: uuid.UUID):
    user, workspace = get_current_user_and_workspace(request)
    session = ShootingSession.objects.filter(id=session_id, workspace=workspace).first()
    if not session:
        raise HttpError(404, "Sesi shooting tidak ditemukan.")
    _require_session_edit(request, session, user)

    session.delete()
    return {"success": True, "message": "Sesi shooting berhasil dihapus."}
