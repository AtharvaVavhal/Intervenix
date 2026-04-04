import { ApiError, tokenStore } from "./authApi";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Public ────────────────────────────────────────────────────────────────────

export async function submitLead(data) {
  const res = await fetch(`${BASE}/lead/talk-to-engineer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name:               data.fullName,
      email:              data.email,
      company:            data.company,
      role:               data.role,
      volume:             parseInt(data.volume, 10) || 0,
      use_case:           data.useCase,
      problem:            data.problem,
      stack:              data.stack,
      notes:              data.notes ?? "",
      callback_requested: data.callback ?? false,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

// ── Admin — helpers ───────────────────────────────────────────────────────────

function authHeaders() {
  const token = tokenStore.get();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function adminGet(path) {
  const res  = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

// ── Admin — lead endpoints ────────────────────────────────────────────────────

/** GET /lead/all — sorted by score DESC */
export const fetchAllLeads = () => adminGet("/lead/all");

/** GET /lead/high-priority */
export const fetchHighPriorityLeads = () => adminGet("/lead/high-priority");

/** GET /lead/analytics */
export const fetchAnalytics = () => adminGet("/lead/analytics");

/**
 * PATCH /lead/{id}
 * @param {number} id
 * @param {{ status?: string, assigned_to_id?: number }} updates
 */
export async function updateLead(id, updates) {
  const res = await fetch(`${BASE}/lead/${id}`, {
    method:  "PATCH",
    headers: authHeaders(),
    body:    JSON.stringify(updates),
  });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

// ── Admin — user endpoints ────────────────────────────────────────────────────

/** GET /auth/users — list of { id, email, is_admin } */
export const fetchUsers = () => adminGet("/auth/users");
