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
    from server.legal import legal_bp
    from server.admin import admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(alerts_bp)
    app.register_blueprint(push_bp)
    app.register_blueprint(stripe_bp)
    app.register_blueprint(legal_bp)
    app.register_blueprint(admin_bp)

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
        """Run a live scraper test with verbose HTTP debug info."""
        from flask import request as flask_req
        import requests as rq
        from server.config import ALLEGRO_CLIENT_ID, ALLEGRO_CLIENT_SECRET, SCRAPER_API_KEY
        from server.scrapers import olx, vinted, allegro, random_headers

        query = flask_req.args.get("q", "Nike")
        max_price = flask_req.args.get("max_price", type=float)

        results = {
            "query": query,
            "max_price": max_price,
            "env": {
                "allegro_client_id_set": bool(ALLEGRO_CLIENT_ID),
                "allegro_client_secret_set": bool(ALLEGRO_CLIENT_SECRET),
                "scraper_api_key_set": bool(SCRAPER_API_KEY),
            },
            "sources": {},
            "raw_tests": {},
        }

        # Raw HTTP probes – minimal direct calls
        try:
            r = rq.get(
                "https://www.olx.pl/api/v1/offers/",
                params={"query": query, "limit": 3},
                headers=random_headers(),
                timeout=10,
            )
            results["raw_tests"]["olx"] = {
                "status": r.status_code,
                "body_prefix": r.text[:400],
            }
        except Exception as e:
            results["raw_tests"]["olx"] = {"error": f"{type(e).__name__}: {e}"}

        try:
            h = random_headers()
            h["Accept"] = "application/json"
            r = rq.get(
                "https://www.vinted.pl/api/v2/catalog/items",
                params={"search_text": query, "per_page": 3},
                headers=h,
                timeout=10,
            )
            results["raw_tests"]["vinted"] = {
                "status": r.status_code,
                "body_prefix": r.text[:400],
            }
        except Exception as e:
            results["raw_tests"]["vinted"] = {"error": f"{type(e).__name__}: {e}"}

        try:
            if ALLEGRO_CLIENT_ID and ALLEGRO_CLIENT_SECRET:
                t = rq.post(
                    "https://allegro.pl/auth/oauth/token",
                    data={"grant_type": "client_credentials"},
                    auth=(ALLEGRO_CLIENT_ID, ALLEGRO_CLIENT_SECRET),
                    timeout=10,
                )
                results["raw_tests"]["allegro_token"] = {
                    "status": t.status_code,
                    "body_prefix": t.text[:400],
                }
            else:
                results["raw_tests"]["allegro_token"] = {"skipped": "missing credentials"}
        except Exception as e:
            results["raw_tests"]["allegro_token"] = {"error": f"{type(e).__name__}: {e}"}

        for name, module in (("olx", olx), ("vinted", vinted), ("allegro", allegro)):
            try:
                items = module.search(keywords=query, max_price=max_price, limit=5)
                results["sources"][name] = {
                    "count": len(items),
                    "sample": [{"title": i.title, "price": i.price, "url": i.url, "id": i.id} for i in items[:3]],
                }
            except Exception as e:
                results["sources"][name] = {"error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()}

        return jsonify(results), 200

    @app.route("/api/debug/version", methods=["GET"])
    def debug_version():
        import os
        import inspect
        from server.scrapers import olx, vinted, allegro
        return jsonify({
            "olx_file": inspect.getfile(olx),
            "olx_size": os.path.getsize(inspect.getfile(olx)),
            "vinted_size": os.path.getsize(inspect.getfile(vinted)),
            "allegro_size": os.path.getsize(inspect.getfile(allegro)),
        }), 200

    @app.route("/api/debug/olx-step", methods=["GET"])
    def debug_olx_step():
        """Run OLX scraper step-by-step with verbose logging"""
        from flask import request as flask_req
        import requests as rq
        from server.scrapers import random_headers

        query = flask_req.args.get("q", "Nike")
        result = {"query": query, "steps": []}

        try:
            params = {"query": query, "limit": 5, "offset": 0}
            result["steps"].append({"step": "building_params", "params": params})

            resp = rq.get(
                "https://www.olx.pl/api/v1/offers/",
                params=params,
                headers=random_headers(),
                timeout=12,
            )
            result["steps"].append({"step": "http_response", "status": resp.status_code})

            resp.raise_for_status()
            data = resp.json()
            result["steps"].append({"step": "json_parsed", "keys": list(data.keys()), "data_len": len(data.get("data", []))})

            parsed = []
            for item in data.get("data", []):
                price_val = None
                for param in item.get("params", []):
                    if param.get("key") == "price":
                        value_obj = param.get("value", {})
                        price_val = {
                            "raw_value": value_obj.get("value"),
                            "arranged": value_obj.get("arranged"),
                            "label": value_obj.get("label"),
                        }
                parsed.append({
                    "id": item.get("id"),
                    "title": item.get("title"),
                    "price_param": price_val,
                })
            result["steps"].append({"step": "items_parsed", "items": parsed[:3]})
        except Exception as e:
            result["steps"].append({"step": "error", "error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()})

        return jsonify(result), 200

    @app.route("/api/debug/allegro-step", methods=["GET"])
    def debug_allegro_step():
        from flask import request as flask_req
        import requests as rq
        from server.config import ALLEGRO_CLIENT_ID, ALLEGRO_CLIENT_SECRET

        query = flask_req.args.get("q", "Nike")
        result = {"query": query, "steps": []}

        try:
            tok_resp = rq.post(
                "https://allegro.pl/auth/oauth/token",
                data={"grant_type": "client_credentials"},
                auth=(ALLEGRO_CLIENT_ID, ALLEGRO_CLIENT_SECRET),
                timeout=10,
            )
            result["steps"].append({"step": "token", "status": tok_resp.status_code})
            token = tok_resp.json().get("access_token")

            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.allegro.public.v1+json",
            }
            search_resp = rq.get(
                "https://api.allegro.pl/offers/listing",
                params={"phrase": query, "limit": 5},
                headers=headers,
                timeout=12,
            )
            result["steps"].append({
                "step": "search",
                "status": search_resp.status_code,
                "body_prefix": search_resp.text[:1500],
            })
        except Exception as e:
            result["steps"].append({"step": "error", "error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()})
        return jsonify(result), 200

    @app.route("/api/debug/stripe-key", methods=["GET"])
    def debug_stripe_key():
        from server.config import STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_ELITE, STRIPE_LINK_PRO, STRIPE_LINK_ELITE
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_SECRET_KEY

        key_info = {
            "set": bool(STRIPE_SECRET_KEY),
            "length": len(STRIPE_SECRET_KEY) if STRIPE_SECRET_KEY else 0,
            "prefix": STRIPE_SECRET_KEY[:12] if STRIPE_SECRET_KEY else None,
            "suffix": STRIPE_SECRET_KEY[-4:] if STRIPE_SECRET_KEY else None,
            "mode": "test" if STRIPE_SECRET_KEY.startswith("sk_test_") else ("live" if STRIPE_SECRET_KEY.startswith("sk_live_") else "unknown"),
        }
        api_test = None
        try:
            balance = stripe_lib.Balance.retrieve()
            api_test = {"ok": True, "account_livemode": balance.livemode}
        except Exception as e:
            api_test = {"ok": False, "error": f"{type(e).__name__}: {e}"}

        return jsonify({
            "key": key_info,
            "api_call": api_test,
            "price_pro_set": bool(STRIPE_PRICE_PRO),
            "price_elite_set": bool(STRIPE_PRICE_ELITE),
            "link_pro_set": bool(STRIPE_LINK_PRO),
            "link_elite_set": bool(STRIPE_LINK_ELITE),
        }), 200

    @app.route("/api/debug/email-test", methods=["GET"])
    def debug_email_test():
        """Send a test email via Resend. Usage: /api/debug/email-test?to=you@example.com"""
        from flask import request as flask_req
        from server.config import RESEND_API_KEY, RESEND_FROM_EMAIL
        from server.emails import send_verification_code

        if not RESEND_API_KEY:
            return jsonify({
                "status": "error",
                "error": "RESEND_API_KEY not set in Railway Variables",
                "hint": "Add RESEND_API_KEY=re_xxx in Railway → Variables",
            }), 200

        to = flask_req.args.get("to")
        if not to:
            return jsonify({
                "status": "error",
                "error": "Missing ?to=email parameter",
            }), 400

        try:
            import resend
            resend.api_key = RESEND_API_KEY
            resp = resend.Emails.send({
                "from": RESEND_FROM_EMAIL,
                "to": [to],
                "subject": "LootAlert – Test emaila",
                "html": "<h1>LootAlert works!</h1><p>Jeśli widzisz tego maila, Resend działa poprawnie.</p>",
            })
            return jsonify({
                "status": "ok",
                "from": RESEND_FROM_EMAIL,
                "to": to,
                "resend_id": resp.get("id") if isinstance(resp, dict) else str(resp),
                "key_prefix": RESEND_API_KEY[:8] + "...",
            }), 200
        except Exception as e:
            return jsonify({
                "status": "error",
                "error": str(e),
                "type": type(e).__name__,
                "key_prefix": RESEND_API_KEY[:8] + "..." if RESEND_API_KEY else None,
                "from": RESEND_FROM_EMAIL,
                "trace": traceback.format_exc(),
            }), 200

    @app.route("/api/debug/vinted-step", methods=["GET"])
    def debug_vinted_step():
        from flask import request as flask_req
        import requests as rq
        import urllib.parse
        from server.scrapers import random_headers
        from server.config import SCRAPER_API_KEY

        query = flask_req.args.get("q", "Nike")
        result = {"query": query, "scraper_api_set": bool(SCRAPER_API_KEY), "steps": []}

        try:
            target = f"https://www.vinted.pl/api/v2/catalog/items?search_text={urllib.parse.quote(query)}&per_page=3&order=newest_first"

            # Step 1: direct (will likely fail with 403)
            try:
                r1 = rq.get(target, headers={**random_headers(), "Accept": "application/json"}, timeout=10)
                result["steps"].append({"step": "direct", "status": r1.status_code, "body_prefix": r1.text[:300]})
            except Exception as e:
                result["steps"].append({"step": "direct", "error": str(e)})

            # Step 2: via ScraperAPI
            if SCRAPER_API_KEY:
                via = f"http://api.scraperapi.com/?api_key={SCRAPER_API_KEY}&url={urllib.parse.quote(target, safe='')}"
                try:
                    r2 = rq.get(via, headers={"Accept": "application/json"}, timeout=30)
                    result["steps"].append({"step": "scraperapi", "status": r2.status_code, "body_prefix": r2.text[:500]})
                except Exception as e:
                    result["steps"].append({"step": "scraperapi", "error": str(e)})
        except Exception as e:
            result["steps"].append({"step": "error", "error": f"{type(e).__name__}: {e}"})
        return jsonify(result), 200

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
