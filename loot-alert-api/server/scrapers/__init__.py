import os
import random
import logging
from dataclasses import dataclass
from server.config import USER_AGENTS

logger = logging.getLogger(__name__)

# Optional residential/rotating proxy for anti-bot–protected sites (Vinted, OLX).
# Leave unset to hit the sites directly. Format: http://user:pass@host:port
SCRAPE_PROXY_URL = os.environ.get("SCRAPE_PROXY_URL", "").strip()

# Browser profile curl_cffi impersonates so our TLS/JA3 fingerprint looks like a
# real Chrome. This is what lets us past Akamai/CloudFront/DataDome TLS blocks
# that reject plain python-requests regardless of headers or IP.
IMPERSONATE = os.environ.get("SCRAPE_IMPERSONATE", "chrome").strip() or "chrome"


@dataclass
class Listing:
    id: str
    title: str
    price: float | None
    url: str
    image_url: str | None
    source: str
    currency: str = "PLN"
    condition: str = "unknown"
    size: str | None = None
    description: str | None = None  # captured where the search API provides it (for AI validation)


def random_headers() -> dict:
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
    }


def _proxies() -> dict | None:
    if SCRAPE_PROXY_URL:
        return {"http": SCRAPE_PROXY_URL, "https": SCRAPE_PROXY_URL}
    return None


def new_browser_session():
    """A curl_cffi session with a real browser TLS fingerprint (and proxy if set).

    Use for sites that require cookie continuity across requests (e.g. Vinted's
    anonymous access_token_web flow). Returns None if curl_cffi is unavailable.
    """
    try:
        from curl_cffi import requests as creq
    except Exception as e:  # pragma: no cover - import guard
        logger.error("curl_cffi not available: %s", e)
        return None
    return creq.Session(impersonate=IMPERSONATE, proxies=_proxies())


def browser_get(url: str, *, params: dict | None = None, headers: dict | None = None,
                timeout: int = 25):
    """One-shot GET with a browser TLS fingerprint (and proxy if set).

    Use for protected sites that only need a single request (e.g. OLX's JSON API).
    Raises on transport error so the caller can log and return [].
    """
    from curl_cffi import requests as creq
    return creq.get(url, params=params, headers=headers,
                    impersonate=IMPERSONATE, proxies=_proxies(), timeout=timeout)
