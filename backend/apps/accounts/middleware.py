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
    "/api/v1/frontend/auth/register",
)

# Sensitive mutation endpoints (posts creation, uploads, etc.)
MUTATION_RATE_LIMITED_PATHS = (
    "/api/v1/frontend/dashboard/media/upload",
    "/api/v1/frontend/dashboard/posts/create",
)

# Rate limit settings
AUTH_RATE_LIMIT = 15       # 15 requests per minute for login/register attempts per IP
MUTATION_RATE_LIMIT = 60   # 60 mutations per minute per IP/session
RATE_WINDOW = 60           # 60 seconds

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
        if request.method == "POST":
            ip = self._get_client_ip(request)

            # Check Auth endpoints rate limit
            if any(request.path.startswith(p) for p in AUTH_RATE_LIMITED_PATHS):
                cache_key = f"auth_ratelimit:{hashlib.md5(ip.encode()).hexdigest()}"
                attempts = cache.get(cache_key, 0)
                if attempts >= AUTH_RATE_LIMIT:
                    if request.path.startswith("/api/"):
                        return JsonResponse(
                            {"detail": "Terlalu banyak percobaan autentikasi. Silakan tunggu 1 menit."},
                            status=429,
                        )
                    return HttpResponse("Too many authentication attempts. Please try again later.", status=429)
                cache.set(cache_key, attempts + 1, RATE_WINDOW)

            # Check Mutation endpoints rate limit
            elif any(request.path.startswith(p) for p in MUTATION_RATE_LIMITED_PATHS):
                cache_key = f"mutation_ratelimit:{hashlib.md5(ip.encode()).hexdigest()}"
                attempts = cache.get(cache_key, 0)
                if attempts >= MUTATION_RATE_LIMIT:
                    return JsonResponse(
                        {"detail": "Batas frekuensi pembuatan data tercapai. Silakan coba sesaat lagi."},
                        status=429,
                    )
                cache.set(cache_key, attempts + 1, RATE_WINDOW)

        return self.get_response(request)

    @staticmethod
    def _get_client_ip(request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")
