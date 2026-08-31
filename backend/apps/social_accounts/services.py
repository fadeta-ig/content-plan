"""Application services for social-account lifecycle operations."""

from __future__ import annotations

import logging
from typing import Any

from .models import SocialAccount

logger = logging.getLogger(__name__)


def disconnect_social_account(account: SocialAccount, provider: Any | None = None) -> bool:
    """Revoke credentials when possible and preserve historical relations.

    Deleting a social account cascades into inbox messages, analytics, posting
    slots, and platform-post history. A disconnect is therefore represented as
    state plus cleared credentials, allowing a later OAuth reconnect to update
    the same row without destroying audit history.
    """

    revocation_confirmed = False
    access_token = account.oauth_access_token
    if provider is not None and access_token:
        try:
            revocation_confirmed = bool(provider.revoke_token(access_token))
        except Exception:
            logger.warning("Provider token revocation failed for social account %s", account.id, exc_info=True)

    account.oauth_access_token = ""
    account.oauth_refresh_token = ""
    account.token_expires_at = None
    account.connection_status = SocialAccount.ConnectionStatus.DISCONNECTED
    account.analytics_needs_reconnect = False
    account.last_error = "" if revocation_confirmed else "Token provider belum dapat dipastikan tercabut."
    account.save(
        update_fields=[
            "oauth_access_token",
            "oauth_refresh_token",
            "token_expires_at",
            "connection_status",
            "analytics_needs_reconnect",
            "last_error",
            "updated_at",
        ]
    )
    return revocation_confirmed
