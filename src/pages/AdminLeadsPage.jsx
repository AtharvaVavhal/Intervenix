import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllLeads, fetchAnalytics, fetchUsers, updateLead } from "../services/leadApi";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:          "#08080c",
  surface:     "#0d0d12",
  surfaceAlt:  "#0f0f15",
  border:      "rgba(255,255,255,0.05)",
  accent:      "#3D5AFE",
  accentLight: "rgba(61,90,254,0.12)",
  text:        "#EDEDF0",
  textSub:     "rgba(237,237,240,0.45)",
  textMuted:   "rgba(237,237,240,0.22)",
  serif:       "'Playfair Display', serif",
  sans:        "'DM Sans', sans-serif",
  mono:        "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_STYLES = {
  high:   { color: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)" },
  medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)" },
  low:    { color: "#6b7280", bg: "rgba(107,114,128,0.10)", border: "rgba(107,114,128,0.20)" },
};

const STATUS_STYLES = {
  new:       { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",   border: "rgba(96,165,250,0.2)" },
  contacted: { color: "#a78bfa", bg: "rgba(167,139,250,0.08)",  border: "rgba(167,139,250,0.2)" },
  qualified: { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",   border: "rgba(251,191,36,0.2)" },
  converted: { color: "#4ade80", bg: "rgba(74,222,128,0.08)",   border: "rgba(74,222,128,0.2)" },
  rejected:  { color: "#6b7280", bg: "rgba(107,114,128,0.08)",  border: "rgba(107,114,128,0.18)" },
};

// Forward-only transition map (mirrors backend VALID_TRANSITIONS)
const VALID_TRANSITIONS = {
  new:       ["contacted", "rejected"],
  contacted: ["qualified",  "rejected"],
  qualified: ["converted",  "rejected"],
  converted: [],
  rejected:  [],
};

const ALL_STATUSES = ["new", "contacted", "qualified", "converted", "rejected"];

// ─── Primitives ───────────────────────────────────────────────────────────────

function Badge({ label, styles }) {
  const s = styles ?? { color: T.textMuted, bg: "transparent", border: T.border };
  return (
    <span style={{
      display: "inline-block", padding: "0.18rem 0.55rem", borderRadius: "3px",
      fontSize: "0.63rem", fontFamily: T.sans, fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {label}
    </span>
  );
}

function Th({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        padding: "0.75rem 1rem", textAlign: "left", fontFamily: T.sans,
        fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.1em",
        textTransform: "uppercase", whiteSpace: "nowrap", userSelect: "none",
        color: active ? T.accent : T.textMuted,
        borderBottom: `1px solid ${T.border}`, cursor: "pointer",
      }}
    >
      {label}
      {active && <span style={{ marginLeft: "0.3rem", opacity: 0.7 }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

// ─── Analytics bar ────────────────────────────────────────────────────────────

function AnalyticsBar({ analytics }) {
  if (!analytics) return null;
  const { total_leads, high_priority_count, conversion_rate, status_breakdown } = analytics;

  const cards = [
    { label: "Total Leads",    value: total_leads,          color: T.text },
    { label: "High Priority",  value: high_priority_count,  color: "#ef4444" },
    { label: "Conversion Rate",value: `${conversion_rate}%`, color: "#4ade80" },
    { label: "New",            value: status_breakdown.new,      color: "#60a5fa" },
    { label: "Contacted",      value: status_breakdown.contacted, color: "#a78bfa" },
    { label: "Qualified",      value: status_breakdown.qualified, color: "#fbbf24" },
    { label: "Converted",      value: status_breakdown.converted, color: "#4ade80" },
    { label: "Rejected",       value: status_breakdown.rejected,  color: "#6b7280" },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(8, 1fr)",
      gap: "1px", background: T.border,
      border: `1px solid ${T.border}`, borderRadius: "6px",
      overflow: "hidden", marginBottom: "1.5rem",
    }}>
      {cards.map(({ label, value, color }) => (
        <div key={label} style={{ background: T.surface, padding: "1rem 1.25rem" }}>
          <div style={{ fontFamily: T.serif, fontSize: "1.4rem", fontWeight: 700, color, lineHeight: 1 }}>
            {value}
          </div>
          <div style={{ fontSize: "0.65rem", color: T.textMuted, marginTop: "0.3rem", whiteSpace: "nowrap" }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Status dropdown ──────────────────────────────────────────────────────────

function StatusDropdown({ lead, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const options = VALID_TRANSITIONS[lead.status] ?? [];

  const handleChange = async (e) => {
    const next = e.target.value;
    if (!next) return;
    setSaving(true);
    try {
      const updated = await updateLead(lead.id, { status: next });
      onUpdate(updated);
    } catch (err) {
      alert(err?.body?.detail ?? "Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const isTerminal = options.length === 0;

  return (
    <select
      disabled={saving || isTerminal}
      onChange={handleChange}
      onClick={e => e.stopPropagation()}
      value=""
      style={{
        background: T.surfaceAlt, border: `1px solid ${T.border}`,
        color: isTerminal ? T.textMuted : T.text,
        borderRadius: "4px", padding: "0.3rem 0.5rem",
        fontSize: "0.72rem", fontFamily: T.sans, cursor: isTerminal ? "default" : "pointer",
        outline: "none",
      }}
    >
      <option value="" disabled>{saving ? "Saving…" : isTerminal ? "—" : "Move to…"}</option>
      {options.map(s => (
        <option key={s} value={s} style={{ background: "#0d0d12" }}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  );
}

// ─── Assign dropdown ──────────────────────────────────────────────────────────

function AssignDropdown({ lead, users, onUpdate }) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (e) => {
    const userId = parseInt(e.target.value, 10);
    setSaving(true);
    try {
      const updated = await updateLead(lead.id, { assigned_to_id: userId });
      onUpdate(updated);
    } catch (err) {
      alert(err?.body?.detail ?? "Failed to assign lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      disabled={saving}
      onChange={handleChange}
      onClick={e => e.stopPropagation()}
      value={lead.assigned_to_id ?? 0}
      style={{
        background: T.surfaceAlt, border: `1px solid ${T.border}`,
        color: T.text, borderRadius: "4px", padding: "0.3rem 0.5rem",
        fontSize: "0.72rem", fontFamily: T.sans, cursor: "pointer",
        outline: "none",
      }}
    >
      <option value={0} style={{ background: "#0d0d12" }}>Unassigned</option>
      {users.map(u => (
        <option key={u.id} value={u.id} style={{ background: "#0d0d12" }}>
          {u.email}
        </option>
      ))}
    </select>
  );
}

// ─── Lead row ─────────────────────────────────────────────────────────────────

function LeadRow({ lead, idx, users, onUpdate }) {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(lead.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const cell = {
    padding: "0.8rem 1rem", fontSize: "0.78rem", color: T.text,
    borderBottom: `1px solid ${T.border}`, fontFamily: T.sans, verticalAlign: "middle",
  };
  const rowBg = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)";

  return (
    <>
      <tr
        onClick={() => setExpanded(e => !e)}
        style={{ background: rowBg, cursor: "pointer", transition: "background 0.1s" }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(61,90,254,0.04)"}
        onMouseLeave={e => e.currentTarget.style.background = rowBg}
      >
        <td style={{ ...cell, fontFamily: T.mono, color: T.accent, fontWeight: 600 }}>
          {lead.lead_score}
        </td>
        <td style={cell}>
          <Badge label={lead.priority} styles={PRIORITY_STYLES[lead.priority]} />
        </td>
        <td style={cell}>
          <Badge label={lead.status} styles={STATUS_STYLES[lead.status]} />
        </td>
        <td style={cell}>{lead.name}</td>
        <td style={{ ...cell, color: T.textSub }}>{lead.company}</td>
        <td style={{ ...cell, color: T.textSub, textTransform: "capitalize" }}>{lead.use_case}</td>
        <td style={{ ...cell, fontFamily: T.mono, fontSize: "0.73rem", color: T.textSub }}>
          {lead.volume.toLocaleString()}
        </td>
        <td style={cell} onClick={e => e.stopPropagation()}>
          <StatusDropdown lead={lead} onUpdate={onUpdate} />
        </td>
        <td style={cell} onClick={e => e.stopPropagation()}>
          <AssignDropdown lead={lead} users={users} onUpdate={onUpdate} />
        </td>
        <td style={{ ...cell, color: T.textMuted, fontSize: "0.72rem" }}>{date}</td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={10} style={{
            padding: "1rem 1.5rem 1.25rem",
            background: "rgba(61,90,254,0.025)",
            borderBottom: `1px solid ${T.border}`,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.25rem" }}>
              {[
                { label: "Email",   value: lead.email,   mono: true, highlight: true },
                { label: "Role",    value: lead.role },
                { label: "Stack",   value: lead.stack },
              ].map(({ label, value, mono, highlight }) => (
                <div key={label}>
                  <div style={{ fontSize: "0.62rem", color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: "0.78rem", fontFamily: mono ? T.mono : T.sans, color: highlight ? T.accent : T.textSub }}>
                    {value}
                  </div>
                </div>
              ))}
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: "0.62rem", color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.3rem" }}>Problem</div>
                <div style={{ fontSize: "0.78rem", color: T.textSub, lineHeight: 1.7 }}>{lead.problem}</div>
              </div>
              {lead.notes && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: "0.62rem", color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.3rem" }}>Notes</div>
                  <div style={{ fontSize: "0.78rem", color: T.textSub, lineHeight: 1.7 }}>{lead.notes}</div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminLeadsPage() {
  const navigate = useNavigate();

  const [leads,     setLeads]     = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const [sortField, setSortField] = useState("lead_score");
  const [sortDir,   setSortDir]   = useState("desc");
  const [filterPri, setFilterPri] = useState("all");   // all | high | medium | low
  const [filterSt,  setFilterSt]  = useState("all");   // all | <status>

  // Load all data in parallel
  useEffect(() => {
    Promise.all([fetchAllLeads(), fetchAnalytics(), fetchUsers()])
      .then(([leadsData, analyticsData, usersData]) => {
        setLeads(leadsData);
        setAnalytics(analyticsData);
        setUsers(usersData);
      })
      .catch((err) => {
        if (err?.status === 401) navigate("/login");
        else if (err?.status === 403) setError("Access denied — admin account required.");
        else setError("Failed to load data. Check your connection.");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  // When a lead is updated (status change / assignment), splice it into local state
  const handleLeadUpdate = useCallback((updated) => {
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
    // Refresh analytics quietly
    fetchAnalytics().then(setAnalytics).catch(() => {});
  }, []);

  const handleSort = useCallback((field) => {
    setSortDir(prev => sortField === field ? (prev === "asc" ? "desc" : "asc") : "desc");
    setSortField(field);
  }, [sortField]);

  const displayed = [...leads]
    .filter(l => filterPri === "all" || l.priority === filterPri)
    .filter(l => filterSt  === "all" || l.status   === filterSt)
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.sans }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${T.border}`, background: T.surface,
        padding: "1.1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span onClick={() => navigate("/dashboard")}
            style={{ color: T.textMuted, fontSize: "0.78rem", cursor: "pointer" }}>
            ← Dashboard
          </span>
          <span style={{ color: T.border }}>|</span>
          <span style={{ fontFamily: T.serif, fontSize: "1.05rem", fontWeight: 700 }}>
            Lead Pipeline
          </span>
        </div>
        <span style={{ fontFamily: T.mono, fontSize: "0.68rem", color: T.textMuted }}>
          {displayed.length} / {leads.length} leads
        </span>
      </div>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem" }}>

        {/* ── Loading / error ──────────────────────────────────────────────── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "6rem", color: T.textMuted, fontSize: "0.82rem" }}>
            Loading…
          </div>
        )}
        {error && (
          <div style={{ textAlign: "center", padding: "6rem", color: "#ef4444", fontSize: "0.82rem" }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── Analytics ─────────────────────────────────────────────── */}
            <AnalyticsBar analytics={analytics} />

            {/* ── Filters ───────────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
              {/* Priority filter */}
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {["all", "high", "medium", "low"].map(p => (
                  <button key={p} onClick={() => setFilterPri(p)} style={{
                    padding: "0.3rem 0.75rem", borderRadius: "4px",
                    fontSize: "0.70rem", fontFamily: T.sans, cursor: "pointer",
                    background: filterPri === p ? T.accent : T.surface,
                    color: filterPri === p ? "#fff" : T.textSub,
                    border: `1px solid ${filterPri === p ? T.accent : T.border}`,
                    transition: "all 0.12s",
                  }}>
                    {p === "all" ? "All priority" : p}
                  </button>
                ))}
              </div>
              <div style={{ width: "1px", background: T.border }} />
              {/* Status filter */}
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {["all", ...ALL_STATUSES].map(s => (
                  <button key={s} onClick={() => setFilterSt(s)} style={{
                    padding: "0.3rem 0.75rem", borderRadius: "4px",
                    fontSize: "0.70rem", fontFamily: T.sans, cursor: "pointer",
                    background: filterSt === s ? T.accentLight : T.surface,
                    color: filterSt === s ? T.accent : T.textSub,
                    border: `1px solid ${filterSt === s ? T.accent : T.border}`,
                    transition: "all 0.12s",
                  }}>
                    {s === "all" ? "All status" : s}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Table ─────────────────────────────────────────────────── */}
            <div style={{
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: "6px", overflow: "hidden",
            }}>
              {displayed.length === 0 ? (
                <div style={{ textAlign: "center", padding: "4rem", color: T.textMuted, fontSize: "0.82rem" }}>
                  No leads match the current filters.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: T.surfaceAlt }}>
                        <Th label="Score"    field="lead_score" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Priority" field="priority"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Status"   field="status"     sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Name"     field="name"       sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Company"  field="company"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Use Case" field="use_case"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Volume"   field="volume"     sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                        <th style={{ padding: "0.75rem 1rem", fontSize: "0.65rem", fontFamily: T.sans,
                          fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
                          color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>
                          Move Status
                        </th>
                        <th style={{ padding: "0.75rem 1rem", fontSize: "0.65rem", fontFamily: T.sans,
                          fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
                          color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>
                          Assign
                        </th>
                        <Th label="Date"     field="created_at" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((lead, idx) => (
                        <LeadRow
                          key={lead.id}
                          lead={lead}
                          idx={idx}
                          users={users}
                          onUpdate={handleLeadUpdate}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
