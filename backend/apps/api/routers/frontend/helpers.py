"""Shared helpers, authentication, and sentiment analysis for frontend API."""

from __future__ import annotations

import re
import uuid
from typing import Any, cast

from django.http import HttpRequest
from ninja.errors import HttpError
from ninja.security import APIKeyCookie, SessionAuth

from apps.accounts.models import User
from apps.members.models import WorkspaceMembership
from apps.workspaces.models import Workspace


class FrontendRequest(HttpRequest):
    """Typed view of request attributes attached during tenant resolution."""

    workspace: Workspace
    workspace_membership: WorkspaceMembership


class FrontendSessionAuth(SessionAuth):
    """Cookie-session authentication with Django's CSRF protection enabled."""

    def __init__(self):
        super().__init__(csrf=True)

    def authenticate(self, request: HttpRequest, key: str | None = None) -> Any | None:
        if hasattr(request, "user") and request.user.is_authenticated:
            if request.user.tos_accepted_at is None:
                raise HttpError(
                    403,
                    "Setujui Syarat Layanan dan Kebijakan Privasi sebelum menggunakan dashboard.",
                )
            return request.user
        return None


frontend_auth = FrontendSessionAuth()


class CsrfOnlyCookieAuth(APIKeyCookie):
    """Require a valid Django CSRF token without requiring an active session."""

    param_name = "csrftoken"

    def authenticate(self, request: HttpRequest, key: str | None) -> bool:
        return True


csrf_only_auth = CsrfOnlyCookieAuth(csrf=True)


def get_current_user_and_workspace(request: HttpRequest):
    """Resolve a workspace only through the authenticated user's membership.

    ``X-Workspace-ID`` and ``workspace_id`` are untrusted selectors. They must
    never be used to fetch a Workspace directly because that turns a guessed
    UUID into cross-tenant access. The selected membership is also attached to
    the request so every mutation can enforce the effective RBAC permissions.
    """
    if not hasattr(request, "user") or not request.user.is_authenticated:
        raise HttpError(401, "Sesi autentikasi telah berakhir. Silakan login kembali.")

    user = request.user
    if not isinstance(user, User):
        raise HttpError(401, "Sesi pengguna tidak valid.")
    membership = None
    workspace_id_header = request.headers.get("X-Workspace-ID") or request.GET.get("workspace_id")
    if workspace_id_header:
        try:
            selected_workspace_id = uuid.UUID(str(workspace_id_header))
        except (TypeError, ValueError, AttributeError) as exc:
            raise HttpError(400, "ID workspace tidak valid.") from exc

        membership = (
            WorkspaceMembership.objects.filter(
                user=user,
                workspace_id=selected_workspace_id,
                workspace__is_archived=False,
            )
            .select_related("workspace__organization", "custom_role")
            .first()
        )
        if membership is None:
            raise HttpError(403, "Anda tidak memiliki akses ke workspace yang dipilih.")

    last_workspace_id = user.last_workspace_id
    if membership is None and last_workspace_id is not None:
        membership = (
            WorkspaceMembership.objects.filter(
                user=user,
                workspace_id=last_workspace_id,
                workspace__is_archived=False,
            )
            .select_related("workspace__organization", "custom_role")
            .first()
        )

    if membership is None:
        membership = (
            WorkspaceMembership.objects.filter(user=user, workspace__is_archived=False)
            .select_related("workspace__organization", "custom_role")
            .order_by("added_at")
            .first()
        )

    if membership is None:
        raise HttpError(
            403,
            "Workspace aktif tidak ditemukan. Pastikan akun Anda telah terdaftar dalam workspace yang valid.",
        )

    workspace = membership.workspace
    frontend_request = cast(FrontendRequest, request)
    frontend_request.workspace = workspace
    frontend_request.workspace_membership = membership

    if user.last_workspace_id != workspace.id:
        user.last_workspace_id = workspace.id
        user.save(update_fields=["last_workspace_id"])

    return user, workspace


def require_workspace_permission(request: HttpRequest, permission_key: str) -> WorkspaceMembership:
    """Require an effective workspace permission after tenant resolution."""
    membership = getattr(request, "workspace_membership", None)
    if membership is None:
        get_current_user_and_workspace(request)
        membership = getattr(request, "workspace_membership", None)
    if membership is None or not membership.effective_permissions.get(permission_key, False):
        raise HttpError(403, "Anda tidak memiliki izin untuk melakukan tindakan ini.")
    return membership


def require_workspace_role(request: HttpRequest, minimum_role: str) -> WorkspaceMembership:
    """Require a minimum built-in role for hierarchy-sensitive administration."""
    membership = getattr(request, "workspace_membership", None)
    if membership is None:
        get_current_user_and_workspace(request)
        membership = getattr(request, "workspace_membership", None)

    role_levels: dict[str, int] = {
        WorkspaceMembership.WorkspaceRole.VIEWER: 1,
        WorkspaceMembership.WorkspaceRole.CLIENT: 2,
        WorkspaceMembership.WorkspaceRole.CONTRIBUTOR: 3,
        WorkspaceMembership.WorkspaceRole.EDITOR: 4,
        WorkspaceMembership.WorkspaceRole.MANAGER: 5,
        WorkspaceMembership.WorkspaceRole.OWNER: 6,
    }
    if membership is None or role_levels.get(membership.workspace_role, 0) < role_levels.get(minimum_role, 0):
        raise HttpError(403, "Role Anda tidak cukup untuk melakukan tindakan ini.")
    return membership


POSITIVE_KEYWORDS = {
    "bagus",
    "keren",
    "mantap",
    "terima kasih",
    "makasih",
    "suka",
    "puas",
    "hebat",
    "luar biasa",
    "rekomendasi",
    "sukses",
    "bantu",
    "senang",
    "good",
    "great",
    "awesome",
    "love",
    "thanks",
    "thank",
    "best",
    "helpful",
    "excellent",
    "amazing",
    "perfect",
    "congrats",
    "selamat",
}

NEGATIVE_KEYWORDS = {
    "jelek",
    "kecewa",
    "rusak",
    "error",
    "lambat",
    "lemot",
    "buruk",
    "batal",
    "parah",
    "rugi",
    "bohong",
    "penipuan",
    "mahal",
    "sulit",
    "bad",
    "slow",
    "broken",
    "worst",
    "terrible",
    "issue",
    "bug",
    "fail",
    "failed",
    "hate",
    "problem",
    "complaint",
    "gagal",
}


def analyze_sentiment(text: str) -> str:
    """Classify text sentiment into positive, neutral, or negative."""
    if not text:
        return "neutral"

    lower_text = text.lower()
    pos_score = sum(1 for word in POSITIVE_KEYWORDS if re.search(r"\b" + re.escape(word) + r"\b", lower_text))
    neg_score = sum(1 for word in NEGATIVE_KEYWORDS if re.search(r"\b" + re.escape(word) + r"\b", lower_text))

    if pos_score > neg_score:
        return "positive"
    elif neg_score > pos_score:
        return "negative"
    return "neutral"
