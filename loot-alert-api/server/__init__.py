import logging
from flask import Flask
from flask_cors import CORS

from server.config import SECRET_KEY
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

    with app.app_context():
        try:
            init_db(app)
        except Exception as e:
            logging.warning("DB init skipped (no DATABASE_URL?): %s", e)

    from server.scheduler import start_scheduler
    start_scheduler()

    return app
