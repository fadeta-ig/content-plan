"""Content Calendar & Shooting Session endpoints for Frontend API."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from django.db import transaction
from django.http import HttpRequest
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.calendar.models import PostingSlot, ShootingSession
from apps.composer.models import Post
from .helpers import frontend_auth, get_current_user_and_workspace


router = Router(tags=["frontend-calendar"], auth=frontend_auth)


class ShootingSessionCreateSchema(Schema):
    title: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    scheduled_at: str
    end_at: Optional[str] = None
    status: Optional[str] = "planned"
    crew_members: Optional[List[Dict[str, Any]]] = []
    equipment_checklist: Optional[List[Dict[str, Any]]] = []


class ShootingSessionUpdateSchema(Schema):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    scheduled_at: Optional[str] = None
    end_at: Optional[str] = None
    status: Optional[str] = None
    crew_members: Optional[List[Dict[str, Any]]] = None
    equipment_checklist: Optional[List[Dict[str, Any]]] = None


class RescheduleSchema(Schema):
    scheduled_at: str


@router.get("/dashboard/calendar", summary="Get Scheduled Calendar Posts & Shooting Sessions")
def get_calendar_posts(request: HttpRequest, start_date: Optional[str] = None, end_date: Optional[str] = None):
    user, workspace = get_current_user_and_workspace(request)

    # 1. Fetch Scheduled Social Posts
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
            "type": "post",
            "title": p.title or (p.caption[:120] if p.caption else "Postingan Terjadwal"),
            "caption": p.caption,
            "first_comment": p.first_comment or "",
            "start": p.scheduled_at.isoformat() if p.scheduled_at else "",
            "platforms": platforms or ["social"],
            "status": primary_status,
            "thumbnail_url": thumbnail,
            "media": media_list,
        })

    # 2. Fetch Shooting Sessions
    shoots_qs = ShootingSession.objects.filter(workspace=workspace)
    if start_date:
        try:
            st = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            shoots_qs = shoots_qs.filter(scheduled_at__gte=st)
        except Exception:
            pass
    if end_date:
        try:
            et = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            shoots_qs = shoots_qs.filter(scheduled_at__lte=et)
        except Exception:
            pass

    for s in shoots_qs.order_by("scheduled_at"):
        events.append({
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
            "platforms": ["shooting"],
            "thumbnail_url": "",
            "media": [],
        })

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
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    user, workspace = get_current_user_and_workspace(request)
    qs = ShootingSession.objects.filter(workspace=workspace)

    if status and status != "all":
        qs = qs.filter(status=status)
    if start_date:
        try:
            st = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            qs = qs.filter(scheduled_at__gte=st)
        except Exception:
            pass
    if end_date:
        try:
            et = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            qs = qs.filter(scheduled_at__lte=et)
        except Exception:
            pass

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
            "created_at": s.created_at.isoformat(),
        }
        for s in qs.order_by("scheduled_at")
    ]
    return {"sessions": sessions}


@router.post("/dashboard/shooting-sessions", summary="Create Shooting Session")
def create_shooting_session(request: HttpRequest, payload: ShootingSessionCreateSchema):
    user, workspace = get_current_user_and_workspace(request)

    if not payload.title.strip():
        raise HttpError(422, "Judul sesi shooting wajib diisi.")

    try:
        start_dt = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
    except Exception:
        raise HttpError(422, "Format waktu shooting tidak valid.")

    end_dt = None
    if payload.end_at:
        try:
            end_dt = datetime.fromisoformat(payload.end_at.replace("Z", "+00:00"))
        except Exception:
            pass

    session = ShootingSession.objects.create(
        workspace=workspace,
        title=payload.title.strip(),
        description=(payload.description or "").strip(),
        location=(payload.location or "").strip(),
        scheduled_at=start_dt,
        end_at=end_dt,
        status=payload.status or ShootingSession.Status.PLANNED,
        crew_members=payload.crew_members or [],
        equipment_checklist=payload.equipment_checklist or [],
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
        },
    }


@router.get("/dashboard/shooting-sessions/{session_id}", summary="Get Shooting Session Detail")
def get_shooting_session_detail(request: HttpRequest, session_id: str):
    user, workspace = get_current_user_and_workspace(request)
    try:
        s_uuid = uuid.UUID(str(session_id))
    except (ValueError, TypeError):
        raise HttpError(400, "ID sesi shooting tidak valid.")

    session = ShootingSession.objects.filter(id=s_uuid, workspace=workspace).first()
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
            "created_at": session.created_at.isoformat(),
        }
    }


@router.patch("/dashboard/shooting-sessions/{session_id}", summary="Update Shooting Session")
def update_shooting_session(request: HttpRequest, session_id: str, payload: ShootingSessionUpdateSchema):
    user, workspace = get_current_user_and_workspace(request)
    try:
        s_uuid = uuid.UUID(str(session_id))
    except (ValueError, TypeError):
        raise HttpError(400, "ID sesi shooting tidak valid.")

    session = ShootingSession.objects.filter(id=s_uuid, workspace=workspace).first()
    if not session:
        raise HttpError(404, "Sesi shooting tidak ditemukan.")

    if payload.title is not None:
        session.title = payload.title.strip()
    if payload.description is not None:
        session.description = payload.description.strip()
    if payload.location is not None:
        session.location = payload.location.strip()
    if payload.scheduled_at is not None:
        try:
            session.scheduled_at = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
        except Exception:
            raise HttpError(422, "Format waktu mulai tidak valid.")
    if payload.end_at is not None:
        try:
            session.end_at = datetime.fromisoformat(payload.end_at.replace("Z", "+00:00")) if payload.end_at else None
        except Exception:
            session.end_at = None
    if payload.status is not None:
        session.status = payload.status
    if payload.crew_members is not None:
        session.crew_members = payload.crew_members
    if payload.equipment_checklist is not None:
        session.equipment_checklist = payload.equipment_checklist

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
        },
    }


@router.patch("/dashboard/shooting-sessions/{session_id}/reschedule", summary="Reschedule Shooting Session")
def reschedule_shooting_session(request: HttpRequest, session_id: str, payload: RescheduleSchema):
    """Move a shooting session to a new date/time (Calendar Drag-and-Drop)."""
    user, workspace = get_current_user_and_workspace(request)
    try:
        s_uuid = uuid.UUID(str(session_id))
    except (ValueError, TypeError):
        raise HttpError(400, "ID sesi shooting tidak valid.")

    session = ShootingSession.objects.filter(id=s_uuid, workspace=workspace).first()
    if not session:
        raise HttpError(404, "Sesi shooting tidak ditemukan.")

    try:
        new_dt = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
    except Exception:
        raise HttpError(422, "Format tanggal tidak valid.")

    session.scheduled_at = new_dt
    session.save(update_fields=["scheduled_at"])

    return {
        "success": True,
        "message": "Jadwal sesi shooting berhasil dipindahkan.",
        "session_id": str(session.id),
        "scheduled_at": new_dt.isoformat(),
    }


@router.delete("/dashboard/shooting-sessions/{session_id}", summary="Delete Shooting Session")
def delete_shooting_session(request: HttpRequest, session_id: str):
    user, workspace = get_current_user_and_workspace(request)
    try:
        s_uuid = uuid.UUID(str(session_id))
    except (ValueError, TypeError):
        raise HttpError(400, "ID sesi shooting tidak valid.")

    session = ShootingSession.objects.filter(id=s_uuid, workspace=workspace).first()
    if not session:
        raise HttpError(404, "Sesi shooting tidak ditemukan.")

    session.delete()
    return {"success": True, "message": "Sesi shooting berhasil dihapus."}
