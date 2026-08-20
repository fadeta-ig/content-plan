"""Workspace Team Members & Roles endpoints for Frontend API."""

from __future__ import annotations

import secrets
from typing import Optional
from django.db import transaction
from django.http import HttpRequest
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.accounts.models import User
from apps.members.models import OrgMembership, WorkspaceMembership
from .helpers import frontend_auth, get_current_user_and_workspace


router = Router(tags=["frontend-members"], auth=frontend_auth)


class MemberInviteSchema(Schema):
    name: str
    email: str
    role: str = "editor"
    password: Optional[str] = None


class MemberRoleUpdateSchema(Schema):
    member_id: str
    role: str


class MemberStatusToggleSchema(Schema):
    is_active: bool


class MemberResetPasswordSchema(Schema):
    new_password: str


@router.get("/dashboard/members", summary="List Real Workspace Team Members")
def list_workspace_members(request: HttpRequest):
    user, workspace = get_current_user_and_workspace(request)

    memberships = WorkspaceMembership.objects.filter(workspace=workspace).select_related("user")
    members_data = [
        {
            "id": str(m.id),
            "user_id": str(m.user.id),
            "name": m.user.name or m.user.email.split("@")[0],
            "email": m.user.email,
            "role": m.workspace_role,
            "joined_at": m.added_at.strftime("%d %b %Y"),
            "is_active": m.user.is_active,
            "status": "active" if m.user.is_active else "inactive",
            "is_owner": m.workspace_role == WorkspaceMembership.WorkspaceRole.OWNER or m.user == user,
        }
        for m in memberships
    ]
    return {"members": members_data}


@router.post("/dashboard/members/invite", summary="Invite / Add Real Workspace Member")
def invite_workspace_member(request: HttpRequest, payload: MemberInviteSchema):
    user, workspace = get_current_user_and_workspace(request)

    clean_email = payload.email.strip().lower()
    clean_name = payload.name.strip()

    if payload.password and len(payload.password) < 6:
        raise HttpError(422, "Kata sandi akun minimal 6 karakter.")

    with transaction.atomic():
        # Check if user already exists
        member_user = User.objects.filter(email=clean_email).first()
        is_new_user = False
        final_password = payload.password or secrets.token_urlsafe(10)

        if not member_user:
            is_new_user = True
            member_user = User.objects.create_user(
                email=clean_email,
                password=final_password,
                name=clean_name,
                tos_accepted_at=timezone.now(),
            )
        else:
            if not member_user.name and clean_name:
                member_user.name = clean_name
                member_user.save(update_fields=["name"])
            if payload.password:
                member_user.set_password(payload.password)
                member_user.save(update_fields=["password"])

        OrgMembership.objects.get_or_create(
            organization=workspace.organization,
            user=member_user,
            defaults={"org_role": OrgMembership.OrgRole.MEMBER},
        )

        wm, created = WorkspaceMembership.objects.get_or_create(
            workspace=workspace,
            user=member_user,
            defaults={"workspace_role": payload.role},
        )
        if not created:
            wm.workspace_role = payload.role
            wm.save(update_fields=["workspace_role"])

    return {
        "success": True,
        "member": {
            "id": str(wm.id),
            "user_id": str(member_user.id),
            "name": member_user.name or member_user.email.split("@")[0],
            "email": member_user.email,
            "role": wm.workspace_role,
            "joined_at": wm.added_at.strftime("%d %b %Y"),
            "is_active": member_user.is_active,
            "status": "active" if member_user.is_active else "inactive",
            "is_owner": False,
        },
        "temporary_password": final_password if is_new_user or payload.password else None,
        "is_new_user": is_new_user,
        "message": f"Anggota {member_user.email} berhasil ditambahkan ke tim.",
    }


@router.post("/dashboard/members/update-role", summary="Update Workspace Member Role")
def update_member_role(request: HttpRequest, payload: MemberRoleUpdateSchema):
    user, workspace = get_current_user_and_workspace(request)
    wm = WorkspaceMembership.objects.filter(id=payload.member_id, workspace=workspace).first()
    if not wm:
        raise HttpError(404, "Anggota tidak ditemukan.")

    wm.workspace_role = payload.role
    wm.save(update_fields=["workspace_role"])
    return {"success": True, "role": wm.workspace_role}


@router.post("/dashboard/members/{member_id}/toggle-status", summary="Toggle Member Active / Inactive Status")
def toggle_member_status(request: HttpRequest, member_id: str, payload: MemberStatusToggleSchema):
    user, workspace = get_current_user_and_workspace(request)
    wm = WorkspaceMembership.objects.filter(id=member_id, workspace=workspace).select_related("user").first()
    if not wm:
        raise HttpError(404, "Anggota tidak ditemukan.")

    if wm.user == user:
        raise HttpError(400, "Tidak dapat menonaktifkan akun yang sedang aktif digunakan.")

    if wm.workspace_role == WorkspaceMembership.WorkspaceRole.OWNER:
        raise HttpError(400, "Tidak dapat menonaktifkan akun pemilik utama workspace.")

    wm.user.is_active = payload.is_active
    wm.user.save(update_fields=["is_active"])

    status_str = "diaktifkan" if wm.user.is_active else "dinonaktifkan"
    return {
        "success": True,
        "is_active": wm.user.is_active,
        "status": "active" if wm.user.is_active else "inactive",
        "message": f"Status akun {wm.user.email} berhasil {status_str}.",
    }


@router.post("/dashboard/members/{member_id}/reset-password", summary="Reset Member Password")
def reset_member_password(request: HttpRequest, member_id: str, payload: MemberResetPasswordSchema):
    user, workspace = get_current_user_and_workspace(request)
    wm = WorkspaceMembership.objects.filter(id=member_id, workspace=workspace).select_related("user").first()
    if not wm:
        raise HttpError(404, "Anggota tidak ditemukan.")

    clean_password = payload.new_password.strip()
    if len(clean_password) < 6:
        raise HttpError(422, "Kata sandi baru minimal 6 karakter.")

    wm.user.set_password(clean_password)
    wm.user.save(update_fields=["password"])

    return {
        "success": True,
        "message": f"Kata sandi untuk akun {wm.user.email} berhasil diperbarui.",
    }


@router.delete("/dashboard/members/{member_id}", summary="Remove Member from Workspace")
def remove_workspace_member(request: HttpRequest, member_id: str):
    user, workspace = get_current_user_and_workspace(request)
    wm = WorkspaceMembership.objects.filter(id=member_id, workspace=workspace).first()
    if not wm:
        raise HttpError(404, "Anggota tidak ditemukan.")

    if wm.workspace_role == WorkspaceMembership.WorkspaceRole.OWNER and wm.user == user:
        raise HttpError(400, "Tidak dapat menghapus pemilik utama workspace.")

    wm.delete()
    return {"success": True, "message": "Anggota berhasil dihapus dari workspace."}
