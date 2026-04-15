import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDashboardSummary } from "../services/dashboardApi";
import Nav from "../components/Nav";

// ── Design tokens (matches the rest of the app) ───────────────────────────────
const T = {
  bg:          "#08080c",
  surface:     "#0d0d12",
  surfaceAlt:  "#0f0f15",
  border:      "rgba(255,255,255,0.05)",
  borderHov:   "rgba(61,90,254,0.28)",
  accent:      "#3D5AFE",
  accentLight: "rgba(61,90,254,0.10)",
  text:        "#EDEDF0",
  textSub:     "rgba(237,237,240,0.45)",
  textMuted:   "rgba(237,237,240,0.22)",
  green:       "#4ade80",
  yellow:      "#fbbf24",
  red:         "#f87171",
  serif:       "'Playfair Display', serif",
  sans:        "'DM Sans', sans-serif",
  mono:        "'Fira Code', monospace",
  ease:        "cubic-bezier(0.22, 1, 0.36, 1)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtMoney(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  const map = {
    nominal:  { color: T.green,  bg: "rgba(74,222,128,0.10)",  border: "rgba(74,222,128,0.20)",  label: "Nominal"  },
    warning:  { color: T.yellow, bg: "rgba(251,191,36,0.10)",   border: "rgba(251,191,36,0.20)",   label: "Warning"  },
    critical: { color: T.red,    bg: "rgba(248,113,113,0.10)",  border: "rgba(248,113,113,0.20)",  label: "Critical" },
  };
  const s = map[status] ?? map.warning;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.4rem",
      fontFamily: T.sans, fontSize: "0.70rem", fontWeight: 500,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: s.color,
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: "100px",
      padding: "0.25rem 0.7rem",
    }}>
      <span style={{
        width: "5px", height: "5px", borderRadius: "50%",
        background: s.color,
        boxShadow: `0 0 6px ${s.color}`,
        animation: status === "nominal" ? "pulse 2s ease infinite" : "none",
      }} />
      {s.label}
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: "10px",
      padding: "1.5rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.4rem",
      transition: "border-color 0.2s ease",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = T.borderHov}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
    >
      <span style={{
        fontFamily: T.sans, fontSize: "0.68rem", fontWeight: 500,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: T.textMuted,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: T.serif, fontSize: "2rem", fontWeight: 700,
        color: accent ?? T.text,
        letterSpacing: "-0.02em", lineHeight: 1.1,
      }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontFamily: T.sans, fontSize: "0.75rem", color: T.textSub }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function MetricRow({ label, value, mono }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0.85rem 0",
      borderBottom: `1px solid ${T.border}`,
    }}>
      <span style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.textSub }}>
        {label}
      </span>
      <span style={{
        fontFamily: mono ? T.mono : T.sans,
        fontSize: mono ? "0.80rem" : "0.88rem",
        fontWeight: 500,
        color: T.text,
      }}>
        {value}
      </span>
    </div>
  );
}

function RiskBar({ high, medium, low, total }) {
  const pct = (n) => ((n / total) * 100).toFixed(1);
  const segments = [
    { label: "High",   value: high,   color: T.red,    pct: pct(high)   },
    { label: "Medium", value: medium, color: T.yellow, pct: pct(medium) },
    { label: "Low",    value: low,    color: T.green,  pct: pct(low)    },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      {/* Stacked bar */}
      <div style={{
        display: "flex", borderRadius: "4px", overflow: "hidden", height: "8px",
      }}>
        {segments.map(s => (
          <div key={s.label} style={{
            width: `${s.pct}%`, background: s.color,
            transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
          }} />
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: s.color }} />
            <span style={{ fontFamily: T.sans, fontSize: "0.75rem", color: T.textSub }}>
              {s.label} <span style={{ color: T.text, fontWeight: 500 }}>{fmt(s.value)}</span>
              <span style={{ color: T.textMuted }}> · {s.pct}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = "1rem", radius = "6px" }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "rgba(255,255,255,0.04)",
      animation: "shimmer 1.4s ease infinite",
    }} />
  );
}

