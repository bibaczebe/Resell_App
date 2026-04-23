import { useEffect, useRef, useState } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import * as Notifications from "expo-notifications";
import { isLoggedIn } from "../lib/auth";
import { Colors } from "../constants/colors";
import {
  registerForPushNotifications,
  addNotificationListener,
  addResponseListener,
} from "../lib/notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface InAppBanner {
  title: string;
  body: string;
  alertId?: number;
  listingUrl?: string;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [banner, setBanner] = useState<InAppBanner | null>(null);
  const bannerAnim = useRef(new Animated.Value(-80)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth check + push token registration on app start
  useEffect(() => {
    (async () => {
      try {
        const loggedIn = await isLoggedIn();
        if (!loggedIn) {
          router.replace("/(auth)/login");
        } else {
          registerForPushNotifications().catch(() => {});
        }
      } catch (e) {
        console.warn("Startup error:", e);
        router.replace("/(auth)/login");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Show in-app banner when notification arrives while app is open
  useEffect(() => {
    const sub = addNotificationListener((notification) => {
      const { title, body, data } = notification.request.content;
      showBanner({
        title: title ?? "LootAlert",
        body: body ?? "",
        alertId: (data as Record<string, unknown>)?.alert_id as number | undefined,
      });
    });
    return () => sub.remove();
  }, []);

  // Navigate on tap of push notification (app in background/killed)
  useEffect(() => {
    const sub = addResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.alert_id) {
        router.push(`/alert/${data.alert_id}`);
      }
    });
    return () => sub.remove();
  }, []);

  function showBanner(info: InAppBanner) {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner(info);
    Animated.spring(bannerAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
    bannerTimer.current = setTimeout(() => dismissBanner(), 4500);
  }

  function dismissBanner() {
    Animated.timing(bannerAnim, {
      toValue: -80,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setBanner(null));
  }

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <Stack screenOptions={{ headerShown: false }} />

        {/* In-app notification banner */}
        {banner && (
          <Animated.View
            style={[styles.banner, { transform: [{ translateY: bannerAnim }] }]}
          >
            <TouchableOpacity
              onPress={() => {
                dismissBanner();
                if (banner.alertId) router.push(`/alert/${banner.alertId}`);
              }}
              style={styles.bannerInner}
              activeOpacity={0.9}
            >
              <View style={styles.bannerDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
                <Text style={styles.bannerBody} numberOfLines={1}>{banner.body}</Text>
              </View>
              <TouchableOpacity onPress={dismissBanner} style={styles.bannerClose}>
                <Text style={{ color: Colors.textMuted, fontSize: 16 }}>×</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingTop: 44,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  bannerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1A1A1F",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.violet,
  },
  bannerTitle: { color: Colors.text, fontSize: 14, fontWeight: "700" },
  bannerBody: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  bannerClose: { paddingHorizontal: 4 },
});
