import stripe
from flask import Blueprint, request, jsonify, current_app
from server.db import get_db
from server.auth import require_auth
from server.config import (
    STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_PREMIUM, STRIPE_PRICE_PRO, STRIPE_PRICE_ELITE,
    STRIPE_LINK_PRO, STRIPE_LINK_ELITE,
)

stripe.api_key = STRIPE_SECRET_KEY

stripe_bp = Blueprint("stripe", __name__)


@stripe_bp.route("/api/stripe/plans", methods=["GET"])
def plans():
    """Return available subscription plans with direct Payment Links."""
    return jsonify({
        "pro": {
            "name": "Pro",
            "price": 9.99,
            "currency": "PLN",
            "period": "miesiąc",
            "features": [
                "Nieograniczone alerty",
                "Polling co 2 min (priorytet)",
                "Push notifications",
                "Wszystkie portale (OLX, Vinted, Allegro)",
            ],
            "payment_link": STRIPE_LINK_PRO,
            "price_id": STRIPE_PRICE_PRO or STRIPE_PRICE_PREMIUM,
        },
        "elite": {
            "name": "Elite",
            "price": 19.99,
            "currency": "PLN",
            "period": "miesiąc",
            "features": [
                "Wszystko z planu Pro",
                "Polling co 60 sekund",
                "Wielokanałowe powiadomienia",
                "Wczesny dostęp do nowych funkcji",
                "Wsparcie priorytetowe 24/7",
            ],
            "payment_link": STRIPE_LINK_ELITE,
            "price_id": STRIPE_PRICE_ELITE,
        },
    }), 200


@stripe_bp.route("/api/stripe/checkout", methods=["POST"])
@require_auth
def create_checkout():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT email, stripe_customer_id FROM users WHERE id = %s", (request.user_id,))
    user = cur.fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404

    customer_id = user["stripe_customer_id"]
    if not customer_id:
        customer = stripe.Customer.create(email=user["email"], metadata={"user_id": request.user_id})
        customer_id = customer.id
        cur.execute("UPDATE users SET stripe_customer_id = %s WHERE id = %s", (customer_id, request.user_id))
        db.commit()

    base_url = request.json.get("base_url", "https://lootalert.app")
    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": STRIPE_PRICE_PREMIUM, "quantity": 1}],
        mode="subscription",
        success_url=f"{base_url}/settings?upgraded=1",
        cancel_url=f"{base_url}/pricing",
        metadata={"user_id": str(request.user_id)},
    )
    return jsonify({"url": session.url}), 200


@stripe_bp.route("/api/stripe/webhook", methods=["POST"])
def webhook():
    payload = request.get_data()
    sig = request.headers.get("Stripe-Signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        return jsonify({"error": "Invalid signature"}), 400

    if event["type"] == "customer.subscription.created":
        _handle_sub_created(event["data"]["object"])
    elif event["type"] in ("customer.subscription.deleted", "customer.subscription.paused"):
        _handle_sub_ended(event["data"]["object"])

    return jsonify({"received": True}), 200


def _handle_sub_created(sub):
    customer_id = sub.get("customer")
    subscription_id = sub.get("id")
    if not customer_id:
        return
    db = get_db()
    cur = db.cursor()
    cur.execute(
        "UPDATE users SET plan = 'premium', stripe_subscription_id = %s WHERE stripe_customer_id = %s",
        (subscription_id, customer_id),
    )
    db.commit()


def _handle_sub_ended(sub):
    customer_id = sub.get("customer")
    if not customer_id:
        return
    db = get_db()
    cur = db.cursor()
    cur.execute(
        "UPDATE users SET plan = 'free', stripe_subscription_id = NULL WHERE stripe_customer_id = %s",
        (customer_id,),
    )
    db.commit()


@stripe_bp.route("/api/stripe/status", methods=["GET"])
@require_auth
def subscription_status():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT plan, stripe_subscription_id FROM users WHERE id = %s", (request.user_id,))
    user = cur.fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"plan": user["plan"], "subscription_id": user["stripe_subscription_id"]}), 200
