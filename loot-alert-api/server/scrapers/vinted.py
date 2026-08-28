"""Vinted.pl scraper — anonymous session-cookie flow.

Vinted's public catalog API (api/v2/catalog/items) needs no login, but it is
protected by DataDome and returns 401 invalid_authentication_token without a
valid web session cookie. We get one for free by requesting the homepage first
(which sets access_token_web), then reuse that cookie jar for the API call — all
through a real browser TLS fingerprint (curl_cffi). No paid proxy required from
residential IPs; set SCRAPE_PROXY_URL if the deploy IP gets DataDome-blocked.
"""

import logging
import urllib.parse
from server.scrapers import Listing, new_browser_session

logger = logging.getLogger(__name__)

VINTED_BASE = "https://www.vinted.pl"
VINTED_API_BASE = f"{VINTED_BASE}/api/v2"

CONDITION_MAP = {
    "new": [6, 1],      # New with tags, New without tags
    "used": [2, 3, 4],  # Very good, Good, Satisfactory
    "any": [],
}


def _build_url(keywords: str, max_price: float | None, min_price: float,
               condition: str, limit: int) -> str:
    parts = [
        ("search_text", keywords),
        ("per_page", str(min(limit, 50))),
        ("order", "newest_first"),
    ]
    if max_price:
        parts.append(("price_to", str(max_price)))
    if min_price and min_price > 0:
        parts.append(("price_from", str(min_price)))
    for sid in CONDITION_MAP.get(condition, []):
        parts.append(("status_ids[]", str(sid)))

    qs = urllib.parse.urlencode(parts)
    return f"{VINTED_API_BASE}/catalog/items?{qs}"


def search(keywords: str, max_price: float | None = None, min_price: float = 0,
           condition: str = "any", size: str | None = None, limit: int = 50) -> list[Listing]:
    session = new_browser_session()
    if session is None:
        logger.error("Vinted: curl_cffi unavailable, cannot fetch")
        return []

    try:
        # Step 1: anonymous session — homepage sets access_token_web cookie.
        home = session.get(VINTED_BASE + "/", timeout=20)
        if home.status_code != 200:
            logger.warning("Vinted homepage returned %s (DataDome block?)", home.status_code)
            return []

        # Step 2: catalog API with the session cookies.
        target_url = _build_url(keywords, max_price, min_price, condition, limit)
        resp = session.get(
            target_url,
            headers={"Accept": "application/json", "Referer": VINTED_BASE + "/"},
            timeout=25,
        )
        if resp.status_code != 200:
            logger.warning("Vinted API returned %s: %s", resp.status_code, resp.text[:200])
            return []
        data = resp.json()
    except Exception as e:
        logger.warning("Vinted request failed: %s", e)
        return []

    listings = []
    for item in data.get("items", []):
        try:
            price_obj = item.get("price") or {}
            amount = price_obj.get("amount") if isinstance(price_obj, dict) else None
            price = float(amount) if amount is not None else None
            currency = (price_obj.get("currency_code") if isinstance(price_obj, dict) else None) or "PLN"
        except (TypeError, ValueError, AttributeError):
            price = None
            currency = "PLN"

        image_url = None
        photo_obj = item.get("photo")
        if isinstance(photo_obj, dict):
            image_url = photo_obj.get("url")
            if not image_url:
                thumbs = photo_obj.get("thumbnails") or []
                if thumbs and isinstance(thumbs[0], dict):
                    image_url = thumbs[0].get("url")

        url = item.get("url", "")
        if url and not url.startswith("http"):
            url = f"{VINTED_BASE}{url}"

        listing_id = str(item.get("id", ""))
        if not listing_id:
            continue

        listings.append(Listing(
            id=listing_id,
            title=item.get("title", ""),
            price=price,
            url=url,
            image_url=image_url,
            source="vinted",
            currency=currency,
            size=item.get("size_title"),
        ))
    return listings
