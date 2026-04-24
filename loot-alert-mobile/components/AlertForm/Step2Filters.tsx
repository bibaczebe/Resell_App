import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { MotiView } from "moti";
import { Colors } from "../../constants/colors";

interface Props {
  maxPrice: string;
  minPrice: string;
  size: string;
  color: string;
  condition: "any" | "new" | "used";
  onMaxPriceChange: (v: string) => void;
  onMinPriceChange: (v: string) => void;
  onSizeChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onConditionChange: (v: "any" | "new" | "used") => void;
}

const CONDITIONS: { value: "any" | "new" | "used"; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
];

export function Step2Filters({
  maxPrice, minPrice, size, color, condition,
  onMaxPriceChange, onMinPriceChange, onSizeChange, onColorChange, onConditionChange,
}: Props) {
  return (
    <MotiView
      from={{ opacity: 0, translateX: 40 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: -40 }}
      transition={{ type: "timing", duration: 300 }}
    >
      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Min price (zł)</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={Colors.textFaint}
            value={minPrice}
            onChangeText={onMinPriceChange}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Max price (zł)</Text>
          <TextInput
            style={styles.input}
            placeholder="no limit"
            placeholderTextColor={Colors.textFaint}
            value={maxPrice}
            onChangeText={onMaxPriceChange}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <Text style={styles.label}>Extra keyword (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 42, XL, 128GB, 205/55 R16"
        placeholderTextColor={Colors.textFaint}
        value={size}
        onChangeText={onSizeChange}
      />

      <Text style={styles.label}>Must contain (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. black, OEM, new, with warranty"
        placeholderTextColor={Colors.textFaint}
        value={color}
        onChangeText={onColorChange}
      />

      <Text style={styles.label}>Condition</Text>
      <View style={styles.conditionRow}>
        {CONDITIONS.map((c) => (
          <TouchableOpacity
            key={c.value}
            onPress={() => onConditionChange(c.value)}
            style={[styles.condBtn, condition === c.value && styles.condBtnActive]}
          >
            <Text style={[styles.condText, condition === c.value && styles.condTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  conditionRow: { flexDirection: "row", gap: 8 },
  condBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  condBtnActive: {
    borderColor: Colors.violet,
    backgroundColor: "rgba(124,58,237,0.15)",
  },
  condText: { color: Colors.textMuted, fontSize: 14 },
  condTextActive: { color: Colors.violetLight, fontWeight: "600" },
});
