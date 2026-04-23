import bcrypt
import jwt
import datetime
import random
from flask import Blueprint, request, jsonify
from server.db import get_db
from server.config import SECRET_KEY, JWT_EXPIRE_HOURS
from server.emails import send_verification_code

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


def _generate_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def _create_verification(db, user_id: int, email: str) -> None:
    code = _generate_code()
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    cur = db.cursor()
    cur.execute(
        """INSERT INTO email_verifications (user_id, code, expires_at)
           VALUES (%s, %s, %s)""",
        (user_id, code, expires_at),
    )
    db.commit()
    send_verification_code(email, code)


@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or "@" not in email:
        return jsonify({"error": "Nieprawidłowy email"}), 400
    if len(password) < 8:
        return jsonify({"error": "Hasło musi mieć min. 8 znaków"}), 400

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cur.fetchone():
        return jsonify({"error": "Email już zarejestrowany"}), 409

    pw_hash = hash_password(password)
    cur.execute(
        "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id",
        (email, pw_hash),
    )
    user_id = cur.fetchone()["id"]
    db.commit()

    _create_verification(db, user_id, email)

    token = create_token(user_id)
    return jsonify({
        "token": token,
        "user_id": user_id,
        "requires_verification": True,
    }), 201


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    db = get_db()
    cur = db.cursor()
    cur.execute(
        "SELECT id, password_hash, plan, is_verified FROM users WHERE email = %s",
        (email,),
    )
    user = cur.fetchone()

    if not user or not check_password(password, user["password_hash"]):
        return jsonify({"error": "Nieprawidłowy email lub hasło"}), 401

    token = create_token(user["id"])
    return jsonify({
        "token": token,
        "user_id": user["id"],
        "plan": user["plan"],
        "is_verified": user["is_verified"],
    }), 200


@auth_bp.route("/api/auth/verify-code", methods=["POST"])
@require_auth
def verify_code():
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()

    if not code or len(code) != 6 or not code.isdigit():
        return jsonify({"error": "Podaj 6-cyfrowy kod"}), 400

    db = get_db()
    cur = db.cursor()
    cur.execute(
        """SELECT id, code, expires_at, attempts, consumed
           FROM email_verifications
           WHERE user_id = %s
           ORDER BY created_at DESC
           LIMIT 1""",
        (request.user_id,),
    )
    row = cur.fetchone()

    if not row:
        return jsonify({"error": "Brak aktywnego kodu. Poproś o nowy."}), 400
    if row["consumed"]:
        return jsonify({"error": "Kod już użyty. Poproś o nowy."}), 400
    if row["expires_at"] < datetime.datetime.utcnow():
        return jsonify({"error": "Kod wygasł. Poproś o nowy."}), 400
    if row["attempts"] >= 5:
        return jsonify({"error": "Za dużo prób. Poproś o nowy kod."}), 429

    cur.execute(
        "UPDATE email_verifications SET attempts = attempts + 1 WHERE id = %s",
        (row["id"],),
    )

    if row["code"] != code:
        db.commit()
        return jsonify({"error": "Nieprawidłowy kod"}), 400

    cur.execute("UPDATE email_verifications SET consumed = TRUE WHERE id = %s", (row["id"],))
    cur.execute("UPDATE users SET is_verified = TRUE WHERE id = %s", (request.user_id,))
    db.commit()

    return jsonify({"message": "Email zweryfikowany", "is_verified": True}), 200


@auth_bp.route("/api/auth/resend-code", methods=["POST"])
@require_auth
def resend_code():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT email, is_verified FROM users WHERE id = %s", (request.user_id,))
    user = cur.fetchone()
    if not user:
        return jsonify({"error": "Nie znaleziono użytkownika"}), 404
    if user["is_verified"]:
        return jsonify({"message": "Email już zweryfikowany"}), 200

    # Rate limit: max 1 code per 60s
    cur.execute(
        """SELECT created_at FROM email_verifications
           WHERE user_id = %s ORDER BY created_at DESC LIMIT 1""",
        (request.user_id,),
    )
    last = cur.fetchone()
    if last and (datetime.datetime.utcnow() - last["created_at"]).total_seconds() < 60:
        return jsonify({"error": "Poczekaj 60 sekund przed wysłaniem nowego kodu"}), 429

    _create_verification(db, request.user_id, user["email"])
    return jsonify({"message": "Nowy kod wysłany"}), 200


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
        return jsonify({"error": "Użytkownik nie znaleziony"}), 404
    return jsonify(dict(user)), 200
