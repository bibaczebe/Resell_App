import { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { api } from "../../lib/api";
import { PricingSheet } from "../../components/PricingSheet";

interface Msg { role: "user" | "assistant"; content: string; }

const STARTERS = [
  "Is this a good flip? iPhone 13 128GB, 200 zł, cracked screen",
  "Write a Vinted listing for Nike Air Max 90, size 43, very good condition",
  "How do I find more buyers for my sneakers?",
];

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const data = await api.post<{ reply: string }>("/api/chat", { messages: next });
      setMessages([...next, { role: "assistant", content: data.reply }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/premium/i.test(msg)) {
        setLocked(true);
      } else if (/not configured/i.test(msg)) {
        setMessages([...next, { role: "assistant", content: "The AI assistant isn't switched on yet. (Admin: set ANTHROPIC_API_KEY.)" }]);
      } else {
        setMessages([...next, { role: "assistant", content: "Sorry — the assistant had a hiccup. Try again." }]);
      }
    } finally {
      setLoading(false);
    }
  }

  if (locked) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Feather name="message-circle" size={48} color={Colors.violetLight} style={{ marginBottom: 16 }} />
        <Text style={styles.title}>AI Reselling Assistant</Text>
        <Text style={styles.lockText}>
          Appraise finds, write listings that sell, price and negotiate, and grow your buyer base — your reseller copilot. Premium only.
        </Text>
        <TouchableOpacity style={styles.cta} onPress={() => setShowPricing(true)}>
          <Text style={styles.ctaText}>Unlock with Premium</Text>
        </TouchableOpacity>
        <PricingSheet visible={showPricing} onClose={() => setShowPricing(false)} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Assistant</Text>
        <Text style={styles.sub}>Your AI reselling copilot</Text>
      </View>

      {messages.length === 0 ? (
        <View style={styles.starters}>
          <View style={styles.startersHero}>
            <Feather name="zap" size={30} color={Colors.violetLight} />
            <Text style={styles.heroTitle}>Should you buy it to flip?</Text>
            <Text style={styles.heroSub}>
              I check the live market (OLX · Vinted · eBay) and give an honest BUY / SKIP verdict with the margin.
            </Text>
          </View>
          <Text style={styles.startersLabel}>Try asking</Text>
          {STARTERS.map((s) => (
            <TouchableOpacity key={s} style={styles.starter} onPress={() => send(s)}>
              <Feather name="arrow-up-right" size={16} color={Colors.violetLight} />
              <Text style={styles.starterText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, paddingBottom: 8, flexGrow: 1 }}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.aiBubble]}>
              <Text style={item.role === "user" ? styles.userText : styles.aiText}>{item.content}</Text>
            </View>
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {loading && <ActivityIndicator color={Colors.violetLight} style={{ marginBottom: 6 }} />}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          placeholder="Ask about a flip, pricing, listings…"
          placeholderTextColor={Colors.textFaint}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => send(input)} disabled={loading || !input.trim()}>
          <Feather name="arrow-up" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: "center", justifyContent: "center", padding: 32 },
  header: { paddingHorizontal: 20, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "800", color: Colors.text },
  sub: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  lockText: { color: Colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 24, paddingHorizontal: 10 },
  cta: { backgroundColor: Colors.violet, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  list: { flex: 1 },
  starters: { flex: 1, padding: 20, gap: 10 },
  startersHero: { alignItems: "center", gap: 10, paddingVertical: 24, paddingHorizontal: 8 },
  heroTitle: { color: Colors.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  heroSub: { color: Colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  startersLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 8, marginBottom: 2 },
  starter: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  starterText: { flex: 1, color: Colors.text, fontSize: 14, lineHeight: 20 },
  bubble: { maxWidth: "92%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 10 },
  userBubble: { alignSelf: "flex-end", backgroundColor: Colors.violet },
  aiBubble: { alignSelf: "flex-start", backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  userText: { color: "#fff", fontSize: 15, lineHeight: 21 },
  aiText: { color: Colors.text, fontSize: 15, lineHeight: 21 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.tabBar,
  },
  input: {
    flex: 1, maxHeight: 120, backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 10, color: Colors.text, fontSize: 15,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
});
