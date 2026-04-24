import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Step1Keywords } from "../../components/AlertForm/Step1Keywords";
import { Step2Filters } from "../../components/AlertForm/Step2Filters";
import { Step3Sources } from "../../components/AlertForm/Step3Sources";
import { api } from "../../lib/api";

const STEPS = ["Keywords", "Filters", "Sources"];

export default function NewAlertScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [condition, setCondition] = useState<"any" | "new" | "used">("any");
  const [sources, setSources] = useState(["olx", "vinted", "allegro"]);

  function toggleSource(source: string) {
    setSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  }

  function canProceed(): boolean {
    if (step === 0) return name.trim().length > 0 && keywords.trim().length > 0;
    if (step === 2) return sources.length > 0;
    return true;
  }

  async function handleSubmit() {
    if (sources.length === 0) {
      Alert.alert("Error", "Choose at least one source");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/alerts", {
        name: name.trim(),
        keywords: keywords.trim(),
        max_price: maxPrice ? parseFloat(maxPrice) : null,
        min_price: minPrice ? parseFloat(minPrice) : 0,
        size: size.trim() || null,
        color: color.trim() || null,
        condition,
        sources,
      });
      router.replace("/(tabs)");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create alert";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => (step > 0 ? setStep(step - 1) : router.back())}>
            <Feather name="arrow-left" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>New alert</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.progress}>
          {STEPS.map((label, i) => (
            <View key={i} style={styles.stepWrapper}>
              <View style={[styles.stepDot, i <= step && styles.stepDotActive]} />
              {i < STEPS.length - 1 && (
                <View style={[styles.stepLine, i < step && styles.stepLineActive]} />
              )}
            </View>
          ))}
        </View>

        <Text style={styles.stepLabel}>{`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}</Text>

        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 && (
            <Step1Keywords
              name={name}
              keywords={keywords}
              onNameChange={setName}
              onKeywordsChange={setKeywords}
            />
          )}
          {step === 1 && (
            <Step2Filters
              maxPrice={maxPrice}
              minPrice={minPrice}
              size={size}
              color={color}
              condition={condition}
              onMaxPriceChange={setMaxPrice}
              onMinPriceChange={setMinPrice}
              onSizeChange={setSize}
              onColorChange={setColor}
              onConditionChange={setCondition}
            />
          )}
          {step === 2 && (
            <Step3Sources sources={sources} onToggleSource={toggleSource} />
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {step < STEPS.length - 1 ? (
            <TouchableOpacity
              style={[styles.btn, !canProceed() && styles.btnDisabled]}
              onPress={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              <Text style={styles.btnText}>Next</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btn, (loading || !canProceed()) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading || !canProceed()}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={styles.btnText}>Create alert</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: "700", color: Colors.text },
  progress: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, marginBottom: 8 },
  stepWrapper: { flexDirection: "row", alignItems: "center", flex: 1 },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.border,
  },
  stepDotActive: { backgroundColor: Colors.violet },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.violet },
  stepLabel: { paddingHorizontal: 24, color: Colors.textMuted, fontSize: 13, marginBottom: 4 },
  form: { paddingHorizontal: 20, paddingBottom: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  btn: {
    backgroundColor: Colors.violet,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
