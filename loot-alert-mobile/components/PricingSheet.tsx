import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking, ActivityIndicator, Modal, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { api } from "../lib/api";

interface Plan {
  name: string;
  price: number;
  currency: string;
  period: string;
  features: string[];
  price_id: string;
}

interface Plans {
  pro: Plan;
  elite: Plan;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function PricingSheet({ visible, onClose }: Props) {
  const [plans, setPlans] = useState<Plans | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (visible && !plans) {
      api.get<Plans>("/api/stripe/plans").then(setPlans).catch(() => {});
    }
  }, [visible, plans]);

  async function startCheckout(planKey: "pro" | "elite", planName: string) {
    setOpening(planName);
    try {
      const data = await api.post<{ url: string }>("/api/stripe/checkout", {
        plan: planKey,
        return_scheme: "lootalert://",
      });
      if (data.url) {
        await Linking.openURL(data.url);
        onClose();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to open checkout";
      if (msg.toLowerCase().includes("verify")) {
        Alert.alert(
          "Verify your email",
          "Premium plans are available only to verified accounts.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Verify now",
              onPress: () => {
                onClose();
                router.push("/(auth)/verify");
              },
            },
          ]
        );
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setOpening(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <MotiView
          from={{ translateY: 500 }}
          animate={{ translateY: 0 }}
          transition={{ type: "timing", duration: 350 }}
          style={styles.sheet}
        >
          <View style={styles.handle} />

          <Text style={styles.title}>Choose your plan</Text>
          <Text style={styles.sub}>Cancel anytime. No commitment.</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
            <PlanCard
              name="Free"
              price="0 zł"
              tag="Free"
              features={["3 active alerts", "Polling every 5 min", "Push notifications"]}
              onPress={() => {}}
              disabled
              current
            />

            {plans?.pro && (
              <PlanCard
                name={plans.pro.name}
                price={`${plans.pro.price.toString().replace(".", ",")} zł`}
                period="/month"
                tag="Popular"
                highlighted
                features={plans.pro.features}
                onPress={() => startCheckout("pro", plans.pro.name)}
                loading={opening === plans.pro.name}
              />
            )}

            {plans?.elite && (
              <PlanCard
                name={plans.elite.name}
                price={`${plans.elite.price.toString().replace(".", ",")} zł`}
                period="/month"
                tag="Power user"
                accent="fuchsia"
                features={plans.elite.features}
                onPress={() => startCheckout("elite", plans.elite.name)}
                loading={opening === plans.elite.name}
              />
            )}
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Maybe later</Text>
          </TouchableOpacity>
        </MotiView>
      </View>
    </Modal>
  );
}

interface PlanCardProps {
  name: string;
  price: string;
  period?: string;
  tag: string;
  features: string[];
  onPress: () => void;
  highlighted?: boolean;
  accent?: "fuchsia";
  loading?: boolean;
  disabled?: boolean;
  current?: boolean;
}

function PlanCard({ name, price, period, tag, features, onPress, highlighted, accent, loading, disabled, current }: PlanCardProps) {
  const borderColor = accent === "fuchsia" ? Colors.fuchsia : highlighted ? Colors.violet : Colors.border;
  const bgColor = accent === "fuchsia"
    ? "rgba(217,70,239,0.08)"
    : highlighted
      ? "rgba(124,58,237,0.08)"
      : Colors.surface;
  const accentColor = accent === "fuchsia" ? Colors.fuchsia : Colors.violetLight;

  return (
    <View style={[styles.planCard, { borderColor, backgroundColor: bgColor }]}>
      {!current && (highlighted || accent === "fuchsia") && (
        <View style={[styles.badge, { backgroundColor: accentColor }]}>
          <Text style={styles.badgeText}>{tag}</Text>
        </View>
      )}
      <View style={styles.planHead}>
        <Text style={[styles.planName, (highlighted || accent) && { color: accentColor }]}>{name}</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <Text style={styles.planPrice}>{price}</Text>
          {period && <Text style={styles.planPer}>{period}</Text>}
        </View>
      </View>

      {features.map((f) => (
        <View key={f} style={styles.featureRow}>
          <Feather name="check" size={14} color={accentColor} />
          <Text style={styles.featureText}>{f}</Text>
        </View>
      ))}

      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[
          styles.ctaBtn,
          { backgroundColor: current ? "transparent" : accentColor },
          current && { borderWidth: 1, borderColor: Colors.border },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.ctaText, current && { color: Colors.textMuted }]}>
            {current ? "Current plan" : `Get ${name}`}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  sheet: {
    backgroundColor: "#0F0F12",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 18 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.text, textAlign: "center" },
  sub: { fontSize: 13, color: Colors.textMuted, textAlign: "center", marginTop: 6, marginBottom: 20 },

  planCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -10,
    right: 14,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  planHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 14,
  },
  planName: { color: Colors.text, fontSize: 17, fontWeight: "700", letterSpacing: 0.5 },
  planPrice: { color: Colors.text, fontSize: 22, fontWeight: "800" },
  planPer: { color: Colors.textMuted, fontSize: 12, fontWeight: "500", marginBottom: 3, marginLeft: 2 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  featureText: { color: Colors.textMuted, fontSize: 13, flex: 1 },
  ctaBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 14,
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cancelBtn: { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  cancelText: { color: Colors.textMuted, fontSize: 14 },
});
