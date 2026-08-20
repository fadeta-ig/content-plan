"""Frontend REST API router aggregator.

Imports and exposes the clean, modular router from ``apps.api.routers.frontend``.
"""

from apps.api.routers.frontend import router

__all__ = ["router"]
