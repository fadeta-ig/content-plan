"""Authentication & Session endpoints for Frontend API."""

from __future__ import annotations

from typing import Optional
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.db import transaction
from django.http import HttpRequest
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.accounts.models import User
from apps.members.models import OrgMembership, WorkspaceMembership
from apps.organizations.models import Organization
from apps.workspaces.models import Workspace
from .helpers import frontend_auth, get_current_user_and_workspace


router = Router(tags=["frontend-auth"], auth=frontend_auth)


class LoginRequest(Schema):
    email: str
    password: str


class RegisterRequest(Schema):
    email: str
    name: str
    password: str
    organization_name: Optional[str] = "PT Wijaya Inovasi Gemilang"
    workspace_name: Optional[str] = "Content Plan Studio"


@router.post("/login", summary="User Login", auth=None)
def auth_login(request: HttpRequest, payload: LoginRequest):
    user = authenticate(request, email=payload.email.strip().lower(), password=payload.password)
    if not user:
        try:
            u = User.objects.get(email=payload.email.strip().lower())
            if u.check_password(payload.password):
                user = u
        except User.DoesNotExist:
            pass

    if not user:
        raise HttpError(401, "Email atau kata sandi tidak sesuai.")

    if not user.is_active:
        raise HttpError(403, "Akun ini telah dinonaktifkan. Hubungi administrator.")

    django_login(request, user)
    _, workspace = get_current_user_and_workspace(request)

    return {
        "success": True,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name or user.email.split("@")[0],
            "avatar_url": user.avatar.url if user.avatar else "",
            "is_staff": user.is_staff,
            "active_workspace_id": str(workspace.id) if workspace else None,
        },
    }


@router.post("/register", summary="User Registration", auth=None)
def auth_register(request: HttpRequest, payload: RegisterRequest):
    clean_email = payload.email.strip().lower()
    if User.objects.filter(email=clean_email).exists():
        raise HttpError(400, "Akun dengan email ini sudah terdaftar.")

    with transaction.atomic():
        user = User.objects.create_user(
            email=clean_email,
            password=payload.password,
            name=payload.name.strip(),
            tos_accepted_at=timezone.now(),
        )

        org, _ = Organization.objects.get_or_create(
            name=payload.organization_name or "PT Wijaya Inovasi Gemilang",
            defaults={"default_timezone": "Asia/Jakarta"},
        )

        OrgMembership.objects.get_or_create(
            organization=org,
            user=user,
            defaults={"org_role": OrgMembership.OrgRole.OWNER},
        )

        workspace, _ = Workspace.objects.get_or_create(
            organization=org,
            name=payload.workspace_name or "Content Plan Studio",
            defaults={"timezone": "Asia/Jakarta"},
        )

        WorkspaceMembership.objects.get_or_create(
            workspace=workspace,
            user=user,
            defaults={"workspace_role": WorkspaceMembership.WorkspaceRole.OWNER},
        )

        user.last_workspace_id = workspace.id
        user.save(update_fields=["last_workspace_id"])
        django_login(request, user)

    return {
        "success": True,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "avatar_url": "",
            "is_staff": user.is_staff,
            "active_workspace_id": str(workspace.id),
        },
    }


@router.get("/me", summary="Get Current User Profile")
def auth_me(request: HttpRequest):
    user, active_workspace = get_current_user_and_workspace(request)

    memberships = WorkspaceMembership.objects.filter(user=user).select_related(
        "workspace", "workspace__organization"
    )
    workspaces_data = [
        {
            "id": str(m.workspace.id),
            "name": m.workspace.name,
            "slug": str(m.workspace.id),
            "color": m.workspace.primary_color or "#0f172a",
            "logo_url": m.workspace.icon.url if m.workspace.icon else "",
            "role": m.workspace_role,
            "organization_name": m.workspace.organization.name,
        }
        for m in memberships
    ]

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name or user.email.split("@")[0],
            "avatar_url": user.avatar.url if user.avatar else "",
            "is_staff": user.is_staff,
            "active_workspace_id": str(active_workspace.id) if active_workspace else None,
        },
        "workspaces": workspaces_data,
        "active_workspace": {
            "id": str(active_workspace.id),
            "name": active_workspace.name,
            "slug": str(active_workspace.id),
            "color": active_workspace.primary_color or "#0f172a",
            "approval_workflow_mode": active_workspace.approval_workflow_mode,
            "organization_name": active_workspace.organization.name,
        }
        if active_workspace
        else None,
    }


@router.post("/logout", summary="User Logout")
def auth_logout(request: HttpRequest):
    django_logout(request)
    return {"success": True, "message": "Logged out successfully."}
