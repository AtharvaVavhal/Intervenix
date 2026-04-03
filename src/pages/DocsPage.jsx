/**
 * DocsPage.jsx
 *
 * Technical documentation for the Intervenix Decision Intelligence Engine.
 *
 * Layout: fixed sidebar (left, 240px) + scrollable content (right)
 *
 * Sections: Overview · Architecture · ML Pipeline · Decision Engine ·
 *           API Reference · Data Model · Reliability · Limitations
 *
 * Features:
 *   - IntersectionObserver active-section tracking
 *   - Syntax-highlighted code blocks with copy button
 *   - Anchor scroll with nav offset
 *   - Fully self-contained — no external libs beyond react-router-dom
 */

import { useState, useEffect, useRef, useCallback } from "react";
import Nav from "../components/Nav";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:          "#08080c",
  surface:     "#0d0d12",
  surfaceAlt:  "#0f0f15",
  surfaceHov:  "#121218",
  border:      "rgba(255,255,255,0.05)",
  accent:      "#3D5AFE",
  accentLight: "rgba(61,90,254,0.10)",
  accentGlow:  "rgba(61,90,254,0.3)",
  text:        "#EDEDF0",
  textSub:     "rgba(237,237,240,0.52)",
  textMuted:   "rgba(237,237,240,0.28)",
  textFaint:   "rgba(237,237,240,0.14)",
  green:       "#4ade80",
  yellow:      "#fbbf24",
  red:         "#f87171",
  blue:        "#60a5fa",
  purple:      "#a78bfa",
  serif:  "'Playfair Display', serif",
  sans:   "'DM Sans', sans-serif",
  mono:   "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
  ease:   "cubic-bezier(0.22, 1, 0.36, 1)",
  easeIn: "cubic-bezier(0.4, 0, 0.2, 1)",
};

// ─── Sidebar nav groups ───────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: "Core",
    items: [
      { id: "overview",     label: "Overview" },
      { id: "architecture", label: "Architecture" },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { id: "ml-pipeline",     label: "ML Pipeline" },
      { id: "decision-engine", label: "Decision Engine" },
    ],
  },
  {
    label: "Reference",
    items: [
      { id: "api",        label: "API Reference" },
      { id: "data-model", label: "Data Model" },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "reliability", label: "Reliability" },
      { id: "limitations", label: "Limitations" },
    ],
  },
];

const ALL_SECTION_IDS = NAV_GROUPS.flatMap(g => g.items.map(i => i.id));

// ─── Syntax highlighter (safe for static developer-authored content) ──────────
function sh(raw) {
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    // Inline comments (# ...)
    .replace(/(#[^\n]*)/g,
      `<span style="color:${T.textMuted}">$1</span>`)
    // JSON keys  "key":
    .replace(/"([^"\n]+)"(\s*:)/g,
      `<span style="color:#7aa2ff">"$1"</span>$2`)
    // String values  : "..."
    .replace(/:\s*"([^"\n]*)"/g,
      `: <span style="color:#f87171">"$1"</span>`)
    // Numbers  : 123 / 0.73
    .replace(/:\s*(-?\d[\d.,]*)/g,
      `: <span style="color:#4ade80">$1</span>`)
    // Booleans / null
    .replace(/:\s*(true|false|null)\b/g,
      `: <span style="color:#a78bfa">$1</span>`)
    // HTTP methods
    .replace(/\b(GET|POST|PUT|DELETE|PATCH)\b/g,
      `<span style="color:#fbbf24">$1</span>`)
    // URL paths
    .replace(/(\/v1\/[^\s\n"<]+)/g,
      `<span style="color:#a78bfa">$1</span>`)
    // HTTP headers
    .replace(/^([A-Z][a-zA-Z-]+)(\s*:)/gm,
      `<span style="color:rgba(237,237,240,0.4)">$1</span>$2`);
}

// ─── Shared doc components ────────────────────────────────────────────────────

const Grain = () => (
  <div style={{
    position:"fixed",inset:0,zIndex:9999,pointerEvents:"none",
    opacity:0.022,mixBlendMode:"overlay",
    backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    backgroundSize:"160px 160px",
  }} />
);

// Section wrapper: adds id anchor + consistent spacing
const DocSection = ({ id, children }) => (
  <section
    id={id}
    style={{
      paddingTop: "4rem",
      paddingBottom: "0.5rem",
      borderBottom: `1px solid ${T.border}`,
      marginBottom: "0.25rem",
      scrollMarginTop: "80px",
    }}
  >
    {children}
  </section>
);

// Section heading with label + title + rule
const SectionHead = ({ label, title, desc }) => (
  <div style={{ marginBottom: "2.5rem" }}>
    <div style={{
      fontFamily: T.mono, fontSize: "0.62rem", fontWeight: 400,
      letterSpacing: "0.14em", textTransform: "uppercase",
      color: T.accent, marginBottom: "0.6rem",
    }}>{label}</div>
    <h2 style={{
      fontFamily: T.serif, fontSize: "clamp(1.6rem, 2.8vw, 2.2rem)",
      fontWeight: 700, color: T.text, lineHeight: 1.12,
      letterSpacing: "-0.022em", margin: "0 0 1rem",
    }}>{title}</h2>
    {desc && (
      <p style={{
        fontFamily: T.sans, fontSize: "0.88rem", fontWeight: 300,
        color: T.textSub, lineHeight: 1.78, maxWidth: "600px", margin: 0,
      }}>{desc}</p>
    )}
  </div>
);

// Inline code
const IC = ({ children }) => (
  <code style={{
    fontFamily: T.mono, fontSize: "0.80em",
    color: "#7aa2ff",
    background: "rgba(61,90,254,0.08)",
    border: "1px solid rgba(61,90,254,0.15)",
    padding: "0.1em 0.4em",
    borderRadius: "3px",
  }}>{children}</code>
);

// Prose paragraph
const P = ({ children, style = {} }) => (
  <p style={{
    fontFamily: T.sans, fontSize: "0.88rem", fontWeight: 300,
    color: T.textSub, lineHeight: 1.82, marginBottom: "1rem",
    ...style,
  }}>{children}</p>
);

// Sub-heading within a section
const H3 = ({ children }) => (
  <h3 style={{
    fontFamily: T.sans, fontSize: "0.82rem", fontWeight: 600,
    color: T.text, letterSpacing: "0.01em",
    marginTop: "2rem", marginBottom: "0.85rem",
    textTransform: "uppercase", letterSpacing: "0.08em",
    fontSize: "0.68rem", color: T.textMuted,
  }}>{children}</h3>
);

// Horizontal divider
const Rule = ({ mt = "2rem", mb = "2rem" }) => (
  <div style={{
    height: "1px", background: T.border,
    marginTop: mt, marginBottom: mb,
  }} />
);

// Code block with copy
const CodeBlock = ({ code, lang = "", title = "" }) => {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  }, [code]);

  return (
    <div style={{
      border: `1px solid ${T.border}`,
      borderRadius: "6px", overflow: "hidden",
      marginBottom: "1.5rem", background: T.surface,
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0.52rem 1.1rem",
        background: "rgba(255,255,255,0.025)",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {title && (
            <span style={{
              fontFamily: T.sans, fontSize: "0.70rem", fontWeight: 400,
              color: T.textSub,
            }}>{title}</span>
          )}
          {lang && (
            <span style={{
              fontFamily: T.mono, fontSize: "0.58rem", fontWeight: 500,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: T.textMuted,
              background: "rgba(255,255,255,0.04)",
              padding: "0.1rem 0.45rem", borderRadius: "2px",
              border: `1px solid ${T.border}`,
            }}>{lang}</span>
          )}
        </div>
        <button
          onClick={copy}
          style={{
            fontFamily: T.sans, fontSize: "0.65rem", fontWeight: 500,
            letterSpacing: "0.04em",
            color: copied ? T.green : T.textMuted,
            background: "transparent", border: "none",
            cursor: "pointer", padding: "0.2rem 0.5rem",
            borderRadius: "3px",
            transition: "color 0.18s ease",
          }}
          onMouseEnter={e => { if (!copied) e.currentTarget.style.color = T.textSub; }}
          onMouseLeave={e => { if (!copied) e.currentTarget.style.color = T.textMuted; }}
          aria-label="Copy code"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Code body */}
      <pre
        style={{
          fontFamily: T.mono, fontSize: "0.76rem", lineHeight: 1.88,
          color: T.textSub, padding: "1.25rem 1.5rem",
          overflowX: "auto", margin: 0, tabSize: 2,
        }}
        dangerouslySetInnerHTML={{ __html: sh(code) }}
      />
    </div>
  );
};

