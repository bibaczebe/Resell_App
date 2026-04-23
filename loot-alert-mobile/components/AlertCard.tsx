import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { GlassCard } from "./ui/GlassCard";

export interface Alert {
  id: number;
  name: string;
  keywords: string;
  max_price: number | null;
  sources: string[];
  is_active: boolean;
  trigger_count: number;
  last_triggered_at: string | null;
}

interface Props {
  alert: Alert;
  index: number;
  onToggle: (id: number, active: boolean) => void;
  onDelete: (id: number) => void;
}

export function AlertCard({ alert, index, onToggle, onDelete }: Props) {
  const sourceIcons: Record<string, string> = { olx: "OLX", vinted: "VIN", allegro: "ALL" };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 350, delay: index * 60 }}
    >
      <TouchableOpacity onPress={() => router.push(`/alert/${alert.id}`)} activeOpacity={0.8}>
        <GlassCard style={[styles.card, !alert.is_active && styles.inactive]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.dot, { backgroundColor: alert.is_active ? Colors.success : Colors.textFaint }]} />
              <Text style={styles.name} numberOfLines={1}>{alert.name}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => onToggle(alert.id, !alert.is_active)} style={styles.iconBtn}>
                <Feather name={alert.is_active ? "pause-circle" : "play-circle"} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(alert.id)} style={styles.iconBtn}>
                <Feather name="trash-2" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.keywords} numberOfLines={2}>{alert.keywords}</Text>

          <View style={styles.footer}>
            <View style={styles.tags}>
              {(alert.sources || []).map((s) => (
                <View key={s} style={styles.tag}>
                  <Text style={styles.tagText}>{sourceIcons[s] ?? s}</Text>
                </View>
              ))}
            </View>
            <View style={styles.meta}>
              {alert.max_price ? (
                <Text style={styles.price}>do {alert.max_price} zł</Text>
              ) : null}
              <Text style={styles.hits}>
                <Feather name="bell" size={11} color={Colors.textMuted} /> {alert.trigger_count}
              </Text>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  inactive: { opacity: 0.5 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", flex: 1, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: Colors.text, fontSize: 16, fontWeight: "600", flex: 1 },
  actions: { flexDirection: "row", gap: 6 },
  iconBtn: { padding: 4 },
  keywords: { color: Colors.textMuted, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tags: { flexDirection: "row", gap: 6 },
  tag: {
    backgroundColor: "rgba(124,58,237,0.15)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.25)",
  },
  tagText: { color: Colors.violetLight, fontSize: 11, fontWeight: "600" },
  meta: { flexDirection: "row", alignItems: "center", gap: 10 },
  price: { color: Colors.success, fontSize: 13, fontWeight: "600" },
  hits: { color: Colors.textMuted, fontSize: 12 },
});
