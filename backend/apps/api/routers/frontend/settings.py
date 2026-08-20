"""Workspace Settings endpoints for Frontend API."""

from __future__ import annotations

from typing import Optional
from django.http import HttpRequest
from ninja import Router, Schema

from .helpers import frontend_auth, get_current_user_and_workspace


router = Router(tags=["frontend-settings"], auth=frontend_auth)


class SettingsUpdateSchema(Schema):
    organization_name: Optional[str] = None
    workspace_name: Optional[str] = None
    timezone: Optional[str] = None
    approval_workflow_mode: Optional[str] = None


@router.get("/dashboard/settings", summary="Get Workspace Settings")
def get_workspace_settings(request: HttpRequest):
    user, workspace = get_current_user_and_workspace(request)

    return {
        "organization_name": workspace.organization.name,
        "workspace_name": workspace.name,
        "timezone": workspace.timezone,
        "approval_workflow_mode": workspace.approval_workflow_mode or "internal",
    }


@router.post("/dashboard/settings/update", summary="Update Workspace Settings")
def update_workspace_settings(request: HttpRequest, payload: SettingsUpdateSchema):
    user, workspace = get_current_user_and_workspace(request)

    if payload.organization_name:
        workspace.organization.name = payload.organization_name.strip()
        workspace.organization.save(update_fields=["name"])

    if payload.workspace_name:
        workspace.name = payload.workspace_name.strip()
    if payload.timezone:
        workspace.timezone = payload.timezone
    if payload.approval_workflow_mode:
        workspace.approval_workflow_mode = payload.approval_workflow_mode

    workspace.save()
    return {"success": True, "message": "Pengaturan workspace berhasil diperbarui."}
