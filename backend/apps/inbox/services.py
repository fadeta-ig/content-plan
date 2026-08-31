"""Application services for reliable social-inbox replies."""

from __future__ import annotations

from apps.publisher.engine import _resolve_publish_credentials
from providers import get_provider

from .models import InboxMessage


class InboxReplyDeliveryError(Exception):
    """Raised when a provider does not confirm delivery of an inbox reply."""


def send_platform_reply(message: InboxMessage, body: str) -> str:
    """Send a reply and return the provider's durable message identifier.

    Nothing is persisted locally until the provider confirms delivery. This
    prevents a failed network call from being represented as a sent reply.
    """

    account = message.social_account
    if account is None:
        raise InboxReplyDeliveryError("Pesan tidak terhubung ke akun media sosial.")
    if not message.platform_message_id:
        raise InboxReplyDeliveryError("ID pesan dari platform tidak tersedia.")
    if not account.oauth_access_token:
        raise InboxReplyDeliveryError("Token akun tidak tersedia. Otorisasi ulang akun terlebih dahulu.")

    provider = get_provider(account.platform, _resolve_publish_credentials(account))
    result = provider.reply_to_message(
        access_token=account.oauth_access_token,
        message_id=message.platform_message_id,
        text=body,
        extra=message.extra,
    )
    platform_reply_id = str(result.platform_message_id or "").strip()
    if not platform_reply_id:
        raise InboxReplyDeliveryError("Platform tidak memberikan konfirmasi ID balasan.")
    return platform_reply_id
