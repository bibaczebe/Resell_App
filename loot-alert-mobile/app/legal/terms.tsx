import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";

export default function TermsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Regulamin</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Ostatnia aktualizacja: 23 kwietnia 2026</Text>

        <Section title="1. Postanowienia ogólne">
          <Text style={styles.p}>
            Niniejszy regulamin określa zasady świadczenia usług drogą elektroniczną w ramach
            aplikacji mobilnej <Strong>LootAlert</Strong> (dalej: „Aplikacja" lub „Usługa").
            {"\n\n"}
            Usługodawcą jest <Strong>LootAlert</Strong>, kontakt: <Strong>kontakt@lootalert.app</Strong>
            (dalej: „Usługodawca").
            {"\n\n"}
            Regulamin jest udostępniany bezpłatnie przed zawarciem umowy w sposób umożliwiający
            jego pobranie, utrwalenie i wydrukowanie.
          </Text>
        </Section>

        <Section title="2. Definicje">
          <Bullet>
            <Strong>Użytkownik</Strong> – osoba fizyczna, która ukończyła 16 lat, korzystająca z
            Aplikacji.
          </Bullet>
          <Bullet>
            <Strong>Konto</Strong> – indywidualny rachunek Użytkownika chroniony hasłem.
          </Bullet>
          <Bullet>
            <Strong>Alert</Strong> – zdefiniowany przez Użytkownika zestaw parametrów wyszukiwania
            ofert na zewnętrznych portalach ogłoszeniowych.
          </Bullet>
          <Bullet>
            <Strong>Portale partnerskie</Strong> – OLX, Vinted, Allegro i inne serwisy, których
            publiczne API/strony są monitorowane przez Aplikację.
          </Bullet>
          <Bullet>
            <Strong>Plan Free / Pro / Elite</Strong> – warianty Usługi o różnej liczbie alertów i
            częstotliwości odświeżania.
          </Bullet>
        </Section>

        <Section title="3. Zakres Usługi">
          <Text style={styles.p}>
            LootAlert automatycznie monitoruje publiczne oferty z portali partnerskich pod kątem
            parametrów zdefiniowanych przez Użytkownika i przesyła natywne powiadomienia push,
            gdy pojawi się pasująca oferta.
            {"\n\n"}
            Aplikacja <Strong>nie pośredniczy</Strong> w transakcjach między Użytkownikiem a
            sprzedającym. Wszelkie zakupy, płatności i spory Użytkownik realizuje bezpośrednio na
            portalu, z którego pochodzi oferta.
          </Text>
        </Section>

        <Section title="4. Rejestracja i Konto">
          <Bullet>Do korzystania wymagane jest utworzenie Konta (email + hasło).</Bullet>
          <Bullet>
            Użytkownik zobowiązany jest podać prawdziwy adres email i utrzymywać jego aktualność.
          </Bullet>
          <Bullet>Minimalna długość hasła wynosi 8 znaków.</Bullet>
          <Bullet>
            Użytkownik odpowiada za bezpieczeństwo swoich danych logowania i nie udostępnia ich
            osobom trzecim.
          </Bullet>
          <Bullet>
            Użytkownik może w dowolnym momencie usunąć swoje Konto w ustawieniach lub pisząc na
            kontakt@lootalert.app.
          </Bullet>
        </Section>

        <Section title="5. Plany i opłaty">
          <Text style={styles.p}>
            <Strong>Plan Free</Strong> – bezpłatnie, do 3 aktywnych alertów, częstotliwość
            pollowania 5 minut.
            {"\n\n"}
            <Strong>Plan Pro – 9,99 zł/miesiąc</Strong> – nieograniczona liczba alertów,
            pollowanie co 2 minuty, priorytet.
            {"\n\n"}
            <Strong>Plan Elite – 19,99 zł/miesiąc</Strong> – wszystko z Pro + pollowanie co 60 s,
            wczesny dostęp do nowych funkcji, wsparcie priorytetowe.
            {"\n\n"}
            Subskrypcja odnawia się automatycznie co miesiąc, dopóki Użytkownik jej nie anuluje.
            Anulowania można dokonać w dowolnym momencie przez panel Stripe lub pisząc na
            kontakt@lootalert.app. Usługa będzie świadczona do końca opłaconego okresu.
            {"\n\n"}
            Płatności obsługuje <Strong>Stripe, Inc.</Strong> Ceny zawierają VAT (jeśli dotyczy).
          </Text>
        </Section>

        <Section title="6. Prawo odstąpienia (konsumenci)">
          <Text style={styles.p}>
            Konsumentowi przysługuje prawo odstąpienia od umowy w terminie{" "}
            <Strong>14 dni</Strong> bez podania przyczyny.
            {"\n\n"}
            <Strong>UWAGA:</Strong> Użytkownik wyraża zgodę na rozpoczęcie świadczenia Usługi
            przed upływem 14 dni, czym traci prawo odstąpienia w odniesieniu do usługi już
            wykonanej (art. 38 pkt 13 ustawy o prawach konsumenta). Dotyczy to aktywnych alertów
            i wysłanych powiadomień. Niewykonana część subskrypcji (pozostałe dni miesiąca) może
            być proporcjonalnie zwrócona.
            {"\n\n"}
            Odstąpienie należy zgłosić emailem na <Strong>kontakt@lootalert.app</Strong>.
          </Text>
        </Section>

        <Section title="7. Obowiązki i ograniczenia Użytkownika">
          <Text style={styles.p}>Użytkownik zobowiązuje się:</Text>
          <Bullet>nie używać Aplikacji do celów niezgodnych z prawem;</Bullet>
          <Bullet>nie zakłócać działania Aplikacji (DDoS, scraping naszego API);</Bullet>
          <Bullet>
            nie odsprzedawać, nie udostępniać dostępu do Konta osobom trzecim ani nie tworzyć
            wielu Kont w celu obejścia limitów Planu Free;
          </Bullet>
          <Bullet>
            nie tworzyć alertów na treści nielegalne, naruszające prawa autorskie, dobra osobiste
            lub dobre obyczaje;
          </Bullet>
          <Bullet>
            przestrzegać regulaminów portali partnerskich podczas kontaktu ze sprzedającymi.
          </Bullet>
        </Section>

        <Section title="8. Odpowiedzialność Usługodawcy">
          <Text style={styles.p}>
            Usługodawca dokłada należytej staranności, aby Aplikacja działała prawidłowo, ale{" "}
            <Strong>nie gwarantuje</Strong>:
          </Text>
          <Bullet>
            100% dostępności (portale partnerskie mogą czasowo blokować żądania lub zmieniać API);
          </Bullet>
          <Bullet>natychmiastowości powiadomień – polling odbywa się w interwałach;</Bullet>
          <Bullet>kompletności wyników – możemy przeoczyć oferty spoza scope scrapera;</Bullet>
          <Bullet>
            skuteczności zakupu – oferty znikają w sekundach, a Użytkownik konkuruje z innymi
            kupującymi bezpośrednio na portalu.
          </Bullet>
          <Text style={styles.p}>
            Usługodawca nie odpowiada za: treść i prawdziwość ogłoszeń na portalach partnerskich,
            jakość oferowanych produktów, transakcje ze sprzedającymi, utratę okazji w wyniku
            awarii technicznej.
            {"\n\n"}
            Odpowiedzialność Usługodawcy wobec Użytkownika ograniczona jest do kwoty opłaty
            uiszczonej za bieżący miesiąc (dla planów Pro/Elite).
          </Text>
        </Section>

        <Section title="9. Reklamacje">
          <Text style={styles.p}>
            Reklamacje dotyczące Usługi można składać emailem na{" "}
            <Strong>kontakt@lootalert.app</Strong>. Usługodawca rozpatrzy reklamację w terminie do
            14 dni.
            {"\n\n"}
            W razie nieuwzględnienia reklamacji Użytkownik może skorzystać z:
          </Text>
          <Bullet>platformy ODR (https://ec.europa.eu/consumers/odr);</Bullet>
          <Bullet>pomocy Powiatowego/Miejskiego Rzecznika Konsumentów;</Bullet>
          <Bullet>mediacji przed Wojewódzkim Inspektorem Inspekcji Handlowej.</Bullet>
        </Section>

        <Section title="10. Własność intelektualna">
          <Text style={styles.p}>
            Wszystkie prawa do Aplikacji, jej kodu, designu, logotypu i treści należą do
            Usługodawcy lub jego licencjodawców. Użytkownikowi udziela się niewyłącznej,
            nieprzenoszalnej licencji na korzystanie z Aplikacji wyłącznie do własnego użytku
            zgodnie z Regulaminem.
            {"\n\n"}
            Nazwy OLX, Vinted, Allegro oraz inne znaki towarowe należą do ich właścicieli i są
            używane wyłącznie w celach informacyjnych (nominative fair use).
          </Text>
        </Section>

        <Section title="11. Zmiany Regulaminu">
          <Text style={styles.p}>
            Usługodawca może zmienić Regulamin z ważnych przyczyn (zmiana prawa, zmiana funkcji,
            zmiana cennika). O zmianach Użytkownik zostanie powiadomiony emailem co najmniej
            14 dni przed wejściem zmian w życie. W razie braku akceptacji Użytkownik może usunąć
            Konto i otrzymać proporcjonalny zwrot niewykorzystanej subskrypcji.
          </Text>
        </Section>

        <Section title="12. Prawo właściwe i sąd">
          <Text style={styles.p}>
            Regulamin podlega prawu polskiemu. Spory rozstrzyga sąd właściwy miejscowo dla
            siedziby Usługodawcy, a w sprawach konsumenckich – sąd właściwy dla miejsca
            zamieszkania konsumenta.
            {"\n\n"}
            W zakresie nieuregulowanym stosuje się przepisy Kodeksu cywilnego, ustawy o prawach
            konsumenta oraz ustawy o świadczeniu usług drogą elektroniczną.
          </Text>
        </Section>

        <Section title="13. Kontakt">
          <Text style={styles.p}>
            Email: <Strong>kontakt@lootalert.app</Strong>
            {"\n"}Sprawy RODO: <Strong>privacy@lootalert.app</Strong>
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
