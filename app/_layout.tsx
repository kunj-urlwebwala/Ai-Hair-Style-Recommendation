import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Text } from "react-native";
import "react-native-reanimated";
import "@/lib/_core/nativewind-pressable";
import { ThemedView } from "@/components/themed-view";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { ConsultationProvider } from "@/lib/consultation-context";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

// Expo Router calls this when a screen throws during rendering.
export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemedView className="flex-1 items-center justify-center gap-3 p-8">
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#211D21" }}>
            Something went wrong
          </Text>
          <Text style={{ textAlign: "center", color: "#665D60" }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </Text>
          <Text selectable style={{ fontSize: 11, color: "#8E8587", marginTop: 8 }}>
            {error.message}
          </Text>
        </ThemedView>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum padding for top and bottom so content clears browser chrome.
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? {
      insets: DEFAULT_WEB_INSETS,
      frame: DEFAULT_WEB_FRAME,
    };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, []);

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
              <ConsultationProvider>
                {/* Headers are hidden by default so raw route segments never appear.
                    Screens that need one should opt in via Stack.Screen options. */}
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                </Stack>
                <StatusBar style="dark" />
              </ConsultationProvider>
            </QueryClientProvider>
          </trpc.Provider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
