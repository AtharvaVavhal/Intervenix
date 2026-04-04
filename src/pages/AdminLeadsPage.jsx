import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllLeads } from "../services/leadApi";

// ─── Design tokens (match App.jsx) ───────────────────────────────────────────
const T = {
  bg:          "#08080c",
  surface:     "#0d0d12",
  surfaceAlt:  "#0f0f15",
  border:      "rgba(255,255,255,0.05)",
  borderHov:   "rgba(61,90,254,0.28)",
  accent:      "#3D5AFE",
  accentLight: "rgba(61,90,254,0.12)",
  text:        "#EDEDF0",
  textSub:     "rgba(237,237,240,0.45)",
  textMuted:   "rgba(237,237,240,0.22)",
  serif:       "'Playfair Display', serif",
  sans:        "'DM Sans', sans-serif",
  mono:        "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
};

// ─── Priority badge ───────────────────────────────────────────────────────────
const PRIORITY_STYLES = {
  high:   { color: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)" },
  medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)" },
  low:    { color: "#6b7280", bg: "rgba(107,114,128,0.10)", border: "rgba(107,114,128,0.20)" },
};

function PriorityBadge({ priority }) {
  const s = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low;
  return (
    <span style={{
      display: "inline-block",
      padding: "0.18rem 0.55rem",
      borderRadius: "3px",
      fontSize: "0.63rem",
      fontFamily: T.sans,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: s.color,
      background: s.bg,
      border: `1px solid ${s.border}`,
    }}>
      {priority}
    </span>
  );
}

