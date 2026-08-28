import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.accounts.models import User
from apps.organizations.models import Organization
from apps.workspaces.models import Workspace
from apps.members.models import OrgMembership, WorkspaceMembership, Invitation
from apps.social_accounts.models import SocialAccount
from apps.composer.models import Post, PlatformPost, Idea, PostMedia
from apps.inbox.models import InboxMessage, InboxReply
from apps.media_library.models import MediaAsset, MediaFolder
from django.utils import timezone

print("Cleaning database for production deployment...")

# 1. Clean dummy social accounts, posts, ideas, messages
PlatformPost.objects.all().delete()
PostMedia.objects.all().delete()
Post.objects.all().delete()
Idea.objects.all().delete()
SocialAccount.objects.all().delete()
InboxReply.objects.all().delete()
InboxMessage.objects.all().delete()
Invitation.objects.all().delete()

# 2. Clean dummy users, keeping only admin@wijayagroup.id
admin_email = "admin@wijayagroup.id"
User.objects.exclude(email=admin_email).delete()

# 3. Ensure official Admin exists
user, created = User.objects.get_or_create(email=admin_email, defaults={
    "name": "Admin PT Wijaya Inovasi Gemilang",
    "is_staff": True,
    "is_superuser": True,
    "tos_accepted_at": timezone.now(),
})
user.name = "Admin PT Wijaya Inovasi Gemilang"
user.is_staff = True
user.is_superuser = True
admin_password = os.environ.get("ADMIN_DEFAULT_PASSWORD", "Wijaya2026!")
user.set_password(admin_password)
user.save()

# 4. Ensure official Organization & Workspace exist
org, _ = Organization.objects.get_or_create(name="PT Wijaya Inovasi Gemilang", defaults={
    "default_timezone": "Asia/Jakarta"
})

# Ensure only admin is org member
OrgMembership.objects.exclude(user=user).delete()
OrgMembership.objects.get_or_create(user=user, organization=org, defaults={
    "org_role": OrgMembership.OrgRole.OWNER
})

workspace, _ = Workspace.objects.get_or_create(organization=org, name="Content Plan Studio", defaults={
    "timezone": "Asia/Jakarta",
    "primary_color": "#0f172a"
})

# Ensure only admin is workspace member
WorkspaceMembership.objects.exclude(user=user).delete()
WorkspaceMembership.objects.get_or_create(user=user, workspace=workspace, defaults={
    "workspace_role": WorkspaceMembership.WorkspaceRole.OWNER
})

user.last_workspace_id = workspace.id
user.save(update_fields=["last_workspace_id"])

print(f"[OK] Database cleaned!")
print(f"Users in DB: {User.objects.count()} ({user.email})")
print(f"Organization: {org.name}")
print(f"Workspace: {workspace.name}")
print(f"Social Accounts in DB: {SocialAccount.objects.count()}")
print(f"Posts in DB: {Post.objects.count()}")
print(f"Ideas in DB: {Idea.objects.count()}")
print(f"Inbox Messages in DB: {InboxMessage.objects.count()}")
