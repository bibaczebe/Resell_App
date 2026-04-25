# iPhone build – krok po kroku

## Co dostaniesz
LootAlert jako natywna aplikacja na ekranie iPhone'a:
- **Ikona** "L" 3D fioletowa
- **Działa w tle** – push notifications nawet gdy app zamknięta
- **Bez Expo Go** – samodzielna aplikacja
- **TestFlight** lub **Ad-hoc install** – do publikacji w App Store potrzeba dodatkowego review

## Wymagania
- **Apple Developer Program** – $99/rok (https://developer.apple.com/programs/)
- **Konto Expo** – darmowe (https://expo.dev/signup)
- **Twój iPhone** + komputer z internetem

## Krok 1 – Apple Developer
1. Wejdź na https://developer.apple.com/programs/enroll/
2. Zaloguj swoim Apple ID (tym co masz na iPhonie)
3. Indywidualny program: $99/rok
4. Po opłaceniu (do 24h aktywacja, zwykle 5-30 min) dostaniesz dostęp do **Apple Developer Portal**

## Krok 2 – Expo CLI + login
W PowerShell / Cmd:

```bash
npm install -g eas-cli
cd "c:\Users\bibac\OneDrive\Reseling_App\loot-alert-mobile"
eas login
```

Wpisz email + hasło do konta Expo (lub utwórz nowe).

## Krok 3 – Connect Apple account

```bash
eas credentials
```

Wybierz:
1. Platform: **iOS**
2. Profile: **preview**
3. Action: **Set up everything**

EAS poprosi o Apple ID i hasło. Wpisz dane Apple Developer.

EAS automatycznie:
- Stworzy App ID (bundle: `com.lootalert.app`) w Apple Portal
- Wygeneruje Distribution Certificate
- Wygeneruje Provisioning Profile
- Zarejestruje Twój iPhone (poprosi o UDID lub może wykryć przez TestFlight)

## Krok 4 – Build

```bash
eas build --profile preview --platform ios
```

Co się dzieje:
- ~5 min: upload kodu źródłowego
- ~15-20 min: kompilacja na serwerach Apple
- Dostaniesz link do `.ipa` (np. `https://expo.dev/.../build/abc123`)

## Krok 5 – Instalacja na iPhone

**Opcja A – TestFlight (zalecane):**
1. `eas submit --profile preview --platform ios`
2. EAS wyśle build do TestFlight
3. Na iPhonie zainstaluj **TestFlight** z App Store
4. Po review (~5-15 min) dostaniesz link → otwórz na iPhonie → **Install**

**Opcja B – Direct install (Ad-hoc):**
1. Otwórz link `.ipa` z poprzedniego kroku w Safari na iPhonie
2. **Settings → General → VPN & Device Management → trust developer profile**
3. Aplikacja się zainstaluje

## Krok 6 – Push tokens

Po zainstalowaniu apki:
1. Otwórz LootAlert
2. Settings → Push notifications **ON** → przyznaj uprawnienia iOS
3. Token zarejestruje się automatycznie w Twoim koncie LootAlert
4. Settings → "Send test notification" → powinieneś dostać push

## Najczęstsze problemy

| Błąd | Rozwiązanie |
|------|-------------|
| `No bundle identifier` | Sprawdź `app.json` → `ios.bundleIdentifier: "com.lootalert.app"` (mamy) |
| `No matching provisioning profile` | `eas credentials → reset → set up everything` |
| Push nie działa po instalacji | Sprawdź czy w app.json `expo-notifications` plugin jest aktywny (mamy) |
| `Cannot install (untrusted developer)` | Settings → General → VPN & Device Management → Trust |

## Update aplikacji bez nowego buildu

Większość zmian (TypeScript, JSX, style) możesz wysłać jako **OTA update** bez rebuildu:

```bash
eas update --branch preview
```

App pobierze najnowszą wersję przy następnym otwarciu (dosłownie sekundy).

OTA NIE działa dla:
- Zmian w `app.json` (ikona, plugins, permissions)
- Zmian native modules (np. dodanie nowej biblioteki z native code)
- Zmian w eas.json

W tych przypadkach trzeba zrobić nowy build.
