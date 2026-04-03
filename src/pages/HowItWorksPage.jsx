/**
 * HowItWorksPage.jsx
 *
 * Full dedicated page for /how-it-works.
 * Design system: identical to landing page (same T tokens, same primitives,
 * same animation patterns). No new visual language introduced.
 *
 * Sections:
 *   HIWHero → PipelineSection → DecisionEngineSection →
 *   OutputSection → TrustSection → ImpactSection → HIWCta → Footer
 *
 * Interactive state:
 *   - budget (slider, DecisionEngineSection)
 *   - activeOutput ('json' | 'table', OutputSection toggle)
 */

import { useState, useEffect } from "react";
import Nav from "../components/Nav";
import Button from "../components/UI/Button";
import Reveal from "../components/UI/Reveal";
import RequestAccess from "../components/RequestAccess";

// ─── Design tokens (source of truth: tokens.css) ─────────────────────────────
const T = {
  bg:           "#08080c",
  surface:      "#0d0d12",
  surfaceAlt:   "#0f0f15",
  surfaceHov:   "#121218",
  border:       "rgba(255,255,255,0.05)",
  borderHov:    "rgba(61,90,254,0.28)",
  borderSubtle: "rgba(255,255,255,0.04)",
  accent:       "#3D5AFE",
  accentLight:  "rgba(61,90,254,0.12)",
  accentGlow:   "rgba(61,90,254,0.3)",
  text:         "#EDEDF0",
  textSub:      "rgba(237,237,240,0.45)",
  textMuted:    "rgba(237,237,240,0.22)",
  textFaint:    "rgba(237,237,240,0.10)",
  serif:   "'Playfair Display', serif",
  sans:    "'DM Sans', sans-serif",
  mono:    "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
  ease:    "cubic-bezier(0.22, 1, 0.36, 1)",
  easeIn:  "cubic-bezier(0.4, 0, 0.2, 1)",
};

// ─── Shared primitives ────────────────────────────────────────────────────────

const Grain = () => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 9999,
    pointerEvents: "none", opacity: 0.022, mixBlendMode: "overlay",
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    backgroundSize: "160px 160px",
  }} />
);

const Label = ({ children }) => (
  <div style={{
    fontFamily: T.sans, fontSize: "0.62rem", fontWeight: 500,
    letterSpacing: "0.18em", textTransform: "uppercase",
    color: T.textMuted, marginBottom: "1rem",
  }}>
    {children}
  </div>
);

const SectionTitle = ({ children, center = false }) => (
  <h2 style={{
    fontFamily: T.serif,
    fontSize: "clamp(1.9rem, 3.5vw, 2.8rem)",
    fontWeight: 700,
    color: T.text,
    lineHeight: 1.1,
    letterSpacing: "-0.025em",
    margin: "0 0 1.25rem",
    textAlign: center ? "center" : "left",
  }}>{children}</h2>
);

const Body = ({ children, style = {}, center = false }) => (
  <p style={{
    fontFamily: T.sans, fontSize: "0.92rem", fontWeight: 300,
    color: T.textSub, lineHeight: 1.82,
    textAlign: center ? "center" : "left",
    ...style,
  }}>{children}</p>
);

const Divider = () => (
  <div style={{
    width: "100%", height: "1px",
    background: `linear-gradient(90deg, transparent 0%, ${T.border} 30%, ${T.border} 70%, transparent 100%)`,
  }} />
);

