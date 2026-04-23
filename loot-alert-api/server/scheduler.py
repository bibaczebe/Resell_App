import logging
import psycopg2
import psycopg2.extras
from apscheduler.schedulers.background import BackgroundScheduler
from server.config import (
    DATABASE_URL, FREE_POLL_INTERVAL_MINUTES, PREMIUM_POLL_INTERVAL_MINUTES
)
from server.scrapers import Listing
from server import scrapers

logger = logging.getLogger(__name__)


def _get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def _is_duplicate(conn, redis_client, source: str, listing_id: str, alert_id: int) -> bool:
    redis_key = f"seen:{source}:{listing_id}:{alert_id}"
    if redis_client.set(redis_key, "1", nx=True, ex=86400):  # 24h TTL
        return False
    return True


def _record_notification(conn, user_id: int, alert_id: int, listing: Listing):
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO notification_log (user_id, alert_id, listing_url, listing_title, listing_price, source)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (user_id, alert_id, listing.url, listing.title, listing.price, listing.source),
    )
    cur.execute(
        "UPDATE alerts SET trigger_count = trigger_count + 1, last_triggered_at = NOW() WHERE id = %s",
        (alert_id,),
    )
    conn.commit()


def _check_keyword_match(listing: Listing, keywords: str, color: str | None, size: str | None) -> bool:
    kw_lower = keywords.lower()
    title_lower = listing.title.lower()
    if not any(word in title_lower for word in kw_lower.split()):
        return False
    if color and color.lower() not in title_lower:
        return False
    if size and listing.size and size.lower() not in listing.size.lower():
        return False
    return True


def _poll_alerts(plan_filter: str):
    from server.db import get_redis
    from server.push import send_push_notification, get_user_tokens, cleanup_dead_tokens

    # Paid tiers share the faster cadence
    if plan_filter == "paid":
        plans = ("pro", "elite", "premium")
    else:
        plans = ("free",)

    try:
        redis_client = get_redis()
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute(
            """SELECT a.id, a.user_id, a.name, a.keywords, a.size, a.color,
                      a.max_price, a.min_price, a.sources, a.condition,
                      u.plan
               FROM alerts a
               JOIN users u ON u.id = a.user_id
               WHERE a.is_active = TRUE AND u.plan = ANY(%s)""",
            (list(plans),),
        )
        alerts = cur.fetchall()
    except Exception as e:
        logger.error("Scheduler DB error: %s", e)
        return

    from server.scrapers import olx, vinted, allegro

    scraper_map = {"olx": olx.search, "vinted": vinted.search, "allegro": allegro.search}

    for alert in alerts:
        alert_id = alert["id"]
        user_id = alert["user_id"]
        keywords = alert["keywords"]
        sources = alert["sources"] or ["olx", "vinted", "allegro"]

        lock_key = f"alert_poll:{alert_id}"
        if not redis_client.set(lock_key, "1", nx=True, ex=60):
            continue  # already being polled

        new_listings: list[Listing] = []

        for source in sources:
            search_fn = scraper_map.get(source)
            if not search_fn:
                continue
            try:
                results = search_fn(
                    keywords=keywords,
                    max_price=alert["max_price"],
                    min_price=alert["min_price"] or 0,
                    condition=alert["condition"] or "any",
                )
                for listing in results:
                    if not listing.id:
                        continue
                    if _is_duplicate(conn, redis_client, source, listing.id, alert_id):
                        continue
                    if not _check_keyword_match(listing, keywords, alert["color"], alert["size"]):
                        continue
                    new_listings.append(listing)
            except Exception as e:
                logger.warning("Scraper %s error for alert %d: %s", source, alert_id, e)

        if not new_listings:
            continue

        tokens = get_user_tokens(conn, user_id)
        if not tokens:
            continue

        for listing in new_listings[:5]:  # cap at 5 notifications per poll cycle per alert
            price_str = f"{listing.price:.0f} zł" if listing.price else "brak ceny"
            title = f"🔔 {alert['name']}"
            body = f"{listing.title} – {price_str} na {listing.source.upper()}"
            data = {
                "alert_id": alert_id,
                "listing_url": listing.url,
                "listing_id": listing.id,
                "source": listing.source,
            }
            dead = send_push_notification(tokens, title, body, data)
            cleanup_dead_tokens(conn, dead)
            _record_notification(conn, user_id, alert_id, listing)

    try:
        conn.close()
    except Exception:
        pass


def poll_free_alerts():
    _poll_alerts("free")


def poll_premium_alerts():
    _poll_alerts("paid")


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="Europe/Warsaw")
    scheduler.add_job(
        poll_premium_alerts,
        "interval",
        minutes=PREMIUM_POLL_INTERVAL_MINUTES,
        id="premium_poll",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        poll_free_alerts,
        "interval",
        minutes=FREE_POLL_INTERVAL_MINUTES,
        id="free_poll",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info("Scheduler started (free: %dmin, premium: %dmin)",
                FREE_POLL_INTERVAL_MINUTES, PREMIUM_POLL_INTERVAL_MINUTES)
    return scheduler
