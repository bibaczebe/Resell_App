import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { verifyCode, resendVerificationCode } from "../../lib/auth";
import { AuroraBg } from "../../components/ui/AuroraBg";

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [info, setInfo] = useState("");
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    // auto-focus first input
    setTimeout(() => inputs.current[0]?.focus(), 300);
  }, []);

  function handleChange(idx: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      // Paste 6 digits at once
      const pasted = clean.slice(0, 6).split("");
      const next = [...digits];
      for (let i = 0; i < 6; i++) next[i] = pasted[i] ?? "";
      setDigits(next);
      if (pasted.length === 6) {
        inputs.current[5]?.blur();
        submit(next.join(""));
      } else {
        inputs.current[Math.min(pasted.length, 5)]?.focus();
      }
      return;
    }

    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    if (clean && idx < 5) inputs.current[idx + 1]?.focus();
    if (next.every((d) => d !== "")) submit(next.join(""));
  }

  function handleKeyPress(idx: number, key: string) {
    if (key === "Backspace" && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  async function submit(code: string) {
    setError("");
    setLoading(true);
    try {
      await verifyCode(code);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Błąd weryfikacji");
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setInfo("");
    try {
      await resendVerificationCode();
      setInfo("Nowy kod wysłany! Sprawdź skrzynkę.");
      setResendCooldown(60);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Nie udało się wysłać kodu");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AuroraBg />
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 500 }}
        style={styles.card}
      >
        <View style={styles.iconWrap}>
          <Feather name="mail" size={28} color={Colors.violetLight} />
        </View>

        <Text style={styles.title}>Sprawdź email</Text>
        <Text style={styles.subtitle}>
          Wysłaliśmy 6-cyfrowy kod na{"\n"}
          <Text style={{ color: Colors.text, fontWeight: "600" }}>{email ?? "Twój email"}</Text>
        </Text>

        <View style={styles.codeRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => (inputs.current[i] = r)}
              style={[styles.codeInput, d ? styles.codeInputFilled : null]}
              value={d}
              onChangeText={(v) => handleChange(i, v)}
              onKeyPress={(e) => handleKeyPress(i, e.nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={6}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              editable={!loading}
            />
          ))}
        </View>

        {loading && (
          <View style={{ alignItems: "center", marginTop: 12 }}>
            <ActivityIndicator color={Colors.violetLight} />
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <TouchableOpacity
          onPress={handleResend}
          disabled={resendCooldown > 0}
          style={styles.resendBtn}
        >
          <Text style={[styles.resendText, resendCooldown > 0 && { color: Colors.textFaint }]}>
            {resendCooldown > 0
              ? `Wyślij ponownie (${resendCooldown}s)`
              : "Nie otrzymałem kodu – wyślij ponownie"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/(auth)/login")} style={styles.backBtn}>
          <Feather name="arrow-left" size={14} color={Colors.textMuted} />
          <Text style={styles.backText}>Powrót do logowania</Text>
        </TouchableOpacity>
      </MotiView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(124,58,237,0.12)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "700", color: Colors.text, textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textMuted, textAlign: "center", lineHeight: 21, marginBottom: 28 },
  codeRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  codeInput: {
    flex: 1,
    height: 56,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  codeInputFilled: { borderColor: Colors.violet, backgroundColor: "rgba(124,58,237,0.08)" },
  error: { color: Colors.error, fontSize: 13, textAlign: "center", marginTop: 16 },
  info: { color: Colors.success, fontSize: 13, textAlign: "center", marginTop: 16 },
  resendBtn: { alignItems: "center", paddingVertical: 16, marginTop: 8 },
  resendText: { color: Colors.violetLight, fontSize: 14, fontWeight: "500" },
  backBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 },
  backText: { color: Colors.textMuted, fontSize: 13 },
});
