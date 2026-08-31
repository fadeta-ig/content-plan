"""Kanban Ideas & Content Pipeline endpoints for Frontend API."""

from __future__ import annotations

import uuid

from django.http import HttpRequest
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.composer.models import Idea

from .helpers import frontend_auth, get_current_user_and_workspace, require_workspace_permission

router = Router(tags=["frontend-kanban"], auth=frontend_auth)


class IdeaCreateSchema(Schema):
    workspace_id: uuid.UUID | None = None
    title: str
    content: str | None = ""
    status: str | None = "unassigned"
    group_id: uuid.UUID | None = None


class IdeaStatusUpdateSchema(Schema):
    status: str


class IdeaUpdateSchema(Schema):
    title: str | None = None
    content: str | None = None
    status: str | None = None


def serialize_idea(i: Idea, default_status: str) -> dict:
    return {
        "id": str(i.id),
        "title": i.title,
        "content": i.description or "",
        "status": i.status or default_status,
        "created_at": i.created_at.strftime("%d %b %Y"),
    }


@router.get("/dashboard/kanban", summary="Get Kanban Columns & Ideas")
def get_kanban_board(request: HttpRequest):
    user, workspace = get_current_user_and_workspace(request)

    ideas = Idea.objects.filter(workspace=workspace).order_by("-created_at")

    unassigned_cards = [serialize_idea(i, "unassigned") for i in ideas.filter(status__in=["unassigned", "backlog"])]
    todo_cards = [serialize_idea(i, "todo") for i in ideas.filter(status__in=["todo", "planned"])]
    in_progress_cards = [serialize_idea(i, "in_progress") for i in ideas.filter(status="in_progress")]
    done_cards = [serialize_idea(i, "done") for i in ideas.filter(status__in=["done", "scheduled", "approved"])]

    columns = [
        {"id": "unassigned", "title": "Ide / Backlog", "cards": unassigned_cards},
        {"id": "todo", "title": "Rencana", "cards": todo_cards},
        {"id": "in_progress", "title": "Dalam Penulisan", "cards": in_progress_cards},
        {"id": "done", "title": "Siap Dijadwalkan", "cards": done_cards},
    ]

    return {"columns": columns}


@router.post("/dashboard/kanban/create", summary="Create New Idea")
def create_kanban_idea(request: HttpRequest, payload: IdeaCreateSchema):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "create_posts")
    title = payload.title.strip()
    if not title:
        raise HttpError(422, "Judul ide wajib diisi.")
    valid_statuses = {choice for choice, _ in Idea.Status.choices}
    if (payload.status or Idea.Status.UNASSIGNED) not in valid_statuses:
        raise HttpError(422, "Status ide tidak valid.")

    idea = Idea.objects.create(
        workspace=workspace,
        author=user,
        title=title,
        description=payload.content.strip() if payload.content else "",
        status=payload.status or "unassigned",
    )

    return {
        "success": True,
        "idea": {
            "id": str(idea.id),
            "title": idea.title,
            "content": idea.description,
            "status": idea.status,
            "created_at": idea.created_at.strftime("%d %b %Y"),
        },
    }


@router.patch("/dashboard/kanban/{idea_id}/status", summary="Update Idea Status")
def update_kanban_idea_status(request: HttpRequest, idea_id: uuid.UUID, payload: IdeaStatusUpdateSchema):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "create_posts")
    if payload.status not in {choice for choice, _ in Idea.Status.choices}:
        raise HttpError(422, "Status ide tidak valid.")
    idea = Idea.objects.filter(id=idea_id, workspace=workspace).first()
    if not idea:
        raise HttpError(404, "Ide tidak ditemukan.")
    idea.status = payload.status
    idea.save(update_fields=["status"])
    return {"success": True, "status": idea.status}


@router.patch("/dashboard/kanban/{idea_id}", summary="Update Idea Details")
def update_kanban_idea_details(request: HttpRequest, idea_id: uuid.UUID, payload: IdeaUpdateSchema):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "create_posts")
    idea = Idea.objects.filter(id=idea_id, workspace=workspace).first()
    if not idea:
        raise HttpError(404, "Ide tidak ditemukan.")

    updated_fields = []
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HttpError(422, "Judul ide wajib diisi.")
        idea.title = title
        updated_fields.append("title")
    if payload.content is not None:
        idea.description = payload.content.strip()
        updated_fields.append("description")
    if payload.status is not None:
        if payload.status not in {choice for choice, _ in Idea.Status.choices}:
            raise HttpError(422, "Status ide tidak valid.")
        idea.status = payload.status
        updated_fields.append("status")

    if updated_fields:
        idea.save(update_fields=updated_fields)

    return {
        "success": True,
        "idea": {
            "id": str(idea.id),
            "title": idea.title,
            "content": idea.description,
            "status": idea.status,
            "created_at": idea.created_at.strftime("%d %b %Y"),
        },
    }


@router.delete("/dashboard/kanban/{idea_id}", summary="Delete Idea")
def delete_kanban_idea(request: HttpRequest, idea_id: uuid.UUID):
    user, workspace = get_current_user_and_workspace(request)
    membership = require_workspace_permission(request, "create_posts")
    idea = Idea.objects.filter(id=idea_id, workspace=workspace).first()
    if not idea:
        raise HttpError(404, "Ide tidak ditemukan.")
    if idea.author_id != user.id and not membership.effective_permissions.get("edit_others_posts", False):
        raise HttpError(403, "Anda hanya dapat menghapus ide yang Anda buat sendiri.")
    idea.delete()
    return {"success": True, "message": "Ide berhasil dihapus."}
