"""Telegram bot — the primary personal interface for Loot Alert.

No login, no subscription: it's a private tool. The first chat to /start claims
ownership; other chats are refused so nobody can burn the AI budget. Commands:
  /start           register + help
  /deals           top flip-worthy deals right now (shipping-adjusted)
  /check <item>    live market analysis + BUY/SKIP verdict (AI)
Heavy work runs in a background thread so the webhook returns instantly.
"""
import threading
import logging
import requests
from flask import Blueprint, request, jsonify
from server.config import TELEGRAM_BOT_TOKEN, APP_BASE_URL
from server.db import get_redis

logger = logging.getLogger(__name__)
telegram_bp = Blueprint("telegram", __name__)

API = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}" if TELEGRAM_BOT_TOKEN else None
CHATS_KEY = "telegram_chats"
OWNER_KEY = "telegram_owner"


def _send(chat_id, text: str):
    if not API:
        return
    try:
        requests.post(f"{API}/sendMessage",
                      json={"chat_id": chat_id, "text": text,
                            "parse_mode": "Markdown", "disable_web_page_preview": False},
                      timeout=15)
    except Exception as e:
        logger.warning("telegram send failed: %s", e)


def _owner():
    try:
        return get_redis().get(OWNER_KEY)
    except Exception:
        return None


def _claim_owner(chat_id) -> bool:
    """First chat to /start claims ownership. Returns True if this chat is owner."""
    try:
        r = get_redis()
        r.set(OWNER_KEY, str(chat_id), nx=True)
        r.sadd(CHATS_KEY, str(chat_id))
        return r.get(OWNER_KEY) == str(chat_id)
    except Exception:
        return True  # no redis: don't lock out


def all_chats() -> list:
    try:
        return list(get_redis().smembers(CHATS_KEY))
    except Exception:
        return []


def broadcast(text: str):
    for c in all_chats():
        _send(c, text)


def _deal_line(d: dict) -> str:
    prof = d.get("estimated_profit_pln")
    prof_s = f"+{round(prof)} zł" if prof is not None else "?"
    price = round(d.get("price_pln") or 0)
    resale = d.get("ai_resale_pln")
    resale_s = f" (sprzedasz ~{round(resale)} zł)" if resale else ""
    reason = d.get("ai_reason")
    reason_s = f"\n  💡 {reason}" if reason else ""
    return (f"• *{d.get('title','')[:65]}*\n"
            f"  kup {price} zł → ~{prof_s} zysk{resale_s} · "
            f"{str(d.get('source','')).upper()}{reason_s}\n  {d.get('url','')}")


def _send_top_deals(chat_id):
    from server.alerts import _curated_deals
    try:
        deals = _curated_deals()
    except Exception as e:
        logger.warning("telegram deals error: %s", e)
        deals = []
    try:
        from server.chat import ai_filter_deals
        deals = ai_filter_deals(deals)  # AI keeps only genuine, correctly-priced flips
    except Exception:
        pass
    if not deals:
        _send(chat_id, "Brak wartościowych flipów w tej chwili — sprawdź za chwilę.")
        return
    _send(chat_id, "🔥 *Najlepsze flipy teraz* (po odliczeniu dostawy):\n\n"
          + "\n\n".join(_deal_line(d) for d in deals[:10]))


def _send_verdict(chat_id, query: str):
    from server.chat import _converse
    try:
        reply = _converse([{"role": "user", "content":
                            f"Czy opłaca się kupić i odsprzedać: {query}? "
                            f"Uwzględnij koszt dostawy (~15 zł). Werdykt BUY/SKIP z marżą."}])
    except Exception as e:
        logger.warning("telegram verdict error: %s", e)
        reply = "AI niedostępne w tej chwili."
    _send(chat_id, reply or "Brak odpowiedzi.")


def _run_bg(target, *args):
    threading.Thread(target=target, args=args, daemon=True).start()


@telegram_bp.route("/api/telegram/webhook", methods=["POST"])
def webhook():
    upd = request.get_json(silent=True) or {}
    msg = upd.get("message") or upd.get("edited_message") or {}
    chat_id = (msg.get("chat") or {}).get("id")
    text = (msg.get("text") or "").strip()
    if not chat_id or not API:
        return jsonify({"ok": True})

    if text.startswith("/start"):
        is_owner = _claim_owner(chat_id)
        if is_owner:
            _send(chat_id, "👋 *Reselling Bot* aktywny!\n\nPodsyłam najlepsze flipy (po odjęciu dostawy) i oceniam okazje.\n\n*Komendy:*\n/deals — top okazje teraz\n/check <przedmiot> — werdykt AI BUY/SKIP\n\nZacznij od /deals")
        else:
            _send(chat_id, "To prywatny bot. 🔒")
        return jsonify({"ok": True})

    # All other commands: owner only (protects the AI budget).
    if str(chat_id) != (_owner() or str(chat_id)):
        _send(chat_id, "To prywatny bot. 🔒")
        return jsonify({"ok": True})

    if text.startswith("/deals"):
        _send(chat_id, "Skanuję rynek…")
        _run_bg(_send_top_deals, chat_id)
    elif text.startswith("/check"):
        q = text[len("/check"):].strip()
        if not q:
            _send(chat_id, "Podaj przedmiot, np. `/check the north face kurtka M`")
        else:
            _send(chat_id, "Analizuję rynek…")
            _run_bg(_send_verdict, chat_id, q)
    elif text.startswith("/help"):
        _send(chat_id, "*Komendy:*\n/deals — top okazje\n/check <przedmiot> — werdykt AI BUY/SKIP")
    else:
        _send(chat_id, "Nie rozumiem. Użyj /deals lub /check <przedmiot>")
    return jsonify({"ok": True})


def push_new_deals():
    """Scheduler job: broadcast NEW flip-worthy deals to the owner (deduped)."""
    if not API:
        return
    chats = all_chats()
    if not chats:
        return
    from server.alerts import _curated_deals
    try:
        deals = _curated_deals()
    except Exception:
        return
    # AI validation FIRST so we only ever mark/push genuine flips.
    try:
        from server.chat import ai_filter_deals
        deals = ai_filter_deals(deals)
    except Exception:
        pass
    if not deals:
        return
    try:
        r = get_redis()
    except Exception:
        return
    fresh = []
    for d in deals:
        key = f"tgseen:{d.get('source')}:{d.get('id')}"
        try:
            if r.set(key, "1", nx=True, ex=7 * 86400):  # 7-day dedup (fewer repeats)
                fresh.append(d)
        except Exception:
            pass
    for d in fresh[:6]:
        broadcast("🔥 *Nowy flip*\n\n" + _deal_line(d))


def setup_webhook():
    """Point Telegram at our webhook (called once on app startup)."""
    if not API:
        return
    try:
        requests.get(f"{API}/setWebhook",
                     params={"url": f"{APP_BASE_URL}/api/telegram/webhook",
                             "allowed_updates": '["message"]'},
                     timeout=10)
        logger.info("Telegram webhook set -> %s/api/telegram/webhook", APP_BASE_URL)
    except Exception as e:
        logger.warning("Telegram setWebhook failed: %s", e)
