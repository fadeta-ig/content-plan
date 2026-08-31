"""Media Library assets & folders management endpoints for Frontend API."""

from __future__ import annotations

import uuid

from django.core.exceptions import ValidationError
from django.http import HttpRequest
from ninja import File, Form, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile

from apps.media_library.models import MediaAsset, MediaFolder
from apps.media_library.services import ProtectedAssetError, create_asset, delete_asset
from apps.media_library.tasks import process_media_asset

from .helpers import frontend_auth, get_current_user_and_workspace, require_workspace_permission

router = Router(tags=["frontend-media"], auth=frontend_auth)


@router.get("/dashboard/media", summary="List Media Assets and Folders")
def list_media_assets(request: HttpRequest, folder_id: str | None = None):
    user, workspace = get_current_user_and_workspace(request)

    folders = MediaFolder.objects.filter(workspace=workspace)
    assets_qs = MediaAsset.objects.filter(workspace=workspace)
    if folder_id:
        try:
            parsed_folder_id = uuid.UUID(folder_id)
        except (TypeError, ValueError, AttributeError) as exc:
            raise HttpError(400, "ID folder media tidak valid.") from exc
        if not folders.filter(id=parsed_folder_id).exists():
            raise HttpError(404, "Folder media tidak ditemukan di workspace ini.")
        assets_qs = assets_qs.filter(folder_id=parsed_folder_id)

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
    folder_id: str | None = Form(None),
):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "upload_media")

    folder = None
    if folder_id:
        try:
            parsed_folder_id = uuid.UUID(folder_id)
        except (TypeError, ValueError, AttributeError) as exc:
            raise HttpError(400, "ID folder media tidak valid.") from exc
        folder = MediaFolder.objects.filter(id=parsed_folder_id, workspace=workspace).first()
        if folder is None:
            raise HttpError(404, "Folder media tidak ditemukan di workspace ini.")

    try:
        asset = create_asset(
            organization=workspace.organization,
            workspace=workspace,
            uploaded_file=file,
            uploaded_by=user,
            folder=folder,
        )
    except ValidationError as exc:
        messages = exc.messages if hasattr(exc, "messages") else [str(exc)]
        raise HttpError(422, " ".join(messages)) from exc

    process_media_asset(str(asset.id))

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


@router.delete("/dashboard/media/{asset_id}", summary="Delete Media Asset")
def delete_media_asset(request: HttpRequest, asset_id: uuid.UUID):
    user, workspace = get_current_user_and_workspace(request)
    require_workspace_permission(request, "delete_media")
    asset = MediaAsset.objects.filter(id=asset_id, workspace=workspace).first()
    if not asset:
        raise HttpError(404, "Berkas media tidak ditemukan.")
    try:
        delete_asset(asset)
    except ProtectedAssetError as exc:
        raise HttpError(
            409,
            "Berkas masih digunakan oleh postingan terjadwal/publishing dan belum dapat dihapus.",
        ) from exc
    return {"success": True, "message": "Berkas media berhasil dihapus."}
