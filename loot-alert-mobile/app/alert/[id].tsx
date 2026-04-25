import { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { GlassCard } from "../../components/ui/GlassCard";
import { AuroraBg } from "../../components/ui/AuroraBg";
import { api } from "../../lib/api";
import { formatPrice, formatMaxPrice } from "../../lib/format";

interface Hit {
  listing_url: string;
  listing_title: string;
  listing_price: number | null;
  source: string;
  sent_at: string;
}

interface CurrentMatch {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  url: string;
  image_url: string | null;
  source: string;
}

interface AlertDetail {
  id: number;
  name: string;
  keywords: string;
  max_price: number | null;
  sources: string[];
  is_active: boolean;
  trigger_count: number;
  last_triggered_at: string | null;
}

type TabKey = "current" | "history";

export default function AlertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [currentMatches, setCurrentMatches] = useState<CurrentMatch[]>([]);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("current");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<AlertDetail>(`/api/alerts/${id}`),
      api.get<Hit[]>(`/api/alerts/${id}/history`),
    ])
      .then(([alertData, hitsData]) => {
        setAlert(alertData);
        setHits(hitsData);
      })
      .finally(() => setLoading(false));
    loadCurrent();
  }, [id]);

  const [matchesError, setMatchesError] = useState<string | null>(null);

  async function loadCurrent() {
    if (!id) return;
    setLoadingCurrent(true);
    setMatchesError(null);
    try {
      const res = await api.get<{ matches: CurrentMatch[]; count: number }>(
        `/api/alerts/${id}/current-matches`
      );
      setCurrentMatches(res.matches ?? []);
    } catch (e) {
      console.warn("current-matches error:", e);
      setMatchesError(e instanceof Error ? e.message : "Failed to load offers");
    } finally {
      setLoadingCurrent(false);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={Colors.violetLight} size="large" />
      </View>
    );
  }

  if (!alert) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: Colors.textMuted }}>Alert not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <AuroraBg />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{alert.name}</Text>
        <View style={{ width: 22 }} />
      </View>

      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 350 }}
      >
        <GlassCard style={styles.summaryCard}>
          <Text style={styles.keywords}>{alert.keywords}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{alert.trigger_count}</Text>
              <Text style={styles.statLabel}>Matches</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <View style={[styles.dot, { backgroundColor: alert.is_active ? Colors.success : Colors.textFaint }]} />
              <Text style={styles.statLabel}>{alert.is_active ? "Active" : "Paused"}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatMaxPrice(alert.max_price)}</Text>
              <Text style={styles.statLabel}>Max price</Text>
            </View>
          </View>
        </GlassCard>
      </MotiView>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === "current" && styles.tabActive]}
          onPress={() => setTab("current")}
        >
          <Text style={[styles.tabText, tab === "current" && styles.tabTextActive]}>
            Current offers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "history" && styles.tabActive]}
          onPress={() => setTab("history")}
        >
          <Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>
            Notified ({hits.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "current" ? (
        loadingCurrent ? (
          <View style={styles.empty}>
            <ActivityIndicator color={Colors.violetLight} />
            <Text style={[styles.emptyText, { marginTop: 12 }]}>Searching marketplaces…</Text>
          </View>
        ) : matchesError ? (
          <View style={styles.empty}>
            <Feather name="alert-circle" size={40} color={Colors.error} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Failed to load: {matchesError}</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadCurrent}>
              <Feather name="refresh-cw" size={14} color={Colors.violetLight} />
              <Text style={styles.refreshText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : currentMatches.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="search" size={40} color={Colors.textFaint} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No offers match right now. The alert will catch new listings as they appear.</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadCurrent}>
              <Feather name="refresh-cw" size={14} color={Colors.violetLight} />
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={currentMatches}
            keyExtractor={(m, i) => `${m.source}-${m.id}-${i}`}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: index * 30 }}
              >
                <TouchableOpacity onPress={() => Linking.openURL(item.url)} activeOpacity={0.8}>
                  <GlassCard style={styles.hitCard}>
                    <View style={styles.hitHeader}>
                      <View style={styles.sourceTag}>
                        <Text style={styles.sourceText}>{item.source?.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.hitTitle} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.hitFooter}>
                      {item.price ? <Text style={styles.hitPrice}>{formatPrice(item.price, item.currency)}</Text> : null}
                      <Feather name="external-link" size={14} color={Colors.textMuted} />
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              </MotiView>
            )}
          />
        )
      ) : hits.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="inbox" size={40} color={Colors.textFaint} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>No notifications sent yet. The alert is active and polling listings.</Text>
        </View>
      ) : (
        <FlatList
          data={hits}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: index * 50 }}
            >
              <TouchableOpacity
                onPress={() => Linking.openURL(item.listing_url)}
                activeOpacity={0.8}
              >
                <GlassCard style={styles.hitCard}>
                  <View style={styles.hitHeader}>
                    <View style={styles.sourceTag}>
                      <Text style={styles.sourceText}>{item.source?.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.date}>{formatDate(item.sent_at)}</Text>
                  </View>
                  <Text style={styles.hitTitle} numberOfLines={2}>{item.listing_title}</Text>
                  <View style={styles.hitFooter}>
                    {item.listing_price ? (
                      <Text style={styles.hitPrice}>{item.listing_price} zł</Text>
                    ) : null}
                    {/* note: notification_log doesn't yet store currency – history shows zł as approximation */}
                    <Feather name="external-link" size={14} color={Colors.textMuted} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            </MotiView>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: "700", color: Colors.text, flex: 1, textAlign: "center" },
  summaryCard: { marginHorizontal: 16, marginBottom: 16 },
  keywords: { color: Colors.textMuted, fontSize: 14, marginBottom: 14, lineHeight: 20 },
  statsRow: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { color: Colors.text, fontSize: 18, fontWeight: "700" },
  statLabel: { color: Colors.textMuted, fontSize: 11 },
  divider: { width: 1, height: 32, backgroundColor: Colors.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { color: Colors.text, fontSize: 15, fontWeight: "600", paddingHorizontal: 20, marginBottom: 10 },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 14,
    gap: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabActive: {
    borderColor: Colors.violet,
    backgroundColor: "rgba(124,58,237,0.12)",
  },
  tabText: { color: Colors.textMuted, fontSize: 13, fontWeight: "500" },
  tabTextActive: { color: Colors.violetLight, fontWeight: "700" },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  refreshText: { color: Colors.violetLight, fontSize: 13, fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  hitCard: { marginBottom: 8 },
  hitHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sourceTag: {
    backgroundColor: "rgba(124,58,237,0.15)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sourceText: { color: Colors.violetLight, fontSize: 11, fontWeight: "700" },
  date: { color: Colors.textFaint, fontSize: 11 },
  hitTitle: { color: Colors.text, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  hitFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hitPrice: { color: Colors.success, fontSize: 15, fontWeight: "700" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