// Formula display block
const FormulaBlock = ({ formula, vars }) => (
  <div style={{
    background: T.surface,
    border: `1px solid rgba(61,90,254,0.22)`,
    borderLeft: `3px solid ${T.accent}`,
    borderRadius: "0 6px 6px 0",
    padding: "1.5rem 1.75rem",
    marginBottom: "2rem",
  }}>
    <div style={{
      fontFamily: T.mono, fontSize: "1.0rem", fontWeight: 400,
      color: T.text, marginBottom: "1.5rem", letterSpacing: "0.02em",
    }}
      dangerouslySetInnerHTML={{ __html: formula }}
    />
    <div style={{ height: "1px", background: T.border, marginBottom: "1.25rem" }} />
    {vars.map(({ name, desc, note }) => (
      <div key={name} style={{
        display: "grid",
        gridTemplateColumns: "90px 1fr",
        gap: "1rem", marginBottom: "0.6rem",
        fontFamily: T.mono, fontSize: "0.74rem",
        alignItems: "baseline",
      }}>
        <span style={{ color: "#7aa2ff", whiteSpace: "nowrap" }}>{name}</span>
        <span>
          <span style={{ color: T.textSub }}>{desc}</span>
          {note && <span style={{ color: T.textMuted }}> — {note}</span>}
        </span>
      </div>
    ))}
  </div>
);

// Constraint / policy block (like a math optimization formulation)
const PolicyBlock = ({ lines }) => (
  <div style={{
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: "6px", padding: "1.25rem 1.5rem",
    marginBottom: "1.5rem", fontFamily: T.mono, fontSize: "0.78rem",
    lineHeight: 2.0,
  }}>
    {lines.map(({ label, expr, note }, i) => (
      <div key={i} style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: "1rem", alignItems: "baseline",
        borderBottom: i < lines.length - 1 ? `1px solid ${T.border}` : "none",
        padding: "0.35rem 0",
      }}>
        <span style={{ color: T.textMuted, fontSize: "0.64rem",
          letterSpacing: "0.06em", textTransform: "uppercase",
          fontFamily: T.sans, fontWeight: 500 }}>{label}</span>
        <span>
          <span style={{ color: T.text }}>{expr}</span>
          {note && <span style={{ color: T.textMuted, fontSize: "0.70rem" }}> &nbsp;// {note}</span>}
        </span>
      </div>
    ))}
  </div>
);

// Architecture node
const ArchNode = ({ title, color, items }) => (
  <div style={{
    flex: 1, minWidth: 0,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: "6px",
    padding: "1rem 1.1rem",
    borderTop: `2px solid ${color}`,
  }}>
    <div style={{
      fontFamily: T.sans, fontSize: "0.60rem", fontWeight: 600,
      letterSpacing: "0.12em", textTransform: "uppercase",
      color, marginBottom: "0.75rem",
    }}>{title}</div>
    {items.map(item => (
      <div key={item} style={{
        fontFamily: T.mono, fontSize: "0.70rem",
        color: T.textSub, lineHeight: 1.7,
        marginBottom: "0.1rem",
      }}>{item}</div>
    ))}
  </div>
);

const ArchArrow = () => (
  <div style={{
    display: "flex", alignItems: "center",
    padding: "0 0.4rem", flexShrink: 0,
  }}>
    <div style={{ width: "16px", height: "1px", background: T.border }} />
    <span style={{ color: T.textMuted, fontSize: "0.75rem", lineHeight: 1 }}>›</span>
  </div>
);

