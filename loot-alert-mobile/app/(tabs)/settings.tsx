import { useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Switch, Alert, ScrollView, ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
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
  const versionTapCount = useRef(0);
  const versionTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUser = useCallback(async () => {
    try {
      // First fetch current user
      const fresh = await fetchMe();
      setUser(fresh);

      // Silently attempt to sync Stripe state if the user is expected to be paid
      // or simply to pick up subscription changes
      try {
        const res = await api.post<{ plan: string }>("/api/stripe/sync", {});
        if (res.plan && res.plan !== fresh.plan) {
          const updated = await fetchMe();
          setUser(updated);
        }
      } catch {
        // silent
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser])
  );

  async function handleEnablePush() {
    const result = await registerForPushNotifications();
    if (result.ok) {
      setPushEnabled(true);
      Alert.alert("Done", "Push notifications enabled.");
    } else {
      Alert.alert(
        "Cannot enable push",
        result.error ?? "Open system Settings → Notifications and enable for LootAlert.",
      );
    }
  }

  async function handleLogout() {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  function handleVersionTap() {
    versionTapCount.current += 1;
    if (versionTapTimer.current) clearTimeout(versionTapTimer.current);
    versionTapTimer.current = setTimeout(() => {
      versionTapCount.current = 0;
    }, 1500);
    if (versionTapCount.current >= 7) {
      versionTapCount.current = 0;
      router.push("/admin/login");
    }
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
      <Text style={styles.pageTitle}>Settings</Text>

      <MotiView
        from={{ opacity: 0, translateY: 16 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400 }}
      >
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.row}>
            <Feather name="mail" size={16} color={Colors.textMuted} />
            <Text style={styles.rowText} numberOfLines={1}>{user?.email}</Text>
            {user?.is_verified ? (
              <View style={styles.verifiedBadge}>
                <Feather name="check" size={10} color={Colors.success} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : user ? (
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/(auth)/verify", params: { email: user.email } })}
                style={styles.verifyBadge}
              >
                <Feather name="alert-circle" size={10} color={Colors.warning} />
                <Text style={styles.verifyText}>Verify</Text>
              </TouchableOpacity>
            ) : null}
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
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => {
                if (!user?.is_verified) {
                  Alert.alert(
                    "Verify your email",
                    "Premium plans are available only to verified accounts. Verify your email first.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Verify now",
                        onPress: () => router.push({ pathname: "/(auth)/verify", params: { email: user.email } }),
                      },
                    ]
                  );
                  return;
                }
                setShowPricing(true);
              }}
            >
              <Feather name="zap" size={14} color="#fff" />
              <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.manageBtn} onPress={() => setShowPricing(true)}>
              <Text style={styles.manageText}>Change plan</Text>
            </TouchableOpacity>
          )}
        </GlassCard>

        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>Push notifications</Text>
              <Text style={styles.rowSub}>Get notified when a matching deal appears</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={(v) => { if (v) handleEnablePush(); else setPushEnabled(false); }}
              trackColor={{ false: Colors.border, true: Colors.violet }}
              thumbColor={pushEnabled ? Colors.violetLight : Colors.textFaint}
            />
          </View>
          <TouchableOpacity
            style={styles.testPushBtn}
            onPress={async () => {
              try {
                const res = await api.post<{ sent_to: number }>("/api/push/test", {});
                Alert.alert("Test sent", `Push sent to ${res.sent_to} device(s). Check your notifications.`);
              } catch (e) {
                Alert.alert(
                  "No push token",
                  "No push token is registered for this account. Tap the toggle above first to grant permission.",
                );
              }
            }}
          >
            <Feather name="send" size={14} color={Colors.violetLight} />
            <Text style={styles.testPushText}>Send test notification</Text>
          </TouchableOpacity>
        </GlassCard>

        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <TouchableOpacity style={styles.row} onPress={handleVersionTap}>
            <Feather name="info" size={16} color={Colors.textMuted} />
            <Text style={styles.rowText}>Version 1.0.0</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => router.push("/legal/privacy")}>
            <Feather name="shield" size={16} color={Colors.textMuted} />
            <Text style={styles.rowText}>Privacy policy</Text>
            <Feather name="chevron-right" size={16} color={Colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => router.push("/legal/terms")}>
            <Feather name="file-text" size={16} color={Colors.textMuted} />
            <Text style={styles.rowText}>Terms of service</Text>
            <Feather name="chevron-right" size={16} color={Colors.textFaint} />
          </TouchableOpacity>
        </GlassCard>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Feather name="log-out" size={16} color={Colors.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </MotiView>

      <PricingSheet visible={showPricing} onClose={() => { setShowPricing(false); loadUser(); }} />
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
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  verifiedText: { color: Colors.success, fontSize: 10, fontWeight: "700" },
  verifyBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  verifyText: { color: Colors.warning, fontSize: 10, fontWeight: "700" },
  upgradeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, marginTop: 12,
  },
  upgradeBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  manageBtn: {
    alignItems: "center", paddingVertical: 10, marginTop: 8,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  manageText: { color: Colors.textMuted, fontSize: 13, fontWeight: "500" },
  testPushBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, marginTop: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: "rgba(124,58,237,0.06)",
  },
  testPushText: { color: Colors.violetLight, fontSize: 13, fontWeight: "600" },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(239,68,68,0.25)",
    paddingVertical: 14, marginTop: 8,
  },
  logoutText: { color: Colors.error, fontWeight: "600", fontSize: 15 },
});
