"""Connected Social Accounts management endpoints for Frontend API."""

from __future__ import annotations

from typing import Optional
from django.http import HttpRequest
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.social_accounts.models import SocialAccount
from .helpers import frontend_auth, get_current_user_and_workspace


router = Router(tags=["frontend-accounts"], auth=frontend_auth)


class ManualAccountCreateSchema(Schema):
    platform: str
    account_name: Optional[str] = ""
    account_handle: Optional[str] = ""
    follower_count: Optional[int] = 0


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
    user, workspace = get_current_user_and_workspace(request)

    handle = payload.account_handle.strip() if payload.account_handle else f"@wijaya.{payload.platform}"
    name = payload.account_name.strip() if payload.account_name else f"PT Wijaya Inovasi Gemilang ({payload.platform.title()})"
    followers = payload.follower_count if payload.follower_count and payload.follower_count >= 0 else 0

    account, created = SocialAccount.objects.get_or_create(
        workspace=workspace,
        platform=payload.platform,
        account_platform_id=handle,
        defaults={
            "account_name": name,
            "account_handle": handle,
            "connection_status": SocialAccount.ConnectionStatus.CONNECTED,
            "follower_count": followers,
        },
    )
    if not created:
        account.connection_status = SocialAccount.ConnectionStatus.CONNECTED
        account.account_name = name
        account.account_handle = handle
        if followers > 0:
            account.follower_count = followers
        account.save(update_fields=["connection_status", "account_name", "account_handle", "follower_count"])

    return {
        "success": True,
        "account": {
            "id": str(account.id),
            "platform": account.platform,
            "account_name": account.account_name,
            "account_handle": account.account_handle,
            "avatar_url": account.avatar_url,
            "follower_count": account.follower_count,
            "connection_status": account.connection_status,
            "is_token_expiring_soon": account.is_token_expiring_soon,
            "connected_at": account.connected_at.strftime("%d %b %Y"),
        },
    }


@router.get("/dashboard/accounts/oauth-init", summary="Check and Initialize OAuth URL")
def init_oauth(request: HttpRequest, platform: str):
    user, workspace = get_current_user_and_workspace(request)
    org_id = workspace.organization_id if workspace.organization else None

    from apps.social_accounts.views import (
        _get_configured_platforms,
        _get_visible_platform_choices,
        _get_provider_for_platform,
        _apply_analytics_scope_flag,
        _sign_state,
        issue_pkce_verifier,
        pkce_kwargs,
        _build_redirect_uri,
        OAUTH_SESSION_KEY,
    )
    import secrets

    configured_platforms = _get_configured_platforms(org_id) if org_id else set()
    visible_platform_choices = dict(_get_visible_platform_choices())

    if platform not in visible_platform_choices:
        return {"configured": False, "message": f"Platform {platform} tidak didukung."}

    if platform not in configured_platforms:
        return {
            "configured": False,
            "message": f"Kredensial OAuth Developer (App ID / Secret) untuk {visible_platform_choices.get(platform, platform)} belum diset di file .env backend. Anda dapat langsung menggunakan mode Tambah Akun Manual di modal.",
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
    except Exception as e:
        return {"configured": False, "message": str(e)}


@router.delete("/dashboard/accounts/{account_id}", summary="Disconnect Social Account")
def disconnect_social_account(request: HttpRequest, account_id: str):
    user, workspace = get_current_user_and_workspace(request)
    account = SocialAccount.objects.filter(id=account_id, workspace=workspace).first()
    if not account:
        raise HttpError(404, "Akun media sosial tidak ditemukan.")
    account.delete()
    return {"success": True, "message": "Akun media sosial berhasil dilepas."}