// Pipeline step
const PipelineStep = ({ num, title, items, tag }) => (
  <div style={{
    display: "flex", gap: "1.25rem",
    marginBottom: "1.75rem", alignItems: "flex-start",
  }}>
    <div style={{
      width: "26px", height: "26px", borderRadius: "50%", flexShrink: 0,
      background: T.accentLight,
      border: `1px solid rgba(61,90,254,0.28)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: T.serif, fontSize: "0.72rem", fontWeight: 700,
      color: T.accent, marginTop: "1px",
    }}>{num}</div>
    <div style={{ flex: 1 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.55rem",
      }}>
        <span style={{
          fontFamily: T.sans, fontSize: "0.84rem", fontWeight: 500, color: T.text,
        }}>{title}</span>
        {tag && (
          <span style={{
            fontFamily: T.mono, fontSize: "0.60rem", fontWeight: 500,
            letterSpacing: "0.08em",
            color: T.textMuted,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${T.border}`,
            padding: "0.1rem 0.45rem", borderRadius: "3px",
          }}>{tag}</span>
        )}
      </div>
      {items.map(item => (
        <div key={item} style={{
          display: "flex", gap: "0.6rem", marginBottom: "0.22rem",
          fontFamily: T.mono, fontSize: "0.72rem", color: T.textSub,
        }}>
          <span style={{ color: T.textFaint, flexShrink: 0 }}>—</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  </div>
);

// Data table
const DataTable = ({ columns, rows }) => (
  <div style={{
    border: `1px solid ${T.border}`,
    borderRadius: "6px", overflow: "hidden",
    marginBottom: "2rem",
    fontSize: "0.76rem",
  }}>
    {/* Header */}
    <div style={{
      display: "grid",
      gridTemplateColumns: columns.map(c => c.w || "1fr").join(" "),
      background: "rgba(255,255,255,0.03)",
      borderBottom: `1px solid ${T.border}`,
      padding: "0.55rem 1.1rem",
    }}>
      {columns.map(c => (
        <div key={c.key} style={{
          fontFamily: T.sans, fontSize: "0.58rem", fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: T.textMuted,
        }}>{c.label}</div>
      ))}
    </div>
    {/* Rows */}
    {rows.map((row, i) => (
      <div key={i} style={{
        display: "grid",
        gridTemplateColumns: columns.map(c => c.w || "1fr").join(" "),
        padding: "0.7rem 1.1rem",
        borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none",
        transition: "background 0.12s ease",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        {columns.map(c => (
          <div key={c.key} style={{
            fontFamily: T.mono,
            color:
              c.key === "column" ? "#7aa2ff" :
              c.key === "type"   ? "#a78bfa" :
              T.textSub,
          }}>{row[c.key]}</div>
        ))}
      </div>
    ))}
  </div>
);

// Status badge
const StatusBadge = ({ label, color }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: "0.35rem",
    fontFamily: T.mono, fontSize: "0.60rem", fontWeight: 500,
    letterSpacing: "0.1em",
    color,
    background: `${color}12`,
    border: `1px solid ${color}30`,
    padding: "0.2rem 0.55rem", borderRadius: "3px",
  }}>
    <span style={{
      width: "5px", height: "5px", borderRadius: "50%",
      background: color, flexShrink: 0,
      animation: "docsBlink 2.2s ease-in-out infinite",
    }} />
    {label}
  </span>
);

// Reliability card
const RelCard = ({ icon, title, metric, threshold, fillPct, status, statusColor, desc }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        border: `1px solid ${hov ? "rgba(61,90,254,0.18)" : T.border}`,
        borderRadius: "6px", padding: "1.5rem",
        background: hov ? "rgba(61,90,254,0.02)" : T.surfaceAlt,
        transition: `border-color 0.18s ease, background 0.18s ease`,
        cursor: "default",
      }}
    >
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ color: T.textMuted, fontSize: "0.82rem" }}>{icon}</span>
          <span style={{
            fontFamily: T.sans, fontSize: "0.82rem",
            fontWeight: 500, color: T.text,
          }}>{title}</span>
        </div>
        <StatusBadge label={status} color={statusColor} />
      </div>
      <p style={{
        fontFamily: T.sans, fontSize: "0.78rem", fontWeight: 300,
        color: T.textSub, lineHeight: 1.72, marginBottom: "1.25rem", margin: "0 0 1.25rem",
      }}>{desc}</p>
      <div>
        <div style={{
          display: "flex", justifyContent: "space-between", marginBottom: "0.35rem",
        }}>
          <span style={{ fontFamily: T.mono, fontSize: "0.68rem", color: statusColor }}>
            {metric}
          </span>
          <span style={{ fontFamily: T.sans, fontSize: "0.65rem", color: T.textMuted }}>
            {threshold}
          </span>
        </div>
        <div style={{ height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "1px" }}>
          <div style={{
            width: `${fillPct}%`, height: "100%",
            background: statusColor, borderRadius: "1px",
            boxShadow: `0 0 6px ${statusColor}40`,
          }} />
        </div>
      </div>
    </div>
  );
};

// Limitation item (honest, engineer-written)
const LimitItem = ({ n, title, body, severity }) => {
  const colors = { high: T.red, medium: T.yellow, low: T.green };
  const color = colors[severity] || T.textMuted;
  return (
    <div style={{
      borderLeft: `2px solid ${color}`,
      paddingLeft: "1.25rem",
      marginBottom: "2.25rem",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem",
      }}>
        <span style={{
          fontFamily: T.mono, fontSize: "0.60rem",
          color: T.textMuted, letterSpacing: "0.08em",
        }}>{n}</span>
        <span style={{
          fontFamily: T.sans, fontSize: "0.84rem",
          fontWeight: 500, color: T.text,
        }}>{title}</span>
        <span style={{
          fontFamily: T.mono, fontSize: "0.58rem",
          letterSpacing: "0.08em", textTransform: "uppercase",
          color, background: `${color}12`,
          border: `1px solid ${color}28`,
          padding: "0.1rem 0.45rem", borderRadius: "3px",
        }}>{severity}</span>
      </div>
      <p style={{
        fontFamily: T.sans, fontSize: "0.82rem", fontWeight: 300,
        color: T.textSub, lineHeight: 1.78, margin: 0,
      }}>{body}</p>
    </div>
  );
};

// ─── Section content ──────────────────────────────────────────────────────────

