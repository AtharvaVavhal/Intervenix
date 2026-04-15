import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  login  as apiLogin,
  signup as apiSignup,
  getMe,
  clearTokens,
  refreshStore,
  refreshToken,
  tokenStore,
} from "../services/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer          = useRef(null);

  // ── Hydrate session on mount ───────────────────────────────────────────────
  // Strategy:
  //   1. If we have a stored access token, try /me directly (fast path).
  //   2. If /me fails (expired), and we have a refresh token, refresh then retry.
  //   3. If both fail, the user is logged out.
  useEffect(() => {
    async function hydrate() {
      const hasAccessToken  = Boolean(tokenStore.get());
      const hasRefreshToken = Boolean(refreshStore.get());

      if (!hasAccessToken && !hasRefreshToken) {
        setLoading(false);
        return;
      }

      // Fast path — access token still valid
      if (hasAccessToken) {
        const me = await getMe();
        if (me) { setUser(me); setLoading(false); return; }
      }

      // Slow path — access token expired, try refresh
      if (hasRefreshToken) {
        const ok = await refreshToken();
        if (ok) {
          const me = await getMe();
          setUser(me ?? null);
        } else {
          // Refresh token also expired — clear everything
          clearTokens();
        }
      }

      setLoading(false);
    }

    hydrate();
    return () => clearTimeout(refreshTimer.current);
  }, []);

  // ── Auth actions ───────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    await apiLogin(email, password);
    const me = await getMe();
    setUser(me);
    return me;
  }, []);

  const signup = useCallback(async (email, password) => {
    await apiSignup(email, password);
    const me = await getMe();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  // ── Proactive access-token refresh (every 14 minutes) ─────────────────────
  // Keeps the session alive silently. Adjust to match ACCESS_TOKEN_EXPIRE_MINUTES.
  useEffect(() => {
    if (!user) return;
    refreshTimer.current = setInterval(async () => {
      const ok = await refreshToken();
      if (!ok) { setUser(null); clearTokens(); }
    }, 14 * 60 * 1000);
    return () => clearInterval(refreshTimer.current);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      signup,
      logout,
      getToken: tokenStore.get,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
