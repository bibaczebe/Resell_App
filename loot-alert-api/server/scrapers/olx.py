"""OLX.pl scraper — unofficial mobile-web JSON API.

OLX sits behind an Akamai/CloudFront WAF that blocks plain python-requests by TLS
fingerprint (403) regardless of headers or IP. curl_cffi with a Chrome
impersonation profile passes it directly from residential IPs; set
SCRAPE_PROXY_URL if the deploy IP gets blocked. The old RSS fallback was removed:
OLX discontinued those feeds and it was routed through the now-dead ScraperAPI key.
"""

import re
import logging
from server.scrapers import Listing, random_headers, browser_get

logger = logging.getLogger(__name__)

OLX_API_BASE = "https://www.olx.pl/api/v1"


def _clean_desc(item: dict) -> str | None:
    d = item.get("description")
    if not d:
        return None
    d = re.sub(r"<[^>]+>", " ", str(d))       # strip HTML tags
    d = re.sub(r"\s+", " ", d).strip()
    return d[:400] or None


def _extract_price(item: dict) -> float | None:
    for param in item.get("params", []):
        if param.get("key") == "price":
            value_obj = param.get("value", {})
            # Some listings are 'negotiable' or 'arranged' with value=0/1; skip those
            if value_obj.get("arranged") and (value_obj.get("value") or 0) <= 1:
                return None
            try:
                return float(value_obj.get("value") or 0) or None
            except (TypeError, ValueError):
                return None
    return None


def _extract_first_photo(item: dict) -> str | None:
    photos = item.get("photos") or []
    if not photos:
        return None
    first = photos[0]
    link = first.get("link", "") if isinstance(first, dict) else ""
    if link:
        return link.replace("{width}", "400").replace("{height}", "400")
    return None


def search(keywords: str, max_price: float | None = None, min_price: float = 0,
           condition: str = "any", limit: int = 50) -> list[Listing]:
    params = {
        "query": keywords,
        "limit": limit,
        "offset": 0,
    }
    if max_price:
        params["filter_float_price:to"] = max_price
    if min_price and min_price > 0:
        params["filter_float_price:from"] = min_price
    if condition == "new":
        params["filter_enum_state"] = "new"
    elif condition == "used":
        params["filter_enum_state"] = "used"

    try:
        resp = browser_get(
            f"{OLX_API_BASE}/offers/",
            params=params,
            headers=random_headers(),
            timeout=15,
        )
        if resp.status_code != 200:
            logger.warning("OLX search returned %s: %s", resp.status_code, resp.text[:200])
            return []
        data = resp.json()
    except Exception as e:
        logger.warning("OLX search failed: %s", e)
        return []

    listings = []
    for item in data.get("data", []):
        price = _extract_price(item)
        if max_price and price and price > max_price:
            continue
        if min_price and price and price < min_price:
            continue

        listing_id = str(item.get("id", ""))
        if not listing_id:
            continue

        listings.append(Listing(
            id=listing_id,
            title=item.get("title", ""),
            price=price,
            url=item.get("url", ""),
            image_url=_extract_first_photo(item),
            source="olx",
            description=_clean_desc(item),
        ))
    return listings
