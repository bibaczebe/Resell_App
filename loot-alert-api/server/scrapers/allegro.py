import requests
import time
from server.scrapers import Listing, random_headers
from server.config import ALLEGRO_CLIENT_ID, ALLEGRO_CLIENT_SECRET, ALLEGRO_TOKEN_URL, ALLEGRO_API_BASE

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
    except Exception:
        return None


def search(keywords: str, max_price: float | None = None, min_price: float = 0,
           condition: str = "any", limit: int = 60) -> list[Listing]:
    token = _get_token()
    if not token:
        return []

    params = {
        "phrase": keywords,
        "sort": "-startTime",
        "limit": limit,
        "offset": 0,
    }
    if max_price:
        params["price.to"] = max_price
    if min_price:
        params["price.from"] = min_price
    if condition == "new":
        params["condition"] = "NEW"
    elif condition == "used":
        params["condition"] = "USED"

    headers = {
        **random_headers(),
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.allegro.public.v1+json",
    }

    try:
        resp = requests.get(
            f"{ALLEGRO_API_BASE}/offers/listing",
            params=params,
            headers=headers,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return []

    listings = []
    items = data.get("items", {})
    for item in items.get("regular", []) + items.get("promoted", []):
        price = None
        try:
            price = float(item.get("sellingMode", {}).get("price", {}).get("amount", 0))
        except (TypeError, ValueError):
            pass

        image_url = None
        images = item.get("images", [])
        if images:
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
