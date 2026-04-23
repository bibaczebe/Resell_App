import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Switch, Alert, ScrollView, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { GlassCard } from "../../components/ui/GlassCard";
import { PricingSheet } from "../../components/PricingSheet";
import { fetchMe, logout } from "../../lib/auth";
import { registerForPushNotifications } from "../../lib/notifications";
import { api } from "../../lib/api";
import { AuroraBg } from "../../components/ui/AuroraBg";
import type { User } from "../../lib/auth";

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  elite: "Elite",
  premium: "Pro",
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPricing, setShowPricing] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchMe().then(setUser).finally(() => setLoading(false));
  }, []);

  async function handleSyncSubscription() {
    setSyncing(true);
    try {
      const res = await api.post<{ plan: string }>("/api/stripe/sync", {});
      const fresh = await fetchMe();
      setUser(fresh);
      Alert.alert(
        "Zsynchronizowano",
        res.plan === "free"
          ? "Brak aktywnej subskrypcji"
          : `Plan zaktualizowany: ${PLAN_LABEL[res.plan] ?? res.plan}`
      );
    } catch (e: unknown) {
      Alert.alert("Błąd", e instanceof Error ? e.message : "Nie udało się zsynchronizować");
    } finally {
      setSyncing(false);
    }
  }

  async function handleEnablePush() {
    const token = await registerForPushNotifications();
    if (token) {
      setPushEnabled(true);
      Alert.alert("Gotowe", "Powiadomienia push włączone!");
    } else {
      Alert.alert("Brak uprawnień", "Przejdź do ustawień systemowych i włącz powiadomienia dla LootAlert.");
    }
  }

  async function handleLogout() {
    Alert.alert("Wyloguj się", "Na pewno chcesz się wylogować?", [
      { text: "Anuluj", style: "cancel" },
      {
        text: "Wyloguj",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={Colors.violetLight} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}
    >
      <AuroraBg />
      <Text style={styles.pageTitle}>Ustawienia</Text>

      <MotiView
        from={{ opacity: 0, translateY: 16 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400 }}
      >
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>Konto</Text>
          <View style={styles.row}>
            <Feather name="mail" size={16} color={Colors.textMuted} />
            <Text style={styles.rowText} numberOfLines={1}>{user?.email}</Text>
            {user?.is_verified && (
              <View style={styles.verifiedBadge}>
                <Feather name="check" size={10} color={Colors.success} />
                <Text style={styles.verifiedText}>Zweryfikowany</Text>
              </View>
            )}
          </View>
          <View style={styles.row}>
            <Feather
              name="star"
              size={16}
              color={user && user.plan !== "free" ? Colors.violetLight : Colors.textMuted}
            />
            <Text style={[styles.rowText, user && user.plan !== "free" && { color: Colors.violetLight }]}>
              Plan: {PLAN_LABEL[user?.plan ?? "free"] ?? "Free"}
            </Text>
          </View>
          {user?.plan === "free" ? (
            <TouchableOpacity style={styles.upgradeBtn} onPress={() => setShowPricing(true)}>
              <Feather name="zap" size={14} color="#fff" />
              <Text style={styles.upgradeBtnText}>Przejdź na Premium</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={handleSyncSubscription}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color={Colors.textMuted} size="small" />
            ) : (
              <>
                <Feather name="refresh-cw" size={14} color={Colors.textMuted} />
                <Text style={styles.syncText}>Synchronizuj subskrypcję ze Stripe</Text>
              </>
            )}
          </TouchableOpacity>
        </GlassCard>

        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>Powiadomienia</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>Powiadomienia push</Text>
              <Text style={styles.rowSub}>Otrzymuj alerty o nowych ofertach</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={(v) => { if (v) handleEnablePush(); else setPushEnabled(false); }}
              trackColor={{ false: Colors.border, true: Colors.violet }}
              thumbColor={pushEnabled ? Colors.violetLight : Colors.textFaint}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>O aplikacji</Text>
          <View style={styles.row}>
            <Feather name="info" size={16} color={Colors.textMuted} />
            <Text style={styles.rowText}>Wersja 1.0.0</Text>
          </View>
          <View style={styles.row}>
            <Feather name="shield" size={16} color={Colors.textMuted} />
            <Text style={styles.rowText}>Polityka prywatności</Text>
          </View>
        </GlassCard>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Feather name="log-out" size={16} color={Colors.error} />
          <Text style={styles.logoutText}>Wyloguj się</Text>
        </TouchableOpacity>
      </MotiView>

      <PricingSheet visible={showPricing} onClose={() => setShowPricing(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 20, paddingHorizontal: 4 },
  section: { marginBottom: 12 },
  sectionTitle: { color: Colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  rowText: { color: Colors.text, fontSize: 15, flex: 1 },
  rowSub: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  switchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedText: { color: Colors.success, fontSize: 10, fontWeight: "700" },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  syncText: { color: Colors.textMuted, fontSize: 13, fontWeight: "500" },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.violet,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  upgradeBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutText: { color: Colors.error, fontWeight: "600", fontSize: 15 },
});
