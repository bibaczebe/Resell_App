import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../constants/colors";

// Stripe Checkout cancel returns here (lootalert://pricing). No charge was made.
export default function PricingReturnScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Feather name="x" size={36} color={Colors.textMuted} />
      </View>
      <Text style={styles.title}>Checkout cancelled</Text>
      <Text style={styles.subtitle}>No charge was made. You can upgrade any time from Settings.</Text>

      <TouchableOpacity style={styles.btn} onPress={() => router.replace("/(tabs)/settings")}>
        <Text style={styles.btnText}>Back to Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center", padding: 32 },
  badge: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: "800", color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textMuted, textAlign: "center" },
  btn: {
    marginTop: 28, backgroundColor: Colors.violet, borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