const OverviewSection = () => (
  <DocSection id="overview">
    <SectionHead
      label="01 / Overview"
      title="Intervenix"
      desc="A decision intelligence engine for pre-delinquency intervention in consumer lending. Converts predicted default probabilities into economically optimised action assignments."
    />
    <P>
      Most risk systems output a score and stop. Intervenix uses that score as an input to a
      constrained optimisation problem — selecting which borrowers to contact, by what channel,
      and at what cost to maximise total expected portfolio recovery within a capital budget.
    </P>
    <P>
      The distinction is meaningful. A classifier ranks borrowers by risk.
      Intervenix allocates interventions by <IC>EV / cost</IC> ratio — a fundamentally
      different objective. The highest-risk borrower is not necessarily the best intervention target.
    </P>

    <H3>System Flow</H3>
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: "6px", padding: "1.5rem 1.75rem",
      fontFamily: T.mono, fontSize: "0.76rem",
      lineHeight: 2.2, marginBottom: "1.5rem",
    }}>
      {[
        ["Loan Data",     "PostgreSQL feature store, refreshed daily"],
        ["Risk Score",    "LightGBM + isotonic calibration  →  P(default)"],
        ["EV Calculation","EV = p × LGD × ε − c  per borrower"],
        ["LP Allocation", "Budget-constrained selection by EV/cost ratio"],
        ["Action",        "{call, email, waiver, hold}  dispatched via API"],
      ].map(([step, desc], i, arr) => (
        <div key={step} style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
          <span style={{
            color: T.accent, fontWeight: 400, minWidth: "160px",
          }}>{step}</span>
          <span style={{ color: T.textMuted, marginRight: "0.5rem" }}>—</span>
          <span style={{ color: T.textSub }}>{desc}</span>
          {i < arr.length - 1 && (
            <div style={{
              width: "100%", display: "block",
              borderLeft: "1px solid rgba(61,90,254,0.15)",
              height: "1.4rem", marginLeft: "79px",
            }} />
          )}
        </div>
      ))}
    </div>

    <H3>Key Properties</H3>
    {[
      ["Calibrated", "Probability outputs aligned to observed default rates (ECE < 0.03)."],
      ["Optimised",  "Budget-constrained LP allocation, not a greedy score threshold."],
      ["Explainable","SHAP factor attribution shipped with every score event."],
      ["Observable", "Drift monitoring (PSI), calibration checks, circuit breakers in prod."],
    ].map(([k, v]) => (
      <div key={k} style={{
        display: "grid", gridTemplateColumns: "110px 1fr",
        gap: "1rem", marginBottom: "0.65rem",
        fontFamily: T.mono, fontSize: "0.76rem", alignItems: "baseline",
      }}>
        <span style={{ color: "#7aa2ff" }}>{k}</span>
        <span style={{ color: T.textSub, fontFamily: T.sans, fontSize: "0.82rem", fontWeight: 300 }}>{v}</span>
      </div>
    ))}
  </DocSection>
);

const ArchitectureSection = () => (
  <DocSection id="architecture">
    <SectionHead
      label="02 / Architecture"
      title="System Architecture"
      desc="Five loosely-coupled layers. Each layer owns a single responsibility and exposes a typed interface to its downstream consumer."
    />

    {/* Horizontal arch diagram */}
    <div style={{
      display: "flex", alignItems: "stretch",
      gap: 0, marginBottom: "2rem", overflowX: "auto",
    }} className="docs-arch-row">
      <ArchNode title="Data" color={T.green}
        items={["PostgreSQL","Feature Store","Daily refresh","Loan records"]} />
      <ArchArrow />
      <ArchNode title="Model" color={T.blue}
        items={["LightGBM","XGBoost","Calibrator","SHAP"]} />
      <ArchArrow />
      <ArchNode title="Decision" color={T.accent}
        items={["LP Solver","EV Engine","Allocator","Budget ctrl"]} />
      <ArchArrow />
      <ArchNode title="API" color={T.yellow}
        items={["FastAPI","REST / gRPC","Auth (Bearer)","Rate limit"]} />
      <ArchArrow />
      <ArchNode title="Client" color={T.purple}
        items={["React UI","Dashboard","Audit log","Webhooks"]} />
    </div>

    <H3>Layer Responsibilities</H3>
    {[
      {
        layer: "Data Layer",
        desc: "PostgreSQL with a feature store that materialises rolling-window features (3m, 6m, 12m). Features are refreshed nightly. Point-in-time correctness is enforced — no future leakage.",
      },
      {
        layer: "Model Layer",
        desc: "LightGBM primary model with XGBoost as ensemble member. Isotonic regression calibration on a held-out calibration set. SHAP values computed for every inference.",
      },
      {
        layer: "Decision Layer",
        desc: "Takes calibrated probabilities as input, computes EV per borrower, solves the budget-constrained allocation LP (relaxed to continuous), and assigns action types.",
      },
      {
        layer: "API Layer",
        desc: "FastAPI application exposing three primary endpoints: /score (single borrower), /optimize (portfolio allocation), /sensitivity (EV sensitivity analysis).",
      },
      {
        layer: "Client Layer",
        desc: "React frontend for analyst review, intervention monitoring, and audit log access. Not required for programmatic API use.",
      },
    ].map(({ layer, desc }) => (
      <div key={layer} style={{ marginBottom: "1.25rem" }}>
        <div style={{
          fontFamily: T.sans, fontSize: "0.80rem", fontWeight: 500,
          color: T.text, marginBottom: "0.3rem",
        }}>{layer}</div>
        <p style={{
          fontFamily: T.sans, fontSize: "0.82rem", fontWeight: 300,
          color: T.textSub, lineHeight: 1.75, margin: 0,
        }}>{desc}</p>
      </div>
    ))}
  </DocSection>
);

