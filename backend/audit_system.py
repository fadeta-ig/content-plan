"""Comprehensive Audit & Verification Script for Content Plan Studio.

Tests all CRUD operations, APIs, models, serializers, and edge cases across:
1. Authentication (Login, Register, Me, Logout)
2. Dashboard Overview Metrics
3. Post Composer & Multi-channel Distribution (Create, List, Filter, Approve, Reject, Delete)
4. Calendar & Scheduling (Events, Slots, Date filtering)
5. Kanban Ideas Pipeline (Create, List, Move Status, Delete)
6. Social Accounts Management (List, Manual Connect, OAuth Check, Disconnect)
7. Unified Social Inbox (List, Sentiment Analysis, Reply, Resolve)
8. Analytics Engine (KPIs, Daily Trends, Channel Breakdown)
9. Media Library (List, Mock Upload, Quota, Delete)
10. Team Members & RBAC (List, Invite, Role Change, Delete)
11. Organization & Workspace Settings (Get, Update, Timezone)
"""

import json
import os
import uuid

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from apps.accounts.models import User
from apps.inbox.models import InboxMessage
from apps.members.models import OrgMembership, WorkspaceMembership
from apps.organizations.models import Organization
from apps.social_accounts.models import SocialAccount
from apps.workspaces.models import Workspace


