"""Shared helpers, authentication, and sentiment analysis for frontend API."""

from __future__ import annotations

import re
import uuid
from typing import Any, Optional

from django.http import HttpRequest
from ninja.errors import HttpError
from ninja.security import SessionAuth

from apps.accounts.models import User
from apps.members.models import OrgMembership, WorkspaceMembership
from apps.organizations.models import Organization
from apps.workspaces.models import Workspace


class FrontendSessionAuth(SessionAuth):
    """Session authenticator that strictly verifies active user session without form CSRF."""

    def __init__(self):
        super().__init__(csrf=False)

    def authenticate(self, request: HttpRequest, key: Optional[str] = None) -> Optional[Any]:
        if hasattr(request, "user") and request.user.is_authenticated:
            return request.user
        return None


frontend_auth = FrontendSessionAuth()


def get_current_user_and_workspace(request: HttpRequest) -> tuple[User, Workspace]:
    """Resolve authenticated user and their active workspace strictly."""
    if not hasattr(request, "user") or not request.user.is_authenticated:
        raise HttpError(401, "Sesi autentikasi telah berakhir. Silakan login kembali.")

    user = request.user
    workspace = None
    workspace_id_header = request.headers.get("X-Workspace-ID") or request.GET.get("workspace_id")
    if workspace_id_header:
        try:
            workspace = Workspace.objects.filter(id=uuid.UUID(str(workspace_id_header))).first()
        except Exception:
            pass

    if not workspace and getattr(user, "last_workspace_id", None):
        workspace = Workspace.objects.filter(id=user.last_workspace_id).first()

    if not workspace:
        membership = WorkspaceMembership.objects.filter(user=user).select_related("workspace").first()
        if membership:
            workspace = membership.workspace

    if not workspace:
        org_membership = OrgMembership.objects.filter(user=user).select_related("organization").first()
        if org_membership:
            workspace = Workspace.objects.filter(organization=org_membership.organization).first()

    if not workspace:
        org, _ = Organization.objects.get_or_create(
            name="PT Wijaya Inovasi Gemilang",
            defaults={"default_timezone": "Asia/Jakarta"},
        )
        OrgMembership.objects.get_or_create(
            organization=org,
            user=user,
            defaults={"org_role": OrgMembership.OrgRole.OWNER},
        )
        workspace, _ = Workspace.objects.get_or_create(
            organization=org,
            name="Content Plan Studio",
            defaults={"timezone": "Asia/Jakarta"},
        )
        WorkspaceMembership.objects.get_or_create(
            workspace=workspace,
            user=user,
            defaults={"workspace_role": WorkspaceMembership.WorkspaceRole.OWNER},
        )

    return user, workspace


POSITIVE_KEYWORDS = {
    "bagus", "keren", "mantap", "terima kasih", "makasih", "suka", "puas",
    "hebat", "luar biasa", "rekomendasi", "sukses", "bantu", "senang",
    "good", "great", "awesome", "love", "thanks", "thank", "best", "helpful",
    "excellent", "amazing", "perfect", "congrats", "selamat",
}

NEGATIVE_KEYWORDS = {
    "jelek", "kecewa", "rusak", "error", "lambat", "lemot", "buruk",
    "batal", "parah", "rugi", "bohong", "penipuan", "mahal", "sulit",
    "bad", "slow", "broken", "worst", "terrible", "issue", "bug",
    "fail", "failed", "hate", "problem", "complaint", "gagal",
}


def analyze_sentiment(text: str) -> str:
    """Classify text sentiment into positive, neutral, or negative."""
    if not text:
        return "neutral"

    lower_text = text.lower()
    pos_score = sum(1 for word in POSITIVE_KEYWORDS if re.search(r'\b' + re.escape(word) + r'\b', lower_text))
    neg_score = sum(1 for word in NEGATIVE_KEYWORDS if re.search(r'\b' + re.escape(word) + r'\b', lower_text))

    if pos_score > neg_score:
        return "positive"
    elif neg_score > pos_score:
        return "negative"
    return "neutral"