const Section = ({ children, alt = false, style: extra = {} }) => (
  <section style={{ background: alt ? T.surfaceAlt : T.bg, padding: "7rem 2rem", ...extra }}>
    <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
      {children}
    </div>
  </section>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Tag = ({ children, accent = false }) => (
  <span style={{
    fontFamily: T.sans, fontSize: "0.62rem", fontWeight: 500,
    letterSpacing: "0.08em",
    color: accent ? T.accent : T.textSub,
    background: accent ? T.accentLight : T.surface,
    border: `1px solid ${accent ? "rgba(61,90,254,0.18)" : T.border}`,
    padding: "0.2rem 0.55rem",
    borderRadius: "3px",
    display: "inline-block",
  }}>{children}</span>
);

// ─── 1. Hero ──────────────────────────────────────────────────────────────────

const HIWHero = () => (
  <section style={{
    position: "relative",
    minHeight: "68vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: "0 1.5rem",
    textAlign: "center",
    background: T.bg,
  }}>
    {/* Radial glow */}
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: "600px", height: "400px", pointerEvents: "none",
      background: "radial-gradient(ellipse at center, rgba(61,90,254,0.06) 0%, transparent 70%)",
      filter: "blur(60px)",
    }} aria-hidden="true" />
    {/* Bottom fade */}
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      height: "200px", pointerEvents: "none",
      background: `linear-gradient(to top, ${T.bg} 0%, transparent 100%)`,
    }} aria-hidden="true" />

    <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", width: "100%" }}>
      {/* Entry badge */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: "0.5rem",
        marginBottom: "2.5rem",
        padding: "0.3rem 0.85rem 0.3rem 0.6rem",
        background: T.accentLight,
        border: `1px solid rgba(61,90,254,0.2)`,
        borderRadius: "100px",
        animation: "fadeSlideInHIW 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both",
      }}>
        <span style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: T.accent, flexShrink: 0,
          animation: "dotBlinkHIW 2.4s ease-in-out infinite",
        }} />
        <span style={{
          fontFamily: T.sans, fontSize: "0.67rem", fontWeight: 500,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "rgba(100,130,255,0.9)",
        }}>
          &lt; 80ms · End-to-end
        </span>
      </div>

      {/* Headline */}
      <div style={{
        animation: "fadeSlideInHIW 0.75s cubic-bezier(0.22,1,0.36,1) 0.2s both",
        marginBottom: "2rem",
      }}>
        <h1 style={{
          fontFamily: T.serif,
          fontSize: "clamp(2.8rem, 6vw, 5rem)",
          fontWeight: 700,
          color: T.text,
          lineHeight: 1.0,
          letterSpacing: "-0.03em",
          margin: "0 0 0.1em",
        }}>
          One pipeline.
        </h1>
        <h1 style={{
          fontFamily: T.serif,
          fontSize: "clamp(2.8rem, 6vw, 5rem)",
          fontWeight: 700,
          fontStyle: "italic",
          color: "rgba(237,237,240,0.18)",
          lineHeight: 1.0,
          letterSpacing: "-0.03em",
          margin: 0,
        }} aria-hidden="true">
          zero ambiguity.
        </h1>
      </div>

      {/* Subtitle */}
      <p style={{
        fontFamily: T.sans, fontSize: "1rem", fontWeight: 300,
        color: T.textSub, lineHeight: 1.72,
        maxWidth: "420px", margin: "0 auto",
        animation: "fadeSlideInHIW 0.75s cubic-bezier(0.22,1,0.36,1) 0.32s both",
      }}>
        Intervenix runs a four-stage decision loop on every transaction —
        from raw signal to structured action in under 80ms.
      </p>
    </div>

    <style>{`
      @keyframes fadeSlideInHIW {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes dotBlinkHIW {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.3; }
      }
      @media (prefers-reduced-motion: reduce) {
        [style*="fadeSlideInHIW"],
        [style*="dotBlinkHIW"] { animation: none !important; opacity: 1 !important; }
      }
    `}</style>
  </section>
);

// ─── 2. Pipeline ──────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  {
    n: "01", title: "Ingest", tag: "< 2ms",
    body: "Connect via REST or event stream. Transactions, behavioral signals, and entity attributes arrive in under 2ms.",
    color: "#4ade80",
  },
  {
    n: "02", title: "Score", tag: "< 50ms",
    body: "Multi-model ensemble runs fraud, credit, and compliance scoring in parallel — simultaneously, across the full entity graph.",
    color: "#60a5fa",
  },
  {
    n: "03", title: "Optimize", tag: "< 20ms",
    body: "Constrained optimization allocates intervention budget across the risk-weighted portfolio. Maximum expected recovery, minimum cost.",
    color: T.accent,
  },
  {
    n: "04", title: "Act", tag: "Instant",
    body: "Block, flag, reroute, or escalate — dispatched automatically with a structured audit payload attached.",
    color: "#fbbf24",
  },
];