// ─── Column header with sort indicator ───────────────────────────────────────
function Th({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        padding: "0.75rem 1rem",
        textAlign: "left",
        fontFamily: T.sans,
        fontSize: "0.65rem",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: active ? T.accent : T.textMuted,
        borderBottom: `1px solid ${T.border}`,
        cursor: "pointer",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {label}
      {active && (
        <span style={{ marginLeft: "0.35rem", opacity: 0.7 }}>
          {sortDir === "asc" ? "↑" : "↓"}
        </span>
      )}
    </th>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminLeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [sortField, setSortField] = useState("lead_score");
  const [sortDir, setSortDir]   = useState("desc");
  const [filter, setFilter]     = useState("all"); // all | high | medium | low

  useEffect(() => {
    fetchAllLeads()
      .then(setLeads)
      .catch((err) => {
        if (err?.status === 401) navigate("/login");
        else if (err?.status === 403) setError("Access denied — admin account required.");
        else setError("Failed to load leads. Check your connection and try again.");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleSort = useCallback((field) => {
    setSortDir(prev => sortField === field ? (prev === "asc" ? "desc" : "asc") : "desc");
    setSortField(field);
  }, [sortField]);

  const displayed = [...leads]
    .filter(l => filter === "all" || l.priority === filter)
    .sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const counts = {
    high:   leads.filter(l => l.priority === "high").length,
    medium: leads.filter(l => l.priority === "medium").length,
    low:    leads.filter(l => l.priority === "low").length,
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.sans }}>

      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
        padding: "1.25rem 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span
            onClick={() => navigate("/dashboard")}
            style={{ color: T.textMuted, fontSize: "0.78rem", cursor: "pointer" }}
          >
            ← Dashboard
          </span>
          <span style={{ color: T.border }}>|</span>
          <span style={{ fontFamily: T.serif, fontSize: "1.05rem", fontWeight: 700 }}>
            Lead Pipeline
          </span>
        </div>
        <span style={{ fontFamily: T.mono, fontSize: "0.68rem", color: T.textMuted }}>
          {leads.length} leads
        </span>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
          {[
            { label: "High Priority",   count: counts.high,   color: "#ef4444", priority: "high" },
            { label: "Medium Priority", count: counts.medium, color: "#f59e0b", priority: "medium" },
            { label: "Low Priority",    count: counts.low,    color: "#6b7280", priority: "low" },
          ].map(({ label, count, color, priority }) => (
            <div
              key={priority}
              onClick={() => setFilter(f => f === priority ? "all" : priority)}
              style={{
                background: filter === priority ? "rgba(61,90,254,0.05)" : T.surface,
                border: `1px solid ${filter === priority ? T.accent : T.border}`,
                borderRadius: "6px",
                padding: "1.25rem 1.5rem",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ fontSize: "1.8rem", fontFamily: T.serif, fontWeight: 700, color, lineHeight: 1 }}>
                {count}
              </div>
              <div style={{ fontSize: "0.72rem", color: T.textSub, marginTop: "0.4rem" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* State: loading / error / empty */}
        {loading && (
          <div style={{ textAlign: "center", padding: "4rem", color: T.textMuted, fontSize: "0.82rem" }}>
            Loading leads…
          </div>
        )}
        {error && (
          <div style={{ textAlign: "center", padding: "4rem", color: "#ef4444", fontSize: "0.82rem" }}>
            {error}
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: "6px",
            overflow: "hidden",
          }}>
            {displayed.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem", color: T.textMuted, fontSize: "0.82rem" }}>
                No leads yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: T.surfaceAlt }}>
                      <Th label="Score"    field="lead_score"  sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <Th label="Priority" field="priority"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <Th label="Name"     field="name"        sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <Th label="Company"  field="company"     sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <Th label="Role"     field="role"        sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <Th label="Use Case" field="use_case"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <Th label="Volume"   field="volume"      sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <Th label="Callback" field="callback_requested" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <Th label="Date"     field="created_at"  sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((lead, idx) => (
                      <LeadRow key={lead.id} lead={lead} idx={idx} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadRow({ lead, idx }) {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(lead.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const cellStyle = {
    padding: "0.85rem 1rem",
    fontSize: "0.78rem",
    color: T.text,
    borderBottom: `1px solid ${T.border}`,
    fontFamily: T.sans,
    verticalAlign: "top",
  };

  return (
    <>
      <tr
        onClick={() => setExpanded(e => !e)}
        style={{
          background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
          cursor: "pointer",
          transition: "background 0.12s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(61,90,254,0.04)"}
        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"}
      >
        <td style={{ ...cellStyle, fontFamily: T.mono, color: T.accent, fontWeight: 600 }}>
          {lead.lead_score}
        </td>
        <td style={cellStyle}>
          <PriorityBadge priority={lead.priority} />
        </td>
        <td style={cellStyle}>{lead.name}</td>
        <td style={{ ...cellStyle, color: T.textSub }}>{lead.company}</td>
        <td style={{ ...cellStyle, color: T.textSub, textTransform: "capitalize" }}>{lead.role}</td>
        <td style={{ ...cellStyle, color: T.textSub, textTransform: "capitalize" }}>{lead.use_case}</td>
        <td style={{ ...cellStyle, fontFamily: T.mono, fontSize: "0.73rem", color: T.textSub }}>
          {Number(lead.volume).toLocaleString()}
        </td>
        <td style={{ ...cellStyle, color: lead.callback_requested ? "#4ade80" : T.textMuted }}>
          {lead.callback_requested ? "Yes" : "—"}
        </td>
        <td style={{ ...cellStyle, color: T.textMuted, fontSize: "0.72rem" }}>{date}</td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr>
          <td colSpan={9} style={{
            padding: "1rem 1.5rem 1.25rem",
            background: "rgba(61,90,254,0.03)",
            borderBottom: `1px solid ${T.border}`,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <div style={{ fontSize: "0.63rem", color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.35rem" }}>Email</div>
                <div style={{ fontSize: "0.78rem", color: T.accent }}>{lead.email}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.63rem", color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.35rem" }}>Stack</div>
                <div style={{ fontSize: "0.78rem", color: T.textSub }}>{lead.stack}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: "0.63rem", color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.35rem" }}>Problem</div>
                <div style={{ fontSize: "0.78rem", color: T.textSub, lineHeight: 1.7 }}>{lead.problem}</div>
              </div>
              {lead.notes && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: "0.63rem", color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.35rem" }}>Notes</div>
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
