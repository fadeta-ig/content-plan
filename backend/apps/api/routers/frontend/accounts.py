"""Connected Social Accounts management endpoints for Frontend API."""

from __future__ import annotations

import logging
import secrets
import uuid

from django.http import HttpRequest
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.social_accounts.models import SocialAccount
from apps.social_accounts.services import disconnect_social_account as disconnect_account_service

from .helpers import frontend_auth, get_current_user_and_workspace, require_workspace_permission

router = Router(tags=["frontend-accounts"], auth=frontend_auth)
logger = logging.getLogger(__name__)


class ManualAccountCreateSchema(Schema):
    platform: str
    account_name: str | None = ""
    account_handle: str | None = ""
    follower_count: int | None = 0


@router.get("/dashboard/accounts", summary="List Connected Social Accounts")
def list_social_accounts(request: HttpRequest):
    user, workspace = get_current_user_and_workspace(request)

    accounts = SocialAccount.objects.filter(workspace=workspace).order_by("-connected_at")
    accounts_data = [
        {
            "id": str(a.id),
            "platform": a.platform,
            "account_name": a.account_name,
            "account_handle": a.account_handle,
            "avatar_url": a.avatar_url,
            "follower_count": a.follower_count,
            "connection_status": a.connection_status,
            "is_token_expiring_soon": a.is_token_expiring_soon,
            "connected_at": a.connected_at.strftime("%d %b %Y"),
        }
        for a in accounts
    ]

    return {"accounts": accounts_data}


@router.post("/dashboard/accounts/create-manual", summary="Connect Social Account")
def create_manual_social_account(request: HttpRequest, payload: ManualAccountCreateSchema):
    get_current_user_and_workspace(request)
    require_workspace_permission(request, "manage_social_accounts")
    raise HttpError(
        409,
        "Akun manual tidak dapat ditandai terhubung karena tidak memiliki token publikasi. Konfigurasikan OAuth lalu hubungkan akun secara resmi.",
    )


@router.get("/dashboard/accounts/oauth-init", summary="Check and Initialize OAuth URL")
def init_oauth(request: HttpRequest, platform: str):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "manage_social_accounts")
    org_id = workspace.organization_id if workspace.organization else None

    from apps.social_accounts.views import (
        OAUTH_SESSION_KEY,
        _apply_analytics_scope_flag,
        _build_redirect_uri,
        _get_configured_platforms,
        _get_provider_for_platform,
        _get_visible_platform_choices,
        _sign_state,
        issue_pkce_verifier,
        pkce_kwargs,
    )

    configured_platforms = _get_configured_platforms(org_id) if org_id else set()
    visible_platform_choices = dict(_get_visible_platform_choices())

    if platform not in visible_platform_choices:
        return {"configured": False, "message": f"Platform {platform} tidak didukung."}

    if platform not in configured_platforms:
        return {
            "configured": False,
            "message": f"Kredensial OAuth Developer (App ID / Secret) untuk {visible_platform_choices.get(platform, platform)} belum dikonfigurasi oleh administrator.",
        }

    try:
        provider = _get_provider_for_platform(platform, org_id)
        _apply_analytics_scope_flag(provider, platform)
        nonce = secrets.token_urlsafe(32)
        state = _sign_state(workspace.id, platform, user.id, nonce)
        code_verifier = issue_pkce_verifier(provider)

        request.session[OAUTH_SESSION_KEY] = {
            "nonce": nonce,
            "workspace_id": str(workspace.id),
            "platform": platform,
            "code_verifier": code_verifier,
        }

        redirect_uri = _build_redirect_uri(request, platform)
        auth_url = provider.get_auth_url(redirect_uri, state, **pkce_kwargs(code_verifier))
        return {"configured": True, "auth_url": auth_url}
    except Exception:
        logger.exception("Gagal membuat URL OAuth untuk platform %s", platform)
        return {
            "configured": False,
            "message": "Koneksi OAuth gagal disiapkan. Periksa konfigurasi provider dan coba lagi.",
        }


@router.delete("/dashboard/accounts/{account_id}", summary="Disconnect Social Account")
def disconnect_social_account(request: HttpRequest, account_id: uuid.UUID):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "manage_social_accounts")
    account = SocialAccount.objects.filter(id=account_id, workspace=workspace).first()
    if not account:
        raise HttpError(404, "Akun media sosial tidak ditemukan.")
    provider = None
    try:
        from apps.social_accounts.views import _get_provider_for_platform

        provider = _get_provider_for_platform(account.platform, workspace.organization_id)
    except Exception:
        logger.warning("Provider untuk pencabutan token akun %s tidak tersedia", account.id, exc_info=True)

    revocation_confirmed = disconnect_account_service(account, provider)
    message = (
        "Akun dilepas dan token berhasil dicabut dari platform."
        if revocation_confirmed
        else "Akun dilepas dari sistem, tetapi pencabutan token di platform belum terkonfirmasi. Cabut akses aplikasi dari pengaturan platform."
    )
    return {"success": True, "message": message, "revocation_confirmed": revocation_confirmed}
