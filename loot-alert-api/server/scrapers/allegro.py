import requests
import time
import logging
from server.scrapers import Listing
from server.config import ALLEGRO_CLIENT_ID, ALLEGRO_CLIENT_SECRET, ALLEGRO_TOKEN_URL, ALLEGRO_API_BASE

logger = logging.getLogger(__name__)

_token_cache = {"token": None, "expires_at": 0}


def _get_token() -> str | None:
    if not ALLEGRO_CLIENT_ID or not ALLEGRO_CLIENT_SECRET:
        return None

    if _token_cache["token"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["token"]

    try:
        resp = requests.post(
            ALLEGRO_TOKEN_URL,
            data={"grant_type": "client_credentials"},
            auth=(ALLEGRO_CLIENT_ID, ALLEGRO_CLIENT_SECRET),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        _token_cache["token"] = data["access_token"]
        _token_cache["expires_at"] = time.time() + data.get("expires_in", 3600)
        return _token_cache["token"]
    except Exception as e:
        logger.warning("Allegro token fetch failed: %s", e)
        return None


def search(keywords: str, max_price: float | None = None, min_price: float = 0,
           condition: str = "any", limit: int = 60) -> list[Listing]:
    token = _get_token()
    if not token:
        return []

    params = {
        "phrase": keywords,
        "limit": min(limit, 60),
        "offset": 0,
        "sort": "-startTime",
    }
    if max_price:
        params["price.to"] = max_price
    if min_price and min_price > 0:
        params["price.from"] = min_price

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.allegro.public.v1+json",
        "User-Agent": "LootAlert/1.0",
    }

    try:
        resp = requests.get(
            f"{ALLEGRO_API_BASE}/offers/listing",
            params=params,
            headers=headers,
            timeout=12,
        )
        if resp.status_code != 200:
            logger.warning("Allegro search %s: %s", resp.status_code, resp.text[:200])
            return []
        data = resp.json()
    except Exception as e:
        logger.warning("Allegro search error: %s", e)
        return []

    listings = []
    items = data.get("items", {}) or {}
    all_items = list(items.get("promoted", [])) + list(items.get("regular", []))

    for item in all_items:
        try:
            selling = item.get("sellingMode", {}) or {}
            price_obj = selling.get("price", {}) or {}
            price = float(price_obj.get("amount", 0)) or None
        except (TypeError, ValueError):
            price = None

        images = item.get("images", []) or []
        image_url = None
        if images and isinstance(images[0], dict):
            image_url = images[0].get("url")

        offer_id = item.get("id", "")
        url = f"https://allegro.pl/oferta/{offer_id}" if offer_id else ""

        listings.append(Listing(
            id=str(offer_id),
            title=item.get("name", ""),
            price=price,
            url=url,
            image_url=image_url,
            source="allegro",
        ))
    return listings
