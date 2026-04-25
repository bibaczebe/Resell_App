import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";

interface Props {
  sources: string[];
  onToggleSource: (source: string) => void;
}

const SOURCES = [
  { id: "olx", label: "OLX", desc: "Polish classifieds – everything from cars to clothes" },
  { id: "ebay", label: "eBay", desc: "Global – US, UK, DE, PL marketplaces" },
  { id: "allegro", label: "Allegro", desc: "Biggest marketplace in Poland" },
  { id: "reverb", label: "Reverb", desc: "Musical instruments worldwide" },
  { id: "discogs", label: "Discogs", desc: "Vinyl, CDs, music collectibles" },
];

export function Step3Sources({ sources, onToggleSource }: Props) {
  return (
    <MotiView
      from={{ opacity: 0, translateX: 40 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: -40 }}
      transition={{ type: "timing", duration: 300 }}
    >
      <Text style={styles.info}>Choose which portals to monitor. You can pick more than one.</Text>

      {SOURCES.map((source, i) => {
        const active = sources.includes(source.id);
        return (
          <MotiView
            key={source.id}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", delay: i * 80 }}
          >
            <TouchableOpacity
              onPress={() => onToggleSource(source.id)}
              style={[styles.row, active && styles.rowActive]}
              activeOpacity={0.7}
            >
              <View style={styles.textBlock}>
                <Text style={[styles.label, active && styles.labelActive]}>{source.label}</Text>
                <Text style={styles.desc}>{source.desc}</Text>
              </View>
              <View style={[styles.check, active && styles.checkActive]}>
                {active && <Feather name="check" size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
          </MotiView>
        );
      })}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  info: { color: Colors.textMuted, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 10,
  },
  rowActive: {
    borderColor: Colors.violet,
    backgroundColor: "rgba(124,58,237,0.1)",
  },
  textBlock: { flex: 1 },
  label: { color: Colors.text, fontSize: 15, fontWeight: "600" },
  labelActive: { color: Colors.violetLight },
  desc: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
});
