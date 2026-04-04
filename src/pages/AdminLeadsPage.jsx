import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchAllLeads, fetchAnalytics, fetchUsers, fetchStaleLeads,
  fetchQueue, fetchLeadEvents, updateLead,
} from "../services/leadApi";

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

const VALID_TRANSITIONS = {
  new:       ["contacted", "rejected"],
  contacted: ["qualified",  "rejected"],
  qualified: ["converted",  "rejected"],
  converted: [],
  rejected:  [],
};

const ALL_STATUSES = ["new", "contacted", "qualified", "converted", "rejected"];
const PAGE_SIZE    = 20;

const ACTION_LABELS = {
  created:        "Created",
  status_changed: "Status changed",
  assigned:       "Assigned",
  unassigned:     "Unassigned",
};

// ─── Primitives ───────────────────────────────────────────────────────────────

function Badge({ label, styles: s }) {
  return (
    <span style={{
      display: "inline-block", padding: "0.18rem 0.55rem", borderRadius: "3px",
      fontSize: "0.63rem", fontFamily: T.sans, fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: s?.color ?? T.textMuted,
      background: s?.bg ?? "transparent",
      border: `1px solid ${s?.border ?? T.border}`,
    }}>{label}</span>
  );
}

function Th({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <th onClick={() => onSort(field)} style={{
      padding: "0.75rem 1rem", textAlign: "left", fontFamily: T.sans,
      fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.1em",
      textTransform: "uppercase", whiteSpace: "nowrap", userSelect: "none",
      color: active ? T.accent : T.textMuted,
      borderBottom: `1px solid ${T.border}`, cursor: "pointer",
    }}>
      {label}
      {active && <span style={{ marginLeft: "0.3rem", opacity: 0.7 }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

function StaticTh({ label }) {
  return (
    <th style={{
      padding: "0.75rem 1rem", fontSize: "0.65rem", fontFamily: T.sans,
      fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
      color: T.textMuted, borderBottom: `1px solid ${T.border}`,
    }}>{label}</th>
  );
}

// ─── Analytics section ────────────────────────────────────────────────────────

function AnalyticsSection({ analytics }) {
  if (!analytics) return null;
  const { total_leads, high_priority_count, conversion_rate, status_breakdown, assignee_stats } = analytics;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {/* Top metrics */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(8, 1fr)",
        gap: "1px", background: T.border,
        border: `1px solid ${T.border}`, borderRadius: "6px",
        overflow: "hidden", marginBottom: "1rem",
      }}>
        {[
          { label: "Total",      value: total_leads,           color: T.text },
          { label: "High Pri",   value: high_priority_count,   color: "#ef4444" },
          { label: "Converted",  value: `${conversion_rate}%`, color: "#4ade80" },
          { label: "New",        value: status_breakdown.new,       color: "#60a5fa" },
          { label: "Contacted",  value: status_breakdown.contacted,  color: "#a78bfa" },
          { label: "Qualified",  value: status_breakdown.qualified,  color: "#fbbf24" },
          { label: "Converted",  value: status_breakdown.converted,  color: "#4ade80" },
          { label: "Rejected",   value: status_breakdown.rejected,   color: "#6b7280" },
        ].map(({ label, value, color }, i) => (
          <div key={i} style={{ background: T.surface, padding: "0.9rem 1.1rem" }}>
            <div style={{ fontFamily: T.serif, fontSize: "1.35rem", fontWeight: 700, color, lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ fontSize: "0.62rem", color: T.textMuted, marginTop: "0.25rem" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Assignee performance */}
      {assignee_stats.length > 0 && (
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: "6px", padding: "1rem 1.25rem",
        }}>
          <div style={{ fontSize: "0.62rem", color: T.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
            Rep Performance
          </div>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {assignee_stats.map(s => (
              <div key={s.user_id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ fontSize: "0.72rem", color: T.textSub }}>{s.email}</div>
                <div style={{ fontFamily: T.mono, fontSize: "0.70rem", color: T.accent }}>
                  {s.assigned_count} assigned
                </div>
                <div style={{ fontFamily: T.mono, fontSize: "0.70rem", color: "#4ade80" }}>
                  {s.conversion_rate}% conv.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Action dropdowns ─────────────────────────────────────────────────────────

function StatusDropdown({ lead, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const options = VALID_TRANSITIONS[lead.status] ?? [];
  if (options.length === 0) return <span style={{ color: T.textMuted, fontSize: "0.72rem" }}>—</span>;

  return (
    <select disabled={saving} onChange={async e => {
      if (!e.target.value) return;
      setSaving(true);
      try { onUpdate(await updateLead(lead.id, { status: e.target.value })); }
      catch (err) { alert(err?.body?.detail ?? "Failed to update status."); }
      finally { setSaving(false); }
    }} onClick={e => e.stopPropagation()} value="" style={selectStyle}>
      <option value="" disabled>{saving ? "Saving…" : "Move to…"}</option>
      {options.map(s => <option key={s} value={s} style={{ background: "#0d0d12" }}>{s}</option>)}
    </select>
  );
}

function AssignDropdown({ lead, users, onUpdate }) {
  const [saving, setSaving] = useState(false);
  return (
    <select disabled={saving} onChange={async e => {
      setSaving(true);
      try { onUpdate(await updateLead(lead.id, { assigned_to_id: parseInt(e.target.value, 10) })); }
      catch (err) { alert(err?.body?.detail ?? "Failed to assign."); }
      finally { setSaving(false); }
    }} onClick={e => e.stopPropagation()} value={lead.assigned_to_id ?? 0} style={selectStyle}>
      <option value={0} style={{ background: "#0d0d12" }}>Unassigned</option>
      {users.map(u => <option key={u.id} value={u.id} style={{ background: "#0d0d12" }}>{u.email}</option>)}
    </select>
  );
}

const selectStyle = {
  background: T.surfaceAlt, border: `1px solid ${T.border}`,
  color: T.text, borderRadius: "4px", padding: "0.3rem 0.5rem",
  fontSize: "0.72rem", fontFamily: T.sans, cursor: "pointer", outline: "none",
};

// ─── Audit drawer ─────────────────────────────────────────────────────────────

function AuditDrawer({ lead, users, onClose }) {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    fetchLeadEvents(lead.id).then(setEvents).catch(() => setEvents([]));
  }, [lead.id]);

  const userEmail = id => users.find(u => u.id === id)?.email ?? (id ? `user #${id}` : "system");

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(8,8,12,0.7)", backdropFilter: "blur(4px)",
      display: "flex", justifyContent: "flex-end",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "420px", height: "100%", background: T.surface,
        borderLeft: `1px solid ${T.border}`, overflowY: "auto",
        padding: "1.5rem",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ fontFamily: T.serif, fontSize: "1rem", fontWeight: 700 }}>{lead.name}</div>
            <div style={{ fontSize: "0.72rem", color: T.textMuted, marginTop: "0.2rem" }}>{lead.company}</div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: T.textMuted,
            cursor: "pointer", fontSize: "1rem", padding: "0.25rem",
          }}>✕</button>
        </div>

        <div style={{ fontSize: "0.62rem", color: T.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
          Audit Trail
        </div>

        {!events && <div style={{ color: T.textMuted, fontSize: "0.78rem" }}>Loading…</div>}
        {events?.length === 0 && <div style={{ color: T.textMuted, fontSize: "0.78rem" }}>No events recorded.</div>}

        {events?.map(ev => (
          <div key={ev.id} style={{
            borderLeft: `2px solid ${T.border}`, paddingLeft: "0.85rem",
            marginBottom: "1rem",
          }}>
            <div style={{ fontSize: "0.75rem", color: T.text, fontWeight: 500 }}>
              {ACTION_LABELS[ev.action] ?? ev.action}
              {ev.old_value && ev.new_value && (
                <span style={{ color: T.textMuted, fontWeight: 400 }}>
                  {" "}<span style={{ color: "#ef4444" }}>{ev.old_value}</span>
                  {" → "}
                  <span style={{ color: "#4ade80" }}>{ev.new_value}</span>
                </span>
              )}
              {!ev.old_value && ev.new_value && (
                <span style={{ color: T.textMuted }}> → {ev.new_value}</span>
              )}
            </div>
            <div style={{ fontSize: "0.68rem", color: T.textMuted, marginTop: "0.2rem" }}>
              {userEmail(ev.performed_by_id)} · {new Date(ev.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Lead row ─────────────────────────────────────────────────────────────────

function LeadRow({ lead, idx, users, onUpdate, onAudit, isStale }) {
  const [expanded, setExpanded] = useState(false);
  const cell = {
    padding: "0.8rem 1rem", fontSize: "0.78rem", color: T.text,
    borderBottom: `1px solid ${T.border}`, fontFamily: T.sans, verticalAlign: "middle",
  };
  const rowBg = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)";
  const date  = new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
        <td style={cell}><Badge label={lead.priority} styles={PRIORITY_STYLES[lead.priority]} /></td>
        <td style={cell}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Badge label={lead.status} styles={STATUS_STYLES[lead.status]} />
            {isStale && <span title="Stale — no update in 3+ days" style={{ color: "#f59e0b", fontSize: "0.7rem" }}>⚠</span>}
          </span>
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
        <td style={cell} onClick={e => { e.stopPropagation(); onAudit(lead); }}>
          <span style={{ fontSize: "0.70rem", color: T.accent, cursor: "pointer" }}>History</span>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={11} style={{
            padding: "1rem 1.5rem 1.25rem",
            background: "rgba(61,90,254,0.025)",
            borderBottom: `1px solid ${T.border}`,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.25rem" }}>
              {[
                { label: "Email", value: lead.email, mono: true, highlight: true },
                { label: "Role",  value: lead.role },
                { label: "Stack", value: lead.stack },
              ].map(({ label, value, mono, highlight }) => (
                <div key={label}>
                  <div style={{ fontSize: "0.62rem", color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.3rem" }}>{label}</div>
                  <div style={{ fontSize: "0.78rem", fontFamily: mono ? T.mono : T.sans, color: highlight ? T.accent : T.textSub }}>{value}</div>
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

// ─── Lead table (shared by all tabs) ─────────────────────────────────────────

function LeadTable({ leads, users, staleIds, onUpdate, onAudit, sortField, sortDir, onSort }) {
  if (leads.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: T.textMuted, fontSize: "0.82rem" }}>
        No leads here.
      </div>
    );
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: T.surfaceAlt }}>
            <Th label="Score"    field="lead_score" sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <Th label="Priority" field="priority"   sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <Th label="Status"   field="status"     sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <Th label="Name"     field="name"       sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <Th label="Company"  field="company"    sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <Th label="Use Case" field="use_case"   sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <Th label="Volume"   field="volume"     sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <StaticTh label="Move" />
            <StaticTh label="Assign" />
            <Th label="Date"     field="created_at" sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <StaticTh label="" />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, idx) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              idx={idx}
              users={users}
              isStale={staleIds.has(lead.id)}
              onUpdate={onUpdate}
              onAudit={onAudit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ total, limit, offset, onPage }) {
  const current = Math.floor(offset / limit);
  const pages   = Math.ceil(total / limit);
  if (pages <= 1) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", padding: "1.25rem", borderTop: `1px solid ${T.border}` }}>
      <PagBtn label="←" disabled={current === 0}         onClick={() => onPage((current - 1) * limit)} />
      <span style={{ fontFamily: T.mono, fontSize: "0.72rem", color: T.textMuted }}>
        {current + 1} / {pages}
      </span>
      <PagBtn label="→" disabled={current >= pages - 1}  onClick={() => onPage((current + 1) * limit)} />
    </div>
  );
}

function PagBtn({ label, disabled, onClick }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{
      background: T.surface, border: `1px solid ${T.border}`,
      color: disabled ? T.textMuted : T.text,
      borderRadius: "4px", padding: "0.3rem 0.7rem",
      fontSize: "0.75rem", fontFamily: T.sans,
      cursor: disabled ? "default" : "pointer",
    }}>{label}</button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = ["All Leads", "Queue", "Stale"];

export default function AdminLeadsPage() {
  const navigate = useNavigate();

  // Data
  const [page,     setPage]     = useState({ total: 0, limit: PAGE_SIZE, offset: 0, items: [] });
  const [analytics,setAnalytics]= useState(null);
  const [users,    setUsers]    = useState([]);
  const [queue,    setQueue]    = useState([]);
  const [stale,    setStale]    = useState([]);
  const [staleIds, setStaleIds] = useState(new Set());

  // UI state
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [tab,      setTab]      = useState(0);
  const [sortField,setSortField]= useState("lead_score");
  const [sortDir,  setSortDir]  = useState("desc");
  const [filterPri,setFilterPri]= useState("all");
  const [filterSt, setFilterSt] = useState("all");
  const [auditLead,setAuditLead]= useState(null);

  const loadPage = useCallback((offset) => {
    fetchAllLeads({ limit: PAGE_SIZE, offset })
      .then(setPage)
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetchAllLeads({ limit: PAGE_SIZE, offset: 0 }),
      fetchAnalytics(),
      fetchUsers(),
      fetchQueue(),
      fetchStaleLeads(),
    ])
      .then(([pageData, analyticsData, usersData, queueData, staleData]) => {
        setPage(pageData);
        setAnalytics(analyticsData);
        setUsers(usersData);
        setQueue(queueData);
        setStale(staleData);
        setStaleIds(new Set(staleData.map(l => l.id)));
      })
      .catch(err => {
        if (err?.status === 401) navigate("/login");
        else if (err?.status === 403) setError("Access denied — admin account required.");
        else setError("Failed to load data.");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLeadUpdate = useCallback((updated) => {
    const splice = list => list.map(l => l.id === updated.id ? updated : l);
    setPage(p => ({ ...p, items: splice(p.items) }));
    setQueue(splice);
    setStale(s => {
      const next = splice(s).filter(l => l.status === "contacted");
      setStaleIds(new Set(next.map(l => l.id)));
      return next;
    });
    fetchAnalytics().then(setAnalytics).catch(() => {});
  }, []);

  const handleSort = useCallback((field) => {
    setSortDir(prev => sortField === field ? (prev === "asc" ? "desc" : "asc") : "desc");
    setSortField(field);
  }, [sortField]);

  // Sort + filter the "All Leads" tab client-side (already paginated from server)
  const displayed = [...page.items]
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

  const tabLeads = tab === 0 ? displayed : tab === 1 ? queue : stale;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.sans }}>

      {/* Header */}
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
          <span style={{ fontFamily: T.serif, fontSize: "1.05rem", fontWeight: 700 }}>Lead Pipeline</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {stale.length > 0 && (
            <span style={{ fontSize: "0.70rem", color: "#f59e0b", fontFamily: T.sans }}>
              ⚠ {stale.length} stale
            </span>
          )}
          <span style={{ fontFamily: T.mono, fontSize: "0.68rem", color: T.textMuted }}>
            {page.total} leads
          </span>
        </div>
      </div>

      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "2rem" }}>

        {loading && <div style={{ textAlign: "center", padding: "6rem", color: T.textMuted }}>Loading…</div>}
        {error   && <div style={{ textAlign: "center", padding: "6rem", color: "#ef4444" }}>{error}</div>}

        {!loading && !error && (
          <>
            <AnalyticsSection analytics={analytics} />

            {/* Tabs */}
            <div style={{ display: "flex", gap: "0", marginBottom: "1rem", borderBottom: `1px solid ${T.border}` }}>
              {TABS.map((label, i) => (
                <button key={i} onClick={() => setTab(i)} style={{
                  padding: "0.6rem 1.25rem", background: "none",
                  border: "none", borderBottom: tab === i ? `2px solid ${T.accent}` : "2px solid transparent",
                  color: tab === i ? T.accent : T.textSub,
                  fontSize: "0.78rem", fontFamily: T.sans, cursor: "pointer",
                  marginBottom: "-1px",
                }}>
                  {label}
                  {i === 1 && queue.length > 0 && (
                    <span style={{ marginLeft: "0.35rem", fontFamily: T.mono, fontSize: "0.65rem", color: T.accent }}>
                      {queue.length}
                    </span>
                  )}
                  {i === 2 && stale.length > 0 && (
                    <span style={{ marginLeft: "0.35rem", fontFamily: T.mono, fontSize: "0.65rem", color: "#f59e0b" }}>
                      {stale.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Filters — All Leads tab only */}
            {tab === 0 && (
              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {["all", "high", "medium", "low"].map(p => (
                    <FilterBtn key={p} label={p === "all" ? "All priority" : p}
                      active={filterPri === p} onClick={() => setFilterPri(p)} />
                  ))}
                </div>
                <div style={{ width: "1px", background: T.border }} />
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {["all", ...ALL_STATUSES].map(s => (
                    <FilterBtn key={s} label={s === "all" ? "All status" : s}
                      active={filterSt === s} onClick={() => setFilterSt(s)} />
                  ))}
                </div>
              </div>
            )}

            {/* Table */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "6px", overflow: "hidden" }}>
              <LeadTable
                leads={tabLeads}
                users={users}
                staleIds={staleIds}
                onUpdate={handleLeadUpdate}
                onAudit={setAuditLead}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {tab === 0 && (
                <Pagination
                  total={page.total}
                  limit={page.limit}
                  offset={page.offset}
                  onPage={loadPage}
                />
              )}
            </div>
          </>
        )}
      </div>

      {auditLead && (
        <AuditDrawer lead={auditLead} users={users} onClose={() => setAuditLead(null)} />
      )}
    </div>
  );
}

function FilterBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "0.3rem 0.75rem", borderRadius: "4px",
      fontSize: "0.70rem", fontFamily: T.sans, cursor: "pointer",
      background: active ? T.accent : T.surface,
      color: active ? "#fff" : T.textSub,
      border: `1px solid ${active ? T.accent : T.border}`,
      transition: "all 0.12s",
    }}>{label}</button>
  );
}
