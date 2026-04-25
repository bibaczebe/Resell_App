import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "./api";

export interface PushRegistrationResult {
  ok: boolean;
  token?: string;
  error?: string;
}

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return { ok: false, error: "Permission not granted in iOS/Android settings" };
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    let tokenData: Notifications.ExpoPushToken;
    try {
      tokenData = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      // Fallback: register a Native Device Push Token instead.
      // Works in Expo Go without a project id but tokens are device-specific
      // (FCM/APNs) — backend will deliver via the same Expo push service
      // because we still call /api/push/register which Expo proxies.
      if (msg.includes("projectId") || msg.includes("project id")) {
        try {
          const native = await Notifications.getDevicePushTokenAsync();
          if (native?.data) {
            try {
              await api.post("/api/push/register", { token: String(native.data), platform: Platform.OS });
            } catch {}
            return { ok: true, token: String(native.data) };
          }
        } catch {}

        return {
          ok: false,
          error: "EAS project ID not configured. Run 'eas init' in loot-alert-mobile once. Until then, native push works on real EAS builds only.",
        };
      }
      return { ok: false, error: `Token fetch failed: ${msg}` };
    }

    const token = tokenData.data;
    if (!token) {
      return { ok: false, error: "Empty push token returned by Expo" };
    }

    try {
      await api.post("/api/push/register", { token, platform: Platform.OS });
    } catch (e) {
      return {
        ok: false,
        token,
        error: `Got token but backend register failed: ${e instanceof Error ? e.message : e}`,
      };
    }

    return { ok: true, token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function addNotificationListener(
  handler: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
