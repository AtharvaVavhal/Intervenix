import { ApiError } from "./authApi";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Re-use the authenticated request wrapper from authApi so token refresh
// is handled automatically on 401.
// We import request indirectly by calling authApi's exported `request`-backed
// functions — but since request() isn't exported, we replicate the same
// pattern here using tokenStore and refreshToken directly.
import { tokenStore, refreshToken } from "./authApi";

async function authFetch(path, options = {}, retry = true) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const token = tokenStore.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const refreshed = await refreshToken();
    if (refreshed) return authFetch(path, options, false);
  }

  return res;
}

/**
 * GET /dashboard/summary
 * Returns the portfolio + model health summary for the logged-in user.
 */
export async function getDashboardSummary() {
  const res = await authFetch("/dashboard/summary");
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
