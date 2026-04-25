"""
Reverb.com – global marketplace for musical instruments and audio gear.
Public Listings API, no auth required for search.
"""

import logging
import requests
from server.scrapers import Listing

logger = logging.getLogger(__name__)
REVERB_API = "https://api.reverb.com/api/listings"


def search(keywords: str, max_price: float | None = None, min_price: float = 0,
           condition: str = "any", limit: int = 50) -> list[Listing]:
    params: dict[str, str | int] = {
        "query": keywords,
        "per_page": min(limit, 50),
        "order": "newest",
    }
    if max_price:
        params["price_max"] = int(max_price)
    if min_price and min_price > 0:
        params["price_min"] = int(min_price)
    if condition == "new":
        params["condition"] = "brand-new"
    elif condition == "used":
        params["condition"] = "excellent,very-good,good"

    try:
        resp = requests.get(
            REVERB_API,
            params=params,
            headers={
                "Accept": "application/hal+json",
                "Accept-Version": "3.0",
                "User-Agent": "LootAlert/1.0",
            },
            timeout=12,
        )
        if resp.status_code != 200:
            logger.warning("Reverb status %s: %s", resp.status_code, resp.text[:160])
            return []
        data = resp.json()
    except Exception as e:
        logger.warning("Reverb error: %s", e)
        return []

    listings: list[Listing] = []
    for item in data.get("listings", []):
        try:
            price_obj = item.get("price") or {}
            price = float(price_obj.get("amount")) if price_obj.get("amount") else None
            currency = price_obj.get("currency") or "USD"
        except (TypeError, ValueError):
            price = None
            currency = "USD"

        photo = (item.get("_links") or {}).get("photo") or {}
        image_url = photo.get("href")

        web_link = (item.get("_links") or {}).get("web") or {}
        url = web_link.get("href", "")

        listings.append(Listing(
            id=str(item.get("id", "")),
            title=item.get("title", ""),
            price=price,
            currency=currency,
            url=url,
            image_url=image_url,
            source="reverb",
        ))
    return listings
