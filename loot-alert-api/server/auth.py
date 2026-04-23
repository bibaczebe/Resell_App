import bcrypt
import jwt
import datetime
import smtplib
from email.mime.text import MIMEText
from flask import Blueprint, request, jsonify, current_app
from server.db import get_db
from server.config import SECRET_KEY, JWT_EXPIRE_HOURS, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS

auth_bp = Blueprint("auth", __name__)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def require_auth(f):
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing token"}), 401
        token = auth_header[7:]
        payload = decode_token(token)
        if payload is None:
            return jsonify({"error": "Invalid or expired token"}), 401
        request.user_id = payload["sub"]
        return f(*args, **kwargs)

    return decorated


def _send_verification_email(email: str, token: str):
    if not SMTP_USER:
        return
    try:
        base_url = current_app.config.get("BASE_URL", "https://api.lootalert.app")
        link = f"{base_url}/api/auth/verify?token={token}"
        msg = MIMEText(f"Verify your LootAlert account:\n\n{link}")
        msg["Subject"] = "Verify your LootAlert account"
        msg["From"] = SMTP_USER
        msg["To"] = email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
    except Exception:
        pass  # email is best-effort


@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or "@" not in email:
        return jsonify({"error": "Invalid email"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cur.fetchone():
        return jsonify({"error": "Email already registered"}), 409

    pw_hash = hash_password(password)
    cur.execute(
        "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id",
        (email, pw_hash),
    )
    user_id = cur.fetchone()["id"]
    db.commit()

    verify_token = create_token(user_id)
    _send_verification_email(email, verify_token)

    token = create_token(user_id)
    return jsonify({"token": token, "user_id": user_id}), 201


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id, password_hash, plan FROM users WHERE email = %s", (email,))
    user = cur.fetchone()

    if not user or not check_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_token(user["id"])
    return jsonify({"token": token, "user_id": user["id"], "plan": user["plan"]}), 200


@auth_bp.route("/api/auth/verify", methods=["GET"])
def verify_email():
    token = request.args.get("token", "")
    payload = decode_token(token)
    if not payload:
        return jsonify({"error": "Invalid or expired token"}), 400

    db = get_db()
    cur = db.cursor()
    cur.execute("UPDATE users SET is_verified = TRUE WHERE id = %s", (payload["sub"],))
    db.commit()
    return jsonify({"message": "Email verified"}), 200


@auth_bp.route("/api/auth/me", methods=["GET"])
@require_auth
def me():
    db = get_db()
    cur = db.cursor()
    cur.execute(
        "SELECT id, email, plan, is_verified, created_at FROM users WHERE id = %s",
        (request.user_id,),
    )
    user = cur.fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(dict(user)), 200
