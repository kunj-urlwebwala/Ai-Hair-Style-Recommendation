import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/api";
import * as Auth from "./auth";

export type SessionResponse = {
  sessionToken: string;
  user: {
    id: number;
    email: string;
    name: string | null;
    role: string;
    lastSignedIn: string;
  };
};

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Native clients authenticate with a stored Bearer token; web relies on the session cookie.
  if (Platform.OS !== "web") {
    const sessionToken = await Auth.getSessionToken();
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }
  }

  const baseUrl = getApiBaseUrl();
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : cleanEndpoint;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorJson.message || errorText;
    } catch {
      // Not JSON, use text as is
    }
    throw new Error(errorMessage || `API call failed: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<SessionResponse> {
  return apiCall<SessionResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function login(email: string, password: string): Promise<SessionResponse> {
  return apiCall<SessionResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// Logout
export async function logout(): Promise<void> {
  await apiCall<void>("/api/auth/logout", {
    method: "POST",
  });
}

// Get current authenticated user (web uses cookie-based auth)
export async function getMe(): Promise<SessionResponse["user"] | null> {
  try {
    const result = await apiCall<{ user: SessionResponse["user"] | null }>("/api/auth/me");
    return result.user || null;
  } catch {
    return null;
  }
}
