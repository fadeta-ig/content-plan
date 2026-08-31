"""Regression tests for the cookie-authenticated frontend API boundary."""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.test import Client
from django.utils import timezone

from apps.accounts.models import User
from apps.inbox.models import InboxMessage, InboxReply
from apps.members.models import OrgMembership, WorkspaceMembership
from apps.notifications.models import EventType, Notification
from apps.organizations.models import Organization
from apps.social_accounts.models import SocialAccount
from apps.workspaces.models import Workspace

pytestmark = pytest.mark.django_db

API_ROOT = "/api/v1/frontend"


@pytest.fixture(autouse=True)
def _clear_frontend_throttles():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def tenant():
    organization = Organization.objects.create(name="Secure Tenant", default_timezone="Asia/Jakarta")
    workspace = Workspace.objects.create(organization=organization, name="Primary Workspace")
    foreign_organization = Organization.objects.create(name="Foreign Tenant")
    foreign_workspace = Workspace.objects.create(organization=foreign_organization, name="Foreign Workspace")
    return organization, workspace, foreign_workspace


def create_member(organization, workspace, *, email, role, password="Strong-Test-Passphrase-491!"):
    user = User.objects.create_user(
        email=email,
        password=password,
        name=email.split("@")[0],
        tos_accepted_at=timezone.now(),
    )
    OrgMembership.objects.update_or_create(
        organization=organization,
        user=user,
        defaults={
            "org_role": OrgMembership.OrgRole.OWNER
            if role == WorkspaceMembership.WorkspaceRole.OWNER
            else OrgMembership.OrgRole.MEMBER
        },
    )
    WorkspaceMembership.objects.update_or_create(
        workspace=workspace,
        user=user,
        defaults={"workspace_role": role},
    )
    user.last_workspace_id = workspace.id
    user.save(update_fields=["last_workspace_id"])
    return user


def csrf_token(client: Client) -> str:
    response = client.get(f"{API_ROOT}/auth/csrf")
    assert response.status_code == 200
    return response.json()["csrf_token"]


def json_request(client: Client, method: str, path: str, payload: dict, token: str):
    return getattr(client, method)(
        path,
        data=json.dumps(payload),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )


def test_frontend_analytics_accepts_ui_periods_and_returns_iso_dates(tenant):
    organization, workspace, _ = tenant
    owner = create_member(
        organization,
        workspace,
        email="analytics-ui-owner@example.com",
        role=WorkspaceMembership.WorkspaceRole.OWNER,
    )
    client = Client()
    client.force_login(owner)

    response = client.get(f"{API_ROOT}/dashboard/analytics?period_days=14")

    assert response.status_code == 200
    body = response.json()
    assert body["period_days"] == 14
    assert len(body["trends"]) == 14
    assert all(len(item["date"]) == 10 and item["date"].count("-") == 2 for item in body["trends"])


def test_frontend_analytics_rejects_unknown_period(tenant):
    organization, workspace, _ = tenant
    owner = create_member(
        organization,
        workspace,
        email="analytics-period-owner@example.com",
        role=WorkspaceMembership.WorkspaceRole.OWNER,
    )
    client = Client()
    client.force_login(owner)

    response = client.get(f"{API_ROOT}/dashboard/analytics?period_days=15")

    assert response.status_code == 422


def test_overview_summarizes_mixed_platform_failures(tenant):
    from apps.composer.models import PlatformPost, Post

    organization, workspace, _ = tenant
    owner = create_member(
        organization,
        workspace,
        email="overview-owner@example.com",
        role=WorkspaceMembership.WorkspaceRole.OWNER,
    )
    instagram = SocialAccount.objects.create(
        workspace=workspace,
        platform="instagram",
        account_platform_id="overview-ig",
        account_name="Overview Instagram",
        connection_status="connected",
    )
    facebook = SocialAccount.objects.create(
        workspace=workspace,
        platform="facebook",
        account_platform_id="overview-fb",
        account_name="Overview Facebook",
        connection_status="connected",
    )
    post = Post.objects.create(workspace=workspace, caption="Mixed platform result")
    PlatformPost.objects.create(post=post, social_account=instagram, status="published")
    PlatformPost.objects.create(post=post, social_account=facebook, status="failed")
    client = Client()
    client.force_login(owner)

    response = client.get(f"{API_ROOT}/dashboard/overview")

    assert response.status_code == 200
    assert response.json()["recent_posts"][0]["status"] == "failed"


def test_cookie_mutation_requires_csrf(tenant):
    organization, workspace, _ = tenant
    owner = create_member(
        organization,
        workspace,
        email="owner-csrf@example.com",
        role=WorkspaceMembership.WorkspaceRole.OWNER,
    )
    client = Client(enforce_csrf_checks=True)
    client.force_login(owner)

    response = client.post(f"{API_ROOT}/auth/logout")

    assert response.status_code == 403


