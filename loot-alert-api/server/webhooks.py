"""
Webhook endpoints for external scrapers (n8n, Zapier, Make.com).

Flow:
  1. User creates alert in LootAlert app.
  2. n8n workflow runs every N minutes, scrapes target site(s).
  3. n8n filters results by alert parameters it pulled from /api/webhook/alerts.
  4. n8n POSTs matched listings to /api/webhook/n8n/listings.
  5. Backend deduplicates via Redis, triggers push notifications.

Also hosts the eBay Marketplace Account Deletion compliance endpoint
(required to enable production keyset).
"""

import os
import hashlib
import logging
from flask import Blueprint, request, jsonify
from server.db import get_db, get_redis
from server.config import N8N_WEBHOOK_SECRET

logger = logging.getLogger(__name__)
webhooks_bp = Blueprint("webhooks", __name__)


def _verify_webhook(req) -> bool:
    supplied = req.headers.get("X-Webhook-Secret") or req.args.get("secret")
    return bool(supplied) and supplied == N8N_WEBHOOK_SECRET


@webhooks_bp.route("/api/webhook/alerts", methods=["GET"])
def list_active_alerts():
    """n8n pulls the list of active alerts to know what to scrape.
    Returns minimal fields needed for scraping."""
    if not _verify_webhook(request):
        return jsonify({"error": "Invalid secret"}), 401

    db = get_db()
    cur = db.cursor()
    cur.execute(
        """SELECT a.id, a.user_id, a.keywords, a.size, a.color,
                  a.max_price, a.min_price, a.sources, a.condition,
                  u.plan
           FROM alerts a
           JOIN users u ON u.id = a.user_id
           WHERE a.is_active = TRUE"""
    )
    rows = cur.fetchall()
    alerts = []
    for r in rows:
        alerts.append({
            "id": r["id"],
            "user_id": r["user_id"],
            "keywords": r["keywords"],
            "size": r["size"],
            "color": r["color"],
            "max_price": float(r["max_price"]) if r["max_price"] else None,
            "min_price": float(r["min_price"]) if r["min_price"] else 0,
            "sources": r["sources"] or [],
            "condition": r["condition"] or "any",
            "user_plan": r["plan"],
        })
    return jsonify({"alerts": alerts, "count": len(alerts)}), 200