const PipelineNode = ({ n, title, tag, body, color, isLast }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? T.surfaceHov : T.surfaceAlt,
        padding: "2.5rem 2rem",
        transition: `background 0.2s ${T.easeIn}`,
        cursor: "default",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top accent line on hover */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "1px",
        background: hov
          ? `linear-gradient(90deg, transparent, ${color}60, transparent)`
          : "transparent",
        transition: `background 0.3s ${T.easeIn}`,
      }} />

      {/* Right connector (all but last) */}
      {!isLast && (
        <div style={{
          position: "absolute", top: "50%", right: "-1px",
          width: "1px", height: "32px",
          transform: "translateY(-50%)",
          background: `linear-gradient(to bottom, transparent, ${T.accent}30, transparent)`,
          zIndex: 2,
        }} />
      )}

      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "2rem",
      }}>
        <span style={{
          fontFamily: T.serif, fontSize: "1.5rem", fontWeight: 700,
          color: hov ? `${color}80` : "rgba(61,90,254,0.18)",
          lineHeight: 1,
          transition: `color 0.25s ${T.easeIn}`,
        }}>{n}</span>
        <Tag accent>{tag}</Tag>
      </div>

      <div style={{
        fontFamily: T.sans, fontSize: "0.88rem", fontWeight: 500,
        color: T.text, marginBottom: "0.75rem", letterSpacing: "0.005em",
        display: "flex", alignItems: "center", gap: "0.5rem",
      }}>
        <span style={{
          fontSize: "0.72rem",
          color: hov ? color : T.textMuted,
          transition: `color 0.2s ease`,
        }}>◆</span>
        {title}
      </div>

      <div style={{
        fontFamily: T.sans, fontSize: "0.82rem", fontWeight: 300,
        color: T.textSub, lineHeight: 1.78,
      }}>{body}</div>
    </div>
  );
};

const PipelineSection = () => (
  <Section>
    <Reveal>
      <div style={{ maxWidth: "520px", marginBottom: "4rem" }}>
        <Label>The Pipeline</Label>
        <SectionTitle>Four stages. Machine speed.</SectionTitle>
        <Body>
          Every transaction passes through all four stages sequentially —
          no batching, no queuing, no shortcuts.
        </Body>
      </div>
    </Reveal>

    {/* 4-column pipeline grid */}
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "1px",
      background: T.border,
    }} className="hiw-pipeline-grid">
      {PIPELINE_STEPS.map((s, i) => (
        <Reveal key={s.n} delay={i * 0.07}>
          <PipelineNode {...s} isLast={i === PIPELINE_STEPS.length - 1} />
        </Reveal>
      ))}
    </div>

    <style>{`
      @media (max-width: 900px) {
        .hiw-pipeline-grid { grid-template-columns: repeat(2, 1fr) !important; }
      }
      @media (max-width: 540px) {
        .hiw-pipeline-grid { grid-template-columns: 1fr !important; }
      }
    `}</style>
  </Section>
);

// ─── 3. Decision Engine ───────────────────────────────────────────────────────

const SEGMENTS = [
  { label: "High Risk",   ratePct: 0.44, costPerAction: 253, rowColor: "#f87171" },
  { label: "Medium Risk", ratePct: 0.36, costPerAction: 145, rowColor: "#fbbf24" },
  { label: "Low Risk",    ratePct: 0.20, costPerAction: 233, rowColor: "#4ade80" },
];

const fmtDollar = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
};

