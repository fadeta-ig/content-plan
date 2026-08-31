"""Workspace Settings endpoints for Frontend API."""

from __future__ import annotations

from zoneinfo import available_timezones

from django.http import HttpRequest
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.members.models import OrgMembership
from apps.workspaces.models import Workspace

from .helpers import frontend_auth, get_current_user_and_workspace, require_workspace_permission

router = Router(tags=["frontend-settings"], auth=frontend_auth)


class SettingsUpdateSchema(Schema):
    organization_name: str | None = None
    workspace_name: str | None = None
    timezone: str | None = None
    approval_workflow_mode: str | None = None


@router.get("/dashboard/settings", summary="Get Workspace Settings")
def get_workspace_settings(request: HttpRequest):
    user, workspace = get_current_user_and_workspace(request)

    return {
        "organization_name": workspace.organization.name,
        "workspace_name": workspace.name,
        "timezone": workspace.timezone,
        "approval_workflow_mode": workspace.approval_workflow_mode or Workspace.ApprovalWorkflowMode.NONE,
    }


@router.post("/dashboard/settings/update", summary="Update Workspace Settings")
def update_workspace_settings(request: HttpRequest, payload: SettingsUpdateSchema):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "manage_workspace_settings")

    if payload.organization_name is not None:
        organization_name = payload.organization_name.strip()
        if not organization_name or len(organization_name) > 100:
            raise HttpError(422, "Nama organisasi wajib diisi dan maksimal 100 karakter.")
        org_membership = OrgMembership.objects.filter(user=user, organization=workspace.organization).first()
        if org_membership is None or org_membership.org_role != OrgMembership.OrgRole.OWNER:
            raise HttpError(403, "Hanya owner organisasi yang dapat mengubah nama organisasi.")
        workspace.organization.name = organization_name
        workspace.organization.save(update_fields=["name"])

    update_fields = []
    if payload.workspace_name is not None:
        workspace_name = payload.workspace_name.strip()
        if not workspace_name or len(workspace_name) > 100:
            raise HttpError(422, "Nama workspace wajib diisi dan maksimal 100 karakter.")
        workspace.name = workspace_name
        update_fields.append("name")
    if payload.timezone is not None:
        if payload.timezone not in available_timezones():
            raise HttpError(422, "Zona waktu tidak valid.")
        workspace.timezone = payload.timezone
        update_fields.append("timezone")
    if payload.approval_workflow_mode is not None:
        valid_modes = {choice for choice, _ in Workspace.ApprovalWorkflowMode.choices}
        if payload.approval_workflow_mode not in valid_modes:
            raise HttpError(422, "Mode alur persetujuan tidak valid.")
        workspace.approval_workflow_mode = payload.approval_workflow_mode
        update_fields.append("approval_workflow_mode")

    if update_fields:
        workspace.save(update_fields=update_fields)
    return {"success": True, "message": "Pengaturan workspace berhasil diperbarui."}
