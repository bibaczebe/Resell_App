import { useState } from "react";
import {
  Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { Colors } from "../../constants/colors";
import { register } from "../../lib/auth";
import { registerForPushNotifications } from "../../lib/notifications";
import { AuroraBg } from "../../components/ui/AuroraBg";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister() {
    setError("");
    if (!email || !password) {
      setError("Wypełnij wszystkie pola");
      return;
    }
    if (password !== confirm) {
      setError("Hasła nie są identyczne");
      return;
    }
    if (password.length < 8) {
      setError("Hasło musi mieć min. 8 znaków");
      return;
    }
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password);
      await registerForPushNotifications();
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Błąd rejestracji");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AuroraBg />
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 500 }}
          style={styles.card}
        >
          <Text style={styles.logo}>LootAlert</Text>
          <Text style={styles.title}>Utwórz konto</Text>
          <Text style={styles.subtitle}>Zacznij za darmo – 3 alerty bez opłat</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.textFaint}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Hasło (min. 8 znaków)"
            placeholderTextColor={Colors.textFaint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="Powtórz hasło"
            placeholderTextColor={Colors.textFaint}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Zarejestruj się</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.link}>
            <Text style={styles.linkText}>Masz konto? <Text style={{ color: Colors.violetLight }}>Zaloguj się</Text></Text>
          </TouchableOpacity>
        </MotiView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flexGrow: 1, justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
  },
  logo: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.violetLight,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 20,
    textAlign: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    marginBottom: 28,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 15,
    marginBottom: 12,
  },
  button: {
    backgroundColor: Colors.violet,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  error: { color: Colors.error, fontSize: 13, marginBottom: 8, textAlign: "center" },
  link: { alignItems: "center" },
  linkText: { color: Colors.textMuted, fontSize: 14 },
});
