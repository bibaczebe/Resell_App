import requests
import feedparser
from server.scrapers import Listing, random_headers
from server.config import SCRAPER_API_KEY

OLX_API_BASE = "https://www.olx.pl/api/v1"
OLX_RSS_BASE = "https://www.olx.pl/oferty"


def _scraper_url(target_url: str) -> str:
    if SCRAPER_API_KEY:
        return f"http://api.scraperapi.com/?api_key={SCRAPER_API_KEY}&url={target_url}"
    return target_url


def search(keywords: str, max_price: float | None = None, min_price: float = 0,
           condition: str = "any", limit: int = 50) -> list[Listing]:
    results = _search_api(keywords, max_price, min_price, condition, limit)
    if not results:
        results = _search_rss(keywords, limit)
    return results


def _search_api(keywords: str, max_price: float | None, min_price: float,
                condition: str, limit: int) -> list[Listing]:
    params = {
        "query": keywords,
        "sort_by": "created_at:desc",
        "limit": limit,
        "offset": 0,
    }
    if max_price:
        params["filter_float_price:to"] = max_price
    if min_price:
        params["filter_float_price:from"] = min_price
    if condition == "new":
        params["filter_enum_state"] = "new"
    elif condition == "used":
        params["filter_enum_state"] = "used"

    try:
        resp = requests.get(
            _scraper_url(f"{OLX_API_BASE}/offers/"),
            params=params,
            headers=random_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return []

    listings = []
    for item in data.get("data", []):
        price = None
        price_info = item.get("price", {})
        if price_info and price_info.get("value"):
            try:
                price = float(price_info["value"]["value"])
            except (KeyError, TypeError, ValueError):
                pass

        photos = item.get("photos", [])
        image_url = photos[0].get("link", "").replace("{width}", "400").replace("{height}", "400") if photos else None

        listings.append(Listing(
            id=str(item.get("id", "")),
            title=item.get("title", ""),
            price=price,
            url=item.get("url", ""),
            image_url=image_url,
            source="olx",
        ))
    return listings


def _search_rss(keywords: str, limit: int) -> list[Listing]:
    slug = keywords.replace(" ", "-").lower()
    url = f"{OLX_RSS_BASE}/q-{slug}/?search[order]=created_at:desc&view=list"
    try:
        feed = feedparser.parse(_scraper_url(url))
    except Exception:
        return []

    listings = []
    for entry in feed.entries[:limit]:
        title = entry.get("title", "")
        link = entry.get("link", "")
        listing_id = link.split("-")[-1].rstrip(".html").rstrip("/") if link else ""

        price = None
        summary = entry.get("summary", "")
        import re
        m = re.search(r"([\d\s]+[,.]?\d*)\s*zł", summary)
        if m:
            try:
                price = float(m.group(1).replace(" ", "").replace(",", "."))
            except ValueError:
                pass

        listings.append(Listing(
            id=listing_id,
            title=title,
            price=price,
            url=link,
            image_url=None,
            source="olx",
        ))
    return listings
