import { ApiError, tokenStore } from "./authApi";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * POST /lead/talk-to-engineer
 *
 * No auth required — public endpoint.
 * Returns { status: "ok", id: number }
 */
export async function submitLead(data) {
  const res = await fetch(`${BASE}/lead/talk-to-engineer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name:               data.fullName,
      email:              data.email,
      company:            data.company,
      role:               data.role,
      volume:             parseInt(data.volume, 10) || 0,  // backend expects integer
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

/**
 * GET /lead/all
 *
 * Protected + admin only. Returns all leads sorted by score DESC.
 */
export async function fetchAllLeads() {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}/lead/all`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

/**
 * GET /lead/high-priority
 *
 * Protected + admin only. Returns only high-priority leads sorted by score.
 */
export async function fetchHighPriorityLeads() {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}/lead/high-priority`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}
