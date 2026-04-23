import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Polityka prywatności</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Ostatnia aktualizacja: 23 kwietnia 2026</Text>

        <Section title="1. Administrator danych">
          <Text style={styles.p}>
            Administratorem Twoich danych osobowych jest <Strong>LootAlert</Strong>
            (dalej: „Administrator"), kontakt: <Strong>kontakt@lootalert.app</Strong>.
            {"\n\n"}
            Dane kontaktowe do spraw RODO: <Strong>privacy@lootalert.app</Strong>.
          </Text>
        </Section>

        <Section title="2. Jakie dane zbieramy">
          <Bullet>
            <Strong>Adres email</Strong> – wymagany do utworzenia konta i przesyłania kodu
            weryfikacyjnego oraz powiadomień o alertach.
          </Bullet>
          <Bullet>
            <Strong>Hasło</Strong> – przechowujemy wyłącznie w formie zahaszowanej (bcrypt); nie
            znamy i nie jesteśmy w stanie odzyskać Twojego hasła w formie czytelnej.
          </Bullet>
          <Bullet>
            <Strong>Token urządzenia (push token)</Strong> – identyfikator urządzenia niezbędny do
            wysyłania powiadomień push.
          </Bullet>
          <Bullet>
            <Strong>Parametry alertów</Strong> – słowa kluczowe, zakres cenowy, wybrane portale,
            filtry. Potrzebne wyłącznie do realizacji usługi.
          </Bullet>
          <Bullet>
            <Strong>Historia powiadomień</Strong> – jakie oferty trafiały do Twoich alertów
            (tytuł, cena, link, źródło, znacznik czasu) przez okres do 90 dni.
          </Bullet>
          <Bullet>
            <Strong>Dane płatnicze</Strong> – NIE przechowujemy danych karty. Płatności obsługuje
            <Strong> Stripe, Inc.</Strong>; my otrzymujemy tylko identyfikator subskrypcji.
          </Bullet>
          <Bullet>
            <Strong>Data rejestracji i logowań</Strong> – dla bezpieczeństwa konta i rate-limitu.
          </Bullet>
        </Section>

        <Section title="3. W jakim celu przetwarzamy dane">
          <Bullet>Świadczenie usługi LootAlert (monitoring i powiadomienia).</Bullet>
          <Bullet>Uwierzytelnianie i zabezpieczenie konta.</Bullet>
          <Bullet>Obsługa płatności (Stripe).</Bullet>
          <Bullet>Wysyłka powiadomień push i emaili serwisowych.</Bullet>
          <Bullet>Realizacja żądań RODO.</Bullet>
          <Bullet>Analiza błędów i wydajności aplikacji (w formie zanonimizowanej).</Bullet>
        </Section>

        <Section title="4. Podstawa prawna">
          <Text style={styles.p}>
            Przetwarzamy Twoje dane na podstawie:
          </Text>
          <Bullet>
            <Strong>art. 6 ust. 1 lit. b RODO</Strong> – wykonanie umowy o świadczenie usługi.
          </Bullet>
          <Bullet>
            <Strong>art. 6 ust. 1 lit. a RODO</Strong> – Twoja zgoda (np. na otrzymywanie
            powiadomień push).
          </Bullet>
          <Bullet>
            <Strong>art. 6 ust. 1 lit. f RODO</Strong> – prawnie uzasadniony interes Administratora
            (bezpieczeństwo, zapobieganie nadużyciom).
          </Bullet>
          <Bullet>
            <Strong>art. 6 ust. 1 lit. c RODO</Strong> – obowiązek prawny (np. podatkowy).
          </Bullet>
        </Section>

        <Section title="5. Komu przekazujemy dane">
          <Bullet>
            <Strong>Railway Corp.</Strong> (USA) – hosting backendu i bazy danych.
          </Bullet>
          <Bullet>
            <Strong>Resend, Inc.</Strong> (USA) – wysyłka maili transakcyjnych.
          </Bullet>
          <Bullet>
            <Strong>Stripe, Inc.</Strong> (USA) – obsługa płatności.
          </Bullet>
          <Bullet>
            <Strong>Expo (650 Industries, Inc.)</Strong> (USA) – dostarczenie powiadomień push.
          </Bullet>
          <Bullet>
            <Strong>OLX, Vinted, Allegro</Strong> – publiczne API do pobierania ofert (nie
            przekazujemy im Twoich danych osobowych).
          </Bullet>
          <Text style={styles.p}>
            Transfer do USA odbywa się na podstawie standardowych klauzul umownych (SCC) oraz
            ram EU-US Data Privacy Framework.
          </Text>
        </Section>

        <Section title="6. Jak długo przechowujemy dane">
          <Bullet>Dane konta – do czasu usunięcia konta przez użytkownika.</Bullet>
          <Bullet>Historia powiadomień – do 90 dni od utworzenia.</Bullet>
          <Bullet>Dane rozliczeniowe (Stripe) – 5 lat (obowiązek podatkowy).</Bullet>
          <Bullet>Logi systemowe – do 30 dni.</Bullet>
          <Bullet>Kody weryfikacyjne – 15 minut.</Bullet>
        </Section>

        <Section title="7. Twoje prawa">
          <Text style={styles.p}>Masz prawo do:</Text>
          <Bullet>dostępu do swoich danych i otrzymania ich kopii (art. 15 RODO);</Bullet>
          <Bullet>sprostowania nieprawidłowych danych (art. 16);</Bullet>
          <Bullet>usunięcia danych / „bycia zapomnianym" (art. 17);</Bullet>
          <Bullet>ograniczenia przetwarzania (art. 18);</Bullet>
          <Bullet>przenoszenia danych (art. 20);</Bullet>
          <Bullet>sprzeciwu wobec przetwarzania (art. 21);</Bullet>
          <Bullet>cofnięcia zgody w dowolnym momencie;</Bullet>
          <Bullet>
            wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (PUODO, ul. Stawki 2,
            00-193 Warszawa).
          </Bullet>
          <Text style={styles.p}>
            Aby skorzystać z prawa, napisz na <Strong>privacy@lootalert.app</Strong>. Odpowiemy
            w terminie do 30 dni.
          </Text>
        </Section>

        <Section title="8. Bezpieczeństwo">
          <Bullet>Hasła hashowane bcrypt z indywidualnym salt.</Bullet>
          <Bullet>Ruch szyfrowany TLS 1.2+.</Bullet>
          <Bullet>Tokeny JWT z krótkim czasem życia (7 dni).</Bullet>
          <Bullet>Rate-limiting logowań i rejestracji.</Bullet>
          <Bullet>Kopie zapasowe bazy danych.</Bullet>
        </Section>

        <Section title="9. Pliki cookies i analityka">
          <Text style={styles.p}>
            Aplikacja mobilna nie używa plików cookies w rozumieniu prawa telekomunikacyjnego.
            Korzystamy z lokalnego bezpiecznego magazynu (Expo SecureStore / iOS Keychain /
            Android Keystore) do przechowywania tokena sesji.
            {"\n\n"}
            Nie używamy zewnętrznych narzędzi analitycznych (Google Analytics, Facebook Pixel
            itp.).
          </Text>
        </Section>

        <Section title="10. Dzieci">
          <Text style={styles.p}>
            Usługa nie jest kierowana do dzieci poniżej 16 lat. Nie zbieramy świadomie danych
            osobowych dzieci. Jeśli dowiemy się, że dziecko poniżej 16 lat przekazało nam dane,
            niezwłocznie je usuniemy.
          </Text>
        </Section>

        <Section title="11. Zmiany polityki">
          <Text style={styles.p}>
            Zmiany niniejszej polityki opublikujemy w aplikacji i powiadomimy emailem. Dalsze
            korzystanie z usługi po wejściu zmian w życie oznacza ich akceptację.
          </Text>
        </Section>

        <Section title="12. Kontakt">
          <Text style={styles.p}>
            Pytania w sprawie prywatności: <Strong>privacy@lootalert.app</Strong>
            {"\n"}Ogólny kontakt: <Strong>kontakt@lootalert.app</Strong>
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: Colors.text, fontWeight: "700" }}>{children}</Text>;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  back: { padding: 4 },
  title: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  updated: { color: Colors.textFaint, fontSize: 12, marginBottom: 20 },
  h2: { color: Colors.violetLight, fontSize: 15, fontWeight: "700", marginBottom: 10 },
  p: { color: Colors.textMuted, fontSize: 14, lineHeight: 22 },
  bullet: { flexDirection: "row", gap: 8, marginBottom: 6, paddingLeft: 4 },
  bulletDot: { color: Colors.violetLight, fontSize: 14, lineHeight: 22 },
  bulletText: { flex: 1, color: Colors.textMuted, fontSize: 14, lineHeight: 22 },
});
