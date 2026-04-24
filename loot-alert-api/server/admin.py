import os
import secrets
import datetime
import logging
import requests
from flask import Blueprint, request, jsonify
from server.db import get_db
from server.config import RESEND_API_KEY, SCRAPER_API_KEY, STRIPE_SECRET_KEY

logger = logging.getLogger(__name__)

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin").strip()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin56519562").strip()

admin_bp = Blueprint("admin", __name__)

# In-memory session tokens (OK for single-instance deployments)
_admin_sessions: dict[str, datetime.datetime] = {}
_SESSION_TTL = datetime.timedelta(hours=8)


def _is_valid_admin(token: str) -> bool:
    if not token:
        return False
    exp = _admin_sessions.get(token)
    if not exp:
        return False
    if datetime.datetime.utcnow() > exp:
        _admin_sessions.pop(token, None)
        return False
    return True


def require_admin(f):
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("X-Admin-Token", "")
        if not _is_valid_admin(token):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)

    return decorated


@admin_bp.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
        return jsonify({"error": "Invalid credentials"}), 401

    token = secrets.token_urlsafe(32)
    _admin_sessions[token] = datetime.datetime.utcnow() + _SESSION_TTL
    return jsonify({"token": token, "expires_in_hours": 8}), 200


@admin_bp.route("/api/admin/users", methods=["GET"])
@require_admin
def admin_users():
    db = get_db()
    cur = db.cursor()
    cur.execute(
        """SELECT u.id, u.email, u.plan, u.is_verified, u.stripe_customer_id,
                  u.stripe_subscription_id, u.created_at,
                  (SELECT COUNT(*) FROM alerts a WHERE a.user_id = u.id) AS alerts_count,
                  (SELECT COUNT(*) FROM alerts a WHERE a.user_id = u.id AND a.is_active = TRUE) AS active_alerts,
                  (SELECT COUNT(*) FROM notification_log n WHERE n.user_id = u.id) AS notifications_sent
           FROM users u ORDER BY u.created_at DESC"""
    )
    users = [dict(r) for r in cur.fetchall()]
    for u in users:
        if u.get("created_at"):
            u["created_at"] = u["created_at"].isoformat()
    return jsonify({"users": users, "total": len(users)}), 200


@admin_bp.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
@require_admin
def admin_delete_user(user_id: int):
    db = get_db()
    cur = db.cursor()
    cur.execute("DELETE FROM users WHERE id = %s RETURNING email", (user_id,))
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "User not found"}), 404
    db.commit()
    return jsonify({"message": f"Deleted {row['email']}"}), 200


@admin_bp.route("/api/admin/users/<int:user_id>/plan", methods=["PATCH"])
@require_admin
def admin_set_plan(user_id: int):
    data = request.get_json(silent=True) or {}
    plan = (data.get("plan") or "").lower()
    if plan not in ("free", "pro", "elite"):
        return jsonify({"error": "plan must be free|pro|elite"}), 400

    db = get_db()
    cur = db.cursor()
    cur.execute("UPDATE users SET plan = %s WHERE id = %s RETURNING email", (plan, user_id))
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "User not found"}), 404
    db.commit()
    return jsonify({"message": f"Plan set to {plan} for {row['email']}"}), 200


def _scraperapi_usage() -> dict:
    if not SCRAPER_API_KEY:
        return {"error": "SCRAPER_API_KEY not set"}
    try:
        r = requests.get(
            f"http://api.scraperapi.com/account?api_key={SCRAPER_API_KEY}",
            timeout=8,
        )
        if r.status_code != 200:
            return {"error": f"HTTP {r.status_code}: {r.text[:200]}"}
        d = r.json()
        return {
            "requests_used": d.get("requestCount"),
            "requests_limit": d.get("requestLimit"),
            "concurrent_limit": d.get("concurrencyLimit"),
            "subscription": d.get("subscriptionDate"),
        }
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


def _resend_usage() -> dict:
    if not RESEND_API_KEY:
        return {"error": "RESEND_API_KEY not set"}
    return {
        "configured": True,
        "note": "Resend free plan: 3000 emails/month, 100/day. Live usage not exposed via API.",
    }


def _stripe_balance() -> dict:
    if not STRIPE_SECRET_KEY:
        return {"error": "STRIPE_SECRET_KEY not set"}
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_SECRET_KEY
        b = stripe_lib.Balance.retrieve()
        available = sum(a.amount for a in b.available) / 100.0 if b.available else 0
        pending = sum(a.amount for a in b.pending) / 100.0 if b.pending else 0
        return {"available": available, "pending": pending, "livemode": b.livemode}
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


@admin_bp.route("/api/admin/stats", methods=["GET"])
@require_admin
def admin_stats():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT COUNT(*) AS c FROM users")
    users_total = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) AS c FROM users WHERE plan = 'pro'")
    users_pro = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) AS c FROM users WHERE plan = 'elite'")
    users_elite = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) AS c FROM users WHERE is_verified = TRUE")
    users_verified = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) AS c FROM alerts")
    alerts_total = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) AS c FROM alerts WHERE is_active = TRUE")
    alerts_active = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) AS c FROM notification_log")
    notifs_total = cur.fetchone()["c"]
    cur.execute(
        "SELECT COUNT(*) AS c FROM notification_log WHERE sent_at > NOW() - INTERVAL '24 hours'"
    )
    notifs_24h = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) AS c FROM push_tokens")
    push_tokens = cur.fetchone()["c"]

    return jsonify({
        "users": {
            "total": users_total,
            "verified": users_verified,
            "by_plan": {
                "free": users_total - users_pro - users_elite,
                "pro": users_pro,
                "elite": users_elite,
            },
        },
        "alerts": {"total": alerts_total, "active": alerts_active},
        "notifications": {"total": notifs_total, "last_24h": notifs_24h},
        "push_tokens": push_tokens,
        "external": {
            "scraperapi": _scraperapi_usage(),
            "resend": _resend_usage(),
            "stripe_balance": _stripe_balance(),
        },
    }), 200
