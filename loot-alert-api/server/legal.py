from flask import Blueprint

legal_bp = Blueprint("legal", __name__)


_BASE_CSS = """
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  h2 { color: #7C3AED; font-size: 18px; margin-top: 32px; }
  p, li { color: #333; }
  .updated { color: #999; font-size: 13px; margin-bottom: 32px; }
  strong { color: #000; }
  ul { padding-left: 22px; }
  a { color: #7C3AED; }
  footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
</style>
"""


@legal_bp.route("/legal/privacy", methods=["GET"])
@legal_bp.route("/legal/privacy.html", methods=["GET"])
def privacy():
    return (
        f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Privacy Policy – LootAlert</title>
<meta name="viewport" content="width=device-width, initial-scale=1">{_BASE_CSS}</head><body>
<h1>Privacy Policy – LootAlert</h1>
<p class="updated">Last updated: April 25, 2026</p>

<h2>1. Data Controller</h2>
<p>The data controller is <strong>LootAlert</strong> ("Controller"), contact: <strong>contact@lootalert.app</strong>.<br>
GDPR matters: <strong>privacy@lootalert.app</strong>.</p>

<h2>2. Data we collect</h2>
<ul>
<li><strong>Email</strong> – needed to create an account, send verification codes, and deliver alerts.</li>
<li><strong>Password</strong> – stored only as a bcrypt hash; we never know your plaintext password.</li>
<li><strong>Push token</strong> – device identifier required for push notifications.</li>
<li><strong>Alert parameters</strong> – keywords, price, sources, filters – used solely for the service.</li>
<li><strong>Notification history</strong> – up to 90 days (title, price, link, source, timestamp).</li>
<li><strong>Payment data</strong> – we do NOT store cards. Handled by Stripe, Inc.</li>
<li><strong>Sign-up and login timestamps</strong> – for account security.</li>
</ul>

<h2>3. Why we process your data</h2>
<ul>
<li>Operating the service (monitoring listings + push notifications).</li>
<li>Authentication and security.</li>
<li>Payment processing (Stripe).</li>
<li>Sending transactional emails.</li>
<li>Handling GDPR requests.</li>
</ul>

<h2>4. Legal basis (GDPR)</h2>
<ul>
<li>Art. 6(1)(b) – performance of the service contract;</li>
<li>Art. 6(1)(a) – your consent (push);</li>
<li>Art. 6(1)(f) – legitimate interest (security);</li>
<li>Art. 6(1)(c) – legal obligation (taxes).</li>
</ul>

<h2>5. Who we share data with (processors)</h2>
<ul>
<li><strong>Railway Corp.</strong> (US) – hosting.</li>
<li><strong>Resend, Inc.</strong> (US) – transactional emails.</li>
<li><strong>Stripe, Inc.</strong> (US) – payments.</li>
<li><strong>Expo (650 Industries, Inc.)</strong> (US) – push notification delivery.</li>
<li><strong>OLX / Vinted / Allegro / eBay / Reverb / Discogs</strong> – public APIs (we do NOT share your personal data with them).</li>
</ul>
<p>US transfers rely on Standard Contractual Clauses (SCCs) and the EU–US Data Privacy Framework.</p>

<h2>6. How long we keep data</h2>
<ul>
<li>Account data – until account deletion.</li>
<li>Notification history – 90 days.</li>
<li>Billing records – 5 years.</li>
<li>System logs – 30 days.</li>
<li>Verification codes – 15 minutes.</li>
</ul>

<h2>7. Your rights</h2>
<ul>
<li>access (Art. 15 GDPR);</li>
<li>rectification (Art. 16);</li>
<li>erasure / "right to be forgotten" (Art. 17);</li>
<li>restriction of processing (Art. 18);</li>
<li>data portability (Art. 20);</li>
<li>objection (Art. 21);</li>
<li>withdrawal of consent;</li>
<li>complaint to the Polish PUODO (ul. Stawki 2, 00-193 Warsaw) or your local supervisory authority.</li>
</ul>
<p>Contact: <strong>privacy@lootalert.app</strong> – we respond within 30 days.</p>

<h2>8. Security</h2>
<ul>
<li>Passwords hashed with bcrypt + per-user salt.</li>
<li>TLS 1.2+.</li>
<li>JWT with 7-day TTL.</li>
<li>Rate limiting.</li>
<li>Regular database backups.</li>
</ul>

<h2>9. Cookies</h2>
<p>The mobile app does not use cookies. Locally we keep only a session token in the device's secure store (iOS Keychain / Android Keystore).</p>

<h2>10. Children</h2>
<p>The service is not directed at people under 16.</p>

<h2>11. Policy changes</h2>
<p>Updates will be published in the app and emailed to you. Continued use means acceptance.</p>

<h2>12. Contact</h2>
<p>GDPR: <strong>privacy@lootalert.app</strong><br>
General: <strong>contact@lootalert.app</strong></p>

<footer>LootAlert · 2026. All rights reserved.</footer>
</body></html>""",
        200,
        {"Content-Type": "text/html; charset=utf-8"},
    )


@legal_bp.route("/legal/terms", methods=["GET"])
@legal_bp.route("/legal/terms.html", methods=["GET"])
def terms():
    return (
        f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Terms of Service – LootAlert</title>
<meta name="viewport" content="width=device-width, initial-scale=1">{_BASE_CSS}</head><body>
<h1>Terms of Service – LootAlert</h1>
<p class="updated">Last updated: April 25, 2026</p>

<h2>1. General</h2>
<p>These Terms govern the electronic services provided in the <strong>LootAlert</strong> mobile app.
Provider: <strong>LootAlert</strong>, <strong>contact@lootalert.app</strong>.</p>

<h2>2. Definitions</h2>
<ul>
<li><strong>User</strong> – an individual at least 16 years old using the App.</li>
<li><strong>Alert</strong> – a set of search parameters.</li>
<li><strong>Partner marketplaces</strong> – OLX, eBay, Allegro, Reverb, Discogs, and other monitored services.</li>
<li><strong>Free / Pro / Elite</strong> – plan tiers.</li>
</ul>

<h2>3. Service scope</h2>
<p>LootAlert automatically monitors public listings on partner marketplaces and sends push notifications.
The App <strong>does not act as an intermediary</strong> in transactions.</p>

<h2>4. Sign-up</h2>
<ul>
<li>Real email + password (min. 8 characters) required.</li>
<li>Users are responsible for credential security.</li>
<li>Account can be deleted at any time.</li>
</ul>

<h2>5. Plans and pricing</h2>
<ul>
<li><strong>Free</strong> – PLN 0, 3 alerts (lifetime), 5-minute polling.</li>
<li><strong>Pro</strong> – PLN 9.99 / month, unlimited alerts, 2-minute polling.</li>
<li><strong>Elite</strong> – PLN 19.99 / month, 60-second polling, priority support.</li>
</ul>
<p>Subscriptions auto-renew. Payments via Stripe. Prices include VAT where applicable.</p>

<h2>6. Right of withdrawal (consumers)</h2>
<p>Consumers in the EU have a <strong>14-day right of withdrawal</strong>. By starting to use the Service before the 14-day period ends, the User waives the right of withdrawal for the part already performed (Polish Consumer Rights Act art. 38(13)). The unused portion of the month may be refunded pro rata.</p>

<h2>7. Prohibited use</h2>
<ul>
<li>Use that violates the law.</li>
<li>Interfering with the App.</li>
<li>Sharing the Account with third parties; multiple accounts to bypass Free limits.</li>
<li>Creating alerts for illegal content.</li>
</ul>

<h2>8. Liability</h2>
<p>The Provider does not guarantee 100% uptime, real-time delivery, or successful purchase. Not liable for partner-marketplace content or transactions. Liability capped at the amount paid for the current month.</p>

<h2>9. Complaints</h2>
<p>Submit to <strong>contact@lootalert.app</strong>. Reply within 14 days. Other options: EU ODR platform, Consumer Ombudsman, Trade Inspection mediation.</p>

<h2>10. Intellectual property</h2>
<p>Rights to the App belong to the Provider. User receives a non-exclusive license for personal use. Names of OLX, eBay, Allegro, etc. belong to their owners (nominative fair use).</p>

<h2>11. Changes to the Terms</h2>
<p>Notified by email 14 days in advance. If unaccepted – delete the Account with a pro-rata refund.</p>

<h2>12. Governing law</h2>
<p>Polish law. Jurisdiction: court of the Provider's seat; for consumers – the consumer's residence.</p>

<h2>13. Contact</h2>
<p><strong>contact@lootalert.app</strong> – general<br>
<strong>privacy@lootalert.app</strong> – GDPR</p>

<footer>LootAlert · 2026. All rights reserved.</footer>
</body></html>""",
        200,
        {"Content-Type": "text/html; charset=utf-8"},
    )
