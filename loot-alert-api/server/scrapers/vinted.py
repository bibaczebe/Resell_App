import requests
import urllib.parse
from server.scrapers import Listing, random_headers
from server.config import SCRAPER_API_KEY

VINTED_API_BASE = "https://www.vinted.pl/api/v2"

CONDITION_MAP = {
    "new": [6, 1],      # New with tags, New without tags
    "used": [2, 3, 4],  # Very good, Good, Satisfactory
    "any": [],
}


def _via_scraper(target_url: str) -> str:
    # Vinted aggressively blocks datacenter IPs – we always route through ScraperAPI when available
    if SCRAPER_API_KEY:
        return f"http://api.scraperapi.com/?api_key={SCRAPER_API_KEY}&url={urllib.parse.quote(target_url, safe='')}"
    return target_url


def _get_session_cookie() -> dict:
    """Fetch anonymous session cookies from Vinted homepage (routed via ScraperAPI if set)."""
    try:
        home = "https://www.vinted.pl/"
        r = requests.get(
            _via_scraper(home),
            headers={**random_headers(), "Accept": "text/html"},
            timeout=12,
        )
        return {c.name: c.value for c in r.cookies}
    except Exception:
        return {}


def search(keywords: str, max_price: float | None = None, min_price: float = 0,
           condition: str = "any", size: str | None = None, limit: int = 50) -> list[Listing]:
    params = {
        "search_text": keywords,
        "per_page": min(limit, 50),
        "order": "newest_first",
    }
    if max_price:
        params["price_to"] = max_price
    if min_price and min_price > 0:
        params["price_from"] = min_price

    status_ids = CONDITION_MAP.get(condition, [])
    if status_ids:
        for sid in status_ids:
            params.setdefault("status_ids[]", []).append(sid) if isinstance(params.get("status_ids[]"), list) else None
        # Simpler: build manually below
        del params["status_ids[]"] if "status_ids[]" in params else None

    # Build URL manually with proper encoding
    qs = urllib.parse.urlencode(params, doseq=True)
    for sid in status_ids:
        qs += f"&status_ids[]={sid}"

    target_url = f"{VINTED_API_BASE}/catalog/items?{qs}"

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
            timeout=15,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
    except Exception:
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
            image_url = photo_obj.get("url") or (photo_obj.get("thumbnails") or [{}])[0].get("url")

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
