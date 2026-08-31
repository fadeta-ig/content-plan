"""Workspace Team Members & Roles endpoints for Frontend API."""

from __future__ import annotations

import secrets
import uuid

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.http import HttpRequest
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.accounts.models import User
from apps.members.models import OrgMembership, WorkspaceMembership

from .helpers import frontend_auth, get_current_user_and_workspace, require_workspace_permission

router = Router(tags=["frontend-members"], auth=frontend_auth)


class MemberInviteSchema(Schema):
    name: str
    email: str
    role: str = "editor"
    password: str | None = None


class MemberRoleUpdateSchema(Schema):
    member_id: uuid.UUID
    role: str


class MemberStatusToggleSchema(Schema):
    is_active: bool


class MemberResetPasswordSchema(Schema):
    new_password: str


ROLE_LEVELS: dict[str, int] = {
    WorkspaceMembership.WorkspaceRole.VIEWER: 1,
    WorkspaceMembership.WorkspaceRole.CLIENT: 2,
    WorkspaceMembership.WorkspaceRole.CONTRIBUTOR: 3,
    WorkspaceMembership.WorkspaceRole.EDITOR: 4,
    WorkspaceMembership.WorkspaceRole.MANAGER: 5,
    WorkspaceMembership.WorkspaceRole.OWNER: 6,
}

ASSIGNABLE_ROLES = {
    WorkspaceMembership.WorkspaceRole.MANAGER,
    WorkspaceMembership.WorkspaceRole.EDITOR,
    WorkspaceMembership.WorkspaceRole.CONTRIBUTOR,
    WorkspaceMembership.WorkspaceRole.CLIENT,
    WorkspaceMembership.WorkspaceRole.VIEWER,
}


def _validate_assignable_role(caller: WorkspaceMembership, role: str) -> None:
    if role not in ASSIGNABLE_ROLES:
        raise HttpError(422, "Role anggota tidak valid.")
    caller_level = ROLE_LEVELS.get(caller.workspace_role, 0)
    requested_level = ROLE_LEVELS.get(role, 0)
    if caller.workspace_role != WorkspaceMembership.WorkspaceRole.OWNER and requested_level >= caller_level:
        raise HttpError(403, "Anda tidak dapat memberikan role yang setara atau lebih tinggi dari role Anda.")


def _validate_password_or_422(password: str, user: User) -> None:
    try:
        validate_password(password, user=user)
    except ValidationError as exc:
        raise HttpError(422, " ".join(exc.messages)) from exc


@router.get("/dashboard/members", summary="List Real Workspace Team Members")
def list_workspace_members(request: HttpRequest):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "manage_members")

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
            "is_owner": m.workspace_role == WorkspaceMembership.WorkspaceRole.OWNER,
            "is_self": m.user == user,
        }
        for m in memberships
    ]
    return {
        "members": members_data,
        "capabilities": {"can_manage_global_accounts": user.is_superuser},
    }


@router.post("/dashboard/members/invite", summary="Invite / Add Real Workspace Member")
def invite_workspace_member(request: HttpRequest, payload: MemberInviteSchema):
    user, workspace = get_current_user_and_workspace(request)
    caller_membership = require_workspace_permission(request, "manage_members")

    clean_email = payload.email.strip().lower()
    clean_name = payload.name.strip()
    if not clean_name:
        raise HttpError(422, "Nama anggota wajib diisi.")
    try:
        validate_email(clean_email)
    except ValidationError as exc:
        raise HttpError(422, "Format alamat email tidak valid.") from exc
    _validate_assignable_role(caller_membership, payload.role)

    with transaction.atomic():
        member_user = User.objects.filter(email=clean_email).first()
        is_new_user = False
        temporary_password = None

        if not member_user:
            is_new_user = True
            temporary_password = payload.password or secrets.token_urlsafe(18)
            candidate_user = User(email=clean_email, name=clean_name)
            _validate_password_or_422(temporary_password, candidate_user)
            member_user = User.objects.create_user(
                email=clean_email,
                password=temporary_password,
                name=clean_name,
            )
        else:
            if not member_user.name and clean_name:
                member_user.name = clean_name
                member_user.save(update_fields=["name"])
            if payload.password:
                raise HttpError(
                    409,
                    "Email sudah terdaftar. Kata sandi akun yang ada tidak diubah; tambahkan tanpa mengisi kata sandi.",
                )

        OrgMembership.objects.get_or_create(
            organization=workspace.organization,
            user=member_user,
            defaults={"org_role": OrgMembership.OrgRole.MEMBER},
        )

        if is_new_user:
            # User creation provisions a personal default organization via a
            # signal. An invited user should enter only the intended tenant.
            personal_memberships = OrgMembership.objects.filter(user=member_user).exclude(
                organization=workspace.organization
            )
            for personal_membership in personal_memberships.select_related("organization"):
                personal_organization = personal_membership.organization
                if (
                    personal_organization.name == "My Organization"
                    and personal_organization.memberships.count() == 1
                ):
                    personal_membership.delete()
                    personal_organization.delete()

        wm, created = WorkspaceMembership.objects.get_or_create(
            workspace=workspace,
            user=member_user,
            defaults={"workspace_role": payload.role},
        )
        if not created:
            existing_level = ROLE_LEVELS.get(wm.workspace_role, 0)
            caller_level = ROLE_LEVELS.get(caller_membership.workspace_role, 0)
            if (
                caller_membership.workspace_role != WorkspaceMembership.WorkspaceRole.OWNER
                and existing_level >= caller_level
            ):
                raise HttpError(403, "Anda tidak dapat mengubah anggota dengan role setara atau lebih tinggi.")
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
            "is_self": member_user == user,
        },
        "temporary_password": temporary_password,
        "is_new_user": is_new_user,
        "message": f"Anggota {member_user.email} berhasil ditambahkan ke tim.",
    }


