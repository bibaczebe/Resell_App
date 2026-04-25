import { api, setToken, clearToken, getToken } from "./api";

export interface User {
  id: number;
  email: string;
  plan: "free" | "pro" | "elite" | "premium";
  is_verified: boolean;
  alerts_created_total?: number;
  alerts_limit?: number | null;
  alerts_remaining?: number | null;
}

export async function login(email: string, password: string): Promise<User> {
  const data = await api.post<{ token: string; user_id: number; plan: string; is_verified: boolean }>(
    "/api/auth/login",
    { email, password },
    false
  );
  await setToken(data.token);
  return fetchMe();
}

export async function register(
  email: string,
  password: string
): Promise<{ user: User; requiresVerification: boolean }> {
  const data = await api.post<{ token: string; user_id: number; requires_verification: boolean }>(
    "/api/auth/register",
    { email, password },
    false
  );
  await setToken(data.token);
  const user = await fetchMe();
  return { user, requiresVerification: data.requires_verification ?? !user.is_verified };
}

export async function verifyCode(code: string): Promise<User> {
  await api.post("/api/auth/verify-code", { code });
  return fetchMe();
}

export async function resendVerificationCode(): Promise<void> {
  await api.post("/api/auth/resend-code", {});
}

export async function fetchMe(): Promise<User> {
  return api.get<User>("/api/auth/me");
}

export async function logout(): Promise<void> {
  await clearToken();
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}
