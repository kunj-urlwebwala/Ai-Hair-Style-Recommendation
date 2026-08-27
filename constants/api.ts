import { Platform } from "react-native";

const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
};

export const API_BASE_URL = env.apiBaseUrl;

/**
 * Resolve the API base URL. The API server runs on port 3000 while the Expo web
 * dev server runs on 8081, so web requests default to localhost:3000.
 * Native apps must set EXPO_PUBLIC_API_BASE_URL to a reachable host.
 */
export function getApiBaseUrl(): string {
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }

  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location
  ) {
    const { protocol, hostname } = window.location;
    // Metro on any other host: assume the API is published on port 3000 of the same host.
    if (!hostname.startsWith("8081-")) {
      return `${protocol}//${hostname.replace(/:8081$/, "")}:3000`;
    }
  }

  return "";
}
