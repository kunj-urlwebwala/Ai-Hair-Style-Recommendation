import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

export function useAuth() {
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const applySession = useCallback(async (session: Api.SessionResponse) => {
    const userInfo: Auth.User = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      lastSignedIn: new Date(session.user.lastSignedIn),
    };

    await Auth.setSessionToken(session.sessionToken);
    await Auth.setUserInfo(userInfo);
    setUser(userInfo);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Web uses cookie-based auth and asks the API who it is.
      if (Platform.OS === "web") {
        const apiUser = await Api.getMe();
        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            email: apiUser.email,
            name: apiUser.name,
            role: apiUser.role,
            lastSignedIn: new Date(apiUser.lastSignedIn),
          };
          setUser(userInfo);
          await Auth.setUserInfo(userInfo);
        } else {
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }

      // Native validates the cached session against the stored token.
      const sessionToken = await Auth.getSessionToken();
      const apiUser = sessionToken ? await Api.getMe() : null;
      if (apiUser) {
        setUser({
          id: apiUser.id,
          email: apiUser.email,
          name: apiUser.name,
          role: apiUser.role,
          lastSignedIn: new Date(apiUser.lastSignedIn),
        });
      } else {
        setUser(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch user"));
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      await applySession(await Api.login(email, password));
    },
    [applySession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setError(null);
      await applySession(await Api.register(name, email, password));
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      // Continue with logout even if the API call fails.
      console.error("[Auth] Logout API call failed:", err);
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    logout,
    refresh,
  };
}
