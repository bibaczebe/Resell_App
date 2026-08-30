"""Deal detection tuned for REAL reselling potential, not just "cheap".

A listing is only a flip if, after buying it, reselling at the market median,
and paying shipping + marketplace fees, there's meaningful profit left. This
kills the "Nike socks 40% below median" / "earphone packaging" false positives:
they're below median but the margin after ~15 zł shipping is negative, and the
category simply doesn't resell for enough to bother.
"""
import statistics
from server.config import (
    SHIPPING_PLN, SELL_FEE_RATE, MIN_FLIP_PROFIT_PLN, MIN_RESALE_VALUE_PLN,
)

HOT_PCT = 30
GOOD_PCT = 15


def score(results: list[dict]) -> dict:
    """Attach discount_pct, deal_tier, estimated_profit_pln, and flip_worthy to
    each result based on the set's median price_pln. Returns {results, median_pln}."""
    prices = sorted(r["price_pln"] for r in results if r.get("price_pln"))
    median = statistics.median(prices) if len(prices) >= 4 else None

    for r in results:
        p = r.get("price_pln")
        r["median_pln"] = round(median, 2) if median else None  # travels with the deal for AI validation
        r["discount_pct"] = None
        r["deal_tier"] = None
        r["estimated_profit_pln"] = None
        r["flip_worthy"] = False

        if not (median and p and p < median):
            continue

        disc = round((1 - p / median) * 100)
        r["discount_pct"] = disc
        r["deal_tier"] = "hot" if disc >= HOT_PCT else "good" if disc >= GOOD_PCT else None

        # Expected profit if bought at p and resold at the market median.
        profit = median - p - SHIPPING_PLN - (SELL_FEE_RATE * median)
        r["estimated_profit_pln"] = round(profit, 2)

        # A real flip: the category resells for enough AND the margin clears the
        # shipping/fee/effort bar AND it's genuinely below market.
        r["flip_worthy"] = (
            median >= MIN_RESALE_VALUE_PLN     # category actually resells for enough
            and p >= 30                        # ignore sub-30 zł items (usually mis-categorized junk in a pricey set)
            and profit >= MIN_FLIP_PROFIT_PLN  # real margin after shipping + fees
            and disc >= GOOD_PCT               # genuinely below market
        )

    return {"results": results, "median_pln": round(median, 2) if median else None}
