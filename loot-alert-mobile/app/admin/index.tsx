import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, FlatList,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { GlassCard } from "../../components/ui/GlassCard";
import { adminApi, AdminUser, AdminStats, clearAdminToken, getAdminToken } from "../../lib/admin";

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getAdminToken();
      if (!token) {
        router.replace("/admin/login");
        return;
      }
      const [s, u] = await Promise.all([adminApi.stats(), adminApi.users()]);
      setStats(s);
      setUsers(u.users);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "Unauthorized") {
        await clearAdminToken();
        router.replace("/admin/login");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleDelete(user: AdminUser) {
    Alert.alert(
      "Delete user",
      `Delete ${user.email} and all their alerts?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await adminApi.deleteUser(user.id);
              setUsers((prev) => prev.filter((u) => u.id !== user.id));
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed");
            }
          },
        },
      ]
    );
  }

  async function handleSetPlan(user: AdminUser) {
    Alert.alert(
      `Set plan for ${user.email}`,
      `Currently: ${user.plan}`,
      [
        { text: "Free", onPress: () => updatePlan(user.id, "free") },
        { text: "Pro", onPress: () => updatePlan(user.id, "pro") },
        { text: "Elite", onPress: () => updatePlan(user.id, "elite") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  async function updatePlan(id: number, plan: string) {
    try {
      await adminApi.setPlan(id, plan);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, plan } : u)));
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleLogout() {
    await clearAdminToken();
    router.replace("/admin/login");
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={Colors.fuchsia} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Admin</Text>
          <Text style={styles.sub}>Dashboard</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Feather name="log-out" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => String(u.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.fuchsia}
          />
        }
        ListHeaderComponent={
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
          >
            {stats && (
              <>
                <View style={styles.statsGrid}>
                  <StatCard icon="users" label="Users" value={stats.users.total.toString()} sub={`${stats.users.verified} verified`} />
                  <StatCard icon="bell" label="Alerts" value={stats.alerts.total.toString()} sub={`${stats.alerts.active} active`} />
                  <StatCard icon="send" label="Notifs 24h" value={stats.notifications.last_24h.toString()} sub={`${stats.notifications.total} total`} />
                  <StatCard icon="smartphone" label="Push tokens" value={stats.push_tokens.toString()} sub="devices" />
                </View>

                <GlassCard style={styles.section}>
                  <Text style={styles.sectionTitle}>Plan Distribution</Text>
                  <View style={styles.planRow}>
                    <PlanPill label="Free" count={stats.users.by_plan.free} color={Colors.textMuted} />
                    <PlanPill label="Pro" count={stats.users.by_plan.pro} color={Colors.violetLight} />
                    <PlanPill label="Elite" count={stats.users.by_plan.elite} color={Colors.fuchsia} />
                  </View>
                </GlassCard>

                <GlassCard style={styles.section}>
                  <Text style={styles.sectionTitle}>External Services</Text>
                  <ServiceRow
                    label="ScraperAPI"
                    status={stats.external.scraperapi.error ? "error" : "ok"}
                    detail={
                      stats.external.scraperapi.error
                        ? stats.external.scraperapi.error
                        : `${stats.external.scraperapi.requests_used ?? "?"} / ${stats.external.scraperapi.requests_limit ?? "?"} req`
                    }
                  />
                  <ServiceRow
                    label="Resend"
                    status={stats.external.resend.error ? "error" : "ok"}
                    detail={stats.external.resend.error ?? "configured"}
                  />
                  <ServiceRow
                    label="Stripe"
                    status={stats.external.stripe_balance.error ? "error" : "ok"}
                    detail={
                      stats.external.stripe_balance.error
                        ? stats.external.stripe_balance.error
                        : `Available: ${stats.external.stripe_balance.available ?? 0} zł · Pending: ${stats.external.stripe_balance.pending ?? 0} zł`
                    }
                  />
                </GlassCard>
              </>
            )}

            <Text style={[styles.sectionTitle, { paddingHorizontal: 4, marginTop: 8 }]}>
              Users ({users.length})
            </Text>
          </MotiView>
        }
        renderItem={({ item, index }) => (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: index * 30 }}
          >
            <GlassCard style={styles.userCard}>
              <View style={styles.userHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
                  <Text style={styles.userMeta}>
                    {new Date(item.created_at).toLocaleDateString()} · {item.alerts_count} alerts · {item.notifications_sent} notifs
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleSetPlan(item)}
                  style={[
                    styles.planChip,
                    item.plan === "pro" && { backgroundColor: "rgba(124,58,237,0.2)", borderColor: Colors.violetLight },
                    item.plan === "elite" && { backgroundColor: "rgba(217,70,239,0.2)", borderColor: Colors.fuchsia },
                  ]}
                >
                  <Text style={[
                    styles.planChipText,
                    item.plan === "pro" && { color: Colors.violetLight },
                    item.plan === "elite" && { color: Colors.fuchsia },
                  ]}>
                    {item.plan.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.userActions}>
                {item.is_verified && (
                  <View style={styles.verifiedChip}>
                    <Feather name="check" size={10} color={Colors.success} />
                    <Text style={styles.verifiedChipText}>verified</Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                  <Feather name="trash-2" size={14} color={Colors.error} />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </MotiView>
        )}
      />
    </View>
  );
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <GlassCard style={styles.statCard}>
      <Feather name={icon as keyof typeof Feather.glyphMap} size={16} color={Colors.fuchsia} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </GlassCard>
  );
}

function PlanPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
      <Text style={styles.pillCount}>{count}</Text>
    </View>
  );
}

function ServiceRow({ label, status, detail }: { label: string; status: "ok" | "error"; detail: string }) {
  return (
    <View style={styles.serviceRow}>
      <View style={[styles.dot, { backgroundColor: status === "ok" ? Colors.success : Colors.error }]} />
      <Text style={styles.serviceLabel}>{label}</Text>
      <Text style={styles.serviceDetail} numberOfLines={2}>{detail}</Text>
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
  pageTitle: { fontSize: 26, fontWeight: "800", color: Colors.text },
  sub: { fontSize: 12, color: Colors.fuchsia, letterSpacing: 2, textTransform: "uppercase" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  statCard: { flexGrow: 1, flexBasis: "47%", gap: 4 },
  statValue: { color: Colors.text, fontSize: 22, fontWeight: "800", marginTop: 4 },
  statLabel: { color: Colors.text, fontSize: 12, fontWeight: "600" },
  statSub: { color: Colors.textMuted, fontSize: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { color: Colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  planRow: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10,
    alignItems: "center",
  },
  pillLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  pillCount: { color: Colors.text, fontSize: 18, fontWeight: "800", marginTop: 2 },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  serviceLabel: { color: Colors.text, fontSize: 13, fontWeight: "600", width: 80 },
  serviceDetail: { color: Colors.textMuted, fontSize: 11, flex: 1 },
  userCard: { marginBottom: 8 },
  userHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  userEmail: { color: Colors.text, fontSize: 14, fontWeight: "600" },
  userMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  planChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planChipText: { color: Colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  userActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  verifiedChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  verifiedChipText: { color: Colors.success, fontSize: 10, fontWeight: "700" },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  deleteBtnText: { color: Colors.error, fontSize: 12, fontWeight: "600" },
});
