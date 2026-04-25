"""
eBay Browse API scraper (global – US, GB, DE, FR, IT, ES, AU, CA, PL).

Auth strategy:
  - If EBAY_APP_ID + EBAY_CERT_ID present: generate own tokens via
    client_credentials (cached for ~2h in Redis).
  - Else fall back to a static EBAY_OAUTH_TOKEN env var (user pastes a
    fresh token from developer.ebay.com every 2h until they hand over
    Cert ID).
"""

import base64
import logging
import time
import requests
from server.scrapers import Listing
from server.config import (
    EBAY_APP_ID, EBAY_CERT_ID, EBAY_OAUTH_TOKEN,
    EBAY_API_BASE, EBAY_TOKEN_URL, EBAY_DEFAULT_MARKETS,
)

logger = logging.getLogger(__name__)
_token_cache = {"token": None, "expires_at": 0.0}


def _fetch_app_token() -> str | None:
    """client_credentials OAuth2 flow. Requires App ID + Cert ID."""
    if not EBAY_APP_ID or not EBAY_CERT_ID:
        return None
    if _token_cache["token"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["token"]

    creds = base64.b64encode(f"{EBAY_APP_ID}:{EBAY_CERT_ID}".encode()).decode()
    try:
        resp = requests.post(
            EBAY_TOKEN_URL,
            headers={
                "Authorization": f"Basic {creds}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "client_credentials",
                "scope": "https://api.ebay.com/oauth/api_scope",
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        _token_cache["token"] = data["access_token"]
        _token_cache["expires_at"] = time.time() + data.get("expires_in", 7200)
        return _token_cache["token"]
    except Exception as e:
        logger.warning("eBay token fetch failed: %s", e)
        return None


def _get_token() -> str | None:
    token = _fetch_app_token()
    if token:
        return token
    return EBAY_OAUTH_TOKEN or None


def _search_marketplace(token: str, market: str, keywords: str,
                        max_price: float | None, min_price: float,
                        condition: str, limit: int) -> list[Listing]:
    """Search a single eBay marketplace site (e.g. EBAY_US)."""
    params: dict[str, str | int] = {
        "q": keywords,
        "limit": min(limit, 50),
    }
    filter_parts: list[str] = []
    if max_price or min_price:
        # eBay expects price filter in marketplace currency – we send raw
        # numbers without currency to use marketplace default
        lo = f"{int(min_price)}" if min_price else ""
        hi = f"{int(max_price)}" if max_price else ""
        if lo or hi:
            filter_parts.append(f"price:[{lo}..{hi}]")
            filter_parts.append("priceCurrency:USD" if market == "EBAY_US" else
                                "priceCurrency:GBP" if market == "EBAY_GB" else
                                "priceCurrency:EUR" if market in ("EBAY_DE", "EBAY_FR", "EBAY_IT", "EBAY_ES", "EBAY_PL") else
                                "priceCurrency:AUD" if market == "EBAY_AU" else
                                "priceCurrency:CAD" if market == "EBAY_CA" else
                                "priceCurrency:USD")
    if condition == "new":
        filter_parts.append("conditions:{NEW}")
    elif condition == "used":
        filter_parts.append("conditions:{USED}")

    if filter_parts:
        params["filter"] = ",".join(filter_parts)

    try:
        resp = requests.get(
            f"{EBAY_API_BASE}/buy/browse/v1/item_summary/search",
            params=params,
            headers={
                "Authorization": f"Bearer {token}",
                "X-EBAY-C-MARKETPLACE-ID": market,
                "Accept": "application/json",
            },
            timeout=12,
        )
        if resp.status_code != 200:
            logger.warning("eBay %s status %s: %s", market, resp.status_code, resp.text[:160])
            return []
        data = resp.json()
    except Exception as e:
        logger.warning("eBay %s error: %s", market, e)
        return []

    listings: list[Listing] = []
    for item in data.get("itemSummaries", []):
        try:
            price_obj = item.get("price") or {}
            price = float(price_obj.get("value")) if price_obj.get("value") else None
        except (TypeError, ValueError):
            price = None

        image_url = (item.get("image") or {}).get("imageUrl")
        listings.append(Listing(
            id=str(item.get("itemId", "")),
            title=item.get("title", ""),
            price=price,
            url=item.get("itemWebUrl") or item.get("itemHref", ""),
            image_url=image_url,
            source=f"ebay_{market[5:].lower()}",  # e.g. ebay_us
        ))
    return listings


def search(keywords: str, max_price: float | None = None, min_price: float = 0,
           condition: str = "any", limit: int = 50) -> list[Listing]:
    """Search across default eBay marketplaces, merge results."""
    token = _get_token()
    if not token:
        return []

    all_results: list[Listing] = []
    per_market = max(5, limit // max(1, len(EBAY_DEFAULT_MARKETS)))
    for market in EBAY_DEFAULT_MARKETS:
        items = _search_marketplace(token, market, keywords, max_price, min_price, condition, per_market)
        all_results.extend(items)

    # dedupe by id (same item could appear via cross-listing)
    seen: set[str] = set()
    deduped: list[Listing] = []
    for item in all_results:
        if item.id in seen:
            continue
        seen.add(item.id)
        deduped.append(item)

    return deduped[:limit]
