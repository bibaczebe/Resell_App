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
        <Text style={styles.title}>Terms of Service</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Last updated: April 25, 2026</Text>

        <Section title="1. General">
          <Text style={styles.p}>
            These Terms govern the electronic services provided in the <Strong>LootAlert</Strong> mobile app ("App" or "Service").
            {"\n\n"}
            The service provider is <Strong>LootAlert</Strong>, contact: <Strong>contact@lootalert.app</Strong> ("Provider").
            {"\n\n"}
            These Terms are made available free of charge in a way that allows them to be downloaded, saved, and printed.
          </Text>
        </Section>

        <Section title="2. Definitions">
          <Bullet>
            <Strong>User</Strong> – an individual at least 16 years old using the App.
          </Bullet>
          <Bullet>
            <Strong>Account</Strong> – an individual user record protected by a password.
          </Bullet>
          <Bullet>
            <Strong>Alert</Strong> – a set of search parameters defined by the User.
          </Bullet>
          <Bullet>
            <Strong>Partner marketplaces</Strong> – OLX, eBay, Allegro, Reverb, Discogs and other services monitored via their public APIs.
          </Bullet>
          <Bullet>
            <Strong>Free / Pro / Elite</Strong> – Service plan tiers.
          </Bullet>
        </Section>

        <Section title="3. Service scope">
          <Text style={styles.p}>
            LootAlert automatically monitors public listings on partner marketplaces according to user-defined parameters and sends native push notifications when a matching offer appears.
            {"\n\n"}
            The App <Strong>does not act as an intermediary</Strong> in transactions between Users and sellers. Purchases, payments, and disputes are handled directly on the originating marketplace.
          </Text>
        </Section>

        <Section title="4. Sign-up and Account">
          <Bullet>An Account (email + password) is required to use the Service.</Bullet>
          <Bullet>Users must provide a real, working email address.</Bullet>
          <Bullet>Passwords must be at least 8 characters.</Bullet>
          <Bullet>Users are responsible for the security of their credentials and may not share them.</Bullet>
          <Bullet>Users may delete their Account at any time from settings or by contacting contact@lootalert.app.</Bullet>
        </Section>

        <Section title="5. Plans and pricing">
          <Text style={styles.p}>
            <Strong>Free</Strong> – PLN 0, up to 3 alerts (lifetime), 5-minute polling.
            {"\n\n"}
            <Strong>Pro – PLN 9.99 / month</Strong> – unlimited alerts, 2-minute polling, all 5 marketplaces, push notifications.
            {"\n\n"}
            <Strong>Elite – PLN 19.99 / month</Strong> – everything in Pro plus 60-second polling, unlimited match history, early access to new sources, priority support.
            {"\n\n"}
            Subscriptions auto-renew monthly until cancelled. Cancellation is available any time via the Stripe customer portal or by emailing contact@lootalert.app. The Service remains available until the end of the paid period.
            {"\n\n"}
            Payments are processed by <Strong>Stripe, Inc.</Strong> Prices include VAT where applicable.
          </Text>
        </Section>

        <Section title="6. Right of withdrawal (consumers)">
          <Text style={styles.p}>
            Consumers in the EU/UK have a <Strong>14-day right of withdrawal</Strong> from a contract concluded at distance, without giving a reason.
            {"\n\n"}
            <Strong>NOTE:</Strong> By starting to use the Service before the 14-day period ends, the User agrees to immediate performance and waives the right of withdrawal for the part already performed (Polish Consumer Rights Act art. 38(13)). This applies to active alerts and notifications already sent. The unused portion of the subscription period may be refunded pro rata.
            {"\n\n"}
            Withdrawal must be communicated by email to <Strong>contact@lootalert.app</Strong>.
          </Text>
        </Section>

        <Section title="7. User obligations">
          <Text style={styles.p}>The User agrees to:</Text>
          <Bullet>not use the App for unlawful purposes;</Bullet>
          <Bullet>not interfere with the App (DDoS, scraping our API);</Bullet>
          <Bullet>not resell, share, or use the Account by third parties; not create multiple accounts to bypass the Free plan limit;</Bullet>
          <Bullet>not create alerts for illegal content, content infringing copyrights, personal rights, or public morals;</Bullet>
          <Bullet>respect the terms of partner marketplaces when contacting sellers.</Bullet>
        </Section>

        <Section title="8. Provider's liability">
          <Text style={styles.p}>The Provider exercises due care to keep the App working but does <Strong>not guarantee</Strong>:</Text>
          <Bullet>100% uptime (partner marketplaces may temporarily block requests or change APIs);</Bullet>
          <Bullet>real-time delivery – polling happens on intervals;</Bullet>
          <Bullet>completeness of results – we may miss listings outside the scraper's scope;</Bullet>
          <Bullet>successful purchase – good deals disappear in seconds and Users compete with other buyers directly on the marketplace.</Bullet>
          <Text style={styles.p}>
            The Provider is not responsible for: the content or accuracy of partner-marketplace listings, the quality of offered goods, transactions with sellers, or missed opportunities due to technical failures.
            {"\n\n"}
            The Provider's liability to a User is capped at the amount paid for the current month (Pro / Elite).
          </Text>
        </Section>

        <Section title="9. Complaints">
          <Text style={styles.p}>
            Complaints regarding the Service may be filed by email to <Strong>contact@lootalert.app</Strong>. The Provider will respond within 14 days.
            {"\n\n"}
            If a complaint is rejected, the User may use:
          </Text>
          <Bullet>the EU ODR platform (https://ec.europa.eu/consumers/odr);</Bullet>
          <Bullet>the District / City Consumer Ombudsman;</Bullet>
          <Bullet>mediation before the Voivodeship Inspector of the Trade Inspection.</Bullet>
        </Section>

        <Section title="10. Intellectual property">
          <Text style={styles.p}>
            All rights to the App, its code, design, logos, and content belong to the Provider or its licensors. The User receives a non-exclusive, non-transferable license to use the App for personal use in line with these Terms.
            {"\n\n"}
            The names OLX, Vinted, Allegro, eBay, Reverb, Discogs and other trademarks belong to their owners and are used for informational purposes only (nominative fair use).
          </Text>
        </Section>

        <Section title="11. Changes to the Terms">
          <Text style={styles.p}>
            The Provider may amend these Terms for valid reasons (changes in law, features, or pricing). Users will be notified by email at least 14 days before changes take effect. If a User does not accept the changes, they may delete their Account and receive a pro-rata refund of the unused subscription period.
          </Text>
        </Section>

        <Section title="12. Governing law and jurisdiction">
          <Text style={styles.p}>
            These Terms are governed by Polish law. Disputes are settled by the court with jurisdiction over the Provider's seat; consumer disputes by the court of the consumer's residence.
            {"\n\n"}
            Matters not regulated here are governed by the Polish Civil Code, the Polish Consumer Rights Act, and the Act on Providing Services by Electronic Means.
          </Text>
        </Section>

        <Section title="13. Contact">
          <Text style={styles.p}>
            Email: <Strong>contact@lootalert.app</Strong>
            {"\n"}GDPR: <Strong>privacy@lootalert.app</Strong>
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
