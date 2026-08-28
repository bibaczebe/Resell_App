import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://resellapp-production.up.railway.app";
const TOKEN_KEY = "loot_jwt";
const TIMEOUT_MS = 20000;

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  // Abort on timeout so spinners can't hang forever on a stalled connection.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Request timed out. Check your connection.");
    throw new Error("Network error. Check your connection.");
  } finally {
    clearTimeout(timer);
  }

  // Parse defensively: a proxy/5xx HTML body must not surface as "JSON Parse error".
  const bodyText = await res.text();
  let data: any = null;
  if (bodyText) {
    try {
      data = JSON.parse(bodyText);
    } catch {
      data = null;
    }
  }

  // Expired/invalid session: clear it and bounce to login instead of leaving a
  // silently-broken "zombie" session. Skip for unauthenticated calls (login/register).
  if (res.status === 401 && auth) {
    await clearToken();
    try {
      router.replace("/(auth)/login");
    } catch {
      // navigation may not be ready; token is cleared so next launch re-auths
    }
    throw new Error(data?.error ?? "Session expired. Please log in again.");
  }

  if (!res.ok) {
    throw new Error(data?.error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  post: <T>(path: string, body: unknown, auth = true) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, auth),

  get: <T>(path: string) => request<T>(path, { method: "GET" }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
