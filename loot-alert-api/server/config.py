import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
JWT_EXPIRE_HOURS = 24 * 7  # 7 days

EXPO_ACCESS_TOKEN = os.environ.get("EXPO_ACCESS_TOKEN", "")

def _clean_env(key: str, default: str = "") -> str:
    """Get env var and strip whitespace, newlines AND surrounding quotes."""
    val = os.environ.get(key, default)
    if not val:
        return default
    val = val.strip()
    # Drop matched surrounding quotes that Railway Raw Editor may keep literal
    if len(val) >= 2 and (
        (val[0] == '"' and val[-1] == '"') or (val[0] == "'" and val[-1] == "'")
    ):
        val = val[1:-1].strip()
    return val


STRIPE_SECRET_KEY = _clean_env("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = _clean_env("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICE_PREMIUM = _clean_env("STRIPE_PRICE_PREMIUM")
STRIPE_PRICE_PRO = _clean_env("STRIPE_PRICE_PRO")
STRIPE_PRICE_ELITE = _clean_env("STRIPE_PRICE_ELITE")
STRIPE_LINK_PRO = _clean_env("STRIPE_LINK_PRO")
STRIPE_LINK_ELITE = _clean_env("STRIPE_LINK_ELITE")

ALLEGRO_CLIENT_ID = os.environ.get("ALLEGRO_CLIENT_ID", "")
ALLEGRO_CLIENT_SECRET = os.environ.get("ALLEGRO_CLIENT_SECRET", "")
ALLEGRO_TOKEN_URL = "https://allegro.pl/auth/oauth/token"
ALLEGRO_API_BASE = "https://api.allegro.pl"

SCRAPER_API_KEY = _clean_env("SCRAPER_API_KEY")
SCRAPER_API_BASE = "http://api.scraperapi.com/"
# Vinted is a "protected domain" – ScraperAPI charges 10 credits per request
# and only succeeds with premium=true. Toggle once you upgrade ScraperAPI plan.
SCRAPER_API_PREMIUM = _clean_env("SCRAPER_API_PREMIUM", "false").lower() == "true"

RESEND_API_KEY = _clean_env("RESEND_API_KEY")
RESEND_FROM_EMAIL = _clean_env("RESEND_FROM_EMAIL", "LootAlert <onboarding@resend.dev>")

# When true, new users are auto-verified on registration without an email.
# Use during MVP / testing while no verified domain is set up in Resend.
DEV_AUTO_VERIFY = _clean_env("DEV_AUTO_VERIFY", "false").lower() == "true"

N8N_WEBHOOK_SECRET = _clean_env("N8N_WEBHOOK_SECRET", "lootalert-n8n-2026")

EBAY_APP_ID = _clean_env("EBAY_APP_ID")
EBAY_CERT_ID = _clean_env("EBAY_CERT_ID")
EBAY_OAUTH_TOKEN = _clean_env("EBAY_OAUTH_TOKEN")  # fallback when CERT_ID unavailable
EBAY_API_BASE = "https://api.ebay.com"
EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token"
# Default marketplaces – user can override per alert later
EBAY_DEFAULT_MARKETS = ["EBAY_US", "EBAY_GB", "EBAY_DE", "EBAY_PL"]

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")

FREE_ALERT_LIMIT = 3
FREE_POLL_INTERVAL_MINUTES = 5
PREMIUM_POLL_INTERVAL_MINUTES = 2

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0",
]