const MLPipelineSection = () => (
  <DocSection id="ml-pipeline">
    <SectionHead
      label="03 / ML Pipeline"
      title="ML Pipeline"
      desc="Temporal training split, tabular ensemble, and isotonic calibration. Automated retraining triggered by production drift signals."
    />

    <PipelineStep num="1" title="Temporal Split" tag="no leakage"
      items={[
        "Train window: T−24m → T−3m  |  Calibration: T−3m → T−1m  |  Test: T−1m → T",
        "Rolling walk-forward validation across 6 folds",
        "Strict temporal ordering — no shuffling, no stratify on time",
      ]}
    />
    <PipelineStep num="2" title="Feature Engineering" tag="tabular"
      items={[
        "Credit utilization: rolling mean / std over 3m, 6m, 12m windows",
        "Payment velocity: missed_payments / total_due, recency-weighted",
        "Income stability: coefficient of variation of monthly income (last 12m)",
        "Behavioral signals: login frequency, app session duration (where available)",
        "All features normalised to [0, 1] before model ingestion",
      ]}
    />
    <PipelineStep num="3" title="Model Training" tag="ensemble"
      items={[
        "LightGBM (primary) — DART boosting, max_depth=7, num_leaves=63",
        "XGBoost (secondary) — linear booster for regularisation",
        "Ensemble: weighted average (LGB 0.65, XGB 0.35)",
        "Hyperparameter search: Optuna, 200 trials, TPE sampler",
        "Evaluation: AUC-ROC, Brier score, KS statistic, precision@K",
      ]}
    />
    <PipelineStep num="4" title="Calibration" tag="isotonic"
      items={[
        "Isotonic regression on held-out calibration set (T−3m → T−1m)",
        "Target: ECE < 0.03,  |reliability curve slope − 1.0| < 0.05",
        "Brier score improvement over uncalibrated model: measured before promotion",
        "Calibration curve plotted and reviewed before each model version release",
      ]}
    />
    <PipelineStep num="5" title="Deployment" tag="registry"
      items={[
        "Model registry with semantic versioning (ivx-v{major}.{minor}.{patch})",
        "Shadow mode deployment: new model runs in parallel for 7 days before cutover",
        "Automated retraining trigger: any feature PSI > 0.20 in production",
        "Rollback procedure: single flag flip in model registry, < 30s",
      ]}
    />

    <H3>Evaluation Metrics</H3>
    <DataTable
      columns={[
        { key: "metric",    label: "Metric",    w: "1.2fr" },
        { key: "value",     label: "Current",   w: "0.8fr" },
        { key: "threshold", label: "Threshold", w: "0.8fr" },
        { key: "note",      label: "Note",      w: "2fr"   },
      ]}
      rows={[
        { metric: "AUC-ROC",    value: "0.847", threshold: "> 0.80", note: "Measured on temporal test set" },
        { metric: "Brier Score",value: "0.118", threshold: "< 0.15", note: "Lower is better" },
        { metric: "KS Stat",    value: "0.512", threshold: "> 0.45", note: "Separation of score distributions" },
        { metric: "ECE",        value: "0.024", threshold: "< 0.03", note: "Post-calibration" },
        { metric: "Precision@K",value: "0.71",  threshold: "> 0.65", note: "K = top 20% by score" },
      ]}
    />
  </DocSection>
);

const DecisionEngineSection = () => (
  <DocSection id="decision-engine">
    <SectionHead
      label="04 / Decision Engine"
      title="Decision Engine"
      desc="Converts P(default) into an economic value, then allocates interventions to maximise total portfolio recovery within a capital budget."
    />

    <H3>Expected Value Formula</H3>
    <FormulaBlock
      formula={`EV(b) = p(b) &middot; LGD(b) &middot; &epsilon; &minus; c`}
      vars={[
        { name: "p(b)",    desc: "Predicted default probability for borrower b",           note: "LightGBM output, isotonic calibration" },
        { name: "LGD(b)",  desc: "Loss given default = loan_balance × (1 − recovery_rate)", note: "Recovery rate applied as portfolio avg" },
        { name: "ε",       desc: "Intervention effectiveness",                              note: "Assumed 0.55 — see Limitations §8" },
        { name: "c",       desc: "Intervention cost",                                       note: "$150 – $600 depending on action type" },
      ]}
    />

    <P>
      EV is computed per borrower at scoring time. Borrowers with <IC>EV ≤ 0</IC> are
      excluded from the allocation pool regardless of available budget — the expected cost of
      intervening exceeds the expected recovery.
    </P>

    <H3>Allocation Policy</H3>
    <PolicyBlock lines={[
      { label: "Filter",     expr: "EV(b) > 0  for all b ∈ B",              note: "Drop negative-EV candidates" },
      { label: "Maximise",   expr: "Σᵢ EV(bᵢ) · xᵢ",                       note: "Objective" },
      { label: "Subject to", expr: "Σᵢ c(bᵢ) · xᵢ  ≤  Budget",            note: "Capital constraint" },
      { label: "",           expr: "xᵢ ∈ [0, 1]  ∀i ∈ B",                  note: "LP relaxation of 0-1 knapsack" },
      { label: "Solved by",  expr: "Sort by EV/cost desc, greedily select", note: "Optimal for fractional knapsack" },
    ]} />

    <H3>Action Mapping</H3>
    <DataTable
      columns={[
        { key: "action",  label: "Action",       w: "0.8fr" },
        { key: "channel", label: "Channel",      w: "0.8fr" },
        { key: "cost",    label: "Cost",         w: "0.6fr" },
        { key: "when",    label: "Condition",    w: "2.5fr" },
      ]}
      rows={[
        { action: "call",   channel: "Phone",   cost: "$380",       when: "p > 0.70  and  EV > $400" },
        { action: "email",  channel: "Email",   cost: "$150",       when: "p ∈ [0.40, 0.70]  or  low EV/cost" },
        { action: "waiver", channel: "Fee",     cost: "$220 avg",   when: "p > 0.65  and  fee_balance > $50" },
        { action: "hold",   channel: "None",    cost: "$0",         when: "EV ≤ 0  or  confidence < 0.85" },
      ]}
    />
  </DocSection>
);

const SCORE_REQ = `POST /v1/score HTTP/1.1
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "borrower_id": "BRW-4821",
  "features": {
    "utilization": 0.84,
    "missed_payments_6m": 2,
    "income_stability": 0.41,
    "loan_amount": 24500.00
  }
}`;

const SCORE_RES = `# 200 OK  |  38ms
{
  "borrower_id": "BRW-4821",
  "p_default": 0.73,
  "confidence": { "low": 0.71, "high": 0.76 },
  "ev": 856.40,
  "action": "email",
  "cost": 150.00,
  "shap_factors": {
    "utilization": 0.18,
    "missed_payments_6m": 0.14,
    "income_stability": 0.09
  },
  "model_version": "ivx-v2.4.1",
  "latency_ms": 38,
  "audit_id": "ivx_8f3k92m"
}`;

const OPTIMIZE_REQ = `POST /v1/optimize HTTP/1.1
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "budget": 180000.00,
  "borrower_ids": ["BRW-4821", "BRW-2047", "..."],
  "constraints": {
    "min_ev": 0,
    "action_types": ["call", "email", "waiver"]
  }
}`;

const OPTIMIZE_RES = `# 200 OK  |  142ms
{
  "selected_count": 428,
  "total_ev": 54527.40,
  "budget_used": 178920.00,
  "efficiency": 3.07,
  "action_distribution": {
    "call": 150,
    "email": 180,
    "waiver": 98
  },
  "assignments": [
    {
      "borrower_id": "BRW-4821",
      "action": "email",
      "ev": 856.40,
      "cost": 150.00,
      "rank": 1
    }
  ]
}`;

const SENSITIVITY_REQ = `GET /v1/sensitivity?borrower_id=BRW-4821 HTTP/1.1
Authorization: Bearer <api_key>`;

