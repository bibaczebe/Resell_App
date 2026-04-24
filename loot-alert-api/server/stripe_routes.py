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
    """Create a Checkout Session tied to the logged-in user.
    Body: { plan: 'pro' | 'elite' }
    After payment, Stripe calls webhook AND user returns via deep link -> backend sync.
    """
    data = request.get_json(silent=True) or {}
    plan = (data.get("plan") or "pro").lower()

    if plan == "elite":
        price_id = STRIPE_PRICE_ELITE
    else:
        price_id = STRIPE_PRICE_PRO or STRIPE_PRICE_PREMIUM

    if not price_id:
        return jsonify({"error": "Price not configured for selected plan"}), 500

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT email, stripe_customer_id FROM users WHERE id = %s", (request.user_id,))
    user = cur.fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        customer_id = user["stripe_customer_id"]
        if not customer_id:
            customer = stripe.Customer.create(
                email=user["email"],
                metadata={"user_id": str(request.user_id)},
            )
            customer_id = customer.id
            cur.execute("UPDATE users SET stripe_customer_id = %s WHERE id = %s", (customer_id, request.user_id))
            db.commit()

        # Deep link back to the app so the mobile client can trigger /sync immediately
        app_scheme = data.get("return_scheme") or "lootalert://"

        session = stripe.checkout.Session.create(
            customer=customer_id,
            client_reference_id=str(request.user_id),
            payment_method_types=["card", "blik", "p24"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=f"{app_scheme}paid?plan={plan}",
            cancel_url=f"{app_scheme}pricing",
            metadata={"user_id": str(request.user_id), "plan": plan},
            subscription_data={
                "metadata": {"user_id": str(request.user_id), "plan": plan},
            },
            locale="pl",
        )
        return jsonify({"url": session.url}), 200
    except Exception as e:
        return jsonify({"error": str(e), "type": type(e).__name__}), 500


@stripe_bp.route("/api/stripe/webhook", methods=["POST"])
def webhook():
    payload = request.get_data()
    sig = request.headers.get("Stripe-Signature", "")

    # If no webhook secret configured, skip verification (dev mode)
    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
        except Exception as e:
            return jsonify({"error": f"Invalid signature: {e}"}), 400
    else:
        import json
        event = json.loads(payload)

    etype = event.get("type", "")
    obj = event.get("data", {}).get("object", {})

    if etype == "checkout.session.completed":
        _handle_checkout_completed(obj)
    elif etype in ("customer.subscription.created", "customer.subscription.updated"):
        _handle_sub_active(obj)
    elif etype in ("customer.subscription.deleted", "customer.subscription.paused"):
        _handle_sub_ended(obj)

    return jsonify({"received": True}), 200


def _plan_from_price(price_id: str) -> str:
    if price_id == STRIPE_PRICE_ELITE:
        return "elite"
    if price_id in (STRIPE_PRICE_PRO, STRIPE_PRICE_PREMIUM):
        return "pro"
    return "pro"


def _match_user(db, customer_id: str | None, email: str | None):
    """Find user by stripe_customer_id OR by email."""
    cur = db.cursor()
    if customer_id:
        cur.execute("SELECT id FROM users WHERE stripe_customer_id = %s", (customer_id,))
        row = cur.fetchone()
        if row:
            return row["id"]
    if email:
        cur.execute("SELECT id FROM users WHERE email = %s", (email.lower(),))
        row = cur.fetchone()
        if row:
            # Also save the customer_id for future events
            if customer_id:
                cur.execute(
                    "UPDATE users SET stripe_customer_id = %s WHERE id = %s",
                    (customer_id, row["id"]),
                )
                db.commit()
            return row["id"]
    return None


def _handle_checkout_completed(session):
    customer_id = session.get("customer")
    customer_email = (session.get("customer_details") or {}).get("email") or session.get("customer_email")
    subscription_id = session.get("subscription")

    # Try to extract price from line_items via subscription
    price_id = None
    try:
        if subscription_id:
            sub = stripe.Subscription.retrieve(subscription_id)
            items = sub.get("items", {}).get("data", [])
            if items:
                price_id = items[0].get("price", {}).get("id")
    except Exception:
        pass

    plan = _plan_from_price(price_id) if price_id else "pro"

    db = get_db()
    user_id = _match_user(db, customer_id, customer_email)
    if not user_id:
        return
    cur = db.cursor()
    cur.execute(
        """UPDATE users SET plan = %s, stripe_subscription_id = %s, stripe_customer_id = %s
           WHERE id = %s""",
        (plan, subscription_id, customer_id, user_id),
    )
    db.commit()


def _handle_sub_active(sub):
    customer_id = sub.get("customer")
    subscription_id = sub.get("id")
    items = sub.get("items", {}).get("data", [])
    price_id = items[0].get("price", {}).get("id") if items else None
    plan = _plan_from_price(price_id) if price_id else "pro"

    # Fetch email from Stripe Customer
    email = None
    try:
        if customer_id:
            customer = stripe.Customer.retrieve(customer_id)
            email = customer.get("email")
    except Exception:
        pass

    db = get_db()
    user_id = _match_user(db, customer_id, email)
    if not user_id:
        return
    cur = db.cursor()
    cur.execute(
        "UPDATE users SET plan = %s, stripe_subscription_id = %s WHERE id = %s",
        (plan, subscription_id, user_id),
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


@stripe_bp.route("/api/stripe/sync", methods=["POST"])
@require_auth
def sync_subscription():
    """Manually re-check Stripe for user's active subscription. Useful when webhook missed."""
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT email, stripe_customer_id FROM users WHERE id = %s", (request.user_id,))
    user = cur.fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        # Find customer by email if not stored yet
        customer_id = user["stripe_customer_id"]
        if not customer_id:
            customers = stripe.Customer.list(email=user["email"], limit=1).get("data", [])
            if customers:
                customer_id = customers[0].id
                cur.execute("UPDATE users SET stripe_customer_id = %s WHERE id = %s", (customer_id, request.user_id))
                db.commit()

        if not customer_id:
            return jsonify({"plan": "free", "message": "Brak subskrypcji"}), 200

        subs = stripe.Subscription.list(customer=customer_id, status="active", limit=1).get("data", [])
        if not subs:
            cur.execute("UPDATE users SET plan = 'free', stripe_subscription_id = NULL WHERE id = %s", (request.user_id,))
            db.commit()
            return jsonify({"plan": "free", "message": "Brak aktywnej subskrypcji"}), 200

        sub = subs[0]
        price_id = sub["items"]["data"][0]["price"]["id"]
        plan = _plan_from_price(price_id)
        cur.execute(
            "UPDATE users SET plan = %s, stripe_subscription_id = %s WHERE id = %s",
            (plan, sub["id"], request.user_id),
        )
        db.commit()
        return jsonify({"plan": plan, "subscription_id": sub["id"]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
