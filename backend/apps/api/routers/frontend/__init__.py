"""Modular Frontend API Router aggregator.

Unites domain routers for PT Wijaya Inovasi Gemilang (Content Plan Studio).
Mounted at `/api/v1/frontend/` in `apps.api.api`.
"""

from __future__ import annotations

from ninja import Router

from .helpers import frontend_auth
from .auth import router as auth_router
from .overview import router as overview_router
from .posts import router as posts_router
from .calendar import router as calendar_router
from .kanban import router as kanban_router
from .accounts import router as accounts_router
from .inbox import router as inbox_router
from .analytics import router as analytics_router
from .media import router as media_router
from .members import router as members_router
from .settings import router as settings_router
from .notifications import router as notifications_router

# Main router for frontend
router = Router(tags=["frontend"], auth=frontend_auth)

# Add all domain sub-routers
router.add_router("/auth", auth_router)
router.add_router("/", overview_router)
router.add_router("/", posts_router)
router.add_router("/", calendar_router)
router.add_router("/", kanban_router)
router.add_router("/", accounts_router)
router.add_router("/", inbox_router)
router.add_router("/", analytics_router)
router.add_router("/", media_router)
router.add_router("/", members_router)
router.add_router("/", settings_router)
router.add_router("/", notifications_router)

__all__ = ["router"]