const SENSITIVITY_RES = `# 200 OK  |  22ms
{
  "borrower_id": "BRW-4821",
  "base_ev": 856.40,
  "sensitivity": {
    "effectiveness_+10pct":  942.04,
    "effectiveness_-10pct":  770.76,
    "cost_+50pct":           631.40,
    "cost_-50pct":          1081.40,
    "utilization_-10pct":    742.30,
    "p_default_-5pct":       798.60
  }
}`;

const APISection = () => {
  const endpoints = [
    {
      method: "POST", path: "/v1/score",
      desc: "Score a single borrower. Returns calibrated P(default), EV, recommended action, and SHAP attribution.",
      reqCode: SCORE_REQ, resCode: SCORE_RES,
    },
    {
      method: "POST", path: "/v1/optimize",
      desc: "Run budget-constrained LP allocation over a borrower set. Returns optimal action assignments.",
      reqCode: OPTIMIZE_REQ, resCode: OPTIMIZE_RES,
    },
    {
      method: "GET", path: "/v1/sensitivity",
      desc: "Compute EV sensitivity to parameter changes for a given borrower. Used for what-if analysis.",
      reqCode: SENSITIVITY_REQ, resCode: SENSITIVITY_RES,
    },
  ];

  const methodColors = { POST: "#fbbf24", GET: "#4ade80", PUT: "#60a5fa", DELETE: "#f87171" };

  return (
    <DocSection id="api">
      <SectionHead
        label="05 / API Reference"
        title="API Reference"
        desc="Three primary endpoints. All requests require Bearer authentication. Base URL: https://api.intervenix.io"
      />

      <H3>Authentication</H3>
      <CodeBlock
        lang="http"
        code={`Authorization: Bearer ivx_live_xxxxxxxxxxxxxxxxxxxx

# Obtain API keys via the dashboard or request-access flow.
# Keys are scoped: read-only  |  score  |  optimize  |  admin`}
      />

      {endpoints.map(({ method, path, desc, reqCode, resCode }) => (
        <div key={path} style={{ marginBottom: "3rem" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            marginBottom: "0.75rem",
          }}>
            <span style={{
              fontFamily: T.mono, fontSize: "0.70rem", fontWeight: 600,
              letterSpacing: "0.06em",
              color: methodColors[method] || T.text,
              background: `${methodColors[method]}12`,
              border: `1px solid ${methodColors[method]}30`,
              padding: "0.18rem 0.55rem", borderRadius: "3px",
              flexShrink: 0,
            }}>{method}</span>
            <span style={{ fontFamily: T.mono, fontSize: "0.84rem", color: T.text }}>
              {path}
            </span>
          </div>
          <p style={{
            fontFamily: T.sans, fontSize: "0.82rem", fontWeight: 300,
            color: T.textSub, lineHeight: 1.72,
            margin: "0 0 1rem",
          }}>{desc}</p>
          <CodeBlock lang="request"  code={reqCode} />
          <CodeBlock lang="response" code={resCode} />
        </div>
      ))}

      <H3>Rate Limits</H3>
      <DataTable
        columns={[
          { key: "tier",   label: "Tier",     w: "0.7fr" },
          { key: "score",  label: "/score",   w: "0.8fr" },
          { key: "optim",  label: "/optimize",w: "0.9fr" },
          { key: "note",   label: "Notes",    w: "2fr"   },
        ]}
        rows={[
          { tier: "Free",       score: "100 / day",    optim: "10 / day",    note: "Development use only" },
          { tier: "Standard",   score: "10,000 / day", optim: "500 / day",   note: "Production — shared infra" },
          { tier: "Enterprise", score: "Unlimited",    optim: "Unlimited",   note: "Dedicated compute, SLA" },
        ]}
      />
    </DocSection>
  );
};

const DataModelSection = () => (
  <DocSection id="data-model">
    <SectionHead
      label="06 / Data Model"
      title="Data Model"
      desc="Three primary tables. All IDs are UUIDs. Timestamps in UTC."
    />

    <H3>borrowers</H3>
    <DataTable
      columns={[
        { key: "col",  label: "Column",       w: "1.2fr" },
        { key: "type", label: "Type",         w: "0.8fr" },
        { key: "desc", label: "Description",  w: "2.5fr" },
      ]}
      rows={[
        { col: "id",                  type: "VARCHAR(36)",  desc: "UUID, primary key" },
        { col: "loan_amount",         type: "DECIMAL(12,2)",desc: "Outstanding principal at last refresh" },
        { col: "utilization",         type: "FLOAT",        desc: "Credit utilization ratio ∈ [0, 1]" },
        { col: "missed_payments_6m",  type: "INT",          desc: "Missed payment count, rolling 6-month window" },
        { col: "income_stability",    type: "FLOAT",        desc: "Variance-based income stability index ∈ [0, 1]" },
        { col: "created_at",          type: "TIMESTAMP",    desc: "Account origination timestamp" },
        { col: "updated_at",          type: "TIMESTAMP",    desc: "Last feature refresh timestamp" },
      ]}
    />

    <H3>scores</H3>
    <DataTable
      columns={[
        { key: "col",  label: "Column",       w: "1.2fr" },
        { key: "type", label: "Type",         w: "0.8fr" },
        { key: "desc", label: "Description",  w: "2.5fr" },
      ]}
      rows={[
        { col: "id",            type: "VARCHAR(36)",   desc: "UUID, primary key" },
        { col: "borrower_id",   type: "VARCHAR(36)",   desc: "FK → borrowers.id" },
        { col: "p_default",     type: "FLOAT",         desc: "Calibrated P(default) ∈ [0, 1]" },
        { col: "conf_low",      type: "FLOAT",         desc: "5th percentile confidence bound" },
        { col: "conf_high",     type: "FLOAT",         desc: "95th percentile confidence bound" },
        { col: "ev",            type: "DECIMAL(10,2)", desc: "Expected value of intervention at scoring time" },
        { col: "action",        type: "ENUM",          desc: "{call, email, waiver, hold}" },
        { col: "model_version", type: "VARCHAR(20)",   desc: "Model registry identifier e.g. ivx-v2.4.1" },
        { col: "audit_id",      type: "VARCHAR(24)",   desc: "Immutable audit reference, returned in API response" },
        { col: "scored_at",     type: "TIMESTAMP",     desc: "Inference timestamp (UTC)" },
      ]}
    />

    <H3>interventions</H3>
    <DataTable
      columns={[
        { key: "col",  label: "Column",       w: "1.2fr" },
        { key: "type", label: "Type",         w: "0.8fr" },
        { key: "desc", label: "Description",  w: "2.5fr" },
      ]}
      rows={[
        { col: "id",          type: "VARCHAR(36)",   desc: "UUID, primary key" },
        { col: "borrower_id", type: "VARCHAR(36)",   desc: "FK → scores.borrower_id" },
        { col: "action_type", type: "ENUM",          desc: "{call, email, waiver, hold}" },
        { col: "cost",        type: "DECIMAL(8,2)",  desc: "Allocated intervention cost" },
        { col: "ev",          type: "DECIMAL(10,2)", desc: "Expected value at time of assignment" },
        { col: "assigned_at", type: "TIMESTAMP",     desc: "Dispatch timestamp (UTC)" },
        { col: "outcome",     type: "ENUM",          desc: "{cured, defaulted, pending, null}" },
        { col: "resolved_at", type: "TIMESTAMP",     desc: "Outcome observation timestamp — nullable" },
      ]}
    />
  </DocSection>
);

