import requests
from server.scrapers import Listing, random_headers
from server.config import SCRAPER_API_KEY

VINTED_API_BASE = "https://www.vinted.pl/api/v2"

CONDITION_MAP = {
    "new": [6, 1],      # New with tags, New without tags
    "used": [2, 3, 4],  # Very good, Good, Satisfactory
    "any": [],
}


def _scraper_url(target_url: str) -> str:
    if SCRAPER_API_KEY:
        return f"http://api.scraperapi.com/?api_key={SCRAPER_API_KEY}&url={target_url}"
    return target_url


def search(keywords: str, max_price: float | None = None, min_price: float = 0,
           condition: str = "any", size: str | None = None, limit: int = 50) -> list[Listing]:
    params = {
        "search_text": keywords,
        "per_page": limit,
        "order": "newest_first",
    }
    if max_price:
        params["price_to"] = max_price
    if min_price:
        params["price_from"] = min_price
    if size:
        params["size_ids"] = size

    status_ids = CONDITION_MAP.get(condition, [])
    if status_ids:
        params["status_ids[]"] = status_ids

    headers = random_headers()
    headers["Accept"] = "application/json"

    try:
        resp = requests.get(
            _scraper_url(f"{VINTED_API_BASE}/catalog/items"),
            params=params,
            headers=headers,
            timeout=12,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return []

    listings = []
    for item in data.get("items", []):
        price = None
        try:
            price = float(item.get("price", {}).get("amount", 0))
        except (TypeError, ValueError, AttributeError):
            pass

        image_url = None
        photos = item.get("photos", [])
        if photos:
            image_url = photos[0].get("url")

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
