import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { adminApi } from "../../lib/admin";
import { AuroraBg } from "../../components/ui/AuroraBg";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      await adminApi.login(username.trim(), password);
      router.replace("/admin/");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid credentials");
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
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 500 }}
        style={styles.card}
      >
        <View style={styles.iconWrap}>
          <Feather name="shield" size={28} color={Colors.fuchsia} />
        </View>
        <Text style={styles.title}>Admin Panel</Text>
        <Text style={styles.sub}>Restricted access</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={Colors.textFaint}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.textFaint}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Enter</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={14} color={Colors.textMuted} />
          <Text style={styles.backText}>Back</Text>
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
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(217,70,239,0.12)",
    borderWidth: 1, borderColor: "rgba(217,70,239,0.3)",
    alignItems: "center", justifyContent: "center",
    alignSelf: "center", marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "700", color: Colors.text, textAlign: "center", marginBottom: 6 },
  sub: { fontSize: 13, color: Colors.textMuted, textAlign: "center", marginBottom: 28 },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    color: Colors.text, fontSize: 15, marginBottom: 12,
  },
  btn: {
    backgroundColor: Colors.fuchsia, borderRadius: 12, paddingVertical: 15,
    alignItems: "center", marginTop: 8, marginBottom: 16,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  error: { color: Colors.error, fontSize: 13, textAlign: "center", marginBottom: 8 },
  back: { flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 8 },
  backText: { color: Colors.textMuted, fontSize: 13 },
});
