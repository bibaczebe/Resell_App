import logging
from flask import Blueprint, request, jsonify
from exponent_server_sdk import (
    PushClient,
    PushMessage,
    PushServerError,
    DeviceNotRegisteredError,
    PushTicketError,
)
from server.db import get_db
from server.auth import require_auth

logger = logging.getLogger(__name__)
push_bp = Blueprint("push", __name__)

_EXPO_TOKEN_PREFIX = "ExponentPushToken["


def _is_valid_expo_token(token: str) -> bool:
    return token.startswith(_EXPO_TOKEN_PREFIX) or token.startswith("ExpoPushToken[")


@push_bp.route("/api/push/register", methods=["POST"])
@require_auth
def register_token():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    platform = (data.get("platform") or "").strip()

    if not token:
        return jsonify({"error": "token is required"}), 400
    if not _is_valid_expo_token(token):
        return jsonify({"error": "Invalid Expo push token format"}), 400

    db = get_db()
    cur = db.cursor()
    cur.execute(
        """INSERT INTO push_tokens (user_id, token, platform)
           VALUES (%s, %s, %s)
           ON CONFLICT (token) DO UPDATE
             SET user_id = EXCLUDED.user_id,
                 platform = EXCLUDED.platform""",
        (request.user_id, token, platform),
    )
    db.commit()
    logger.info("Push token registered for user %d [%s]", request.user_id, platform)
    return jsonify({"message": "Token registered"}), 200


@push_bp.route("/api/push/unregister", methods=["POST"])
@require_auth
def unregister_token():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    if not token:
        return jsonify({"error": "token is required"}), 400

    db = get_db()
    cur = db.cursor()
    cur.execute(
        "DELETE FROM push_tokens WHERE token = %s AND user_id = %s",
        (token, request.user_id),
    )
    db.commit()
    return jsonify({"message": "Token unregistered"}), 200


def send_push_notification(
    tokens: list[str],
    title: str,
    body: str,
    data: dict | None = None,
) -> list[str]:
    """
    Send push notifications via Expo push service.
    Returns list of dead/invalid tokens to be cleaned up from the database.
    """
    if not tokens:
        return []

    valid_tokens = [t for t in tokens if _is_valid_expo_token(t)]
    if not valid_tokens:
        logger.warning("send_push_notification called with no valid Expo tokens")
        return []

    messages = [
        PushMessage(
            to=token,
            title=title,
            body=body,
            data=data or {},
            sound="default",
            badge=1,
            channel_id="lootalert",  # Android notification channel
        )
        for token in valid_tokens
    ]

    dead_tokens: list[str] = []

    try:
        client = PushClient()
        responses = client.publish_multiple(messages)

        for token, response in zip(valid_tokens, responses):
            try:
                response.validate_response()
            except DeviceNotRegisteredError:
                logger.info("Dead push token removed: %s", token[:40])
                dead_tokens.append(token)
            except PushTicketError as e:
                logger.warning("Push ticket error for token %s: %s", token[:40], e)
            except Exception as e:
                logger.warning("Push response error: %s", e)

    except PushServerError as e:
        logger.error("Expo push server error: %s", e)
    except Exception as e:
        logger.error("Unexpected push error: %s", e)

    return dead_tokens


def get_user_tokens(db, user_id: int) -> list[str]:
    cur = db.cursor()
    cur.execute("SELECT token FROM push_tokens WHERE user_id = %s", (user_id,))
    return [r["token"] for r in cur.fetchall()]


def cleanup_dead_tokens(db, dead_tokens: list[str]) -> None:
    if not dead_tokens:
        return
    cur = db.cursor()
    cur.execute("DELETE FROM push_tokens WHERE token = ANY(%s)", (dead_tokens,))
    db.commit()
    logger.info("Cleaned up %d dead push tokens", len(dead_tokens))
