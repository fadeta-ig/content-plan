"""Kanban Ideas & Content Pipeline endpoints for Frontend API."""

from __future__ import annotations

from typing import Optional
from django.http import HttpRequest
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.composer.models import Idea
from .helpers import frontend_auth, get_current_user_and_workspace


router = Router(tags=["frontend-kanban"], auth=frontend_auth)


class IdeaCreateSchema(Schema):
    workspace_id: Optional[str] = None
    title: str
    content: Optional[str] = ""
    status: Optional[str] = "unassigned"
    group_id: Optional[str] = None


class IdeaStatusUpdateSchema(Schema):
    status: str


@router.get("/dashboard/kanban", summary="Get Kanban Columns & Ideas")
def get_kanban_board(request: HttpRequest):
    user, workspace = get_current_user_and_workspace(request)

    ideas = Idea.objects.filter(workspace=workspace).order_by("-created_at")

    unassigned_cards = [
        {"id": str(i.id), "title": i.title, "content": i.description or "", "created_at": i.created_at.strftime("%d %b %Y")}
        for i in ideas.filter(status__in=["unassigned", "backlog"])
    ]
    todo_cards = [
        {"id": str(i.id), "title": i.title, "content": i.description or "", "created_at": i.created_at.strftime("%d %b %Y")}
        for i in ideas.filter(status__in=["todo", "planned"])
    ]
    in_progress_cards = [
        {"id": str(i.id), "title": i.title, "content": i.description or "", "created_at": i.created_at.strftime("%d %b %Y")}
        for i in ideas.filter(status="in_progress")
    ]
    done_cards = [
        {"id": str(i.id), "title": i.title, "content": i.description or "", "created_at": i.created_at.strftime("%d %b %Y")}
        for i in ideas.filter(status__in=["done", "scheduled", "approved"])
    ]

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

    idea = Idea.objects.create(
        workspace=workspace,
        author=user,
        title=payload.title.strip(),
        description=payload.content.strip() if payload.content else "",
        status=payload.status or "unassigned",
    )

    return {
        "success": True,
        "idea": {
            "id": str(idea.id),
            "title": idea.title,
            "content": idea.description,
            "created_at": idea.created_at.strftime("%d %b %Y"),
        },
    }


@router.patch("/dashboard/kanban/{idea_id}/status", summary="Update Idea Status")
def update_kanban_idea_status(request: HttpRequest, idea_id: str, payload: IdeaStatusUpdateSchema):
    user, workspace = get_current_user_and_workspace(request)
    idea = Idea.objects.filter(id=idea_id, workspace=workspace).first()
    if not idea:
        raise HttpError(404, "Ide tidak ditemukan.")
    idea.status = payload.status
    idea.save(update_fields=["status"])
    return {"success": True, "status": idea.status}


@router.delete("/dashboard/kanban/{idea_id}", summary="Delete Idea")
def delete_kanban_idea(request: HttpRequest, idea_id: str):
    user, workspace = get_current_user_and_workspace(request)
    idea = Idea.objects.filter(id=idea_id, workspace=workspace).first()
    if not idea:
        raise HttpError(404, "Ide tidak ditemukan.")
    idea.delete()
    return {"success": True, "message": "Ide berhasil dihapus."}
