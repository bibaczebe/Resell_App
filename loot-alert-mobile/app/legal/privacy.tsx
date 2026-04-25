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
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Last updated: April 25, 2026</Text>

        <Section title="1. Data Controller">
          <Text style={styles.p}>
            The data controller is <Strong>LootAlert</Strong> ("Controller").
            Contact: <Strong>contact@lootalert.app</Strong>.
            {"\n\n"}
            GDPR matters: <Strong>privacy@lootalert.app</Strong>.
          </Text>
        </Section>

        <Section title="2. Data we collect">
          <Bullet>
            <Strong>Email address</Strong> – needed to create an account, send verification codes, and deliver alerts.
          </Bullet>
          <Bullet>
            <Strong>Password</Strong> – stored as a bcrypt hash only; we never know or can recover your plaintext password.
          </Bullet>
          <Bullet>
            <Strong>Push token</Strong> – device identifier required to send push notifications.
          </Bullet>
          <Bullet>
            <Strong>Alert parameters</Strong> – keywords, price range, sources, filters. Used solely to operate the service.
          </Bullet>
          <Bullet>
            <Strong>Notification history</Strong> – which listings triggered your alerts (title, price, link, source, timestamp), kept up to 90 days.
          </Bullet>
          <Bullet>
            <Strong>Payment data</Strong> – we do NOT store card data. Payments are handled by <Strong>Stripe, Inc.</Strong>; we only receive a subscription identifier.
          </Bullet>
          <Bullet>
            <Strong>Sign-up and login timestamps</Strong> – for account security and rate limiting.
          </Bullet>
        </Section>

        <Section title="3. Why we process your data">
          <Bullet>Operating LootAlert (monitoring and notifications).</Bullet>
          <Bullet>Authentication and account security.</Bullet>
          <Bullet>Payment processing (Stripe).</Bullet>
          <Bullet>Sending push notifications and transactional emails.</Bullet>
          <Bullet>Handling GDPR requests.</Bullet>
          <Bullet>Anonymous error and performance analysis.</Bullet>
        </Section>

        <Section title="4. Legal basis">
          <Text style={styles.p}>We process your data based on:</Text>
          <Bullet>
            <Strong>Art. 6(1)(b) GDPR</Strong> – performance of the service contract.
          </Bullet>
          <Bullet>
            <Strong>Art. 6(1)(a) GDPR</Strong> – your consent (e.g. push notifications).
          </Bullet>
          <Bullet>
            <Strong>Art. 6(1)(f) GDPR</Strong> – legitimate interest (security, fraud prevention).
          </Bullet>
          <Bullet>
            <Strong>Art. 6(1)(c) GDPR</Strong> – legal obligation (e.g. tax records).
          </Bullet>
        </Section>

        <Section title="5. Who we share data with">
          <Bullet>
            <Strong>Railway Corp.</Strong> (US) – backend and database hosting.
          </Bullet>
          <Bullet>
            <Strong>Resend, Inc.</Strong> (US) – transactional emails.
          </Bullet>
          <Bullet>
            <Strong>Stripe, Inc.</Strong> (US) – payment processing.
          </Bullet>
          <Bullet>
            <Strong>Expo (650 Industries, Inc.)</Strong> (US) – push notification delivery.
          </Bullet>
          <Bullet>
            <Strong>OLX, Vinted, Allegro, eBay, Reverb, Discogs</Strong> – public APIs we read for listing data (we do NOT share your personal data with them).
          </Bullet>
          <Text style={styles.p}>
            Transfers to the US rely on Standard Contractual Clauses (SCCs) and the EU–US Data Privacy Framework.
          </Text>
        </Section>

        <Section title="6. How long we keep data">
          <Bullet>Account data – until you delete your account.</Bullet>
          <Bullet>Notification history – up to 90 days.</Bullet>
          <Bullet>Billing records (Stripe) – 5 years (tax law).</Bullet>
          <Bullet>System logs – up to 30 days.</Bullet>
          <Bullet>Verification codes – 15 minutes.</Bullet>
        </Section>

        <Section title="7. Your rights">
          <Text style={styles.p}>You have the right to:</Text>
          <Bullet>access your data and obtain a copy (Art. 15 GDPR);</Bullet>
          <Bullet>rectify inaccurate data (Art. 16);</Bullet>
          <Bullet>erase your data – the "right to be forgotten" (Art. 17);</Bullet>
          <Bullet>restrict processing (Art. 18);</Bullet>
          <Bullet>data portability (Art. 20);</Bullet>
          <Bullet>object to processing (Art. 21);</Bullet>
          <Bullet>withdraw consent at any time;</Bullet>
          <Bullet>
            lodge a complaint with the President of the Personal Data Protection Office (PUODO, ul. Stawki 2, 00-193 Warsaw, Poland) or your local supervisory authority.
          </Bullet>
          <Text style={styles.p}>
            To exercise any of these rights, email <Strong>privacy@lootalert.app</Strong>. We respond within 30 days.
          </Text>
        </Section>

        <Section title="8. Security">
          <Bullet>Passwords hashed with bcrypt + per-user salt.</Bullet>
          <Bullet>TLS 1.2+ encryption in transit.</Bullet>
          <Bullet>JWT tokens with short TTL (7 days).</Bullet>
          <Bullet>Rate limiting on sign-up and login.</Bullet>
          <Bullet>Regular database backups.</Bullet>
        </Section>

        <Section title="9. Cookies and analytics">
          <Text style={styles.p}>
            The mobile app does not use cookies as defined under telecommunications law. We use the secure on-device storage (Expo SecureStore / iOS Keychain / Android Keystore) to keep your session token.
            {"\n\n"}
            We do not use third-party analytics tools (Google Analytics, Facebook Pixel, etc.).
          </Text>
        </Section>

        <Section title="10. Children">
          <Text style={styles.p}>
            The service is not directed at children under 16. We do not knowingly collect data from minors. If we learn that a child under 16 has provided us with data, we will delete it.
          </Text>
        </Section>

        <Section title="11. Policy changes">
          <Text style={styles.p}>
            We will publish updates in the app and notify you by email. Continued use of the service after the changes take effect means you accept them.
          </Text>
        </Section>

        <Section title="12. Contact">
          <Text style={styles.p}>
            Privacy: <Strong>privacy@lootalert.app</Strong>
            {"\n"}General: <Strong>contact@lootalert.app</Strong>
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
