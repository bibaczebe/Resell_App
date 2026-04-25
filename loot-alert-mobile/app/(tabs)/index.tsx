import { useState, useCallback } from "react";
import {
  View, Text, FlatList, RefreshControl, StyleSheet,
  TouchableOpacity, Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { AlertCard, Alert as AlertType } from "../../components/AlertCard";
import { api } from "../../lib/api";
import { AuroraBg } from "../../components/ui/AuroraBg";
import { fetchMe } from "../../lib/auth";
import type { User } from "../../lib/auth";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      const [data, me] = await Promise.all([
        api.get<AlertType[]>("/api/alerts"),
        fetchMe().catch(() => null),
      ]);
      setAlerts(data);
      if (me) setUser(me);
    } catch {
      // silent fail on refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload every time this tab becomes focused (e.g. after creating alert)
  useFocusEffect(useCallback(() => { loadAlerts(); }, [loadAlerts]));

  async function handleToggle(id: number, active: boolean) {
    try {
      await api.patch(`/api/alerts/${id}`, { is_active: active });
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: active } : a))
      );
    } catch {
      Alert.alert("Błąd", "Nie udało się zmienić statusu alertu");
    }
  }

  async function handleDelete(id: number) {
    Alert.alert("Usuń alert", "Na pewno chcesz usunąć ten alert?", [
      { text: "Anuluj", style: "cancel" },
      {
        text: "Usuń",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/api/alerts/${id}`);
            setAlerts((prev) => prev.filter((a) => a.id !== id));
          } catch {
            Alert.alert("Błąd", "Nie udało się usunąć alertu");
          }
        },
      },
    ]);
  }

  const activeCount = alerts.filter((a) => a.is_active).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
      <AuroraBg />
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>LOOTALERT</Text>
          <Text style={styles.greeting}>
            {activeCount > 0 ? `${activeCount} active ` : "Start hunting "}
            <Text style={{ color: Colors.violetLight }}>deals</Text>
          </Text>
          {user?.plan === "free" && user.alerts_limit ? (
            <View style={styles.quotaBadge}>
              <Feather name="layers" size={11} color={Colors.textMuted} />
              <Text style={styles.quotaText}>
                {user.alerts_created_total ?? 0}/{user.alerts_limit} alerts used (Free)
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {loading ? (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={styles.empty}
        >
          <Text style={styles.emptyText}>Loading alerts…</Text>
        </MotiView>
      ) : alerts.length === 0 ? (
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 400 }}
          style={styles.empty}
        >
          <Feather name="bell-off" size={48} color={Colors.textFaint} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>No alerts yet</Text>
          <Text style={styles.emptyText}>Create your first alert and start catching deals</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push("/(tabs)/new")}
          >
            <Text style={styles.emptyBtnText}>Create alert</Text>
          </TouchableOpacity>
        </MotiView>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <AlertCard
              alert={item}
              index={index}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadAlerts(); }}
              tintColor={Colors.violetLight}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  logo: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.violetLight,
    letterSpacing: 3,
    marginBottom: 6,
  },
  greeting: { fontSize: 26, fontWeight: "800", color: Colors.text, lineHeight: 32 },
  quotaBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8, alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  quotaText: { color: Colors.textMuted, fontSize: 11, fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: Colors.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    marginTop: 24,
    backgroundColor: Colors.violet,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
