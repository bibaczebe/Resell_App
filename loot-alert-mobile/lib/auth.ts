import { api, setToken, clearToken, getToken } from "./api";

export interface User {
  id: number;
  email: string;
  plan: "free" | "premium";
  is_verified: boolean;
}

export async function login(email: string, password: string): Promise<User> {
  const data = await api.post<{ token: string; user_id: number; plan: string }>(
    "/api/auth/login",
    { email, password },
    false
  );
  await setToken(data.token);
  return fetchMe();
}

export async function register(email: string, password: string): Promise<User> {
  const data = await api.post<{ token: string; user_id: number }>(
    "/api/auth/register",
    { email, password },
    false
  );
  await setToken(data.token);
  return fetchMe();
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