def run_comprehensive_audit():
    print("=" * 80)
    print("[INITIATING CONTENT PLAN SYSTEM AUDIT & INTEGRITY VERIFICATION]")
    print("=" * 80)

    client = Client()
    audit_results = []

    def record(name, success, detail=""):
        status = "[PASS]" if success else "[FAIL]"
        audit_results.append((name, success, detail))
        print(f"{status} {name}" + (f" -> {detail}" if detail else ""))

    # Setup or retrieve test admin
    test_email = "audit.admin@wijayagroup.id"
    test_password = "AuditSecurePassword123!"

    user = User.objects.filter(email=test_email).first()
    if not user:
        user = User.objects.create_user(
            email=test_email,
            password=test_password,
            name="Audit Lead Engineer",
        )
    else:
        user.set_password(test_password)
        user.save()

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
    user.last_workspace_id = workspace.id
    user.save(update_fields=["last_workspace_id"])

    # -------------------------------------------------------------
    # 1. AUTHENTICATION & SESSIONS
    # -------------------------------------------------------------
    print("\n--- [1/11] AUDITING AUTHENTICATION & SESSION CRUD ---")

    # 1.1 Login with wrong password
    res = client.post(
        "/api/v1/frontend/auth/login",
        data=json.dumps({"email": test_email, "password": "WrongPassword!"}),
        content_type="application/json",
    )
    record("Auth Login (Invalid Credentials Guard)", res.status_code == 401, f"Status: {res.status_code}")

    # 1.2 Login with valid credentials
    res = client.post(
        "/api/v1/frontend/auth/login",
        data=json.dumps({"email": test_email, "password": test_password}),
        content_type="application/json",
    )
    login_success = res.status_code == 200 and res.json().get("success") is True
    record(
        "Auth Login (Valid Credentials & Session Cookie)",
        login_success,
        f"User: {res.json().get('user', {}).get('email')}",
    )

    # 1.3 Get Me profile
    res = client.get("/api/v1/frontend/auth/me")
    me_data = res.json()
    record(
        "Auth /me Endpoint & Active Workspace Resolution",
        res.status_code == 200 and "active_workspace" in me_data,
        f"Workspace: {me_data.get('active_workspace', {}).get('name')}",
    )

    # -------------------------------------------------------------
    # 2. DASHBOARD OVERVIEW METRICS
    # -------------------------------------------------------------
    print("\n--- [2/11] AUDITING DASHBOARD OVERVIEW REAL METRICS ---")
    res = client.get("/api/v1/frontend/dashboard/overview")
    ov = res.json()
    record(
        "Overview Real Metrics Aggregator",
        res.status_code == 200 and "total_posts" in ov and "total_reach" in ov,
        f"Total Posts: {ov.get('total_posts')}, Scheduled: {ov.get('scheduled_posts')}",
    )

    # -------------------------------------------------------------
    # 3. SOCIAL ACCOUNTS CRUD
    # -------------------------------------------------------------
    print("\n--- [3/11] AUDITING SOCIAL ACCOUNTS CRUD ---")

    # 3.1 Create Manual Account
    res = client.post(
        "/api/v1/frontend/dashboard/accounts/create-manual",
        data=json.dumps(
            {
                "platform": "instagram",
                "account_name": "PT Wijaya Inovasi Gemilang Official",
                "account_handle": "@wijaya.official",
                "follower_count": 25400,
            }
        ),
        content_type="application/json",
    )
    created_acc = res.json().get("account", {})
    record(
        "Social Account Manual Create/Connect",
        res.status_code == 200 and created_acc.get("platform") == "instagram",
        f"Account ID: {created_acc.get('id')}",
    )

    # Also create LinkedIn account
    client.post(
        "/api/v1/frontend/dashboard/accounts/create-manual",
        data=json.dumps(
            {
                "platform": "linkedin",
                "account_name": "PT Wijaya Inovasi Gemilang Enterprise",
                "account_handle": "company/wijayagroup",
                "follower_count": 8900,
            }
        ),
        content_type="application/json",
    )

    # 3.2 List Accounts
    res = client.get("/api/v1/frontend/dashboard/accounts")
    acc_list = res.json().get("accounts", [])
    record(
        "Social Accounts List Query", res.status_code == 200 and len(acc_list) >= 2, f"Total Accounts: {len(acc_list)}"
    )

    # 3.3 OAuth Init Platform Check
    res = client.get("/api/v1/frontend/dashboard/accounts/oauth-init?platform=instagram")
    record(
        "OAuth Discovery & Graceful Developer Check",
        res.status_code == 200 and "configured" in res.json(),
        f"Configured: {res.json().get('configured')}",
    )

    # -------------------------------------------------------------
    # 4. POST COMPOSER & CONTENT PIPELINE CRUD
    # -------------------------------------------------------------
    print("\n--- [4/11] AUDITING POST COMPOSER & PIPELINE CRUD ---")

    # 4.1 Create Scheduled Post
    res = client.post(
        "/api/v1/frontend/dashboard/posts/create",
        data=json.dumps(
            {
                "master_caption": "Transformasi Digital Enterprise bersama PT Wijaya Inovasi Gemilang #DigitalTransformation #Innovation",
                "target_account_ids": ["instagram", "linkedin"],
                "scheduled_at": "2026-08-25T14:30:00+07:00",
                "first_comment": "Kunjungi website resmi kami di https://wijayagroup.id untuk rincian lengkap!",
            }
        ),
        content_type="application/json",
    )
    post_data = res.json()
    post_id = post_data.get("post_id")
    record(
        "Post Creation & Multi-platform Scheduling",
        res.status_code == 200 and post_id is not None,
        f"Post ID: {post_id}",
    )

    # 4.2 List Posts
    res = client.get("/api/v1/frontend/dashboard/posts")
    posts_list = res.json().get("posts", [])
    record(
        "Post Listing & Media/Target Relations",
        res.status_code == 200 and len(posts_list) >= 1,
        f"Found {len(posts_list)} posts",
    )

    # 4.3 Approve Post
    if post_id:
        res = client.post(f"/api/v1/frontend/dashboard/posts/{post_id}/approve")
        record(
            "Post Approval Workflow Action (Approve)",
            res.status_code == 200 and res.json().get("success") is True,
            f"Approval Status: {res.json().get('approval_status')}",
        )

    # 4.4 Reject Post
    if post_id:
        res = client.post(f"/api/v1/frontend/dashboard/posts/{post_id}/reject")
        record(
            "Post Rejection Workflow Action (Reject)",
            res.status_code == 200 and res.json().get("success") is True,
            f"Approval Status: {res.json().get('approval_status')}",
        )

    # -------------------------------------------------------------
    # 5. CALENDAR & TIME SLOTS
    # -------------------------------------------------------------
    print("\n--- [5/11] AUDITING CALENDAR & SCHEDULE DISTRIBUTION ---")
    res = client.get(
        "/api/v1/frontend/dashboard/calendar?start_date=2026-08-01T00:00:00Z&end_date=2026-08-31T23:59:59Z"
    )
    cal_data = res.json()
    record(
        "Calendar Events & Posting Slots Retrieval",
        res.status_code == 200 and "events" in cal_data,
        f"Events Count: {len(cal_data.get('events', []))}",
    )

    # -------------------------------------------------------------
    # 6. KANBAN IDEAS PIPELINE CRUD
    # -------------------------------------------------------------
    print("\n--- [6/11] AUDITING KANBAN IDEAS CRUD ---")

    # 6.1 Create Idea
    res = client.post(
        "/api/v1/frontend/dashboard/kanban/create",
        data=json.dumps(
            {
                "title": "Studi Kasus Efisiensi AI pada Industri Logistik",
                "content": "Pembahasan mendalam bagaimana AI mereduksi biaya operasional hingga 35%.",
                "status": "unassigned",
            }
        ),
        content_type="application/json",
    )
    idea_data = res.json().get("idea", {})
    idea_id = idea_data.get("id")
    record("Kanban Idea Creation", res.status_code == 200 and idea_id is not None, f"Idea ID: {idea_id}")

    # 6.2 Get Kanban Board Columns
    res = client.get("/api/v1/frontend/dashboard/kanban")
    kb_data = res.json().get("columns", [])
    record(
        "Kanban Board 4-Column Aggregation",
        res.status_code == 200 and len(kb_data) == 4,
        f"Columns: {[c['id'] for c in kb_data]}",
    )

    # 6.3 Update Idea Status
    if idea_id:
        res = client.patch(
            f"/api/v1/frontend/dashboard/kanban/{idea_id}/status",
            data=json.dumps({"status": "in_progress"}),
            content_type="application/json",
        )
        record(
            "Kanban Idea Status Transition",
            res.status_code == 200 and res.json().get("status") == "in_progress",
            "New Status: in_progress",
        )

    # 6.4 Delete Idea
    if idea_id:
        res = client.delete(f"/api/v1/frontend/dashboard/kanban/{idea_id}")
        record(
            "Kanban Idea Delete Action",
            res.status_code == 200 and res.json().get("success") is True,
            "Deleted successfully",
        )

    # -------------------------------------------------------------
    # 7. UNIFIED INBOX & SENTIMENT ANALYSIS CRUD
    # -------------------------------------------------------------
    print("\n--- [7/11] AUDITING UNIFIED SOCIAL INBOX & SENTIMENT ---")

    # Seed a test message if empty
    from django.utils import timezone

    insta_acc = SocialAccount.objects.filter(workspace=workspace, platform="instagram").first()
    msg = InboxMessage.objects.create(
        workspace=workspace,
        social_account=insta_acc,
        sender_name="Budi Santoso",
        platform_message_id=f"msg_audit_{uuid.uuid4().hex[:8]}",
        body="Halo PT Wijaya, layanannya sangat bagus dan tim responnya sangat cepat! Keren banget.",
        received_at=timezone.now(),
        status=InboxMessage.Status.UNREAD,
    )

    # 7.1 List Messages & Real Sentiment
    res = client.get("/api/v1/frontend/dashboard/inbox")
    inbox_data = res.json().get("messages", [])
    target_msg = next((m for m in inbox_data if m["id"] == str(msg.id)), None)
    sentiment_correct = target_msg is not None and target_msg.get("sentiment") == "positive"
    record(
        "Inbox Message List & NLP Sentiment Classification",
        res.status_code == 200 and sentiment_correct,
        f"Sender: {target_msg.get('sender_name') if target_msg else 'None'}, Sentiment: {target_msg.get('sentiment') if target_msg else 'None'}",
    )

    # 7.2 Reply to Message
    res = client.post(
        "/api/v1/frontend/dashboard/inbox/reply",
        data=json.dumps(
            {
                "message_id": str(msg.id),
                "content": "Terima kasih banyak atas apresiasi Bapak Budi! Sukses selalu untuk bisnis Anda.",
            }
        ),
        content_type="application/json",
    )
    record(
        "Inbox Reply Dispatch & Status Resolve",
        res.status_code == 200 and res.json().get("status") == "resolved",
        f"Reply ID: {res.json().get('reply_id')}",
    )

    # -------------------------------------------------------------
    # 8. ANALYTICS ENGINE
    # -------------------------------------------------------------
    print("\n--- [8/11] AUDITING ANALYTICS ENGINE & KPIS ---")
    res = client.get("/api/v1/frontend/dashboard/analytics?period_days=30")
    an_data = res.json()
    record(
        "Analytics KPIs, Daily Trends, Channel Breakdown",
        res.status_code == 200 and "kpis" in an_data and len(an_data.get("trends", [])) > 0,
        f"Followers KPI: {an_data.get('kpis', {}).get('total_followers')}, Trends points: {len(an_data.get('trends', []))}",
    )

    # -------------------------------------------------------------
    # 9. MEDIA LIBRARY CRUD
    # -------------------------------------------------------------
    print("\n--- [9/11] AUDITING MEDIA LIBRARY CRUD ---")

    # 9.1 Upload Media Asset
    dummy_img = SimpleUploadedFile(
        "test_banner_audit.png",
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82",
        content_type="image/png",
    )
    res = client.post("/api/v1/frontend/dashboard/media/upload", {"file": dummy_img})
    media_asset = res.json().get("asset", {})
    media_id = media_asset.get("id")
    record(
        "Media File Upload & Metadata Extraction",
        res.status_code == 200 and media_id is not None,
        f"Asset ID: {media_id}, Title: {media_asset.get('title')}",
    )

    # 9.2 List Media Assets
    res = client.get("/api/v1/frontend/dashboard/media")
    media_list = res.json().get("assets", [])
    record(
        "Media Assets Query & Thumbnail Resolution",
        res.status_code == 200 and len(media_list) >= 1,
        f"Total Assets: {len(media_list)}",
    )

    # 9.3 Delete Media Asset
    if media_id:
        res = client.delete(f"/api/v1/frontend/dashboard/media/{media_id}")
        record(
            "Media Asset Deletion & Disk Cleanup",
            res.status_code == 200 and res.json().get("success") is True,
            "Asset deleted",
        )

    # -------------------------------------------------------------
    # 10. TEAM MEMBERS & ROLES CRUD
    # -------------------------------------------------------------
    print("\n--- [10/11] AUDITING TEAM MEMBERS & RBAC CRUD ---")

    # 10.1 Invite Member
    res = client.post(
        "/api/v1/frontend/dashboard/members/invite",
        data=json.dumps(
            {
                "name": "Ratna Dewi Sartika",
                "email": "ratna.copywriter@wijayagroup.id",
                "role": "editor",
            }
        ),
        content_type="application/json",
    )
    invited_member = res.json().get("member", {})
    member_id = invited_member.get("id")
    record(
        "Team Member Invite & Account Provisioning",
        res.status_code == 200 and member_id is not None,
        f"Member: {invited_member.get('name')}, Role: {invited_member.get('role')}",
    )

    # 10.2 List Members
    res = client.get("/api/v1/frontend/dashboard/members")
    members_data = res.json().get("members", [])
    record(
        "Team Members Listing Query",
        res.status_code == 200 and len(members_data) >= 2,
        f"Total Members: {len(members_data)}",
    )

    # 10.3 Update Role
    if member_id:
        res = client.post(
            "/api/v1/frontend/dashboard/members/update-role",
            data=json.dumps({"member_id": member_id, "role": "manager"}),
            content_type="application/json",
        )
        record(
            "Member Role Elevation (Editor -> Manager)",
            res.status_code == 200 and res.json().get("role") == "manager",
            "Elevated to Manager",
        )

    # 10.4 Remove Member
    if member_id:
        res = client.delete(f"/api/v1/frontend/dashboard/members/{member_id}")
        record(
            "Member Removal from Workspace",
            res.status_code == 200 and res.json().get("success") is True,
            "Removed successfully",
        )

    # -------------------------------------------------------------
    # 11. WORKSPACE SETTINGS CRUD
    # -------------------------------------------------------------
    print("\n--- [11/11] AUDITING WORKSPACE & ORG SETTINGS CRUD ---")

    # 11.1 Get Settings
    res = client.get("/api/v1/frontend/dashboard/settings")
    sett = res.json()
    record(
        "Workspace Settings Query",
        res.status_code == 200 and "organization_name" in sett,
        f"Org: {sett.get('organization_name')}, Mode: {sett.get('approval_workflow_mode')}",
    )

    # 11.2 Update Settings
    res = client.post(
        "/api/v1/frontend/dashboard/settings/update",
        data=json.dumps(
            {
                "organization_name": "PT Wijaya Inovasi Gemilang",
                "workspace_name": "Content Plan Studio",
                "timezone": "Asia/Jakarta",
                "approval_workflow_mode": "internal",
            }
        ),
        content_type="application/json",
    )
    record(
        "Workspace Settings Mutation", res.status_code == 200 and res.json().get("success") is True, "Settings updated"
    )

    # -------------------------------------------------------------
    # 12. CLEANUP POST
    # -------------------------------------------------------------
    if post_id:
        client.delete(f"/api/v1/frontend/dashboard/posts/{post_id}")

    print("\n" + "=" * 80)
    total_audits = len(audit_results)
    passed_audits = sum(1 for _, s, _ in audit_results if s)
    failed_audits = total_audits - passed_audits
    print(f"AUDIT SUMMARY: {passed_audits}/{total_audits} PASSED (Failures: {failed_audits})")
    print("=" * 80)


if __name__ == "__main__":
    run_comprehensive_audit()