const ReliabilitySection = () => (
  <DocSection id="reliability">
    <SectionHead
      label="07 / Reliability"
      title="Reliability"
      desc="Three automated safeguards. No manual monitoring required during normal operation. Alerts route to on-call via PagerDuty."
    />

    <div style={{
      display: "grid", gridTemplateColumns: "1fr",
      gap: "1rem", marginBottom: "2rem",
    }}>
      <RelCard
        icon="◈" title="Drift Monitoring"
        metric="PSI: 0.08" threshold="Limit: 0.20"
        fillPct={40} status="NOMINAL" statusColor={T.green}
        desc="Population Stability Index computed daily across all input features. Automated model retraining fires when any feature PSI exceeds 0.20 for two consecutive days. Current worst-case feature PSI: 0.08 (utilization)."
      />
      <RelCard
        icon="◎" title="Calibration Check"
        metric="ECE: 0.024" threshold="Limit: 0.050"
        fillPct={48} status="NOMINAL" statusColor={T.green}
        desc="Expected Calibration Error measured on a rolling 30-day holdout set and computed weekly. Recalibration queue activates when ECE > 0.05 persists for 3 consecutive evaluations. Current ECE: 0.024."
      />
      <RelCard
        icon="■" title="Circuit Breakers"
        metric="Confidence: 91%" threshold="Floor: 85%"
        fillPct={91} status="STANDBY" statusColor={T.yellow}
        desc="Conservative deterministic rules (no ML) engage automatically when model confidence drops below 85% for a scoring request. Circuit breakers currently cover < 3% of scoring volume. Threshold is configurable per deployment."
      />
    </div>

    <H3>Incident Runbooks</H3>
    {[
      { trigger: "PSI > 0.20", action: "Automated retraining job queued. On-call notified. New model enters shadow mode before cutover." },
      { trigger: "ECE > 0.05 (3d)", action: "Recalibration on latest holdout set. Brier score comparison run. Model gated if not improved." },
      { trigger: "Latency p99 > 200ms", action: "Auto-scaling triggers. If persists > 5 min, alert escalated to infra on-call." },
      { trigger: "Circuit breaker > 10%", action: "Model health review within 2h. Possible rollback to previous model version." },
    ].map(({ trigger, action }) => (
      <div key={trigger} style={{
        display: "grid", gridTemplateColumns: "180px 1fr",
        gap: "1rem", marginBottom: "0.85rem",
        padding: "0.75rem 1rem",
        background: T.surfaceAlt, border: `1px solid ${T.border}`,
        borderRadius: "4px", alignItems: "baseline",
      }}>
        <span style={{ fontFamily: T.mono, fontSize: "0.72rem", color: T.yellow }}>{trigger}</span>
        <span style={{ fontFamily: T.sans, fontSize: "0.78rem", fontWeight: 300,
          color: T.textSub, lineHeight: 1.65 }}>{action}</span>
      </div>
    ))}
  </DocSection>
);

