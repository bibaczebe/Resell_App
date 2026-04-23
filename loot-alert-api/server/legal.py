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
<html lang="pl"><head><meta charset="utf-8"><title>Polityka prywatności – LootAlert</title>
<meta name="viewport" content="width=device-width, initial-scale=1">{_BASE_CSS}</head><body>
<h1>Polityka prywatności – LootAlert</h1>
<p class="updated">Ostatnia aktualizacja: 23 kwietnia 2026</p>

<h2>1. Administrator danych</h2>
<p>Administratorem Twoich danych osobowych jest <strong>LootAlert</strong>
(dalej: „Administrator"), kontakt: <strong>kontakt@lootalert.app</strong>.<br>
Sprawy RODO: <strong>privacy@lootalert.app</strong>.</p>

<h2>2. Jakie dane zbieramy</h2>
<ul>
<li><strong>Adres email</strong> – wymagany do utworzenia konta, wysyłki kodów weryfikacyjnych i powiadomień.</li>
<li><strong>Hasło</strong> – przechowujemy wyłącznie jako skrót bcrypt; nie znamy Twojego hasła.</li>
<li><strong>Token urządzenia (push token)</strong> – do wysyłki powiadomień push.</li>
<li><strong>Parametry alertów</strong> – słowa kluczowe, cena, portale, filtry – wyłącznie do realizacji usługi.</li>
<li><strong>Historia powiadomień</strong> – do 90 dni (tytuł, cena, link, źródło, znacznik czasu).</li>
<li><strong>Dane płatnicze</strong> – NIE przechowujemy kart. Obsługuje Stripe, Inc.</li>
<li><strong>Data rejestracji i logowań</strong> – dla bezpieczeństwa konta.</li>
</ul>

<h2>3. W jakim celu przetwarzamy dane</h2>
<ul>
<li>Świadczenie usługi (monitoring ofert i powiadomienia push).</li>
<li>Uwierzytelnianie i bezpieczeństwo.</li>
<li>Obsługa płatności (Stripe).</li>
<li>Wysyłka maili serwisowych.</li>
<li>Realizacja żądań RODO.</li>
</ul>

<h2>4. Podstawa prawna (RODO)</h2>
<ul>
<li>art. 6 ust. 1 lit. b – wykonanie umowy;</li>
<li>art. 6 ust. 1 lit. a – Twoja zgoda (push);</li>
<li>art. 6 ust. 1 lit. f – prawnie uzasadniony interes (bezpieczeństwo);</li>
<li>art. 6 ust. 1 lit. c – obowiązek prawny (podatki).</li>
</ul>

<h2>5. Komu przekazujemy dane (procesory)</h2>
<ul>
<li><strong>Railway Corp.</strong> (USA) – hosting.</li>
<li><strong>Resend, Inc.</strong> (USA) – maile transakcyjne.</li>
<li><strong>Stripe, Inc.</strong> (USA) – płatności.</li>
<li><strong>Expo (650 Industries, Inc.)</strong> (USA) – powiadomienia push.</li>
<li><strong>OLX / Vinted / Allegro</strong> – publiczne API (nie przekazujemy Twoich danych osobowych).</li>
</ul>
<p>Transfer do USA – standardowe klauzule umowne (SCC) + EU-US Data Privacy Framework.</p>

<h2>6. Jak długo przechowujemy dane</h2>
<ul>
<li>Dane konta – do usunięcia konta.</li>
<li>Historia powiadomień – 90 dni.</li>
<li>Dane rozliczeniowe – 5 lat.</li>
<li>Logi – 30 dni.</li>
<li>Kody weryfikacyjne – 15 minut.</li>
</ul>

<h2>7. Twoje prawa</h2>
<ul>
<li>dostęp do danych (art. 15 RODO);</li>
<li>sprostowanie (art. 16);</li>
<li>usunięcie / „prawo do bycia zapomnianym" (art. 17);</li>
<li>ograniczenie przetwarzania (art. 18);</li>
<li>przenoszenie (art. 20);</li>
<li>sprzeciw (art. 21);</li>
<li>cofnięcie zgody;</li>
<li>skarga do PUODO (ul. Stawki 2, 00-193 Warszawa).</li>
</ul>
<p>Kontakt: <strong>privacy@lootalert.app</strong> – odpowiedź w 30 dni.</p>

<h2>8. Bezpieczeństwo</h2>
<ul>
<li>Hasła bcrypt z salt.</li>
<li>TLS 1.2+.</li>
<li>JWT z TTL 7 dni.</li>
<li>Rate-limiting.</li>
<li>Regularne backupy.</li>
</ul>

<h2>9. Pliki cookies</h2>
<p>Aplikacja mobilna nie używa cookies. Lokalnie przechowujemy tylko token sesji w bezpiecznym magazynie systemu (iOS Keychain / Android Keystore).</p>

<h2>10. Dzieci</h2>
<p>Usługa nie jest kierowana do osób poniżej 16 roku życia.</p>

<h2>11. Zmiany polityki</h2>
<p>Zmiany opublikujemy w aplikacji i wyślemy emailem. Dalsze korzystanie po zmianie oznacza akceptację.</p>

<h2>12. Kontakt</h2>
<p>RODO: <strong>privacy@lootalert.app</strong><br>
Ogólny: <strong>kontakt@lootalert.app</strong></p>

<footer>LootAlert – Polska, 2026. Wszystkie prawa zastrzeżone.</footer>
</body></html>""",
        200,
        {"Content-Type": "text/html; charset=utf-8"},
    )


@legal_bp.route("/legal/terms", methods=["GET"])
@legal_bp.route("/legal/terms.html", methods=["GET"])
def terms():
    return (
        f"""<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><title>Regulamin – LootAlert</title>
<meta name="viewport" content="width=device-width, initial-scale=1">{_BASE_CSS}</head><body>
<h1>Regulamin – LootAlert</h1>
<p class="updated">Ostatnia aktualizacja: 23 kwietnia 2026</p>

<h2>1. Postanowienia ogólne</h2>
<p>Regulamin określa zasady świadczenia usług drogą elektroniczną w aplikacji <strong>LootAlert</strong>.
Usługodawca: <strong>LootAlert</strong>, <strong>kontakt@lootalert.app</strong>.</p>

<h2>2. Definicje</h2>
<ul>
<li><strong>Użytkownik</strong> – osoba fizyczna (min. 16 lat) korzystająca z Aplikacji.</li>
<li><strong>Alert</strong> – zestaw parametrów wyszukiwania ofert.</li>
<li><strong>Portale partnerskie</strong> – OLX, Vinted, Allegro i inne monitorowane serwisy.</li>
<li><strong>Plan Free / Pro / Elite</strong> – warianty Usługi.</li>
</ul>

<h2>3. Zakres Usługi</h2>
<p>LootAlert automatycznie monitoruje publiczne oferty z portali partnerskich i wysyła powiadomienia push.
Aplikacja <strong>nie pośredniczy</strong> w transakcjach.</p>

<h2>4. Rejestracja</h2>
<ul>
<li>Wymagany prawdziwy email + hasło min. 8 znaków.</li>
<li>Użytkownik odpowiada za bezpieczeństwo danych logowania.</li>
<li>Konto można usunąć w dowolnym momencie.</li>
</ul>

<h2>5. Plany i opłaty</h2>
<ul>
<li><strong>Free</strong> – 0 zł, 3 alerty, pollowanie 5 min.</li>
<li><strong>Pro</strong> – 9,99 zł/mies., bez limitu alertów, pollowanie 2 min.</li>
<li><strong>Elite</strong> – 19,99 zł/mies., pollowanie 60 s, priorytet.</li>
</ul>
<p>Subskrypcja odnawia się automatycznie. Płatności: Stripe. Ceny zawierają VAT.</p>

<h2>6. Prawo odstąpienia (konsumenci)</h2>
<p>Konsumentowi przysługuje prawo odstąpienia w terminie <strong>14 dni</strong>. Użytkownik wyraża zgodę
na rozpoczęcie Usługi przed upływem 14 dni, tracąc prawo odstąpienia w zakresie świadczenia już wykonanego
(art. 38 pkt 13 ustawy o prawach konsumenta). Niewykorzystana część miesiąca – proporcjonalny zwrot.</p>

<h2>7. Zakazy</h2>
<ul>
<li>Używanie niezgodne z prawem.</li>
<li>Zakłócanie działania Aplikacji.</li>
<li>Udostępnianie Konta osobom trzecim; wiele kont w celu obejścia limitów Free.</li>
<li>Tworzenie alertów na treści nielegalne.</li>
</ul>

<h2>8. Odpowiedzialność</h2>
<p>Usługodawca nie gwarantuje 100% dostępności, natychmiastowości powiadomień ani skutecznego zakupu.
Nie odpowiada za treść ofert z portali partnerskich ani za transakcje. Odpowiedzialność ograniczona do
kwoty opłaty za bieżący miesiąc.</p>

<h2>9. Reklamacje</h2>
<p>Składaj na <strong>kontakt@lootalert.app</strong>. Rozpatrzymy w 14 dni. Pozostaje platforma ODR,
Rzecznik Konsumentów, WIIH.</p>

<h2>10. Własność intelektualna</h2>
<p>Prawa do Aplikacji należą do Usługodawcy. Użytkownik otrzymuje niewyłączną licencję do użytku
osobistego. Znaki OLX, Vinted, Allegro – własność ich właścicieli (nominative fair use).</p>

<h2>11. Zmiany Regulaminu</h2>
<p>Zmiany z powiadomieniem emailem na 14 dni przed wejściem. Brak akceptacji – możliwość usunięcia
konta z proporcjonalnym zwrotem.</p>

<h2>12. Prawo właściwe</h2>
<p>Regulamin podlega prawu polskiemu. Sądy: właściwe miejscowo; w sprawach konsumenckich – sąd miejsca
zamieszkania konsumenta.</p>

<h2>13. Kontakt</h2>
<p><strong>kontakt@lootalert.app</strong> – ogólny<br>
<strong>privacy@lootalert.app</strong> – RODO</p>

<footer>LootAlert – Polska, 2026. Wszystkie prawa zastrzeżone.</footer>
</body></html>""",
        200,
        {"Content-Type": "text/html; charset=utf-8"},
    )
