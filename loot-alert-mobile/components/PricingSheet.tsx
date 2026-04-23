import { View, Text, TouchableOpacity, StyleSheet, Linking, ActivityIndicator, Modal } from "react-native";
import { useState } from "react";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { api } from "../lib/api";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const FEATURES_FREE = ["3 aktywne alerty", "Polling co 5 min", "Push notifications"];
const FEATURES_PREMIUM = [
  "Nieograniczone alerty",
  "Polling co 2 min (priorytet)",
  "Push notifications",
  "Wsparcie priorytetowe",
];

export function PricingSheet({ visible, onClose }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const data = await api.post<{ url: string }>("/api/stripe/checkout", {
        base_url: "lootalert://",
      });
      if (data.url) await Linking.openURL(data.url);
      onClose();
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <MotiView
          from={{ translateY: 400 }}
          animate={{ translateY: 0 }}
          exit={{ translateY: 400 }}
          transition={{ type: "timing", duration: 350 }}
          style={styles.sheet}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Upgrade do Premium</Text>
          <Text style={styles.sub}>Odblokuj nieograniczone alerty i szybszy polling</Text>

          <View style={styles.plansRow}>
            <View style={styles.planCard}>
              <Text style={styles.planName}>Free</Text>
              <Text style={styles.planPrice}>0 zł</Text>
              {FEATURES_FREE.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Feather name="check" size={13} color={Colors.textMuted} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.planCard, styles.premiumCard]}>
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Popularny</Text>
              </View>
              <Text style={[styles.planName, { color: Colors.violetLight }]}>Premium</Text>
              <Text style={[styles.planPrice, { color: Colors.text }]}>9,99 zł<Text style={styles.per}>/mies.</Text></Text>
              {FEATURES_PREMIUM.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Feather name="check" size={13} color={Colors.violetLight} />
                  <Text style={[styles.featureText, { color: Colors.text }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.upgradeBtnText}>Przejdź na Premium</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Może później</Text>
          </TouchableOpacity>
        </MotiView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: "#111113",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: "800", color: Colors.text, textAlign: "center" },
  sub: { fontSize: 13, color: Colors.textMuted, textAlign: "center", marginTop: 6, marginBottom: 20 },
  plansRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  planCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
  },
  premiumCard: {
    borderColor: Colors.violet,
    backgroundColor: "rgba(124,58,237,0.08)",
    position: "relative",
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    right: 12,
    backgroundColor: Colors.violet,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  popularText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  planName: { color: Colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 4, letterSpacing: 1 },
  planPrice: { color: Colors.text, fontSize: 20, fontWeight: "800", marginBottom: 12 },
  per: { fontSize: 13, fontWeight: "400", color: Colors.textMuted },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  featureText: { color: Colors.textMuted, fontSize: 12, flex: 1 },
  upgradeBtn: {
    backgroundColor: Colors.violet,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: Colors.violet,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  upgradeBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelText: { color: Colors.textMuted, fontSize: 14 },
});