// ── Error state ───────────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: "1rem",
      padding: "4rem 2rem", textAlign: "center",
    }}>
      <div style={{
        width: "48px", height: "48px", borderRadius: "50%",
        background: "rgba(248,113,113,0.08)",
        border: "1px solid rgba(248,113,113,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.25rem",
      }}>
        ⚠
      </div>
      <p style={{ fontFamily: T.sans, fontSize: "0.88rem", color: T.textSub, margin: 0 }}>
        {message}
      </p>
      <button
        onClick={onRetry}
        style={{
          fontFamily: T.sans, fontSize: "0.80rem", fontWeight: 500,
          color: "rgba(100,130,255,0.9)",
          background: "none", border: "none", cursor: "pointer",
          padding: "0.3rem 0", textDecoration: "underline",
          textUnderlineOffset: "3px",
        }}
      >
        Try again
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const summary = await getDashboardSummary();
      setData(summary);
    } catch (err) {
      setError(err?.message ?? "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans }}>
      <Nav T={T} onRequestAccess={() => {}} />

      <main style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "calc(60px + 3rem) 2rem 4rem",
      }}>
        {/* ── Header ── */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", flexWrap: "wrap", gap: "1rem",
          marginBottom: "2.5rem",
          animation: "dashFadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both",
        }}>
          <div>
            <div style={{
              fontFamily: T.sans, fontSize: "0.68rem", fontWeight: 500,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: T.textMuted, marginBottom: "0.4rem",
            }}>
              Decision Intelligence
            </div>
            <h1 style={{
              fontFamily: T.serif, fontSize: "1.8rem", fontWeight: 700,
              color: T.text, margin: 0, letterSpacing: "-0.02em",
            }}>
              Portfolio Overview
            </h1>
            {data && (
              <p style={{
                fontFamily: T.sans, fontSize: "0.80rem",
                color: T.textSub, margin: "0.4rem 0 0",
              }}>
                {data.user_email}
              </p>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {data && <StatusPill status={data.model_health.status} />}
            <Link to="/products" style={{
              fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500,
              color: T.textSub, textDecoration: "none",
              padding: "0.45rem 0.9rem",
              border: `1px solid ${T.border}`,
              borderRadius: "6px",
              transition: "all 0.15s ease",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub; }}
            >
              Open Suite →
            </Link>
          </div>
        </div>

        {/* ── Error ── */}
        {error && !loading && (
          <ErrorState message={error} onRetry={fetchData} />
        )}

        {/* ── Content ── */}
        {!error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* Row 1: portfolio stats + recovery */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              animation: "dashFadeUp 0.5s cubic-bezier(0.22,1,0.36,1) 0.05s both",
            }}>
              {loading ? (
                [0,1,2,3].map(i => (
                  <div key={i} style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: "10px", padding: "1.5rem",
                    display: "flex", flexDirection: "column", gap: "0.6rem",
                  }}>
                    <Skeleton w="60%" h="0.65rem" />
                    <Skeleton w="45%" h="1.8rem" />
                    <Skeleton w="80%" h="0.65rem" />
                  </div>
                ))
              ) : (
                <>
                  <StatCard
                    label="Total Portfolio"
                    value={fmt(data.total_portfolio)}
                    sub="active borrowers"
                  />
                  <StatCard
                    label="High Risk"
                    value={fmt(data.high_risk)}
                    sub={`${((data.high_risk / data.total_portfolio) * 100).toFixed(1)}% of portfolio`}
                    accent={T.red}
                  />
                  <StatCard
                    label="Medium Risk"
                    value={fmt(data.medium_risk)}
                    sub={`${((data.medium_risk / data.total_portfolio) * 100).toFixed(1)}% of portfolio`}
                    accent={T.yellow}
                  />
                  <StatCard
                    label="Expected Recovery"
                    value={fmtMoney(data.expected_recovery)}
                    sub="via intervention policy"
                    accent={T.green}
                  />
                </>
              )}
            </div>

            {/* Row 2: risk distribution + model health */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              animation: "dashFadeUp 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s both",
            }}
              className="dash-two-col"
            >
              {/* Risk distribution */}
              <div style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: "10px",
                padding: "1.5rem",
              }}>
                <div style={{
                  fontFamily: T.sans, fontSize: "0.68rem", fontWeight: 500,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  color: T.textMuted, marginBottom: "1.25rem",
                }}>
                  Risk Distribution
                </div>
                {loading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <Skeleton h="8px" radius="4px" />
                    <Skeleton w="70%" h="0.7rem" />
                  </div>
                ) : (
                  <RiskBar
                    high={data.high_risk}
                    medium={data.medium_risk}
                    low={data.low_risk}
                    total={data.total_portfolio}
                  />
                )}
              </div>

              {/* Model health */}
              <div style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: "10px",
                padding: "1.5rem",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: "0.25rem",
                }}>
                  <div style={{
                    fontFamily: T.sans, fontSize: "0.68rem", fontWeight: 500,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    color: T.textMuted,
                  }}>
                    Model Health
                  </div>
                  {!loading && data && <StatusPill status={data.model_health.status} />}
                </div>

                {loading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
                    {[0,1,2].map(i => <Skeleton key={i} h="2.5rem" />)}
                  </div>
                ) : (
                  <div style={{ marginTop: "0.5rem" }}>
                    <MetricRow
                      label="Population Stability Index (PSI)"
                      value={data.model_health.psi.toFixed(3)}
                      mono
                    />
                    <MetricRow
                      label="Expected Calibration Error (ECE)"
                      value={data.model_health.ece.toFixed(3)}
                      mono
                    />
                    <MetricRow
                      label="Status"
                      value={data.model_health.status.charAt(0).toUpperCase() + data.model_health.status.slice(1)}
                    />
                    <div style={{
                      marginTop: "1rem",
                      fontFamily: T.sans, fontSize: "0.72rem",
                      color: T.textMuted, lineHeight: 1.5,
                    }}>
                      PSI &lt; 0.10 → stable distribution.
                      ECE &lt; 0.05 → well-calibrated probabilities.
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>

      <style>{`
        @keyframes dashFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.8; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @media (max-width: 640px) {
          .dash-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
