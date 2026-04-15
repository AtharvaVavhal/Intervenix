// ─── Token store ──────────────────────────────────────────────────────────────
// Access token is kept in memory for speed, and mirrored in localStorage so
// the first /me call after a hard reload can succeed immediately (before the
// refresh cycle completes). It expires in 15 min, so the security window is
// small. Swap to sessionStorage if you want stricter isolation.
const AT_KEY = "intervenix_at";
let _accessToken = localStorage.getItem(AT_KEY) ?? null;

export const tokenStore = {
  get:   ()      => _accessToken,
  set:   (token) => { _accessToken = token; localStorage.setItem(AT_KEY, token); },
  clear: ()      => { _accessToken = null;  localStorage.removeItem(AT_KEY); },
};

// ─── Refresh token (persisted across page loads) ──────────────────────────────
const RT_KEY = "intervenix_rt";

export const refreshStore = {
  get:   ()      => localStorage.getItem(RT_KEY),
  set:   (token) => localStorage.setItem(RT_KEY, token),
  clear: ()      => localStorage.removeItem(RT_KEY),
};

// ─── Base fetch with automatic token refresh ──────────────────────────────────
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request(path, options = {}, retry = true) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const token = tokenStore.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  // Access token expired → try refresh once
  if (res.status === 401 && retry) {
    const refreshed = await refreshToken();
    if (refreshed) {
      return request(path, options, false); // one retry
    }
    // Refresh also failed — caller handles the 401
  }

  return res;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

/**
 * POST /auth/signup
 * Returns { access_token, refresh_token, token_type }
 */
export async function signup(email, password) {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data);

  tokenStore.set(data.access_token);
  refreshStore.set(data.refresh_token);
  return data;
}

/**
 * POST /auth/login  (OAuth2 password form expected by FastAPI)
 * Returns { access_token, refresh_token, token_type }
 */
export async function login(email, password) {
  // FastAPI's OAuth2PasswordRequestForm expects form-encoded body
  const body = new URLSearchParams({ username: email, password });

  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data);

  tokenStore.set(data.access_token);
  refreshStore.set(data.refresh_token);
  return data;
}

/**
 * POST /auth/refresh
 * Returns a new { access_token }
 */
export async function refreshToken() {
  const rt = refreshStore.get();
  if (!rt) return false;

  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });

    if (!res.ok) {
      refreshStore.clear();
      tokenStore.clear();
      return false;
    }

    const data = await res.json();
    tokenStore.set(data.access_token);
    if (data.refresh_token) refreshStore.set(data.refresh_token); // rotation
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /auth/me
 * Returns the current user object.
 */
export async function getMe() {
  const res = await request("/auth/me");
  if (!res.ok) return null;
  return res.json();
}

/**
 * Call on logout — clears both tokens.
 */
export function clearTokens() {
  tokenStore.clear();
  refreshStore.clear();
}

// ─── Error type ───────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(status, body) {
    const message =
      body?.detail ??
      body?.message ??
      (typeof body === "string" ? body : "Request failed");
    super(typeof message === "string" ? message : JSON.stringify(message));
    this.status = status;
    this.body   = body;
  }
}