@router.post("/dashboard/members/update-role", summary="Update Workspace Member Role")
def update_member_role(request: HttpRequest, payload: MemberRoleUpdateSchema):
    user, workspace = get_current_user_and_workspace(request)
    caller_membership = require_workspace_permission(request, "manage_members")
    _validate_assignable_role(caller_membership, payload.role)
    wm = WorkspaceMembership.objects.filter(id=payload.member_id, workspace=workspace).first()
    if not wm:
        raise HttpError(404, "Anggota tidak ditemukan.")

    if wm.workspace_role == WorkspaceMembership.WorkspaceRole.OWNER:
        raise HttpError(403, "Role owner tidak dapat diubah melalui halaman anggota workspace.")
    caller_level = ROLE_LEVELS.get(caller_membership.workspace_role, 0)
    target_level = ROLE_LEVELS.get(wm.workspace_role, 0)
    if caller_membership.workspace_role != WorkspaceMembership.WorkspaceRole.OWNER and target_level >= caller_level:
        raise HttpError(403, "Anda tidak dapat mengubah anggota dengan role setara atau lebih tinggi.")

    wm.workspace_role = payload.role
    wm.save(update_fields=["workspace_role"])
    return {"success": True, "role": wm.workspace_role}


@router.post("/dashboard/members/{member_id}/toggle-status", summary="Toggle Member Active / Inactive Status")
def toggle_member_status(request: HttpRequest, member_id: uuid.UUID, payload: MemberStatusToggleSchema):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "manage_members")
    if not user.is_superuser:
        raise HttpError(
            403,
            "Status login bersifat global dan hanya dapat diubah oleh superadmin. Gunakan Hapus Anggota untuk mencabut akses workspace.",
        )
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
def reset_member_password(request: HttpRequest, member_id: uuid.UUID, payload: MemberResetPasswordSchema):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "manage_members")
    if not user.is_superuser:
        raise HttpError(
            403,
            "Reset kata sandi langsung hanya tersedia bagi superadmin. Anggota harus memakai alur Lupa Kata Sandi.",
        )
    wm = WorkspaceMembership.objects.filter(id=member_id, workspace=workspace).select_related("user").first()
    if not wm:
        raise HttpError(404, "Anggota tidak ditemukan.")

    clean_password = payload.new_password.strip()
    _validate_password_or_422(clean_password, wm.user)

    wm.user.set_password(clean_password)
    wm.user.save(update_fields=["password"])

    return {
        "success": True,
        "message": f"Kata sandi untuk akun {wm.user.email} berhasil diperbarui.",
    }


@router.delete("/dashboard/members/{member_id}", summary="Remove Member from Workspace")
def remove_workspace_member(request: HttpRequest, member_id: uuid.UUID):
    user, workspace = get_current_user_and_workspace(request)
    caller_membership = require_workspace_permission(request, "manage_members")
    wm = WorkspaceMembership.objects.filter(id=member_id, workspace=workspace).first()
    if not wm:
        raise HttpError(404, "Anggota tidak ditemukan.")

    if wm.workspace_role == WorkspaceMembership.WorkspaceRole.OWNER:
        raise HttpError(403, "Owner workspace tidak dapat dihapus melalui halaman anggota.")
    caller_level = ROLE_LEVELS.get(caller_membership.workspace_role, 0)
    target_level = ROLE_LEVELS.get(wm.workspace_role, 0)
    if caller_membership.workspace_role != WorkspaceMembership.WorkspaceRole.OWNER and target_level >= caller_level:
        raise HttpError(403, "Anda tidak dapat menghapus anggota dengan role setara atau lebih tinggi.")

    wm.delete()
    return {"success": True, "message": "Anggota berhasil dihapus dari workspace."}