def test_login_requires_csrf_and_accepts_valid_token(tenant):
    organization, workspace, _ = tenant
    password = "Strong-Login-Passphrase-829!"
    user = create_member(
        organization,
        workspace,
        email="login-user@example.com",
        role=WorkspaceMembership.WorkspaceRole.EDITOR,
        password=password,
    )
    client = Client(enforce_csrf_checks=True)
    payload = {"email": user.email, "password": password}

    rejected = client.post(
        f"{API_ROOT}/auth/login",
        data=json.dumps(payload),
        content_type="application/json",
    )
    token = csrf_token(client)
    accepted = json_request(client, "post", f"{API_ROOT}/auth/login", payload, token)

    assert rejected.status_code == 403
    assert accepted.status_code == 200
    assert accepted.json()["success"] is True


def test_workspace_header_cannot_cross_tenant_boundary(tenant):
    organization, workspace, foreign_workspace = tenant
    member = create_member(
        organization,
        workspace,
        email="tenant-member@example.com",
        role=WorkspaceMembership.WorkspaceRole.EDITOR,
    )
    client = Client()
    client.force_login(member)

    response = client.get(
        f"{API_ROOT}/dashboard/overview",
        HTTP_X_WORKSPACE_ID=str(foreign_workspace.id),
    )

    assert response.status_code == 403


def test_viewer_cannot_access_member_administration(tenant):
    organization, workspace, _ = tenant
    viewer = create_member(
        organization,
        workspace,
        email="viewer@example.com",
        role=WorkspaceMembership.WorkspaceRole.VIEWER,
    )
    client = Client()
    client.force_login(viewer)

    response = client.get(f"{API_ROOT}/dashboard/members")

    assert response.status_code == 403


def test_inviting_existing_user_never_changes_password(tenant):
    organization, workspace, _ = tenant
    owner = create_member(
        organization,
        workspace,
        email="owner-invite@example.com",
        role=WorkspaceMembership.WorkspaceRole.OWNER,
    )
    existing_password = "Existing-Safe-Passphrase-671!"
    existing = User.objects.create_user(
        email="existing@example.com",
        password=existing_password,
        tos_accepted_at=timezone.now(),
    )
    client = Client(enforce_csrf_checks=True)
    client.force_login(owner)
    token = csrf_token(client)

    response = json_request(
        client,
        "post",
        f"{API_ROOT}/dashboard/members/invite",
        {
            "name": "Existing User",
            "email": existing.email,
            "role": "editor",
            "password": "Attacker-Replacement-Passphrase-931!",
        },
        token,
    )
    existing.refresh_from_db()

    assert response.status_code == 409
    assert existing.check_password(existing_password)
    assert not WorkspaceMembership.objects.filter(workspace=workspace, user=existing).exists()


def test_invited_user_must_accept_terms_and_has_no_personal_tenant(tenant):
    organization, workspace, _ = tenant
    owner = create_member(
        organization,
        workspace,
        email="owner-new-invite@example.com",
        role=WorkspaceMembership.WorkspaceRole.OWNER,
    )
    client = Client(enforce_csrf_checks=True)
    client.force_login(owner)
    token = csrf_token(client)

    response = json_request(
        client,
        "post",
        f"{API_ROOT}/dashboard/members/invite",
        {
            "name": "Invited User",
            "email": "new-invite@example.com",
            "role": "editor",
            "password": "Invited-Safe-Passphrase-648!",
        },
        token,
    )

    invited = User.objects.get(email="new-invite@example.com")
    invited_client = Client()
    invited_client.force_login(invited)
    blocked = invited_client.get(f"{API_ROOT}/dashboard/overview")

    assert response.status_code == 200
    assert invited.tos_accepted_at is None
    assert list(OrgMembership.objects.filter(user=invited).values_list("organization_id", flat=True)) == [
        organization.id
    ]
    assert list(WorkspaceMembership.objects.filter(user=invited).values_list("workspace_id", flat=True)) == [
        workspace.id
    ]
    assert blocked.status_code == 403


def test_manual_social_account_cannot_fake_connected_state(tenant):
    organization, workspace, _ = tenant
    owner = create_member(
        organization,
        workspace,
        email="owner-oauth@example.com",
        role=WorkspaceMembership.WorkspaceRole.OWNER,
    )
    client = Client(enforce_csrf_checks=True)
    client.force_login(owner)
    token = csrf_token(client)

    response = json_request(
        client,
        "post",
        f"{API_ROOT}/dashboard/accounts/create-manual",
        {"platform": "instagram", "account_name": "Fake", "account_handle": "@fake"},
        token,
    )

    assert response.status_code == 409
    assert not SocialAccount.objects.filter(workspace=workspace).exists()


