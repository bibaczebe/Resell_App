"""AI reselling copilot (Claude) with LIVE market analysis via tool use.

The assistant's whole job is resale potential: it looks up the real current
market (median price, comps, spread) through the app's own engine and gives an
honest BUY / SKIP / MAYBE verdict — actively telling the user NOT to buy when
there's no flip margin. Premium-gated. Requires ANTHROPIC_API_KEY in the env
(set a rotated key in Railway — never commit it)."""
import json
import logging
import statistics
from flask import Blueprint, request, jsonify
from server.db import get_db
from server.auth import require_auth
from server.config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL

logger = logging.getLogger(__name__)
chat_bp = Blueprint("chat", __name__)

SYSTEM = (
    "You are Loot Assistant, an AI copilot for RESELLERS on Polish and EU "
    "marketplaces (OLX, Vinted, eBay, Reverb, Discogs). Your only lens is resale "
    "potential — will this item make money when flipped? For any item the user "
    "considers, you MUST:\n"
    "1. Call the market_lookup tool to get the LIVE market (median price in PLN, "
    "number of comparable listings, price range) — never guess prices from memory.\n"
    "2. Give a clear verdict up front: BUY, SKIP, or MAYBE.\n"
    "3. Justify it with numbers: buy price vs median resale, estimated profit "
    "after fees/shipping, how liquid the item is (how many comps = how fast it "
    "sells), and the risk.\n"
    "Be honest and protective of the user's money: if the margin is thin, demand "
    "is low, or the buy price is at/above market, tell them plainly to SKIP it — "
    "do not talk them into a bad flip. When it IS a good flip, also help: write "
    "the resale listing (title + description), suggest a sell price and where to "
    "list it, and negotiation lines. Reply in the user's language (Polish or "
    "English). You are not a financial advisor; keep it practical."
)

TOOLS = [
    {
        "name": "market_lookup",
        "description": (
            "Look up the LIVE resale market for an item across OLX, Vinted and eBay: "
            "median price (PLN), number of comparable listings (liquidity), price "
            "range, and sample listings with how far below market each is. ALWAYS "
            "call this before giving a buy/skip verdict or quoting any price — it is "
            "real current data, not an estimate."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "the item, e.g. 'iphone 13 128gb' or 'nike air max 90 rozmiar 42'"},
                "max_price": {"type": "number", "description": "optional: only count listings up to this PLN price"},
            },
            "required": ["query"],
        },
    }
]


