"""Media Library assets & folders management endpoints for Frontend API."""

from __future__ import annotations

from typing import Optional
from django.http import HttpRequest
from ninja import File, Form, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile

from apps.media_library.models import MediaAsset, MediaFolder
from .helpers import frontend_auth, get_current_user_and_workspace


router = Router(tags=["frontend-media"], auth=frontend_auth)


@router.get("/dashboard/media", summary="List Media Assets and Folders")
def list_media_assets(request: HttpRequest, folder_id: Optional[str] = None):
    user, workspace = get_current_user_and_workspace(request)

    folders = MediaFolder.objects.filter(workspace=workspace)
    assets_qs = MediaAsset.objects.filter(workspace=workspace)
    if folder_id:
        assets_qs = assets_qs.filter(folder_id=folder_id)

    folders_data = [{"id": str(f.id), "name": f.name} for f in folders]
    assets_data = [
        {
            "id": str(a.id),
            "title": a.title or a.filename,
            "file_url": a.file.url if a.file else "",
            "thumbnail_url": a.thumbnail.url if a.thumbnail else (a.file.url if a.file else ""),
            "file_type": a.media_type,
            "file_size": a.file_size or 0,
            "width": a.width,
            "height": a.height,
            "created_at": a.created_at.strftime("%d %b %Y"),
        }
        for a in assets_qs.order_by("-created_at")[:100]
    ]

    return {"folders": folders_data, "assets": assets_data}


@router.post("/dashboard/media/upload", summary="Upload Local Media File")
def upload_media_asset(
    request: HttpRequest,
    file: UploadedFile = File(...),
    folder_id: Optional[str] = Form(None),
):
    user, workspace = get_current_user_and_workspace(request)

    media_type = "video" if file.content_type and "video" in file.content_type else "image"

    asset = MediaAsset.objects.create(
        organization=workspace.organization,
        workspace=workspace,
        uploaded_by=user,
        file=file,
        filename=file.name or "uploaded_media",
        media_type=media_type,
        file_size=file.size,
        mime_type=file.content_type or "application/octet-stream",
    )

    return {
        "success": True,
        "asset": {
            "id": str(asset.id),
            "title": asset.filename,
            "file_url": asset.file.url if asset.file else "",
            "thumbnail_url": asset.thumbnail.url if asset.thumbnail else (asset.file.url if asset.file else ""),
            "file_type": asset.media_type,
            "file_size": asset.file_size,
            "created_at": asset.created_at.strftime("%d %b %Y"),
        },
    }


import uuid


@router.delete("/dashboard/media/{asset_id}", summary="Delete Media Asset")
def delete_media_asset(request: HttpRequest, asset_id: str):
    user, workspace = get_current_user_and_workspace(request)
    try:
        a_uuid = uuid.UUID(str(asset_id))
    except (ValueError, TypeError):
        raise HttpError(400, "ID berkas media tidak valid.")

    asset = MediaAsset.objects.filter(id=a_uuid, workspace=workspace).first()
    if not asset:
        raise HttpError(404, "Berkas media tidak ditemukan.")
    if asset.file:
        asset.file.delete(save=False)
    if asset.thumbnail:
        asset.thumbnail.delete(save=False)
    asset.delete()
    return {"success": True, "message": "Berkas media berhasil dihapus."}
