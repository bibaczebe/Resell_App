import { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Linking, ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { api } from "../../lib/api";
import { AuroraBg } from "../../components/ui/AuroraBg";
import { PricingSheet } from "../../components/PricingSheet";

interface Deal {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  price_pln: number | null;
  discount_pct: number | null;
  deal_tier: "hot" | "good" | null;
  url: string;
  source: string;
  alert_name: string;
}

export default function DealsScreen() {
  const insets = useSafeAreaInsets();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locked, setLocked] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ deals: Deal[]; count: number }>("/api/deals/top");
      setDeals(data.deals);
      setLocked(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/premium/i.test(msg)) setLocked(true);
      else setDeals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function aiRead() {
    setBriefLoading(true);
    try {
      const data = await api.post<{ brief: string }>("/api/chat/deals-brief", { deals: deals.slice(0, 15) });
      setBrief(data.brief);
    } catch {
      setBrief("Could not generate the AI brief right now.");
    } finally {
      setBriefLoading(false);
    }
  }

  if (locked) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <AuroraBg />
        <Feather name="trending-up" size={48} color={Colors.violetLight} style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Top Deals</Text>
        <Text style={styles.lockText}>
          The engine surfaces the best underpriced finds across all your alerts — ranked by how far below market they are. Premium only.
        </Text>
        <TouchableOpacity style={styles.cta} onPress={() => setShowPricing(true)}>
          <Text style={styles.ctaText}>Unlock with Premium</Text>
        </TouchableOpacity>
        <PricingSheet visible={showPricing} onClose={() => { setShowPricing(false); load(); }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <AuroraBg />
      <View style={styles.header}>
        <Text style={styles.title}>Top Deals</Text>
        <Text style={styles.sub}>Best finds across your alerts, ranked by % below market</Text>
      </View>

      {deals.length > 0 && (
        <TouchableOpacity style={styles.aiBtn} onPress={aiRead} disabled={briefLoading}>
          {briefLoading ? <ActivityIndicator color={Colors.violetLight} />
            : <><Feather name="zap" size={15} color={Colors.violetLight} /><Text style={styles.aiBtnText}>AI read — brief me on these flips</Text></>}
        </TouchableOpacity>
      )}
      {brief ? (
        <View style={styles.briefCard}>
          <Text style={styles.briefText}>{brief}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}><Text style={styles.muted}>Scanning marketplaces…</Text></View>
      ) : deals.length === 0 ? (
        <View style={styles.center}>
          <Feather name="search" size={40} color={Colors.textFaint} style={{ marginBottom: 12 }} />
          <Text style={styles.muted}>No standout deals right now. Add more alerts and check back.</Text>
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(d, i) => `${d.source}:${d.id}:${i}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.violetLight} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => item.url && Linking.openURL(item.url)} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {item.price_pln ? `${Math.round(item.price_pln)} zł` : "—"}
                  {item.currency && item.currency !== "PLN" && item.price ? `  (${item.price} ${item.currency})` : ""}
                  {"  ·  "}{item.source.toUpperCase()}  ·  {item.alert_name}
                </Text>
              </View>
              {item.discount_pct != null && (
                <View style={[styles.badge, item.deal_tier === "hot" ? styles.badgeHot : styles.badgeGood]}>
                  <Text style={styles.badgeText}>-{item.discount_pct}%</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: Colors.text },
  sub: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  muted: { color: Colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  lockText: { color: Colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 24, paddingHorizontal: 10 },
  cta: { backgroundColor: Colors.violet, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  aiBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 10, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.violet, backgroundColor: "rgba(124,58,237,0.1)",
  },
  aiBtnText: { color: Colors.violetLight, fontWeight: "700", fontSize: 14 },
  briefCard: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  briefText: { color: Colors.text, fontSize: 14, lineHeight: 21 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: 10,
  },
  cardTitle: { color: Colors.text, fontSize: 15, fontWeight: "600" },
  cardMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  badgeHot: { backgroundColor: "#F59E0B" },
  badgeGood: { backgroundColor: "#10B981" },
  badgeText: { color: "#111", fontWeight: "800", fontSize: 13 },
});
