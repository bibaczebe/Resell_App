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
      // Common case: missing projectId in Expo Go
      if (msg.includes("projectId") || msg.includes("project id")) {
        return {
          ok: false,
          error: "App needs an EAS project ID. Run 'eas init' in the project root once.",
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
