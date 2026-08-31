import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")
django.setup()

from datetime import timedelta

from django.utils import timezone

from apps.accounts.models import User
from apps.composer.models import Idea, PlatformPost, Post
from apps.members.models import OrgMembership, WorkspaceMembership
from apps.organizations.models import Organization
from apps.social_accounts.models import SocialAccount
from apps.workspaces.models import Workspace

# 1. Create or get Admin Superuser
email = "admin@wijayagroup.id"
user, created = User.objects.get_or_create(
    email=email,
    defaults={
        "name": "Admin PT Wijaya Inovasi Gemilang",
        "is_staff": True,
        "is_superuser": True,
        "tos_accepted_at": timezone.now(),
    },
)
user.name = "Admin PT Wijaya Inovasi Gemilang"
user.is_staff = True
user.is_superuser = True
admin_password = os.environ.get("ADMIN_DEFAULT_PASSWORD", "Wijaya2026!")
user.set_password(admin_password)
user.save()

# 2. Create Organization & Workspace
org, _ = Organization.objects.get_or_create(
    name="PT Wijaya Inovasi Gemilang", defaults={"default_timezone": "Asia/Jakarta"}
)

OrgMembership.objects.get_or_create(user=user, organization=org, defaults={"org_role": OrgMembership.OrgRole.OWNER})

workspace, _ = Workspace.objects.get_or_create(
    organization=org, name="Content Plan Studio", defaults={"timezone": "Asia/Jakarta", "primary_color": "#0284c7"}
)

WorkspaceMembership.objects.get_or_create(
    user=user, workspace=workspace, defaults={"workspace_role": WorkspaceMembership.WorkspaceRole.OWNER}
)

user.last_workspace_id = workspace.id
user.save(update_fields=["last_workspace_id"])

# 3. Seed Connected Social Accounts
ig, _ = SocialAccount.objects.get_or_create(
    workspace=workspace,
    platform="instagram",
    defaults={
        "account_name": "PT Wijaya Inovasi Gemilang",
        "account_handle": "@wijayagroup",
        "follower_count": 12450,
        "connection_status": "connected",
    },
)

li, _ = SocialAccount.objects.get_or_create(
    workspace=workspace,
    platform="linkedin",
    defaults={
        "account_name": "PT Wijaya Inovasi Gemilang",
        "account_handle": "wijaya-inovasi-gemilang",
        "follower_count": 4120,
        "connection_status": "connected",
    },
)

fb, _ = SocialAccount.objects.get_or_create(
    workspace=workspace,
    platform="facebook",
    defaults={
        "account_name": "Wijaya Inovasi Official",
        "account_handle": "wijaya.official",
        "follower_count": 8300,
        "connection_status": "connected",
    },
)

# 4. Seed a Sample Post
post, _ = Post.objects.get_or_create(
    workspace=workspace,
    caption="Transformasi Digital & Inovasi Masa Depan bersama PT Wijaya Inovasi Gemilang. #Inovasi #Teknologi #WijayaGroup",
    defaults={
        "author": user,
        "first_comment": "Kunjungi website resmi kami di https://wijayagroup.id untuk informasi lebih lanjut.",
        "scheduled_at": timezone.now() + timedelta(days=1),
    },
)

PlatformPost.objects.get_or_create(post=post, social_account=ig, defaults={"status": PlatformPost.Status.SCHEDULED})
PlatformPost.objects.get_or_create(post=post, social_account=li, defaults={"status": PlatformPost.Status.SCHEDULED})

# 5. Seed Kanban Ideas
Idea.objects.get_or_create(
    workspace=workspace,
    title="Video Showcase Produk Terbaru Q3 2026",
    defaults={
        "author": user,
        "status": Idea.Status.TODO,
        "description": "Rencana konten reels dan TikTok untuk peluncuran fitur baru.",
    },
)
Idea.objects.get_or_create(
    workspace=workspace,
    title="Infografis Tips Efisiensi Operasional",
    defaults={"author": user, "status": Idea.Status.IN_PROGRESS, "description": "Draft infografis carousel 5 slide."},
)

print("Seed completed successfully!")