@webhooks_bp.route("/api/webhook/n8n/listings", methods=["POST"])
def receive_listings():
    """n8n pushes matched listings here. Each listing is deduplicated and, if
    fresh, triggers a push notification to the alert owner.

    Body: {
      "alert_id": 123,
      "listings": [
        {"id": "1234", "title": "...", "price": 149, "url": "...", "image_url": "...", "source": "vinted"},
        ...
      ]
    }
    """
    if not _verify_webhook(request):
        return jsonify({"error": "Invalid secret"}), 401

    data = request.get_json(silent=True) or {}
    alert_id = data.get("alert_id")
    listings = data.get("listings") or []

    if not alert_id or not isinstance(listings, list):
        return jsonify({"error": "alert_id and listings[] required"}), 400

    db = get_db()
    cur = db.cursor()
    cur.execute(
        """SELECT a.id, a.user_id, a.name FROM alerts a
           WHERE a.id = %s AND a.is_active = TRUE""",
        (alert_id,),
    )
    alert = cur.fetchone()
    if not alert:
        return jsonify({"error": "Alert not found or inactive"}), 404

    redis_client = get_redis()
    from server.push import send_push_notification, get_user_tokens, cleanup_dead_tokens

    new_count = 0
    sent_count = 0
    tokens = get_user_tokens(db, alert["user_id"])

    for listing in listings[:20]:  # cap at 20 per call
        listing_id = str(listing.get("id") or "")
        source = str(listing.get("source") or "external")
        if not listing_id:
            continue

        # Dedup via Redis (24h TTL)
        key = f"seen:{source}:{listing_id}:{alert_id}"
        if not redis_client.set(key, "1", nx=True, ex=86400):
            continue  # already seen

        title = str(listing.get("title") or "").strip()
        price = listing.get("price")
        url = str(listing.get("url") or "")

        # Record notification
        cur.execute(
            """INSERT INTO notification_log
               (user_id, alert_id, listing_url, listing_title, listing_price, source)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (alert["user_id"], alert_id, url, title, price, source),
        )
        cur.execute(
            "UPDATE alerts SET trigger_count = trigger_count + 1, last_triggered_at = NOW() WHERE id = %s",
            (alert_id,),
        )
        new_count += 1

        # Send push
        if tokens:
            price_str = f"{float(price):.0f} zł" if price else "no price"
            push_title = f"🔔 {alert['name']}"
            push_body = f"{title[:80]} – {price_str} on {source.upper()}"
            dead = send_push_notification(
                tokens, push_title, push_body,
                {"alert_id": alert_id, "listing_url": url, "source": source, "listing_id": listing_id},
            )
            cleanup_dead_tokens(db, dead)
            sent_count += 1

    db.commit()

    return jsonify({
        "received": len(listings),
        "new": new_count,
        "notifications_sent": sent_count,
    }), 200


# ----------------------------------------------------------------------------
# eBay Marketplace Account Deletion / Closure Notifications
# Docs: https://developer.ebay.com/marketplace-account-deletion
#
# eBay calls our endpoint on TWO occasions:
# 1. Verification – GET with ?challenge_code=<code>. We must respond with JSON
#    {"challengeResponse": SHA256(challenge + verification_token + endpoint_url)}
#
# 2. Notification – POST with notification body when an eBay user deletes their
#    account. We must respond 200 within 3 seconds.
#
# The verification token is a 32-80 char string we choose; same value goes in
# the eBay developer portal.
# ----------------------------------------------------------------------------

EBAY_VERIFICATION_TOKEN = os.environ.get(
    "EBAY_VERIFICATION_TOKEN",
    "lootalert-ebay-deletion-2026-verification-token",
).strip()
EBAY_DELETION_ENDPOINT_URL = os.environ.get(
    "EBAY_DELETION_ENDPOINT_URL",
    "https://resellapp-production.up.railway.app/api/webhook/ebay/account-deletion",
).strip()


@webhooks_bp.route("/api/webhook/ebay/account-deletion", methods=["GET"])
def ebay_account_deletion_verify():
    challenge_code = request.args.get("challenge_code", "")
    if not challenge_code:
        return jsonify({"error": "missing challenge_code"}), 400

    m = hashlib.sha256()
    m.update(challenge_code.encode("utf-8"))
    m.update(EBAY_VERIFICATION_TOKEN.encode("utf-8"))
    m.update(EBAY_DELETION_ENDPOINT_URL.encode("utf-8"))
    challenge_response = m.hexdigest()

    logger.info("eBay deletion verification: code=%s", challenge_code[:8])
    return jsonify({"challengeResponse": challenge_response}), 200, {
        "Content-Type": "application/json",
    }


@webhooks_bp.route("/api/webhook/ebay/account-deletion", methods=["POST"])
def ebay_account_deletion_notify():
    """eBay sends a notification when one of THEIR users deletes their account.
    LootAlert does not store eBay user PII (we only fetch public listings),
    so we just acknowledge and log. Must respond 200 within 3 seconds.
    """
    payload = request.get_json(silent=True) or {}
    notification = payload.get("notification") or {}
    user_data = notification.get("data") or {}
    user_id = user_data.get("userId") or user_data.get("username")
    logger.info("eBay account deletion notification received for user=%s", user_id)
    # Optional: clean any cached eBay data here. We don't store any.
    return jsonify({"status": "acknowledged"}), 200


@webhooks_bp.route("/api/webhook/ebay/config", methods=["GET"])
def ebay_deletion_config():
    """Helper – returns the verification token + endpoint URL to paste into
    the eBay developer portal. Public on purpose – the token is non-secret.
    """
    return jsonify({
        "endpoint_url": EBAY_DELETION_ENDPOINT_URL,
        "verification_token": EBAY_VERIFICATION_TOKEN,
        "instructions": (
            "Paste endpoint_url into 'Marketplace account deletion notification "
            "endpoint' field, and verification_token into the verification token "
            "field, then click Save. eBay will call our endpoint with a "
            "challenge_code; we respond with SHA256(code + token + url)."
        ),
    }), 200