def test_disconnect_preserves_account_and_inbox_history(tenant):
    organization, workspace, _ = tenant
    owner = create_member(
        organization,
        workspace,
        email="owner-disconnect@example.com",
        role=WorkspaceMembership.WorkspaceRole.OWNER,
    )
    account = SocialAccount.objects.create(
        workspace=workspace,
        platform="facebook",
        account_platform_id="history-page",
        account_name="Historical Page",
        oauth_access_token="access-token",
        oauth_refresh_token="refresh-token",
    )
    message = InboxMessage.objects.create(
        workspace=workspace,
        social_account=account,
        platform_message_id="historical-message",
        sender_name="Customer",
        body="Keep this history",
        received_at=timezone.now(),
    )
    client = Client(enforce_csrf_checks=True)
    client.force_login(owner)
    token = csrf_token(client)

    with patch("apps.social_accounts.views._get_provider_for_platform") as provider_factory:
        provider_factory.return_value.revoke_token.return_value = True
        response = client.delete(
            f"{API_ROOT}/dashboard/accounts/{account.id}",
            HTTP_X_CSRFTOKEN=token,
        )

    account.refresh_from_db()
    assert response.status_code == 200
    assert response.json()["revocation_confirmed"] is True
    assert account.connection_status == SocialAccount.ConnectionStatus.DISCONNECTED
    assert account.oauth_access_token == ""
    assert account.oauth_refresh_token == ""
    assert InboxMessage.objects.filter(id=message.id, social_account=account).exists()


def test_reply_is_not_saved_when_platform_delivery_fails(tenant):
    organization, workspace, _ = tenant
    editor = create_member(
        organization,
        workspace,
        email="inbox-editor@example.com",
        role=WorkspaceMembership.WorkspaceRole.EDITOR,
    )
    account = SocialAccount.objects.create(
        workspace=workspace,
        platform="facebook",
        account_platform_id="page-123",
        account_name="Official Page",
        oauth_access_token="encrypted-by-model",
    )
    message = InboxMessage.objects.create(
        workspace=workspace,
        social_account=account,
        platform_message_id="message-123",
        sender_name="Customer",
        body="Need help",
        received_at=timezone.now(),
    )
    client = Client(enforce_csrf_checks=True)
    client.force_login(editor)
    token = csrf_token(client)

    with patch(
        "apps.api.routers.frontend.inbox.send_platform_reply",
        side_effect=ConnectionError("provider unavailable"),
    ):
        response = json_request(
            client,
            "post",
            f"{API_ROOT}/dashboard/inbox/reply",
            {"message_id": str(message.id), "content": "We can help."},
            token,
        )

    message.refresh_from_db()
    assert response.status_code == 502
    assert not InboxReply.objects.filter(inbox_message=message).exists()
    assert message.status == InboxMessage.Status.UNREAD


def test_notifications_are_user_and_workspace_scoped(tenant):
    organization, workspace, foreign_workspace = tenant
    user = create_member(
        organization,
        workspace,
        email="notifications@example.com",
        role=WorkspaceMembership.WorkspaceRole.EDITOR,
    )
    visible = Notification.objects.create(
        user=user,
        event_type=EventType.POST_FAILED,
        title="Visible",
        data={"workspace_id": str(workspace.id)},
    )
    hidden = Notification.objects.create(
        user=user,
        event_type=EventType.POST_FAILED,
        title="Hidden",
        data={"workspace_id": str(foreign_workspace.id)},
    )
    client = Client(enforce_csrf_checks=True)
    client.force_login(user)
    token = csrf_token(client)

    listing = client.get(f"{API_ROOT}/dashboard/notifications")
    mark_foreign = json_request(
        client,
        "post",
        f"{API_ROOT}/dashboard/notifications/mark-read",
        {"notification_ids": [str(hidden.id)]},
        token,
    )
    hidden.refresh_from_db()

    assert listing.status_code == 200
    assert [item["id"] for item in listing.json()["notifications"]] == [str(visible.id)]
    assert mark_foreign.status_code == 200
    assert mark_foreign.json()["marked_count"] == 0
    assert hidden.is_read is False


def test_public_owner_registration_route_is_not_exposed():
    client = Client(enforce_csrf_checks=True)
    token = csrf_token(client)
    response = json_request(
        client,
        "post",
        f"{API_ROOT}/auth/register",
        {"email": "attacker@example.com", "password": "Strong-Attacker-Passphrase-291!"},
        token,
    )

    assert response.status_code == 404