const AllocationTable = ({ budget }) => {
  const rows = SEGMENTS.map(({ label, ratePct, costPerAction, rowColor }) => {
    const alloc   = budget * ratePct;
    const actions = Math.max(1, Math.round(alloc / costPerAction));
    return { label, alloc, actions, rowColor };
  });
  const totalActions = rows.reduce((s, r) => s + r.actions, 0);
  const recovery     = Math.round(budget * 6.8);
  const roi          = (recovery / budget).toFixed(1);

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: "8px",
      overflow: "hidden",
      fontFamily: T.sans,
    }}>
      {/* Table header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        padding: "0.65rem 1.25rem",
        background: "rgba(255,255,255,0.025)",
        borderBottom: `1px solid ${T.border}`,
      }}>
        {["Segment", "Budget Allocated", "Actions"].map(h => (
          <span key={h} style={{
            fontSize: "0.62rem", fontWeight: 500,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: T.textMuted,
          }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      {rows.map(({ label, alloc, actions, rowColor }, i) => (
        <div key={label} style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          padding: "1rem 1.25rem",
          borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none",
          transition: "background 0.15s ease",
        }}
          onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: rowColor, flexShrink: 0,
            }} />
            <span style={{ fontSize: "0.82rem", color: T.text }}>{label}</span>
          </span>
          <span style={{ fontSize: "0.82rem", color: T.textSub }}>{fmtDollar(alloc)}</span>
          <span style={{ fontSize: "0.82rem", color: T.textSub }}>{actions.toLocaleString()}</span>
        </div>
      ))}

      {/* Footer: totals */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        padding: "1rem 1.25rem",
        borderTop: `1px solid ${T.border}`,
        background: "rgba(255,255,255,0.015)",
      }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 500, color: T.text }}>Total</span>
        <span style={{ fontSize: "0.78rem", fontWeight: 500, color: T.text }}>{fmtDollar(budget)}</span>
        <span style={{ fontSize: "0.78rem", fontWeight: 500, color: T.text }}>{totalActions.toLocaleString()}</span>
      </div>

      {/* Recovery bar */}
      <div style={{
        padding: "1rem 1.25rem",
        borderTop: `1px solid ${T.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{
            fontFamily: T.sans, fontSize: "0.62rem", fontWeight: 500,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: T.textMuted, marginBottom: "0.25rem",
          }}>Expected Recovery</div>
          <div style={{
            fontFamily: T.serif, fontSize: "1.5rem", fontWeight: 700,
            color: "#4ade80", letterSpacing: "-0.02em",
          }}>{fmtDollar(recovery)}</div>
        </div>
        <span style={{
          fontFamily: T.mono, fontSize: "0.78rem",
          color: "#4ade80",
          background: "rgba(74,222,128,0.08)",
          border: "1px solid rgba(74,222,128,0.2)",
          padding: "0.3rem 0.7rem",
          borderRadius: "3px",
        }}>{roi}× ROI</span>
      </div>
    </div>
  );
};

const BudgetSlider = ({ value, onChange }) => (
  <div>
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      marginBottom: "0.75rem",
    }}>
      <label style={{
        fontFamily: T.sans, fontSize: "0.62rem", fontWeight: 500,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color: T.textMuted,
      }}>
        Intervention Budget
      </label>
      <span style={{
        fontFamily: T.serif, fontSize: "1.35rem", fontWeight: 700,
        color: T.text, letterSpacing: "-0.02em",
      }}>{fmtDollar(value)}</span>
    </div>

    <input
      type="range"
      min={10000}
      max={500000}
      step={5000}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: "100%", cursor: "pointer" }}
      className="hiw-slider"
    />

    <div style={{
      display: "flex", justifyContent: "space-between",
      marginTop: "0.4rem",
    }}>
      <span style={{ fontFamily: T.sans, fontSize: "0.68rem", color: T.textMuted }}>$10k</span>
      <span style={{ fontFamily: T.sans, fontSize: "0.68rem", color: T.textMuted }}>$500k</span>
    </div>

    <style>{`
      .hiw-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 2px;
        background: linear-gradient(
          to right,
          ${T.accent} 0%,
          ${T.accent} ${((value - 10000) / (500000 - 10000)) * 100}%,
          rgba(255,255,255,0.08) ${((value - 10000) / (500000 - 10000)) * 100}%,
          rgba(255,255,255,0.08) 100%
        );
        border-radius: 2px;
        outline: none;
      }
      .hiw-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px; height: 14px;
        border-radius: 50%;
        background: ${T.accent};
        border: 2px solid rgba(255,255,255,0.15);
        box-shadow: 0 0 0 3px rgba(61,90,254,0.2);
        cursor: pointer;
        transition: box-shadow 0.15s ease, transform 0.15s ease;
      }
      .hiw-slider::-webkit-slider-thumb:hover {
        box-shadow: 0 0 0 5px rgba(61,90,254,0.3);
        transform: scale(1.1);
      }
      .hiw-slider::-moz-range-thumb {
        width: 14px; height: 14px;
        border-radius: 50%;
        background: ${T.accent};
        border: 2px solid rgba(255,255,255,0.15);
        cursor: pointer;
      }
    `}</style>
  </div>
);

const DecisionEngineSection = () => {
  const [budget, setBudget] = useState(50000);

  return (
    <Section alt>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6rem",
        alignItems: "start",
      }} className="hiw-engine-grid">
        <Reveal>
          <Label>Decision Engine</Label>
          <SectionTitle>Optimization at transaction time.</SectionTitle>
          <Body style={{ marginBottom: "2.5rem" }}>
            At scoring time, Intervenix solves a constrained allocation problem —
            distributing your intervention budget across the risk-weighted portfolio
            to maximize expected recovery. No manual triage. No static rules.
          </Body>
          <BudgetSlider value={budget} onChange={setBudget} />
          <p style={{
            fontFamily: T.sans, fontSize: "0.72rem",
            color: T.textMuted, marginTop: "1.25rem", lineHeight: 1.65,
          }}>
            Adjust budget to see real-time allocation across risk segments.
            Recovery estimate based on average interception rate across live deployments.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <AllocationTable budget={budget} />
        </Reveal>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .hiw-engine-grid { grid-template-columns: 1fr !important; gap: 3rem !important; }
        }
      `}</style>
    </Section>
  );
};

// ─── 4. Output ────────────────────────────────────────────────────────────────

