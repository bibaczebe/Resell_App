import logging
import psycopg2
import psycopg2.extras
from apscheduler.schedulers.background import BackgroundScheduler
from server.config import (
    DATABASE_URL, FREE_POLL_INTERVAL_MINUTES, PREMIUM_POLL_INTERVAL_MINUTES
)
from server.scrapers import Listing
from server import matching
from server.fx import to_pln

logger = logging.getLogger(__name__)

# Max notifications to fire per alert per poll cycle. Anything above this stays
# un-marked so it is picked up on the next cycle rather than silently dropped.
MAX_NOTIFS_PER_CYCLE = 15

# How long a durable "seen" record is trusted in the Redis L1 cache (Postgres is
# the source of truth and is permanent). 7 days is long enough that a listing
# that stays live for a week is not re-notified.
SEEN_REDIS_TTL = 7 * 86400


def _get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def _claim_unseen(conn, redis_client, source: str, listing_id: str, alert_id: int) -> bool:
    """Atomically claim a (source, listing_id, alert_id) as newly seen.

    Returns True if this is the first time we've seen it (caller should notify),
    False if it was already recorded. Durable via the seen_listings table so a
    Redis restart/eviction can never cause re-notification spam; Redis is only a
    fast L1 in front of it.
    """
    redis_key = f"seen:{source}:{listing_id}:{alert_id}"

    # Fast path: L1 cache hit means we've definitely seen it.
    try:
        if redis_client and redis_client.exists(redis_key):
            return False
    except Exception as e:
        logger.debug("Redis seen-check failed (falling back to DB): %s", e)

    # Durable claim: INSERT wins the race; a conflict means someone already has it.
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO seen_listings (source, listing_id, alert_id)
           VALUES (%s, %s, %s)
           ON CONFLICT (source, listing_id, alert_id) DO NOTHING
           RETURNING id""",
        (source, listing_id, alert_id),
    )
    row = cur.fetchone()
    conn.commit()

    try:
        if redis_client:
            redis_client.set(redis_key, "1", ex=SEEN_REDIS_TTL)
    except Exception:
        pass

    return row is not None


def _release_seen(conn, redis_client, source: str, listing_id: str, alert_id: int) -> None:
    """Undo a claim when the notification could not be delivered, so the listing
    is retried on the next cycle instead of being lost for good."""
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM seen_listings WHERE source = %s AND listing_id = %s AND alert_id = %s",
            (source, listing_id, alert_id),
        )
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
    try:
        if redis_client:
            redis_client.delete(f"seen:{source}:{listing_id}:{alert_id}")
    except Exception:
        pass


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
    except Exception as e:
        logger.error("Scheduler: Redis unavailable, skipping cycle: %s", e)
        return

    try:
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute(
            """SELECT a.id, a.user_id, a.name, a.keywords, a.size, a.color,
                      a.max_price, a.min_price, a.sources, a.condition,
                      a.exclude_keywords, u.plan
               FROM alerts a
               JOIN users u ON u.id = a.user_id
               WHERE a.is_active = TRUE AND u.plan = ANY(%s)""",
            (list(plans),),
        )
        alerts = cur.fetchall()
    except Exception as e:
        logger.error("Scheduler DB error: %s", e)
        return

    from server.scrapers import olx, vinted, ebay, reverb, discogs

    # Allegro is intentionally excluded: the public /offers/listing API is
    # entitlement-gated (403) and low reselling value. Legacy alerts that still
    # list "allegro" as a source are simply skipped (scraper_map.get → None).
    scraper_map = {
        "olx": olx.search,
        "vinted": vinted.search,
        "ebay": ebay.search,
        "reverb": reverb.search,
        "discogs": discogs.search,
    }

    try:
        for alert in alerts:
            alert_id = alert["id"]
            try:
                _process_alert(
                    conn, redis_client, alert, scraper_map,
                    send_push_notification, get_user_tokens, cleanup_dead_tokens,
                )
            except Exception as e:
                logger.exception("Poll failed for alert %s: %s", alert_id, e)
                # Leave the connection usable for the remaining alerts.
                try:
                    conn.rollback()
                except Exception:
                    pass
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _process_alert(conn, redis_client, alert, scraper_map,
                   send_push_notification, get_user_tokens, cleanup_dead_tokens):
    alert_id = alert["id"]
    user_id = alert["user_id"]
    keywords = alert["keywords"]
    sources = alert["sources"] or ["olx", "vinted", "ebay"]
    exclude_keywords = alert.get("exclude_keywords")
    max_pln = float(alert["max_price"]) if alert["max_price"] else None
    min_pln = float(alert["min_price"]) if alert["min_price"] else 0

    lock_key = f"alert_poll:{alert_id}"
    try:
        if not redis_client.set(lock_key, "1", nx=True, ex=180):
            return  # already being polled by another worker/cycle
    except Exception as e:
        logger.warning("Redis lock failed for alert %s: %s", alert_id, e)
        return

    # 1) Collect all matching listings (no side effects yet).
    matched: list[tuple[str, Listing]] = []
    for source in sources:
        search_fn = scraper_map.get(source)
        if not search_fn:
            continue
        # Skip music-only sources (Reverb/Discogs) for non-music keywords.
        if not matching.source_allowed(source, keywords, sources):
            continue
        try:
            results = search_fn(
                keywords=keywords,
                max_price=alert["max_price"],
                min_price=alert["min_price"] or 0,
                condition=alert["condition"] or "any",
            )
        except Exception as e:
            logger.warning("Scraper %s error for alert %d: %s", source, alert_id, e)
            continue
        for listing in results:
            if not listing.id:
                continue
            if not matching.matches(listing.title, keywords, alert["color"],
                                    alert["size"], listing.size, exclude_keywords):
                continue
            # Currency-normalized price gate (alert bounds are PLN).
            price_pln = to_pln(listing.price, listing.currency)
            if price_pln is not None:
                if max_pln and price_pln > max_pln:
                    continue
                if min_pln and price_pln < min_pln:
                    continue
            matched.append((source, listing))

    if not matched:
        return

    # 2) Only claim/notify if there is somewhere to send. If the user has no
    #    push tokens we do NOT mark anything seen, so nothing is lost.
    tokens = get_user_tokens(conn, user_id)
    if not tokens:
        return

    sent = 0
    for source, listing in matched:
        if sent >= MAX_NOTIFS_PER_CYCLE:
            break
        # 3) Claim as unseen ONLY now — after the keyword filter passes and right
        #    before we push. Prevents marking-then-dropping.
        if not _claim_unseen(conn, redis_client, source, listing.id, alert_id):
            continue  # already notified previously

        currency = listing.currency or "PLN"
        price_str = f"{listing.price:.0f} {currency}" if listing.price else "no price"
        title = f"🔔 {alert['name']}"
        body = f"{listing.title} – {price_str} on {listing.source.upper()}"
        data = {
            "alert_id": alert_id,
            "listing_url": listing.url,
            "listing_id": listing.id,
            "source": listing.source,
        }
        try:
            dead = send_push_notification(tokens, title, body, data)
            cleanup_dead_tokens(conn, dead)
            _record_notification(conn, user_id, alert_id, listing)
            sent += 1
        except Exception as e:
            # Delivery failed — release the claim so we retry next cycle.
            logger.warning("Push/record failed for alert %s listing %s: %s",
                           alert_id, listing.id, e)
            try:
                conn.rollback()
            except Exception:
                pass
            _release_seen(conn, redis_client, source, listing.id, alert_id)


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
