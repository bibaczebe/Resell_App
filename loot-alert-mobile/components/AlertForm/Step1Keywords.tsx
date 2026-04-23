import { View, Text, TextInput, StyleSheet } from "react-native";
import { MotiView } from "moti";
import { Colors } from "../../constants/colors";

interface Props {
  name: string;
  keywords: string;
  onNameChange: (v: string) => void;
  onKeywordsChange: (v: string) => void;
}

export function Step1Keywords({ name, keywords, onNameChange, onKeywordsChange }: Props) {
  return (
    <MotiView
      from={{ opacity: 0, translateX: 40 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: -40 }}
      transition={{ type: "timing", duration: 300 }}
    >
      <Text style={styles.label}>Nazwa alertu</Text>
      <TextInput
        style={styles.input}
        placeholder="np. Nike Air Max 90"
        placeholderTextColor={Colors.textFaint}
        value={name}
        onChangeText={onNameChange}
      />
      <Text style={styles.label}>Słowa kluczowe</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder={"np. Nike Air Max 90 czarne\nMożesz podać kilka słów kluczowych"}
        placeholderTextColor={Colors.textFaint}
        value={keywords}
        onChangeText={onKeywordsChange}
        multiline
        numberOfLines={3}
      />
      <Text style={styles.hint}>System będzie szukał ogłoszeń zawierających te słowa.</Text>
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
});