def _plan(db, user_id: int) -> str:
    cur = db.cursor()
    cur.execute("SELECT plan FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone()
    return row["plan"] if row else "free"


def _client():
    from anthropic import Anthropic
    return Anthropic(api_key=ANTHROPIC_API_KEY)


def _text(resp) -> str:
    return "".join(getattr(b, "text", "") for b in resp.content if getattr(b, "type", None) == "text")


def _market_snapshot(query: str, max_price=None) -> dict:
    """Run the real engine for a one-off query and summarize the market in PLN."""
    from server.alerts import _scrape_alert
    from server import deals

    alert = {
        "keywords": query, "max_price": max_price, "min_price": 0,
        "condition": "any", "sources": ["olx", "vinted", "ebay"],
        "exclude_keywords": None, "color": None, "size": None,
    }
    results = _scrape_alert(alert, limit=25)
    deals.score(results)
    prices = sorted(r["price_pln"] for r in results if r.get("price_pln"))
    median = statistics.median(prices) if len(prices) >= 4 else (prices[len(prices) // 2] if prices else None)
    return {
        "query": query,
        "listings_found": len(results),
        "median_pln": round(median, 2) if median else None,
        "min_pln": prices[0] if prices else None,
        "max_pln": prices[-1] if prices else None,
        "note": "liquidity = listings_found; few listings means it sells slowly",
        "samples": [
            {"title": r["title"][:60], "price_pln": r["price_pln"],
             "pct_below_median": r.get("discount_pct"), "source": r["source"]}
            for r in results[:8]
        ],
    }


def _run_tool(block) -> dict:
    if block.name == "market_lookup":
        try:
            data = _market_snapshot(block.input.get("query", ""), block.input.get("max_price"))
            return {"type": "tool_result", "tool_use_id": block.id,
                    "content": json.dumps(data, ensure_ascii=False)}
        except Exception as e:
            logger.warning("market_lookup failed: %s", e)
            return {"type": "tool_result", "tool_use_id": block.id,
                    "content": "market lookup failed", "is_error": True}
    return {"type": "tool_result", "tool_use_id": block.id,
            "content": "unknown tool", "is_error": True}


def _converse(messages: list, max_rounds: int = 4) -> str:
    """messages.create loop that services market_lookup tool calls."""
    client = _client()
    resp = None
    for _ in range(max_rounds):
        resp = client.messages.create(
            model=ANTHROPIC_MODEL, max_tokens=1500, system=SYSTEM,
            tools=TOOLS, messages=messages,
        )
        if resp.stop_reason != "tool_use":
            break
        messages.append({"role": "assistant", "content": resp.content})
        tool_results = [_run_tool(b) for b in resp.content if getattr(b, "type", None) == "tool_use"]
        messages.append({"role": "user", "content": tool_results})
    return _text(resp) if resp else ""


@chat_bp.route("/api/chat", methods=["POST"])
@require_auth
def chat():
    db = get_db()
    if _plan(db, request.user_id) == "free":
        return jsonify({"error": "AI assistant is a Premium feature", "code": "PREMIUM_ONLY"}), 403
    if not ANTHROPIC_API_KEY:
        return jsonify({"error": "AI assistant is not configured yet"}), 503

    data = request.get_json(silent=True) or {}
    raw = data.get("messages") or []
    messages = [
        {"role": m.get("role"), "content": str(m.get("content", ""))[:4000]}
        for m in raw
        if m.get("role") in ("user", "assistant") and str(m.get("content", "")).strip()
    ][-20:]
    if not messages or messages[-1]["role"] != "user":
        return jsonify({"error": "messages must be a non-empty list ending in a user turn"}), 400

    try:
        return jsonify({"reply": _converse(messages)}), 200
    except Exception as e:
        logger.warning("chat error: %s", e)
        return jsonify({"error": "AI request failed"}), 502


@chat_bp.route("/api/chat/deals-brief", methods=["POST"])
@require_auth
def deals_brief():
    """'AI read' of the premium Top Deals feed: a short flip-brief."""
    db = get_db()
    if _plan(db, request.user_id) == "free":
        return jsonify({"error": "Premium feature", "code": "PREMIUM_ONLY"}), 403
    if not ANTHROPIC_API_KEY:
        return jsonify({"error": "AI assistant is not configured yet"}), 503

    data = request.get_json(silent=True) or {}
    deals_list = data.get("deals") or []
    if not deals_list:
        return jsonify({"brief": "No deals to analyze yet — create a few alerts and check back."}), 200

    lines = []
    for d in deals_list[:15]:
        lines.append(
            f"- {str(d.get('title',''))[:70]} | {d.get('price_pln')} PLN | "
            f"{d.get('discount_pct')}% below market | {d.get('source')} | alert: {d.get('alert_name')}"
        )
    prompt = (
        "These are the top deals my engine just found (price normalized to PLN, "
        "% below the median for that item). Give a punchy flip-brief: 3-5 bullets "
        "on the best flips and why (rough resale value + margin + how fast it "
        "sells), and clearly flag any to SKIP. Be honest — protect my money.\n\n"
        + "\n".join(lines)
    )
    try:
        resp = _client().messages.create(
            model=ANTHROPIC_MODEL, max_tokens=900, system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        return jsonify({"brief": _text(resp)}), 200
    except Exception as e:
        logger.warning("deals-brief error: %s", e)
        return jsonify({"error": "AI request failed"}), 502
