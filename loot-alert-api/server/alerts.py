from flask import Blueprint, request, jsonify
from server.db import get_db
from server.auth import require_auth
from server.config import FREE_ALERT_LIMIT

alerts_bp = Blueprint("alerts", __name__)


def _get_user_plan(db, user_id: int) -> str:
    cur = db.cursor()
    cur.execute("SELECT plan FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone()
    return row["plan"] if row else "free"


@alerts_bp.route("/api/alerts", methods=["GET"])
@require_auth
def list_alerts():
    db = get_db()
    cur = db.cursor()
    cur.execute(
        """SELECT id, name, keywords, size, color, max_price, min_price,
                  sources, condition, is_active, trigger_count, last_triggered_at, created_at
           FROM alerts WHERE user_id = %s ORDER BY created_at DESC""",
        (request.user_id,),
    )
    rows = cur.fetchall()
    return jsonify([dict(r) for r in rows]), 200


@alerts_bp.route("/api/alerts", methods=["POST"])
@require_auth
def create_alert():
    db = get_db()
    plan = _get_user_plan(db, request.user_id)

    if plan == "free":
        cur = db.cursor()
        cur.execute(
            "SELECT COUNT(*) AS cnt FROM alerts WHERE user_id = %s AND is_active = TRUE",
            (request.user_id,),
        )
        count = cur.fetchone()["cnt"]
        if count >= FREE_ALERT_LIMIT:
            return jsonify({"error": f"Free plan allows max {FREE_ALERT_LIMIT} active alerts"}), 403

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    keywords = (data.get("keywords") or "").strip()
    if not name or not keywords:
        return jsonify({"error": "name and keywords are required"}), 400

    size = data.get("size")
    color = data.get("color")
    max_price = data.get("max_price")
    min_price = data.get("min_price", 0)
    sources = data.get("sources", ["olx", "vinted", "allegro"])
    condition = data.get("condition", "any")

    cur = db.cursor()
    cur.execute(
        """INSERT INTO alerts (user_id, name, keywords, size, color, max_price, min_price,
                               sources, condition)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
        (request.user_id, name, keywords, size, color, max_price, min_price, sources, condition),
    )
    alert_id = cur.fetchone()["id"]
    db.commit()
    return jsonify({"id": alert_id, "message": "Alert created"}), 201


@alerts_bp.route("/api/alerts/<int:alert_id>", methods=["GET"])
@require_auth
def get_alert(alert_id: int):
    db = get_db()
    cur = db.cursor()
    cur.execute(
        """SELECT id, name, keywords, size, color, max_price, min_price,
                  sources, condition, is_active, trigger_count, last_triggered_at, created_at
           FROM alerts WHERE id = %s AND user_id = %s""",
        (alert_id, request.user_id),
    )
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "Alert not found"}), 404
    return jsonify(dict(row)), 200


@alerts_bp.route("/api/alerts/<int:alert_id>", methods=["PATCH"])
@require_auth
def update_alert(alert_id: int):
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id FROM alerts WHERE id = %s AND user_id = %s", (alert_id, request.user_id))
    if not cur.fetchone():
        return jsonify({"error": "Alert not found"}), 404

    data = request.get_json(silent=True) or {}
    allowed = ["name", "keywords", "size", "color", "max_price", "min_price", "sources", "condition", "is_active"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [alert_id]
    cur.execute(f"UPDATE alerts SET {set_clause} WHERE id = %s", values)
    db.commit()
    return jsonify({"message": "Alert updated"}), 200


@alerts_bp.route("/api/alerts/<int:alert_id>", methods=["DELETE"])
@require_auth
def delete_alert(alert_id: int):
    db = get_db()
    cur = db.cursor()
    cur.execute("DELETE FROM alerts WHERE id = %s AND user_id = %s RETURNING id", (alert_id, request.user_id))
    if not cur.fetchone():
        return jsonify({"error": "Alert not found"}), 404
    db.commit()
    return jsonify({"message": "Alert deleted"}), 200


@alerts_bp.route("/api/alerts/<int:alert_id>/history", methods=["GET"])
@require_auth
def alert_history(alert_id: int):
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id FROM alerts WHERE id = %s AND user_id = %s", (alert_id, request.user_id))
    if not cur.fetchone():
        return jsonify({"error": "Alert not found"}), 404

    cur.execute(
        """SELECT listing_url, listing_title, listing_price, source, sent_at
           FROM notification_log WHERE alert_id = %s ORDER BY sent_at DESC LIMIT 50""",
        (alert_id,),
    )
    return jsonify([dict(r) for r in cur.fetchall()]), 200


@alerts_bp.route("/api/alerts/<int:alert_id>/current-matches", methods=["GET"])
@require_auth
def alert_current_matches(alert_id: int):
    """Fetch listings that currently match the alert (existing offers, not just new ones).
    Runs scrapers on-demand, returns combined + deduplicated results.
    """
    from server.scrapers import olx, vinted, allegro, ebay, reverb, discogs

    db = get_db()
    cur = db.cursor()
    cur.execute(
        """SELECT id, keywords, size, color, max_price, min_price, sources, condition
           FROM alerts WHERE id = %s AND user_id = %s""",
        (alert_id, request.user_id),
    )
    alert = cur.fetchone()
    if not alert:
        return jsonify({"error": "Alert not found"}), 404

    keywords = alert["keywords"]
    max_price = alert["max_price"]
    min_price = alert["min_price"] or 0
    condition = alert["condition"] or "any"
    sources = alert["sources"] or ["olx", "vinted", "allegro"]

    scraper_map = {
        "olx": olx.search,
        "vinted": vinted.search,
        "allegro": allegro.search,
        "ebay": ebay.search,
        "reverb": reverb.search,
        "discogs": discogs.search,
    }

    results = []
    for source in sources:
        search_fn = scraper_map.get(source)
        if not search_fn:
            continue
        try:
            items = search_fn(
                keywords=keywords,
                max_price=float(max_price) if max_price else None,
                min_price=float(min_price),
                condition=condition,
                limit=25,
            )
            for it in items:
                # filter by extra keyword (size field)
                if alert["size"] and alert["size"].lower() not in it.title.lower():
                    continue
                if alert["color"] and alert["color"].lower() not in it.title.lower():
                    continue
                results.append({
                    "id": it.id,
                    "title": it.title,
                    "price": it.price,
                    "url": it.url,
                    "image_url": it.image_url,
                    "source": it.source,
                })
        except Exception:
            pass

    # sort by price ascending (cheapest first)
    results.sort(key=lambda x: (x["price"] is None, x["price"] or 0))
    return jsonify({"matches": results, "count": len(results)}), 200
