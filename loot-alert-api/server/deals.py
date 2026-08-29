"""Deal detection — the defensible, in-ToS moat: flag listings priced below
what they resell for. We use the median PLN price of the current matches for a
keyword as a cheap market baseline (works well now that accessory/parts noise
is filtered out, so the median reflects real items)."""
import statistics

HOT_PCT = 30    # >= this % below median -> "hot"
GOOD_PCT = 15   # >= this % below median -> "good"


def score(results: list[dict]) -> dict:
    """Attach discount_pct + deal_tier to each result based on the set's median
    price_pln. Returns {"results", "median_pln"}. Mutates results in place."""
    prices = sorted(r["price_pln"] for r in results if r.get("price_pln"))
    median = statistics.median(prices) if len(prices) >= 4 else None
    for r in results:
        p = r.get("price_pln")
        if median and p and p < median:
            disc = round((1 - p / median) * 100)
            r["discount_pct"] = disc
            r["deal_tier"] = "hot" if disc >= HOT_PCT else "good" if disc >= GOOD_PCT else None
        else:
            r["discount_pct"] = None
            r["deal_tier"] = None
    return {"results": results, "median_pln": round(median, 2) if median else None}
