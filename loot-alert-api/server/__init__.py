import logging
import traceback
from flask import Flask, jsonify
from flask_cors import CORS

from server.config import SECRET_KEY, DATABASE_URL, REDIS_URL
from server.db import init_db, close_db

logging.basicConfig(level=logging.INFO)


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["BASE_URL"] = "https://api.lootalert.app"

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    app.teardown_appcontext(close_db)

    from server.auth import auth_bp
    from server.alerts import alerts_bp
    from server.push import push_bp
    from server.stripe_routes import stripe_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(alerts_bp)
    app.register_blueprint(push_bp)
    app.register_blueprint(stripe_bp)

    @app.route("/health")
    def health():
        return {"status": "ok"}, 200

    @app.route("/api/debug/status")
    def debug_status():
        """Returns JSON with env + DB connectivity check. Safe to expose."""
        status = {
            "has_database_url": bool(DATABASE_URL),
            "database_url_prefix": (DATABASE_URL[:25] + "...") if DATABASE_URL else None,
            "has_redis_url": bool(REDIS_URL),
            "redis_url_prefix": (REDIS_URL[:25] + "...") if REDIS_URL else None,
            "db_connect": None,
            "db_tables": None,
        }
        try:
            import psycopg2
            conn = psycopg2.connect(DATABASE_URL)
            cur = conn.cursor()
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
            tables = [r[0] for r in cur.fetchall()]
            status["db_connect"] = "ok"
            status["db_tables"] = tables
            cur.close()
            conn.close()
        except Exception as e:
            status["db_connect"] = f"error: {type(e).__name__}: {e}"
        return jsonify(status), 200

    @app.route("/api/debug/init-db", methods=["POST", "GET"])
    def debug_init_db():
        """Manually create tables if they don't exist."""
        try:
            init_db(app)
            return jsonify({"status": "ok", "message": "Tables created/verified"}), 200
        except Exception as e:
            return jsonify({"status": "error", "error": str(e), "trace": traceback.format_exc()}), 500

    @app.route("/api/debug/scrape", methods=["GET"])
    def debug_scrape():
        """Run a live scraper test for a query. Usage: /api/debug/scrape?q=Nike&max_price=150"""
        from flask import request as flask_req
        from server.scrapers import olx, vinted, allegro

        query = flask_req.args.get("q", "Nike Air Max")
        max_price = flask_req.args.get("max_price", type=float)

        results = {"query": query, "max_price": max_price, "sources": {}}
        for name, module in (("olx", olx), ("vinted", vinted), ("allegro", allegro)):
            try:
                items = module.search(keywords=query, max_price=max_price, limit=5)
                results["sources"][name] = {
                    "count": len(items),
                    "sample": [{"title": i.title, "price": i.price, "url": i.url, "id": i.id} for i in items[:3]],
                }
            except Exception as e:
                results["sources"][name] = {"error": f"{type(e).__name__}: {e}"}
        return jsonify(results), 200

    @app.route("/api/debug/poll-now", methods=["POST"])
    def debug_poll_now():
        """Force the scheduler to run the polling loop right now (for both plans)."""
        try:
            from server.scheduler import poll_free_alerts, poll_premium_alerts
            poll_free_alerts()
            poll_premium_alerts()
            return jsonify({"status": "ok", "message": "Polled"}), 200
        except Exception as e:
            return jsonify({"status": "error", "error": str(e), "trace": traceback.format_exc()}), 500

    @app.errorhandler(Exception)
    def json_error_handler(e):
        """Return JSON instead of HTML for any unhandled exception."""
        logging.exception("Unhandled exception in request")
        from werkzeug.exceptions import HTTPException
        if isinstance(e, HTTPException):
            return jsonify({"error": e.description, "code": e.code}), e.code
        return jsonify({
            "error": str(e),
            "type": type(e).__name__,
        }), 500

    with app.app_context():
        try:
            init_db(app)
            logging.info("DB tables initialized successfully")
        except Exception as e:
            logging.warning("DB init skipped (will retry on first request): %s", e)

    try:
        from server.scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        logging.warning("Scheduler start skipped: %s", e)

    return app
