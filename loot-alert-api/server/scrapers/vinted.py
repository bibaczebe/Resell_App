import requests
import urllib.parse
import logging
from server.scrapers import Listing, random_headers
from server.config import SCRAPER_API_KEY, SCRAPER_API_PREMIUM

logger = logging.getLogger(__name__)

VINTED_API_BASE = "https://www.vinted.pl/api/v2"

CONDITION_MAP = {
    "new": [6, 1],      # New with tags, New without tags
    "used": [2, 3, 4],  # Very good, Good, Satisfactory
    "any": [],
}


def _via_scraper(target_url: str) -> str:
    if not SCRAPER_API_KEY:
        return target_url
    # Vinted is a protected domain (Cloudflare/DataDome) – we need premium proxies
    # which cost 10 credits per request instead of 1. Toggle SCRAPER_API_PREMIUM=true
    # in Railway once you upgrade your ScraperAPI plan.
    parts = [
        f"api_key={SCRAPER_API_KEY}",
        f"url={urllib.parse.quote(target_url, safe='')}",
        "country_code=pl",
    ]
    if SCRAPER_API_PREMIUM:
        parts.append("premium=true")
    else:
        # Standard plan: try without premium – will likely return 500 with
        # "Protected domains may require premium=true" but worth trying once.
        parts.append("render=false")
    return "http://api.scraperapi.com/?" + "&".join(parts)


def _get_session_cookie() -> dict:
    # Skip the cookie fetch — adds 15-30s and isn't needed when going through
    # ScraperAPI (which rotates session-friendly residential proxies anyway).
    return {}


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
    target_url = _build_url(keywords, max_price, min_price, condition, limit)

    headers = {
        **random_headers(),
        "Accept": "application/json",
        "Referer": "https://www.vinted.pl/",
    }
    cookies = _get_session_cookie()

    try:
        resp = requests.get(
            _via_scraper(target_url),
            headers=headers,
            cookies=cookies,
            timeout=70,  # ScraperAPI residential proxies need up to 60s for Vinted
        )
        if resp.status_code != 200:
            logger.warning("Vinted returned %s: %s", resp.status_code, resp.text[:200])
            return []
        data = resp.json()
    except Exception as e:
        logger.warning("Vinted request failed: %s", e)
        return []

    listings = []
    for item in data.get("items", []):
        try:
            price_obj = item.get("price") or {}
            price = float(price_obj.get("amount", 0)) if price_obj else None
        except (TypeError, ValueError, AttributeError):
            price = None

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
            url = f"https://www.vinted.pl{url}"

        listings.append(Listing(
            id=str(item.get("id", "")),
            title=item.get("title", ""),
            price=price,
            url=url,
            image_url=image_url,
            source="vinted",
            size=item.get("size_title"),
        ))
    return listings
