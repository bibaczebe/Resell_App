import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.lootalert.app";
const ADMIN_TOKEN_KEY = "admin_token";

export async function getAdminToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ADMIN_TOKEN_KEY);
}

export async function setAdminToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ADMIN_TOKEN_KEY, token);
}

export async function clearAdminToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ADMIN_TOKEN_KEY);
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAdminToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Admin-Token": token } : {}),
      ...(options.headers as Record<string, string>),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

export interface AdminUser {
  id: number;
  email: string;
  plan: string;
  is_verified: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  alerts_count: number;
  active_alerts: number;
  notifications_sent: number;
}

export interface AdminStats {
  users: {
    total: number;
    verified: number;
    by_plan: { free: number; pro: number; elite: number };
  };
  alerts: { total: number; active: number };
  notifications: { total: number; last_24h: number };
  push_tokens: number;
  external: {
    scraperapi: { requests_used?: number; requests_limit?: number; error?: string };
    resend: { configured?: boolean; error?: string };
    stripe_balance: { available?: number; pending?: number; error?: string };
  };
}

export const adminApi = {
  async login(username: string, password: string): Promise<string> {
    const res = await fetch(`${API_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Login failed");
    await setAdminToken(data.token);
    return data.token;
  },

  users: () => adminRequest<{ users: AdminUser[]; total: number }>("/api/admin/users"),

  stats: () => adminRequest<AdminStats>("/api/admin/stats"),

  deleteUser: (id: number) =>
    adminRequest<{ message: string }>(`/api/admin/users/${id}`, { method: "DELETE" }),

  setPlan: (id: number, plan: string) =>
    adminRequest<{ message: string }>(`/api/admin/users/${id}/plan`, {
      method: "PATCH",
      body: JSON.stringify({ plan }),
    }),
};
