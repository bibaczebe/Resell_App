"""Minimal FX so prices from different marketplaces are comparable in PLN.

max_price is entered in PLN but eBay/Reverb/Discogs return GBP/USD/EUR, so a
"2000 PLN" cap was silently admitting 2000 GBP (~10k PLN) items and the
cheapest-first sort compared raw numbers across currencies. We normalize to PLN.

Rates are refreshed from the NBP public API (no key) with a hardcoded fallback
so the app never depends on that call succeeding.
"""
import time
import logging
import requests

logger = logging.getLogger(__name__)

# Conservative fallback rates -> PLN (approx, Aug 2026). Used if the live fetch
# fails; being approximate is fine for a deal-filter threshold.
_FALLBACK = {
    "PLN": 1.0, "EUR": 4.30, "USD": 3.95, "GBP": 5.05,
    "CHF": 4.45, "CZK": 0.17, "SEK": 0.37, "NOK": 0.36,
    "AUD": 2.60, "CAD": 2.90, "JPY": 0.027,
}

_cache = {"rates": None, "at": 0.0}
_TTL = 12 * 3600


def _load_rates() -> dict:
    if _cache["rates"] and time.time() - _cache["at"] < _TTL:
        return _cache["rates"]
    rates = dict(_FALLBACK)
    try:
        # NBP table A: mid rates of foreign currencies vs PLN.
        resp = requests.get("https://api.nbp.pl/api/exchangerates/tables/A?format=json", timeout=6)
        if resp.status_code == 200:
            for item in resp.json()[0]["rates"]:
                code = item["code"].upper()
                if code in _FALLBACK:
                    rates[code] = float(item["mid"])
            rates["PLN"] = 1.0
    except Exception as e:
        logger.debug("FX fetch failed, using fallback: %s", e)
    _cache["rates"] = rates
    _cache["at"] = time.time()
    return rates


def to_pln(amount, currency: str | None) -> float | None:
    if amount is None:
        return None
    try:
        amt = float(amount)
    except (TypeError, ValueError):
        return None
    rate = _load_rates().get((currency or "PLN").upper(), _FALLBACK.get((currency or "PLN").upper()))
    if rate is None:
        return amt  # unknown currency: leave as-is rather than drop
    return round(amt * rate, 2)
