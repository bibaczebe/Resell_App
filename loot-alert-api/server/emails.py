import logging
import resend
from server.config import RESEND_API_KEY, RESEND_FROM_EMAIL

logger = logging.getLogger(__name__)

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def send_verification_code(to_email: str, code: str) -> bool:
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY missing – skipping email to %s", to_email)
        return False

    html = _verification_html(code)

    try:
        resend.Emails.send({
            "from": RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": f"Kod weryfikacyjny LootAlert: {code}",
            "html": html,
        })
        logger.info("Verification code sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("Resend send failed: %s", e)
        return False


def _verification_html(code: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0A0A0B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0B;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:40px 32px;">
          <tr>
            <td align="center">
              <div style="font-size:11px;font-weight:800;color:#A78BFA;letter-spacing:3px;margin-bottom:24px;">LOOTALERT</div>
              <h1 style="color:#F8F8F8;font-size:24px;font-weight:700;margin:0 0 8px 0;">Zweryfikuj swój email</h1>
              <p style="color:rgba(255,255,255,0.45);font-size:14px;line-height:20px;margin:0 0 32px 0;">
                Wpisz ten 6-cyfrowy kod w aplikacji, żeby aktywować konto i zacząć łapać okazje.
              </p>

              <div style="background:linear-gradient(135deg,rgba(124,58,237,0.2) 0%,rgba(217,70,239,0.15) 100%);border:1px solid rgba(124,58,237,0.4);border-radius:16px;padding:24px 20px;margin-bottom:32px;">
                <div style="font-size:36px;font-weight:800;color:#FFFFFF;letter-spacing:12px;font-family:'SF Mono','Menlo',monospace;">
                  {code}
                </div>
              </div>

              <p style="color:rgba(255,255,255,0.3);font-size:12px;line-height:18px;margin:0;">
                Kod jest ważny przez <strong style="color:rgba(255,255,255,0.6);">15 minut</strong>.<br>
                Jeśli to nie Ty zakładasz konto – po prostu zignoruj tego maila.
              </p>
            </td>
          </tr>
        </table>

        <p style="color:rgba(255,255,255,0.25);font-size:11px;margin-top:24px;">
          LootAlert · Monitoring okazji na Vinted, OLX, Allegro
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    """
