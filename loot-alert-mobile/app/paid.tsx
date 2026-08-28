import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { api } from "../lib/api";

// Stripe Checkout success returns here (lootalert://paid?plan=...). We confirm
// the upgrade with the backend, then send the user to Settings.
export default function PaidScreen() {
  const { plan } = useLocalSearchParams<{ plan?: string }>();
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await api.post("/api/stripe/sync", {});
      } catch {
        // Webhook will reconcile the plan even if this immediate sync fails.
      } finally {
        if (active) setSyncing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Feather name="check" size={40} color="#fff" />
      </View>
      <Text style={styles.title}>You're upgraded!</Text>
      <Text style={styles.subtitle}>
        {plan ? `Welcome to ${String(plan).toUpperCase()}.` : "Your subscription is active."}
      </Text>

      {syncing ? (
        <ActivityIndicator color={Colors.violetLight} style={{ marginTop: 24 }} />
      ) : (
        <TouchableOpacity style={styles.btn} onPress={() => router.replace("/(tabs)/settings")}>
          <Text style={styles.btnText}>Continue</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center", padding: 32 },
  badge: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.violet,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textMuted, textAlign: "center" },
  btn: {
    marginTop: 28, backgroundColor: Colors.violet, borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
