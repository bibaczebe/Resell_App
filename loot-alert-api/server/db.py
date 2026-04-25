import psycopg2
import psycopg2.extras
import redis
from flask import g
from server.config import DATABASE_URL, REDIS_URL

_redis_client = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


def get_db():
    if "db" not in g:
        g.db = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        g.db.autocommit = False
    return g.db


def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db(app):
    with app.app_context():
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id                     SERIAL PRIMARY KEY,
                email                  VARCHAR(255) UNIQUE NOT NULL,
                password_hash          VARCHAR(255) NOT NULL,
                plan                   VARCHAR(20) DEFAULT 'free',
                stripe_customer_id     VARCHAR(100),
                stripe_subscription_id VARCHAR(100),
                is_verified            BOOLEAN DEFAULT FALSE,
                alerts_created_total   INTEGER DEFAULT 0,
                created_at             TIMESTAMP DEFAULT NOW()
            );

            -- Migration for existing DBs that don't have alerts_created_total yet
            DO $$
            BEGIN
                ALTER TABLE users ADD COLUMN IF NOT EXISTS alerts_created_total INTEGER DEFAULT 0;
            EXCEPTION WHEN OTHERS THEN NULL;
            END $$;

            CREATE TABLE IF NOT EXISTS push_tokens (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token      VARCHAR(255) UNIQUE NOT NULL,
                platform   VARCHAR(10),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id                SERIAL PRIMARY KEY,
                user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name              VARCHAR(255) NOT NULL,
                keywords          VARCHAR(500) NOT NULL,
                size              VARCHAR(50),
                color             VARCHAR(100),
                max_price         DECIMAL(10,2),
                min_price         DECIMAL(10,2) DEFAULT 0,
                sources           TEXT[] DEFAULT '{olx,vinted,allegro}',
                condition         VARCHAR(20) DEFAULT 'any',
                is_active         BOOLEAN DEFAULT TRUE,
                trigger_count     INTEGER DEFAULT 0,
                last_triggered_at TIMESTAMP,
                created_at        TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS seen_listings (
                id         SERIAL PRIMARY KEY,
                source     VARCHAR(20) NOT NULL,
                listing_id VARCHAR(100) NOT NULL,
                alert_id   INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
                seen_at    TIMESTAMP DEFAULT NOW(),
                UNIQUE(source, listing_id, alert_id)
            );

            CREATE INDEX IF NOT EXISTS idx_seen ON seen_listings(source, listing_id);

            CREATE TABLE IF NOT EXISTS notification_log (
                id            SERIAL PRIMARY KEY,
                user_id       INTEGER REFERENCES users(id),
                alert_id      INTEGER REFERENCES alerts(id),
                listing_url   TEXT NOT NULL,
                listing_title TEXT,
                listing_price DECIMAL(10,2),
                source        VARCHAR(20),
                sent_at       TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS email_verifications (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
                code        VARCHAR(6) NOT NULL,
                expires_at  TIMESTAMP NOT NULL,
                attempts    INTEGER DEFAULT 0,
                consumed    BOOLEAN DEFAULT FALSE,
                created_at  TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_verif_user ON email_verifications(user_id);
        """)
        conn.commit()
        cur.close()
        conn.close()