const OUTPUT_FIELDS = [
  { key: "transaction_id", value: "txn_9k2m4x",         type: "string",  color: "#a78bfa" },
  { key: "risk_score",     value: "94.7",                type: "float",   color: "#4ade80" },
  { key: "decision",       value: "BLOCK",               type: "enum",    color: "#fbbf24" },
  { key: "latency_ms",     value: "38",                  type: "int",     color: "#4ade80" },
  { key: "confidence",     value: "0.97",                type: "float",   color: "#4ade80" },
  { key: "factors",        value: '["velocity_breach", "geo_mismatch"]', type: "array", color: "#f87171" },
  { key: "budget_used",    value: "$247.50",             type: "float",   color: "#4ade80" },
  { key: "model_ver",      value: "ivx-v2.4.1",          type: "string",  color: "#86efac" },
  { key: "audit_id",       value: "ivx_8f3k92m",         type: "string",  color: "#a78bfa" },
];

const JSONLine = ({ k, v, color }) => (
  <div style={{ paddingLeft: "1.25rem", display: "flex", gap: "0", lineHeight: 1.95 }}>
    <span style={{ color: "#7aa2ff" }}>"{k}"</span>
    <span style={{ color: T.textMuted, opacity: 0.5 }}>: </span>
    <span style={{ color }}>{v},</span>
  </div>
);

