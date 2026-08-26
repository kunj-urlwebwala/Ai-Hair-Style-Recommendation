import { useAuth } from "@/hooks/use-auth";
import { ThemedView } from "@/components/themed-view";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();
  const { login, register, error } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password);
      }
      router.replace("/(tabs)");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ThemedView className="flex-1 justify-center gap-4 p-6">
          <Text className="text-3xl font-bold text-foreground">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </Text>

          {mode === "register" && (
            <TextInput
              className="rounded-xl border border-border px-4 py-3 text-base text-foreground"
              placeholder="Your name"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            className="rounded-xl border border-border px-4 py-3 text-base text-foreground"
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />

          <TextInput
            className="rounded-xl border border-border px-4 py-3 text-base text-foreground"
            placeholder={mode === "register" ? "Password (min. 8 characters)" : "Password"}
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {(formError ?? error?.message) && (
            <Text className="text-sm text-error">{formError ?? error?.message}</Text>
          )}

          <Pressable
            className="items-center rounded-xl bg-primary px-4 py-3.5 active:opacity-80"
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {mode === "login" ? "Sign in" : "Sign up"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setMode(mode === "login" ? "register" : "login")}
            className="items-center py-2"
          >
            <Text className="text-sm text-muted">
              {mode === "login"
                ? "No account yet? Create one"
                : "Already have an account? Sign in"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.navigate("/forgot-password")} className="items-center pb-2">
            <Text className="text-xs text-muted">Forgot password?</Text>
          </Pressable>
        </ThemedView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
