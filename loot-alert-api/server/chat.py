"""AI assistant for resellers (Claude) + an 'AI read' brief over top deals.
Premium-gated. Requires ANTHROPIC_API_KEY in the environment (set a rotated key
in Railway — never commit it)."""
import logging
from flask import Blueprint, request, jsonify
from server.db import get_db
from server.auth import require_auth
from server.config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL

logger = logging.getLogger(__name__)
chat_bp = Blueprint("chat", __name__)

SYSTEM = (
    "You are Loot Assistant, an AI copilot for resellers and flippers on Polish "
    "and EU marketplaces (OLX, Vinted, eBay, Reverb, Discogs). Help the user: "
    "judge whether a find is a good flip (buy low / sell high), estimate resale "
    "value and margin, write compelling listing titles and descriptions, price "
    "and negotiate, source inventory, and grow their buyer base. Be concrete and "
    "concise — give numbers, ranges, and ready-to-paste text when useful. Reply "
    "in the user's language (Polish or English). You are not a lawyer or financial "
    "advisor; keep advice practical."
)


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
        resp = _client().messages.create(
            model=ANTHROPIC_MODEL, max_tokens=1200, system=SYSTEM, messages=messages,
        )
        return jsonify({"reply": _text(resp)}), 200
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
        "These are the top deals my engine just found across marketplaces "
        "(price already normalized to PLN, % below the median for that item). "
        "Give me a punchy flip-brief: 3-5 bullets on the best flips and why "
        "(rough resale value + margin), and flag any to skip. Be concrete.\n\n"
        + "\n".join(lines)
    )
    try:
        resp = _client().messages.create(
            model=ANTHROPIC_MODEL, max_tokens=800, system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        return jsonify({"brief": _text(resp)}), 200
    except Exception as e:
        logger.warning("deals-brief error: %s", e)
        return jsonify({"error": "AI request failed"}), 502
