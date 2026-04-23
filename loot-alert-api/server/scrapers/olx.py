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
    results = _search_api(keywords, max_price, min_price, condition, limit)
    if not results:
        results = _search_rss(keywords, limit)
    return results


def _search_api(keywords: str, max_price: float | None, min_price: float,
                condition: str, limit: int) -> list[Listing]:
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
        resp = requests.get(
            f"{OLX_API_BASE}/offers/",
            params=params,
            headers=random_headers(),
            timeout=12,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return []

    listings = []
    for item in data.get("data", []):
        price = _extract_price(item)
        if max_price and price and price > max_price:
            continue
        if min_price and price and price < min_price:
            continue

        listings.append(Listing(
            id=str(item.get("id", "")),
            title=item.get("title", ""),
            price=price,
            url=item.get("url", ""),
            image_url=_extract_first_photo(item),
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
