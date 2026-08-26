import { ThemedView } from "@/components/themed-view";
import { apiCall } from "@/lib/_core/api";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiCall<{ success: boolean; warning?: string }>(
        "/api/auth/forgot-password",
        { method: "POST", body: JSON.stringify({ email: email.trim() }) },
      );
      setStep("reset");
      setNotice(
        result.warning
          ? "This server cannot send email yet. Ask the administrator to configure email delivery."
          : `If an account exists for ${email.trim()}, a 6-digit code is on its way.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await apiCall("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), password }),
      });
      Alert.alert("Password updated", "You can sign in with your new password now.", [
        { text: "Sign in", onPress: () => router.replace("/login") },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
          <Text className="text-3xl font-bold text-foreground">Reset your password</Text>
          {step === "email" ? (
            <>
              <Text className="text-sm text-muted">
                Enter your account email and we will send a one-time code.
              </Text>
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
            </>
          ) : (
            <>
              {notice && <Text className="text-sm text-success">{notice}</Text>}
              <TextInput
                className="rounded-xl border border-border px-4 py-3 text-base text-foreground"
                placeholder="6-digit code"
                placeholderTextColor="#9ca3af"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TextInput
                className="rounded-xl border border-border px-4 py-3 text-base text-foreground"
                placeholder="New password (min. 8 characters)"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </>
          )}

          {error && <Text className="text-sm text-error">{error}</Text>}

          <Pressable
            className="items-center rounded-xl bg-primary px-4 py-3.5 active:opacity-80"
            onPress={step === "email" ? requestCode : resetPassword}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {step === "email" ? "Send code" : "Update password"}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace("/login")} className="items-center py-2">
            <Text className="text-sm text-muted">Back to sign in</Text>
          </Pressable>
        </ThemedView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
