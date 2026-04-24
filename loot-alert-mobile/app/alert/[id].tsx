import { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { GlassCard } from "../../components/ui/GlassCard";
import { api } from "../../lib/api";

interface Hit {
  listing_url: string;
  listing_title: string;
  listing_price: number | null;
  source: string;
  sent_at: string;
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

export default function AlertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [id]);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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
              <Text style={styles.statValue}>{alert.max_price ? `${alert.max_price} zł` : "∞"}</Text>
              <Text style={styles.statLabel}>Max price</Text>
            </View>
          </View>
        </GlassCard>
      </MotiView>

      <Text style={styles.sectionTitle}>Match history</Text>

      {hits.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="inbox" size={40} color={Colors.textFaint} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>No matches yet. The alert is active and polling listings.</Text>
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