const JSONView = () => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.surface,
        border: `1px solid ${hov ? T.borderHov : T.border}`,
        borderRadius: "8px",
        overflow: "hidden",
        fontFamily: T.mono,
        fontSize: "0.76rem",
        lineHeight: 1.95,
        transition: `border-color 0.25s ease, box-shadow 0.25s ease`,
        boxShadow: hov
          ? `0 0 0 1px rgba(61,90,254,0.1), 0 8px 40px rgba(0,0,0,0.5)`
          : `0 4px 24px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Window chrome */}
      <div style={{
        background: "rgba(255,255,255,0.025)",
        padding: "0.65rem 1.25rem",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: "0.4rem",
      }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map(c => (
          <div key={c} style={{
            width: "9px", height: "9px", borderRadius: "50%",
            background: c, opacity: 0.7,
          }} />
        ))}
        <span style={{
          fontFamily: T.sans, color: T.textSub,
          marginLeft: "0.75rem", fontSize: "0.67rem",
          letterSpacing: "0.04em",
        }}>
          POST /v1/score  ·  200 OK  ·  38ms
        </span>
      </div>

      <div style={{ padding: "1.4rem 1.6rem" }}>
        <div><span style={{ color: T.textSub }}>{"{"}</span></div>
        {OUTPUT_FIELDS.map(({ key, value, color }) => (
          <JSONLine
            key={key}
            k={key}
            v={key === "decision" ? `"${value}"` : key === "factors" ? value : value}
            color={color}
          />
        ))}
        <div><span style={{ color: T.textSub }}>{"}"}</span></div>
      </div>
    </div>
  );
};

const TableView = () => (
  <div style={{
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: "8px",
    overflow: "hidden",
    fontFamily: T.sans,
    fontSize: "0.80rem",
  }}>
    {/* Header */}
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1.4fr 0.6fr",
      padding: "0.65rem 1.25rem",
      background: "rgba(255,255,255,0.025)",
      borderBottom: `1px solid ${T.border}`,
    }}>
      {["Field", "Value", "Type"].map(h => (
        <span key={h} style={{
          fontSize: "0.62rem", fontWeight: 500,
          letterSpacing: "0.1em", textTransform: "uppercase",
          color: T.textMuted,
        }}>{h}</span>
      ))}
    </div>

    {OUTPUT_FIELDS.map(({ key, value, type, color }, i) => (
      <div
        key={key}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.4fr 0.6fr",
          padding: "0.75rem 1.25rem",
          borderBottom: i < OUTPUT_FIELDS.length - 1 ? `1px solid ${T.border}` : "none",
          transition: "background 0.15s ease",
        }}
        onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <span style={{ fontFamily: T.mono, fontSize: "0.73rem", color: "#7aa2ff" }}>{key}</span>
        <span style={{ color, fontFamily: T.mono, fontSize: "0.73rem" }}>{value}</span>
        <span style={{
          color: T.textMuted, fontSize: "0.68rem",
          background: T.surfaceAlt,
          border: `1px solid ${T.border}`,
          padding: "0.1rem 0.4rem",
          borderRadius: "3px",
          display: "inline-block",
          alignSelf: "center",
          height: "fit-content",
        }}>{type}</span>
      </div>
    ))}
  </div>
);

const OutputSection = () => {
  const [view, setView] = useState("json");

  return (
    <Section>
      <div style={{ marginBottom: "4rem" }}>
        <Reveal>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-end", flexWrap: "wrap", gap: "1.5rem",
          }}>
            <div>
              <Label>Output</Label>
              <SectionTitle>Structured. Auditable. Actionable.</SectionTitle>
              <Body style={{ maxWidth: "460px" }}>
                Every scoring event returns a typed payload — risk score, contributing
                factors, budget consumed, and a cryptographically signed audit record.
                Plug into any downstream system in minutes.
              </Body>
            </div>

            {/* Integration tags */}
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", paddingBottom: "1.5rem" }}>
              {["REST API", "Webhooks", "Kafka", "gRPC"].map(tag => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          </div>
        </Reveal>

        {/* View toggle */}
        <div style={{
          display: "inline-flex",
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: "6px",
          padding: "3px",
          marginTop: "2rem",
          gap: "2px",
        }}>
          {[["json", "JSON Response"], ["table", "Field Reference"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              style={{
                fontFamily: T.sans, fontSize: "0.72rem", fontWeight: 500,
                letterSpacing: "0.04em",
                padding: "0.4rem 1rem",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                transition: `all 0.15s ${T.easeIn}`,
                background: view === key ? T.accent : "transparent",
                color: view === key ? "#fff" : T.textSub,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Reveal>
        {view === "json" ? <JSONView /> : <TableView />}
      </Reveal>
    </Section>
  );
};

// ─── 5. Trust ─────────────────────────────────────────────────────────────────

const TRUST_CARDS = [
  {
    icon: "◎",
    title: "Calibration",
    body: "Predicted probabilities match observed event frequencies within ±2%. Validated monthly across all active model versions with held-out production data.",
    detail: "Brier score ≤ 0.04 · Monthly validation",
  },
  {
    icon: "◈",
    title: "Explainability",
    body: "SHAP-attributed factor weights for every scoring decision. Every block, flag, or escalation ships with a human-readable rationale trace.",
    detail: "SHAP values · Per-decision attribution",
  },
  {
    icon: "■",
    title: "Audit Trail",
    body: "Immutable, cryptographically signed decision records. Queryable by audit_id in under 100ms. Full compliance export for AML, KYC, and PSD2.",
    detail: "Queryable in < 100ms · SOC 2 ready",
  },
];

const TrustCard = ({ icon, title, body, detail }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "2rem 1.75rem",
        background: hov ? "rgba(61,90,254,0.035)" : T.surfaceAlt,
        transition: `background 0.2s ${T.easeIn}`,
        cursor: "default",
        position: "relative",
      }}
    >
      <div style={{
        fontSize: "0.88rem",
        color: hov ? T.accent : T.textMuted,
        marginBottom: "1.25rem",
        transition: `color 0.2s ease`,
      }}>{icon}</div>

      <div style={{
        fontFamily: T.sans, fontSize: "0.86rem", fontWeight: 500,
        color: T.text, marginBottom: "0.6rem",
      }}>{title}</div>

      <div style={{
        fontFamily: T.sans, fontSize: "0.80rem", fontWeight: 300,
        color: T.textSub, lineHeight: 1.75, marginBottom: "1.25rem",
      }}>{body}</div>

      <div style={{
        fontFamily: T.mono, fontSize: "0.68rem",
        color: hov ? T.accent : T.textMuted,
        letterSpacing: "0.04em",
        borderTop: `1px solid ${T.border}`,
        paddingTop: "1rem",
        transition: `color 0.2s ease`,
      }}>{detail}</div>
    </div>
  );
};

const TrustSection = () => (
  <Section alt>
    <Reveal>
      <div style={{ textAlign: "center", maxWidth: "500px", margin: "0 auto 4rem" }}>
        <Label>Trust Layer</Label>
        <SectionTitle center>Every score earns its number.</SectionTitle>
        <Body center>
          Three properties make Intervenix deployable in regulated environments
          where a wrong decision has legal, financial, and operational consequences.
        </Body>
      </div>
    </Reveal>

    <Reveal delay={0.08}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "1px",
        background: T.border,
        border: `1px solid ${T.border}`,
        borderRadius: "2px",
        overflow: "hidden",
      }} className="hiw-trust-grid">
        {TRUST_CARDS.map(c => (
          <TrustCard key={c.title} {...c} />
        ))}
      </div>
    </Reveal>

    <style>{`
      @media (max-width: 768px) {
        .hiw-trust-grid { grid-template-columns: 1fr !important; }
      }
    `}</style>
  </Section>
);

// ─── 6. Impact ────────────────────────────────────────────────────────────────

const IMPACT_STATS = [
  { value: "94.3%", label: "Precision on fraud detection", sub: "vs. 71% industry average" },
  { value: "38ms",  label: "p99 decision latency",         sub: "end-to-end, production" },
  { value: "$220M", label: "Intercepted in Q1 2026",       sub: "across deployed institutions" },
];

const ImpactStat = ({ value, label, sub, i, last }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "2.75rem 2.5rem 2.75rem 0",
        paddingLeft: i > 0 ? "2.5rem" : "0",
        borderRight: !last ? `1px solid ${T.border}` : "none",
        cursor: "default",
      }}
    >
      <div style={{
        fontFamily: T.serif,
        fontSize: "clamp(2.2rem, 4vw, 3.2rem)",
        fontWeight: 700,
        color: T.text,
        lineHeight: 1,
        letterSpacing: "-0.03em",
        marginBottom: "0.5rem",
        transition: "text-shadow 0.3s ease",
        textShadow: hov ? `0 0 40px ${T.accentGlow}` : "none",
      }}>{value}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.80rem",
        fontWeight: 400, color: T.text, marginBottom: "0.25rem",
      }}>{label}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.72rem",
        fontWeight: 300, color: T.textMuted,
      }}>{sub}</div>
    </div>
  );
};

const ImpactSection = () => (
  <Section>
    <Reveal>
      <div style={{ maxWidth: "480px", marginBottom: "4rem" }}>
        <Label>Measured Impact</Label>
        <SectionTitle>Results across deployed institutions.</SectionTitle>
      </div>
    </Reveal>

    <Reveal delay={0.1}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        borderTop: `1px solid ${T.border}`,
      }} className="hiw-impact-grid">
        {IMPACT_STATS.map((s, i) => (
          <ImpactStat
            key={s.value} {...s} i={i}
            last={i === IMPACT_STATS.length - 1}
          />
        ))}
      </div>
    </Reveal>

    <style>{`
      @media (max-width: 640px) {
        .hiw-impact-grid {
          grid-template-columns: 1fr !important;
        }
        .hiw-impact-grid > div {
          border-right: none !important;
          border-bottom: 1px solid ${T.border};
          padding-left: 0 !important;
        }
        .hiw-impact-grid > div:last-child {
          border-bottom: none;
        }
      }
    `}</style>
  </Section>
);

// ─── 7. CTA ───────────────────────────────────────────────────────────────────

const HIWCta = ({ onRequestAccess }) => (
  <section style={{
    position: "relative", overflow: "hidden",
    padding: "10rem 2rem", background: T.bg, textAlign: "center",
  }}>
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: "700px", height: "400px", pointerEvents: "none",
      background: "radial-gradient(ellipse at center, rgba(61,90,254,0.07) 0%, transparent 65%)",
      filter: "blur(60px)",
    }} />
    <div style={{
      position: "absolute", top: "50%", left: "5%", right: "5%", height: "1px",
      background: `linear-gradient(90deg, transparent, ${T.border} 20%, ${T.border} 80%, transparent)`,
      transform: "translateY(-80px)", pointerEvents: "none",
    }} />

    <div style={{ position: "relative", zIndex: 1, maxWidth: "540px", margin: "0 auto" }}>
      <Reveal>
        <p style={{
          fontFamily: T.sans, fontSize: "0.62rem", fontWeight: 500,
          letterSpacing: "0.18em", textTransform: "uppercase",
          color: T.textMuted, marginBottom: "1.5rem",
        }}>Get Started</p>
        <h2 style={{
          fontFamily: T.serif,
          fontSize: "clamp(2.1rem, 5vw, 3.6rem)",
          fontWeight: 700, color: T.text,
          lineHeight: 1.06, letterSpacing: "-0.025em",
          marginBottom: "1.25rem",
        }}>
          The intervention starts<br />
          <em style={{ fontStyle: "italic", color: T.textMuted }}>
            when you choose to act.
          </em>
        </h2>
        <Body center style={{ marginBottom: "2.75rem" }}>
          Join institutions already running Intervenix across their risk stack.
        </Body>
        <div style={{
          display: "flex", gap: "0.75rem",
          justifyContent: "center", flexWrap: "wrap", alignItems: "center",
        }}>
          <Button T={T} primary onClick={onRequestAccess}>Request Early Access</Button>
          <Button T={T}>Talk to an Engineer</Button>
        </div>
        <p style={{
          fontFamily: T.sans, fontSize: "0.70rem",
          color: T.textMuted, marginTop: "1.5rem",
        }}>
          No commitment. Response within 24 hours.
        </p>
      </Reveal>
    </div>
  </section>
);

// ─── 8. Footer ────────────────────────────────────────────────────────────────

const FooterLink = ({ children }) => {
  const [hov, setHov] = useState(false);
  return (
    <a
      href="#"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "block",
        fontFamily: T.sans, fontSize: "0.78rem", fontWeight: 300,
        color: hov ? T.text : T.textSub,
        marginBottom: "0.6rem",
        transition: "color 0.15s ease",
      }}
    >{children}</a>
  );
};

const HIWFooter = () => {
  const cols = [
    { head: "Product",  links: ["Overview", "How It Works", "Security", "Changelog"] },
    { head: "Company",  links: ["About", "Blog", "Careers", "Press"] },
    { head: "Legal",    links: ["Privacy", "Terms", "DPA", "Compliance"] },
  ];
  return (
    <footer style={{
      background: T.bg, borderTop: `1px solid ${T.border}`,
      padding: "4rem 2rem 2rem",
    }}>
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <div className="footer-grid" style={{ marginBottom: "3.5rem" }}>
          <div>
            <span style={{
              fontFamily: T.serif, fontSize: "1rem",
              fontWeight: 700, color: T.text,
              display: "block", marginBottom: "0.75rem",
            }}>Intervenix</span>
            <p style={{
              fontFamily: T.sans, fontSize: "0.78rem", fontWeight: 300,
              color: T.textSub, lineHeight: 1.7, maxWidth: "240px",
            }}>
              Real-time autonomous risk intervention for financial institutions.
            </p>
          </div>
          {cols.map(({ head, links }) => (
            <div key={head}>
              <p style={{
                fontFamily: T.sans, fontSize: "0.68rem", fontWeight: 500,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: T.textMuted, marginBottom: "1rem",
              }}>{head}</p>
              {links.map(l => <FooterLink key={l}>{l}</FooterLink>)}
            </div>
          ))}
        </div>
        <div style={{
          borderTop: `1px solid ${T.border}`,
          paddingTop: "1.5rem",
          display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: "0.75rem",
        }}>
          <span style={{ fontFamily: T.sans, fontSize: "0.70rem", color: T.textMuted }}>
            © 2026 Intervenix. An academic project of Vishwakarma Institute of Technology.
          </span>
          <span style={{ fontFamily: T.sans, fontSize: "0.70rem", color: T.textMuted }}>
            SOC 2 · ISO 27001 · GDPR
          </span>
        </div>
      </div>
    </footer>
  );
};

// ─── Access Modal ─────────────────────────────────────────────────────────────

const AccessModal = ({ onClose }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(8,8,12,0.88)",
        backdropFilter: "blur(10px)",
        overflowY: "auto",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        animation: "fadeIn 0.25s ease forwards",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "fixed", top: "1.25rem", right: "1.5rem",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          color: "rgba(237,237,240,0.4)",
          fontFamily: T.mono, fontSize: "0.75rem",
          padding: "0.4rem 0.85rem",
          cursor: "pointer", borderRadius: "4px",
          zIndex: 10001,
          transition: "color 0.15s, background 0.15s, border-color 0.15s",
          letterSpacing: "0.04em",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = "#EDEDF0";
          e.currentTarget.style.background = "rgba(255,255,255,0.08)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = "rgba(237,237,240,0.4)";
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        aria-label="Close"
      >
        ✕ esc
      </button>
      <div style={{ width: "100%", minHeight: "100vh" }}>
        <RequestAccess />
      </div>
    </div>
  );
};

// ─── Page root ────────────────────────────────────────────────────────────────

export default function HowItWorksPage() {
  const [showAccess, setShowAccess] = useState(false);
  const open  = () => setShowAccess(true);
  const close = () => setShowAccess(false);

  // Reset scroll on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <Grain />
      <Nav T={T} onRequestAccess={open} />

      {/* Page fade-in on mount */}
      <div style={{ animation: "fadeIn 0.3s ease both" }}>
        <HIWHero />
        <Divider />
        <PipelineSection />
        <Divider />
        <DecisionEngineSection />
        <Divider />
        <OutputSection />
        <Divider />
        <TrustSection />
        <Divider />
        <ImpactSection />
        <HIWCta onRequestAccess={open} />
        <HIWFooter />
      </div>

      {showAccess && <AccessModal onClose={close} />}
    </>
  );
}
