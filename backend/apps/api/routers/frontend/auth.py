"""Authentication & Session endpoints for Frontend API."""

from __future__ import annotations

from typing import cast

from django.contrib.auth import authenticate
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.http import HttpRequest, JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.accounts.models import User
from apps.members.models import WorkspaceMembership

from .helpers import FrontendRequest, csrf_only_auth, frontend_auth, get_current_user_and_workspace

router = Router(tags=["frontend-auth"], auth=frontend_auth)


class LoginRequest(Schema):
    email: str
    password: str


class WorkspaceSwitchRequest(Schema):
    workspace_id: str


@router.get("/csrf", summary="Issue CSRF Token", auth=None)
@ensure_csrf_cookie
@csrf_exempt
def auth_csrf(request: HttpRequest):
    """Issue the CSRF cookie/token required by cookie-authenticated writes."""
    return JsonResponse({"csrf_token": get_token(request)})


@router.post("/login", summary="User Login", auth=csrf_only_auth)
def auth_login(request: HttpRequest, payload: LoginRequest):
    clean_email = payload.email.strip().lower()
    user = authenticate(request, username=clean_email, password=payload.password) or authenticate(
        request, email=clean_email, password=payload.password
    )

    if not user or not isinstance(user, User):
        raise HttpError(401, "Email atau kata sandi tidak sesuai.")

    if not user.is_active:
        raise HttpError(403, "Akun ini telah dinonaktifkan. Hubungi administrator.")

    django_login(request, user)

    if user.tos_accepted_at is None:
        return {
            "success": True,
            "requires_tos": True,
            "accept_terms_url": "/accounts/accept-terms/",
        }

    _, workspace = get_current_user_and_workspace(request)

    return {
        "success": True,
        "requires_tos": False,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name or user.email.split("@")[0],
            "avatar_url": user.avatar.url if user.avatar else "",
            "is_staff": user.is_staff,
            "active_workspace_id": str(workspace.id) if workspace else None,
        },
    }


@router.get("/me", summary="Get Current User Profile")
def auth_me(request: HttpRequest):
    user, active_workspace = get_current_user_and_workspace(request)

    memberships = WorkspaceMembership.objects.filter(user=user, workspace__is_archived=False).select_related(
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
            "logo_url": active_workspace.icon.url if active_workspace.icon else "",
            "role": cast(FrontendRequest, request).workspace_membership.workspace_role,
            "approval_workflow_mode": active_workspace.approval_workflow_mode,
            "organization_name": active_workspace.organization.name,
        }
        if active_workspace
        else None,
    }


@router.post("/switch-workspace", summary="Switch Active Workspace")
def auth_switch_workspace(request: HttpRequest, payload: WorkspaceSwitchRequest):
    request.META["HTTP_X_WORKSPACE_ID"] = payload.workspace_id
    _, workspace = get_current_user_and_workspace(request)
    return {
        "success": True,
        "message": f"Workspace aktif diubah ke {workspace.name}.",
        "workspace_id": str(workspace.id),
    }


@router.post("/logout", summary="User Logout")
def auth_logout(request: HttpRequest):
    django_logout(request)
    return {"success": True, "message": "Sesi berhasil diakhiri."}
