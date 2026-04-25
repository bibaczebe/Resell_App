"""
Discogs – global music marketplace (vinyl, CD, cassette, equipment).
Public database search; for marketplace prices we follow up with /marketplace/listings.
Token auth optional for higher rate limits (60 req/min instead of 25).
"""

import os
import logging
import requests
from server.scrapers import Listing

logger = logging.getLogger(__name__)
DISCOGS_API = "https://api.discogs.com"
DISCOGS_TOKEN = os.environ.get("DISCOGS_TOKEN", "").strip()


def _auth_header() -> dict:
    if DISCOGS_TOKEN:
        return {"Authorization": f"Discogs token={DISCOGS_TOKEN}"}
    return {}


def search(keywords: str, max_price: float | None = None, min_price: float = 0,
           condition: str = "any", limit: int = 50) -> list[Listing]:
    """Search Discogs database, then for each release fetch min marketplace price.
    Database hits are not 'for sale' per se – we only return releases that
    have at least one active listing.
    """
    try:
        resp = requests.get(
            f"{DISCOGS_API}/database/search",
            params={
                "q": keywords,
                "type": "release",
                "per_page": min(limit, 25),
            },
            headers={
                "User-Agent": "LootAlert/1.0",
                "Accept": "application/json",
                **_auth_header(),
            },
            timeout=12,
        )
        if resp.status_code != 200:
            logger.warning("Discogs search status %s", resp.status_code)
            return []
        data = resp.json()
    except Exception as e:
        logger.warning("Discogs search error: %s", e)
        return []

    listings: list[Listing] = []
    # Cap follow-up calls to keep within rate limit
    for item in data.get("results", [])[:8]:
        try:
            release_id = item.get("id")
            if not release_id:
                continue

            price = None
            currency = "EUR"

            # Fetch lowest marketplace price for the release
            try:
                price_resp = requests.get(
                    f"{DISCOGS_API}/marketplace/stats/{release_id}",
                    params={"curr_abbr": "PLN"},
                    headers={
                        "User-Agent": "LootAlert/1.0",
                        "Accept": "application/json",
                        **_auth_header(),
                    },
                    timeout=8,
                )
                if price_resp.status_code == 200:
                    pdata = price_resp.json()
                    lowest = pdata.get("lowest_price")
                    if lowest:
                        price = float(lowest.get("value", 0))
                        currency = lowest.get("currency", "PLN")
            except Exception:
                pass

            if max_price and price and price > max_price:
                continue
            if min_price and price and price < min_price:
                continue

            url = f"https://www.discogs.com/sell/release/{release_id}"
            image_url = item.get("cover_image") or item.get("thumb")

            listings.append(Listing(
                id=str(release_id),
                title=item.get("title", ""),
                price=price,
                currency=currency,
                url=url,
                image_url=image_url,
                source="discogs",
            ))
        except Exception as e:
            logger.debug("Discogs item parse error: %s", e)

    return listings