const LimitationsSection = () => (
  <DocSection id="limitations">
    <SectionHead
      label="08 / Limitations"
      title="Limitations"
      desc="Honest accounting of current system gaps. These are known constraints, not bugs. Addressing them is on the roadmap."
    />

    <LimitItem
      n="L-01" severity="high"
      title="Effectiveness is assumed, not measured"
      body={`The intervention effectiveness parameter ε = 0.55 is derived from published literature on early outreach in consumer lending portfolios. Intervenix does not currently run randomised controlled experiments to measure causal treatment effect. This is the most significant gap in the current system. Until A/B testing infrastructure is in place, the EV calculation is a function of an assumed constant, not an empirically validated estimate per borrower segment or action type.`}
    />
    <LimitItem
      n="L-02" severity="high"
      title="No causal model — effectiveness is not personalised"
      body={`The scoring model estimates P(default | features), not P(default | intervention, features) − P(default | no intervention, features). The difference between these two quantities is the actual treatment effect. Without a causal uplift model, the system cannot identify borrowers who would cure without intervention ("sure things") or those unresponsive to any action ("lost causes"). A two-model uplift architecture (T-Learner or DR-Learner) is the planned resolution.`}
    />
    <LimitItem
      n="L-03" severity="medium"
      title="LGD is a portfolio average, not borrower-level"
      body={`Loss Given Default is approximated as loan_balance × (1 − recovery_rate), where recovery_rate is a portfolio-wide constant (currently 0.42). Borrower-level LGD estimation — which would account for collateral, loan type, and regional recovery rates — would require a second-stage regression model. The current approximation introduces systematic bias for high-collateral and unsecured loan segments.`}
    />
    <LimitItem
      n="L-04" severity="medium"
      title="Static feature windows"
      body={`Feature engineering uses fixed rolling windows of 3m, 6m, and 12m. For borrowers with short loan histories (< 6m), the 6m and 12m features are zero-imputed, which degrades model performance on this segment. Adaptive window selection based on account age is not yet implemented.`}
    />
    <LimitItem
      n="L-05" severity="low"
      title="LP relaxation — not true integer optimisation"
      body={`The budget allocation is solved as a continuous LP (fractional knapsack), not an integer programme. In practice, borrowers are treated as discrete units. The LP relaxation is optimal for the fractional case and near-optimal when the number of borrowers is large relative to the budget constraint tightness. For small portfolios (< 50 borrowers) or very tight budgets, integer LP would yield marginally better allocations.`}
    />

    <div style={{
      marginTop: "2rem",
      padding: "1.25rem 1.5rem",
      background: "rgba(61,90,254,0.05)",
      border: `1px solid rgba(61,90,254,0.2)`,
      borderRadius: "6px",
    }}>
      <div style={{
        fontFamily: T.sans, fontSize: "0.72rem", fontWeight: 500,
        letterSpacing: "0.08em", textTransform: "uppercase",
        color: T.accent, marginBottom: "0.6rem",
      }}>Roadmap</div>
      <p style={{
        fontFamily: T.sans, fontSize: "0.82rem", fontWeight: 300,
        color: T.textSub, lineHeight: 1.78, margin: 0,
      }}>
        L-01 and L-02 are addressed together by an A/B testing framework and uplift model (T-Learner).
        Target: Q3 2026. L-03 by a second-stage LGD regression. L-04 by dynamic feature window
        selection. L-05 is considered low-priority given current portfolio scale.
      </p>
    </div>
  </DocSection>
);

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const DocsSidebar = ({ active, onNavigate }) => (
  <aside style={{
    position: "sticky",
    top: "60px",
    height: "calc(100vh - 60px)",
    overflowY: "auto",
    borderRight: `1px solid ${T.border}`,
    padding: "2.5rem 0 3rem",
    background: T.bg,
    scrollbarWidth: "none",
  }}>
    {/* Brand */}
    <div style={{
      padding: "0 1.5rem 2rem",
      borderBottom: `1px solid ${T.border}`,
      marginBottom: "1.5rem",
    }}>
      <div style={{
        fontFamily: T.serif, fontSize: "0.92rem", fontWeight: 700,
        color: T.text, marginBottom: "0.2rem",
      }}>Intervenix</div>
      <div style={{
        fontFamily: T.mono, fontSize: "0.62rem", color: T.textMuted,
        letterSpacing: "0.06em",
      }}>v2.4.1 · Docs</div>
    </div>

    {/* Nav groups */}
    {NAV_GROUPS.map(({ label, items }) => (
      <div key={label} style={{ marginBottom: "1.75rem", padding: "0 1.5rem" }}>
        <div style={{
          fontFamily: T.sans, fontSize: "0.58rem", fontWeight: 600,
          letterSpacing: "0.14em", textTransform: "uppercase",
          color: T.textFaint, marginBottom: "0.6rem",
          paddingLeft: "0.85rem",
        }}>{label}</div>
        {items.map(({ id, label: itemLabel }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                display: "flex", alignItems: "center", gap: "0.6rem",
                width: "100%", textAlign: "left",
                fontFamily: T.sans, fontSize: "0.80rem", fontWeight: isActive ? 500 : 400,
                color: isActive ? T.text : T.textSub,
                background: isActive ? T.accentLight : "transparent",
                border: "none",
                borderLeft: `2px solid ${isActive ? T.accent : "transparent"}`,
                padding: "0.45rem 0.85rem",
                borderRadius: "0 4px 4px 0",
                cursor: "pointer",
                transition: `color 0.15s ease, background 0.15s ease, border-color 0.15s ease`,
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = T.text;
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.color = T.textSub;
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {itemLabel}
            </button>
          );
        })}
      </div>
    ))}

    {/* Bottom links */}
    <div style={{
      padding: "1.5rem 1.5rem 0",
      borderTop: `1px solid ${T.border}`,
      marginTop: "0.5rem",
    }}>
      {["Changelog", "GitHub"].map(lbl => (
        <a key={lbl} href="#" style={{
          display: "block",
          fontFamily: T.sans, fontSize: "0.74rem", fontWeight: 300,
          color: T.textMuted, padding: "0.35rem 0.85rem",
          borderRadius: "4px",
          transition: "color 0.15s ease",
        }}
          onMouseEnter={e => e.currentTarget.style.color = T.textSub}
          onMouseLeave={e => e.currentTarget.style.color = T.textMuted}
        >{lbl}</a>
      ))}
    </div>

    <style>{`
      aside::-webkit-scrollbar { display: none; }
    `}</style>
  </aside>
);

// ─── Page root ────────────────────────────────────────────────────────────────
export default function DocsPage() {
  const [active, setActive] = useState("overview");

  // Intersection observer: fires when section top enters top ~30% of viewport
  useEffect(() => {
    window.scrollTo(0, 0);
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-10% 0px -65% 0px", threshold: 0 }
    );
    ALL_SECTION_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const navigate = useCallback((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  }, []);

  return (
    <>
      <style>{`
        @keyframes docsBlink {
          0%,100% { opacity:1;   }
          50%      { opacity:0.3; }
        }
        @media (max-width:900px) {
          .docs-arch-row { flex-wrap:wrap !important; }
          .docs-arch-row > div { flex:0 0 calc(50% - 1.5rem) !important; }
        }
        @media (max-width:768px) {
          .docs-sidebar-col { display:none !important; }
          .docs-content-col { padding:2rem 1.5rem !important; }
        }
      `}</style>

      <Grain />
      <Nav T={T} onRequestAccess={() => {}} />

      <div style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        marginTop: "60px",
        minHeight: "calc(100vh - 60px)",
        background: T.bg,
      }}>
        {/* Sidebar */}
        <div className="docs-sidebar-col">
          <DocsSidebar active={active} onNavigate={navigate} />
        </div>

        {/* Content */}
        <main
          className="docs-content-col"
          style={{
            padding: "3rem 4.5rem 8rem",
            overflowX: "hidden",
          }}
        >
          <div style={{ maxWidth: "720px" }}>
            <OverviewSection />
            <ArchitectureSection />
            <MLPipelineSection />
            <DecisionEngineSection />
            <APISection />
            <DataModelSection />
            <ReliabilitySection />
            <LimitationsSection />

            {/* Footer */}
            <div style={{
              paddingTop: "4rem",
              display: "flex", justifyContent: "space-between",
              alignItems: "center", flexWrap: "wrap", gap: "0.75rem",
            }}>
              <span style={{ fontFamily: T.sans, fontSize: "0.70rem", color: T.textMuted }}>
                © 2026 Intervenix · Academic project, Vishwakarma Institute of Technology
              </span>
              <span style={{ fontFamily: T.mono, fontSize: "0.68rem", color: T.textMuted }}>
                ivx-v2.4.1
              </span>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
