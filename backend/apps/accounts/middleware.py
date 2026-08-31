import hashlib

from django.core.cache import cache
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.urls import reverse

# Paths that are rate-limited for unauthenticated POST requests (auth flows)
AUTH_RATE_LIMITED_PATHS = (
    "/accounts/login/",
    "/accounts/signup/",
    "/accounts/password/reset/",
    "/accounts/password/reset/key/",
    "/api/v1/frontend/auth/login",
)

# Sensitive mutation endpoints (legacy exact list plus all dashboard writes).
MUTATION_RATE_LIMITED_PATHS = (
    "/api/v1/frontend/dashboard/media/upload",
    "/api/v1/frontend/dashboard/posts/create",
)
MUTATION_RATE_LIMITED_PREFIXES = (
    "/api/v1/frontend/dashboard/",
    "/api/v1/frontend/auth/switch-workspace",
)

# Rate limit settings
AUTH_RATE_LIMIT = 15  # 15 requests per minute for login/register attempts per IP
MUTATION_RATE_LIMIT = 120  # 120 mutations per minute per user/IP session
RATE_WINDOW = 60  # 60 seconds

EXEMPT_PATH_PREFIXES = (
    "/accounts/accept-terms/",
    "/accounts/logout/",
    "/accounts/google/",
    "/accounts/3rdparty/",
    "/health/",
    "/static/",
    "/admin/",
)


class TosAcceptanceMiddleware:
    """Redirect authenticated users to the ToS acceptance page if they haven't accepted yet."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            hasattr(request, "user")
            and request.user.is_authenticated
            and request.user.tos_accepted_at is None
            and not request.path.startswith(EXEMPT_PATH_PREFIXES)
            and not request.path.startswith("/api/")
        ):
            return redirect(reverse("accounts:accept_terms"))

        return self.get_response(request)


class AuthRateLimitMiddleware:
    """Rate-limit POST requests to authentication & sensitive endpoints."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            ip = self._get_client_ip(request)

            # Check Auth endpoints rate limit
            if any(request.path.startswith(p) for p in AUTH_RATE_LIMITED_PATHS):
                cache_key = f"auth_ratelimit:{hashlib.sha256(ip.encode()).hexdigest()}"
                if self._increment_and_check(cache_key, AUTH_RATE_LIMIT):
                    if request.path.startswith("/api/"):
                        return JsonResponse(
                            {"detail": "Terlalu banyak percobaan autentikasi. Silakan tunggu 1 menit."},
                            status=429,
                        )
                    return HttpResponse("Too many authentication attempts. Please try again later.", status=429)
            # Check Mutation endpoints rate limit
            elif any(request.path.startswith(p) for p in MUTATION_RATE_LIMITED_PATHS + MUTATION_RATE_LIMITED_PREFIXES):
                user_scope = str(request.user.pk) if request.user.is_authenticated else ip
                cache_key = f"mutation_ratelimit:{hashlib.sha256(user_scope.encode()).hexdigest()}"
                if self._increment_and_check(cache_key, MUTATION_RATE_LIMIT):
                    return JsonResponse(
                        {"detail": "Batas frekuensi pembuatan data tercapai. Silakan coba sesaat lagi."},
                        status=429,
                    )

        return self.get_response(request)

    @staticmethod
    def _get_client_ip(request):
        from apps.api.limits import _client_ip

        return _client_ip(request) or "unknown"

    @staticmethod
    def _increment_and_check(cache_key, limit):
        """Atomically increment a fixed-window counter and report overflow."""
        if cache.add(cache_key, 1, RATE_WINDOW):
            return False
        try:
            attempts = cache.incr(cache_key)
        except ValueError:
            cache.set(cache_key, 1, RATE_WINDOW)
            attempts = 1
        return attempts > limit
