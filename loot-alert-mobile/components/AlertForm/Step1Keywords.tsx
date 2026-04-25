import { useState } from "react";
import { Text, TextInput, StyleSheet, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { api } from "../../lib/api";
import { formatPrice } from "../../lib/format";

interface Props {
  name: string;
  keywords: string;
  onNameChange: (v: string) => void;
  onKeywordsChange: (v: string) => void;
}

interface PriceEstimate {
  count: number;
  currency: string;
  avg?: number;
  median?: number;
  min?: number;
  max?: number;
  good_deal_threshold?: number;
  message?: string;
}

export function Step1Keywords({ name, keywords, onNameChange, onKeywordsChange }: Props) {
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkMarketPrice() {
    if (!keywords.trim()) return;
    setLoading(true);
    try {
      const data = await api.get<PriceEstimate>(
        `/api/alerts/price-estimate?q=${encodeURIComponent(keywords.trim())}`
      );
      setEstimate(data);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <MotiView
      from={{ opacity: 0, translateX: 40 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: -40 }}
      transition={{ type: "timing", duration: 300 }}
    >
      <Text style={styles.label}>Alert name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. iPhone 13 Pro, BBS 18 rims"
        placeholderTextColor={Colors.textFaint}
        value={name}
        onChangeText={onNameChange}
      />
      <Text style={styles.label}>Keywords</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder={"e.g. iPhone 13 Pro 128GB\nOr: Huawei Mate, Lego Star Wars, Winter tires 205"}
        placeholderTextColor={Colors.textFaint}
        value={keywords}
        onChangeText={onKeywordsChange}
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        style={[styles.estimateBtn, !keywords.trim() && styles.estimateBtnDisabled]}
        onPress={checkMarketPrice}
        disabled={!keywords.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.violetLight} size="small" />
        ) : (
          <>
            <Feather name="trending-up" size={14} color={Colors.violetLight} />
            <Text style={styles.estimateBtnText}>Check market price</Text>
          </>
        )}
      </TouchableOpacity>

      {estimate && estimate.count > 0 ? (
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 250 }}
          style={styles.estimateCard}
        >
          <View style={styles.estRow}>
            <Text style={styles.estLabel}>Average</Text>
            <Text style={styles.estValue}>{formatPrice(estimate.avg, estimate.currency)}</Text>
          </View>
          <View style={styles.estRow}>
            <Text style={styles.estLabel}>Median</Text>
            <Text style={styles.estValue}>{formatPrice(estimate.median, estimate.currency)}</Text>
          </View>
          <View style={styles.estRow}>
            <Text style={styles.estLabel}>Range</Text>
            <Text style={styles.estValue}>
              {formatPrice(estimate.min, estimate.currency)} – {formatPrice(estimate.max, estimate.currency)}
            </Text>
          </View>
          <View style={styles.estDivider} />
          <View style={styles.estRow}>
            <Text style={[styles.estLabel, { color: Colors.success }]}>Good deal under</Text>
            <Text style={[styles.estValue, { color: Colors.success, fontSize: 16 }]}>
              {formatPrice(estimate.good_deal_threshold, estimate.currency)}
            </Text>
          </View>
          <Text style={styles.estFootnote}>
            Based on {estimate.count} listings on OLX{estimate.currency !== "PLN" && estimate.currency !== "EUR" ? ` (${estimate.currency})` : ""}
          </Text>
        </MotiView>
      ) : estimate && estimate.message ? (
        <Text style={styles.hint}>{estimate.message}</Text>
      ) : null}

      <Text style={styles.hint}>
        We search across everything: electronics, cars, fashion, collectibles, home, hobby.
      </Text>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  label: { color: Colors.textMuted, fontSize: 13, marginBottom: 8, marginTop: 16, fontWeight: "500" },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: Colors.text,
    fontSize: 15,
  },
  textArea: { height: 80, textAlignVertical: "top" },
  hint: { color: Colors.textFaint, fontSize: 12, marginTop: 8, lineHeight: 18 },
  estimateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.4)",
    backgroundColor: "rgba(124,58,237,0.08)",
  },
  estimateBtnDisabled: { opacity: 0.4 },
  estimateBtnText: { color: Colors.violetLight, fontSize: 13, fontWeight: "700" },
  estimateCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(124,58,237,0.06)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.2)",
  },
  estRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5 },
  estLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: "500" },
  estValue: { color: Colors.text, fontSize: 14, fontWeight: "700" },
  estDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },
  estFootnote: { color: Colors.textFaint, fontSize: 11, textAlign: "center", marginTop: 8 },
});
