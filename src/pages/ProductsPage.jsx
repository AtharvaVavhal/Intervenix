/**
 * ProductsPage.jsx
 *
 * Four products, one suite.
 *   01 Decision Engine    — calibrated scoring → structured action
 *   02 Policy Optimizer   — budget-constrained LP allocation
 *   03 Analyst Workbench  — SHAP explainability + override queue
 *   04 Risk Intelligence  — drift monitoring + reliability signals
 *
 * Each section: 2-column layout (copy ↔ interactive demo), alternating sides.
 * Each demo is stateful and interactive.
 *
 * No Tailwind. No Framer Motion.
 * Design system: inline styles + T tokens, identical to rest of product.
 */

import { useState, useEffect, useCallback } from "react";
import Nav from "../components/Nav";
import Button from "../components/UI/Button";
import Reveal from "../components/UI/Reveal";
import RequestAccess from "../components/RequestAccess";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:          "#08080c",
  surface:     "#0d0d12",
  surfaceAlt:  "#0f0f15",
  surfaceHov:  "#121218",
  border:      "rgba(255,255,255,0.05)",
  borderHov:   "rgba(61,90,254,0.28)",
  accent:      "#3D5AFE",
  accentLight: "rgba(61,90,254,0.10)",
  accentGlow:  "rgba(61,90,254,0.28)",
  text:        "#EDEDF0",
  textSub:     "rgba(237,237,240,0.48)",
  textMuted:   "rgba(237,237,240,0.26)",
  textFaint:   "rgba(237,237,240,0.12)",
  green:       "#4ade80",
  yellow:      "#fbbf24",
  red:         "#f87171",
  blue:        "#60a5fa",
  purple:      "#a78bfa",
  orange:      "#fb923c",
  serif:  "'Playfair Display', serif",
  sans:   "'DM Sans', sans-serif",
  mono:   "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
  ease:   "cubic-bezier(0.22, 1, 0.36, 1)",
  easeIn: "cubic-bezier(0.4, 0, 0.2, 1)",
};

// ─── Product definitions ──────────────────────────────────────────────────────
const PRODUCTS = [
  { id: "decision-engine",   n: "01", icon: "◆", name: "Decision Engine",   color: T.accent  },
  { id: "policy-optimizer",  n: "02", icon: "⬡", name: "Policy Optimizer",  color: T.green   },
  { id: "analyst-workbench", n: "03", icon: "◎", name: "Analyst Workbench", color: T.yellow  },
  { id: "risk-intelligence", n: "04", icon: "◈", name: "Risk Intelligence",  color: T.red     },
];

// ─── LP data (budget optimisation, deterministic) ────────────────────────────
const LP_USERS = (() => {
  const u = [];
  for (let i = 0; i < 80; i++) {
    const h = Math.max(0.06, Math.min(1,
      (1 - (i / 80) * 0.82) +
      Math.sin(i * 2.3 + 0.8) * 0.06 +
      Math.cos(i * 1.7 + 2.1) * 0.04
    ));
    const cost = 150 + i * 14 + Math.floor(Math.abs(Math.sin(i * 3.1 + 1)) * 60);
    u.push({ h, cost, ev: h * 1200 });
  }
  return u;
})();
const LP_CUMCOST = LP_USERS.reduce((a, u, i) => [...a, (a[i - 1] || 0) + u.cost], []);

// ─── Demo borrower data ───────────────────────────────────────────────────────
const DEMO_BORROWERS = [
  {
    id: "BRW-4821", tier: "HIGH", tierColor: T.red,
    p: 0.73, ev: 856.40, action: "EMAIL", cost: 150, conf: 0.92,
    factors: [
      { label: "High credit utilization", val: +0.18, pct: 60, color: T.red    },
      { label: "Missed payment history",  val: +0.14, pct: 47, color: T.orange },
    ],
  },
  {
    id: "BRW-2047", tier: "MEDIUM", tierColor: T.yellow,
    p: 0.51, ev: 524.20, action: "CALL", cost: 380, conf: 0.76,
    factors: [
      { label: "Late payment recency",   val: +0.12, pct: 40, color: T.yellow },
      { label: "Loan-to-income ratio",   val: +0.09, pct: 30, color: T.orange },
    ],
  },
  {
    id: "BRW-9183", tier: "LOW", tierColor: T.green,
    p: 0.31, ev: 180.50, action: "HOLD", cost: 0, conf: 0.65,
    factors: [
      { label: "Income variance (mild)",  val: +0.08, pct: 27, color: T.yellow },
      { label: "Utilization (moderate)", val: +0.04, pct: 13, color: T.orange },
    ],
  },
];

// ─── Shared primitives ────────────────────────────────────────────────────────
const Grain = () => (
  <div style={{
    position:"fixed",inset:0,zIndex:9999,pointerEvents:"none",
    opacity:0.022,mixBlendMode:"overlay",
    backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    backgroundSize:"160px 160px",
  }} />
);

const Divider = () => (
  <div style={{
    width:"100%",height:"1px",
    background:`linear-gradient(90deg,transparent 0%,${T.border} 30%,${T.border} 70%,transparent 100%)`,
  }} />
);

const Section = ({ children, alt=false, id, style:extra={} }) => (
  <section id={id} style={{
    background: alt ? T.surfaceAlt : T.bg,
    padding: "6rem 2rem", ...extra,
  }}>
    <div style={{ maxWidth:"1080px", margin:"0 auto" }}>
      {children}
    </div>
  </section>
);

const fmtK = v =>
  v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` :
  v >= 1_000     ? `$${(v/1_000).toFixed(0)}k` :
  `$${v}`;

// ─── Demo window chrome wrapper ───────────────────────────────────────────────
const DemoWindow = ({ label, color, children }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.surface,
        border: `1px solid ${hov ? color + "50" : T.border}`,
        borderTop: `2px solid ${color}`,
        borderRadius: "8px",
        overflow: "hidden",
        transition: `border-color 0.22s ease, box-shadow 0.22s ease`,
        boxShadow: hov
          ? `0 12px 48px rgba(0,0,0,0.45), 0 0 0 1px ${color}18`
          : `0 4px 24px rgba(0,0,0,0.28)`,
      }}
    >
      {/* Window chrome */}
      <div style={{
        display:"flex", alignItems:"center", gap:"0.4rem",
        padding:"0.6rem 1.1rem",
        background:"rgba(255,255,255,0.025)",
        borderBottom:`1px solid ${T.border}`,
      }}>
        {["#FF5F57","#FEBC2E","#28C840"].map(c => (
          <div key={c} style={{
            width:"8px",height:"8px",borderRadius:"50%",
            background:c,opacity:0.7,
          }} />
        ))}
        <span style={{
          fontFamily:T.sans, fontSize:"0.62rem",
          color:T.textMuted, marginLeft:"0.75rem", letterSpacing:"0.04em",
        }}>{label}</span>
      </div>
      <div style={{ padding:"1.5rem" }}>{children}</div>
    </div>
  );
};

// ─── Product copy block: Problem → System → Output ────────────────────────────
const ProductCopy = ({ n, color, name, tagline, chain, onExplore, onDocs }) => (
  <div>
    {/* Number + product label */}
    <div style={{
      display:"inline-flex", alignItems:"center", gap:"0.55rem",
      padding:"0.22rem 0.7rem 0.22rem 0.5rem",
      background:`${color}0e`,
      border:`1px solid ${color}28`,
      borderRadius:"100px",
      marginBottom:"1.75rem",
    }}>
      <span style={{
        fontFamily:T.mono, fontSize:"0.60rem", fontWeight:600,
        letterSpacing:"0.1em", color,
      }}>{n}</span>
      <span style={{
        fontFamily:T.sans, fontSize:"0.62rem", fontWeight:500,
        letterSpacing:"0.08em", textTransform:"uppercase", color,
      }}>{name}</span>
    </div>

    {/* Title */}
    <h2 style={{
      fontFamily:T.serif, fontSize:"clamp(1.8rem,3.2vw,2.6rem)",
      fontWeight:700, color:T.text, lineHeight:1.08,
      letterSpacing:"-0.025em", margin:"0 0 0.9rem",
    }}>{tagline}</h2>

    {/* Chain */}
    <div style={{ marginBottom:"2.25rem" }}>
      {chain.map(({ label, text }) => (
        <div key={label} style={{
          display:"grid", gridTemplateColumns:"72px 1fr",
          gap:"0.75rem", marginBottom:"0.7rem",
          alignItems:"baseline",
        }}>
          <span style={{
            fontFamily:T.sans, fontSize:"0.58rem", fontWeight:600,
            letterSpacing:"0.12em", textTransform:"uppercase",
            color: label === "Problem" ? T.textMuted
                 : label === "System"  ? color
                 : T.textSub,
            paddingTop:"0.1rem",
          }}>{label}</span>
          <span style={{
            fontFamily:T.sans, fontSize:"0.86rem", fontWeight:300,
            color:T.textSub, lineHeight:1.7,
          }}>{text}</span>
        </div>
      ))}
    </div>

    {/* CTAs */}
    <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
      <Button T={T} primary onClick={onExplore}>Request Access</Button>
      <Button T={T}>View Docs →</Button>
    </div>
  </div>
);

// ─── Slider ───────────────────────────────────────────────────────────────────
const SliderInput = ({ label, value, min, max, step, onChange, format, color=T.accent }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom:"1.5rem" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"0.6rem" }}>
        <label style={{
          fontFamily:T.sans, fontSize:"0.60rem", fontWeight:500,
          letterSpacing:"0.1em", textTransform:"uppercase", color:T.textMuted,
        }}>{label}</label>
        <span style={{
          fontFamily:T.serif, fontSize:"1.05rem", fontWeight:700,
          color:T.text, letterSpacing:"-0.02em",
        }}>{format(value)}</span>
      </div>
      <div style={{ position:"relative", height:"2px", background:"rgba(255,255,255,0.07)", borderRadius:"2px" }}>
        <div style={{
          position:"absolute", left:0, top:0, height:"100%",
          width:`${pct}%`, background:color, borderRadius:"2px",
          transition:`width 0.1s ${T.easeIn}`,
        }} />
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="prod-slider"
        style={{ marginTop:"-2px" }}
        aria-label={label}
      />
    </div>
  );
};

// ─── Small metric tile ────────────────────────────────────────────────────────
const MetricTile = ({ value, label, color=T.text, accent=false }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding:"1.1rem 1rem",
        background: hov ? T.surfaceHov : T.surfaceAlt,
        border:`1px solid ${T.border}`,
        borderRadius:"6px",
        transition:`background 0.15s ease`,
        cursor:"default",
        textAlign:"center",
      }}
    >
      <div style={{
        fontFamily:T.serif, fontSize:"clamp(1.3rem,2.5vw,1.8rem)",
        fontWeight:700, color, letterSpacing:"-0.03em", lineHeight:1,
        marginBottom:"0.3rem",
        transition:"text-shadow 0.25s ease",
        textShadow: hov ? `0 0 28px ${T.accentGlow}` : "none",
      }}>{value}</div>
      <div style={{
        fontFamily:T.sans, fontSize:"0.66rem", fontWeight:400,
        color:T.textMuted, lineHeight:1.4,
      }}>{label}</div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Hero
// ─────────────────────────────────────────────────────────────────────────────
const ProductHero = ({ onRequestAccess }) => {
  const scrollTo = useCallback(id => {
    document.getElementById(id)?.scrollIntoView({ behavior:"smooth", block:"start" });
  }, []);

  return (
    <section style={{
      position:"relative", minHeight:"76vh",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      overflow:"hidden", padding:"0 1.5rem",
      textAlign:"center", background:T.bg,
    }}>
      {/* Ambient glow */}
      <div aria-hidden="true" style={{
        position:"absolute", top:"50%", left:"50%",
        transform:"translate(-50%,-50%)",
        width:"800px", height:"500px",
        background:"radial-gradient(ellipse at center,rgba(61,90,254,0.05) 0%,transparent 68%)",
        filter:"blur(50px)", pointerEvents:"none",
      }} />
      {/* Subtle grid lines */}
      <div aria-hidden="true" style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:`
          linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)
        `,
        backgroundSize:"80px 80px",
        maskImage:"radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)",
      }} />
      <div aria-hidden="true" style={{
        position:"absolute", bottom:0, left:0, right:0, height:"220px",
        background:`linear-gradient(to top,${T.bg} 0%,transparent 100%)`,
        pointerEvents:"none",
      }} />

      <div style={{
        position:"relative", zIndex:1, maxWidth:"760px", width:"100%",
      }}>
        {/* Eyebrow */}
        <div style={{
          display:"inline-flex", alignItems:"center", gap:"0.5rem",
          marginBottom:"2.25rem",
          padding:"0.28rem 0.85rem 0.28rem 0.6rem",
          background:T.accentLight, border:`1px solid rgba(61,90,254,0.22)`,
          borderRadius:"100px",
          animation:"prodFadeUp 0.6s cubic-bezier(0.22,1,0.36,1) 0.08s both",
        }}>
          <span style={{
            width:"6px",height:"6px",borderRadius:"50%",
            background:T.accent,flexShrink:0,
            animation:"prodDotBlink 2.4s ease-in-out infinite",
          }} />
          <span style={{
            fontFamily:T.sans,fontSize:"0.67rem",fontWeight:500,
            letterSpacing:"0.12em",textTransform:"uppercase",
            color:"rgba(100,130,255,0.9)",
          }}>Product Suite · 2026</span>
        </div>

        {/* Headline */}
        <div style={{ animation:"prodFadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.16s both", marginBottom:"1.75rem" }}>
          <h1 style={{
            fontFamily:T.serif, fontSize:"clamp(2.8rem,6.5vw,5.2rem)",
            fontWeight:700, color:T.text, lineHeight:1.0,
            letterSpacing:"-0.03em", margin:"0 0 0.06em",
          }}>Decision Systems,</h1>
          <h1 style={{
            fontFamily:T.serif, fontSize:"clamp(2.8rem,6.5vw,5.2rem)",
            fontWeight:700, fontStyle:"italic",
            color:"rgba(237,237,240,0.18)", lineHeight:1.0,
            letterSpacing:"-0.03em", margin:0,
          }} aria-hidden="true">Not Dashboards.</h1>
        </div>

        {/* Subtitle */}
        <p style={{
          fontFamily:T.sans, fontSize:"1rem", fontWeight:300,
          color:T.textSub, lineHeight:1.78, maxWidth:"440px", margin:"0 auto 3rem",
          animation:"prodFadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.28s both",
        }}>
          Intervenix transforms borrower risk into optimised financial action —
          at portfolio scale, in real time.
        </p>

        {/* Product chips */}
        <div style={{
          display:"flex", justifyContent:"center", flexWrap:"wrap", gap:"0.6rem",
          animation:"prodFadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.4s both",
        }} className="prod-chips">
          {PRODUCTS.map(({ id, icon, name, color, n }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              style={{
                display:"inline-flex", alignItems:"center", gap:"0.45rem",
                padding:"0.4rem 0.9rem",
                background:`${color}0a`,
                border:`1px solid ${color}28`,
                borderRadius:"100px",
                cursor:"pointer",
                fontFamily:T.sans, fontSize:"0.74rem", fontWeight:500,
                color, letterSpacing:"0.01em",
                transition:`background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `${color}18`;
                e.currentTarget.style.borderColor = `${color}50`;
                e.currentTarget.style.boxShadow = `0 0 16px ${color}22`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = `${color}0a`;
                e.currentTarget.style.borderColor = `${color}28`;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <span style={{ fontSize:"0.68rem" }}>{icon}</span>
              <span style={{ fontFamily:T.mono, fontSize:"0.58rem", opacity:0.6 }}>{n}</span>
              {name}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes prodFadeUp {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes prodDotBlink {
          0%,100% { opacity:1; }
          50%     { opacity:0.3; }
        }
        .prod-slider {
          -webkit-appearance:none; appearance:none;
          width:100%; height:2px; background:transparent;
          outline:none; cursor:pointer;
          position:relative; z-index:1; margin:0;
        }
        .prod-slider::-webkit-slider-thumb {
          -webkit-appearance:none;
          width:14px; height:14px; border-radius:50%;
          background:#3D5AFE;
          border:2px solid rgba(255,255,255,0.2);
          box-shadow:0 0 0 3px rgba(61,90,254,0.2);
          cursor:pointer;
          transition:box-shadow 0.15s ease, transform 0.15s ease;
        }
        .prod-slider::-webkit-slider-thumb:hover {
          box-shadow:0 0 0 5px rgba(61,90,254,0.3);
          transform:scale(1.12);
        }
        .prod-slider::-moz-range-thumb {
          width:14px; height:14px; border-radius:50%;
          background:#3D5AFE;
          border:2px solid rgba(255,255,255,0.2);
          box-sizing:border-box;
        }
        @media (max-width:640px) { .prod-chips { gap:0.5rem !important; } }
        @media (prefers-reduced-motion:reduce) {
          [style*="prodFadeUp"],[style*="prodDotBlink"] {
            animation:none !important; opacity:1 !important;
          }
        }
      `}</style>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT 01 — Decision Engine
// ─────────────────────────────────────────────────────────────────────────────
const DecisionEngineDemo = () => {
  const [idx, setIdx] = useState(0);
  const b = DEMO_BORROWERS[idx];
  const actionColors = { EMAIL:"#60a5fa", CALL:"#fbbf24", HOLD:T.textMuted };

  return (
    <DemoWindow label={`Decision Engine  ·  ${b.id}`} color={T.accent}>
      {/* Header row */}
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        marginBottom:"1.25rem",
        paddingBottom:"1.25rem",
        borderBottom:`1px solid ${T.border}`,
      }}>
        <div>
          <div style={{ fontFamily:T.mono, fontSize:"0.70rem", color:T.textMuted, marginBottom:"0.2rem" }}>
            BORROWER
          </div>
          <div style={{
            fontFamily:T.mono, fontSize:"0.88rem", fontWeight:500, color:T.text,
          }}>{b.id}</div>
        </div>
        <div style={{
          display:"inline-flex", alignItems:"center", gap:"0.35rem",
          padding:"0.22rem 0.6rem",
          background:`${b.tierColor}10`,
          border:`1px solid ${b.tierColor}30`,
          borderRadius:"3px",
        }}>
          <span style={{ width:"5px",height:"5px",borderRadius:"50%",background:b.tierColor,flexShrink:0 }} />
          <span style={{ fontFamily:T.sans,fontSize:"0.60rem",fontWeight:500,
            letterSpacing:"0.1em",color:b.tierColor }}>{b.tier} RISK</span>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{
        display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
        gap:"0.75rem", marginBottom:"1.25rem",
      }}>
        {[
          { label:"P(default)", value:b.p.toFixed(2), color:b.tierColor },
          { label:"Exp. Value",  value:`$${b.ev.toFixed(0)}`, color:T.text },
          { label:"Confidence",  value:`${Math.round(b.conf*100)}%`, color:T.textSub },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background:T.surfaceAlt, border:`1px solid ${T.border}`,
            borderRadius:"4px", padding:"0.65rem 0.75rem", textAlign:"center",
          }}>
            <div style={{ fontFamily:T.mono,fontSize:"0.62rem",color:T.textMuted,marginBottom:"0.25rem" }}>
              {label}
            </div>
            <div style={{ fontFamily:T.serif,fontSize:"1.05rem",fontWeight:700,color, lineHeight:1 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Action row */}
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"0.85rem 1rem",
        background:`${actionColors[b.action]}08`,
        border:`1px solid ${actionColors[b.action]}28`,
        borderRadius:"6px",
        marginBottom:"1.25rem",
      }}>
        <div>
          <div style={{ fontFamily:T.sans,fontSize:"0.58rem",fontWeight:500,
            letterSpacing:"0.1em",textTransform:"uppercase",color:T.textMuted,marginBottom:"0.25rem" }}>
            Recommended Action
          </div>
          <div style={{ fontFamily:T.sans,fontSize:"0.86rem",fontWeight:600,
            color:actionColors[b.action],letterSpacing:"0.02em" }}>
            {b.action === "EMAIL" ? "Email Outreach"
           : b.action === "CALL"  ? "Phone Contact"
           : "Hold — No Action"}
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontFamily:T.sans,fontSize:"0.58rem",color:T.textMuted,marginBottom:"0.25rem" }}>
            Cost
          </div>
          <div style={{ fontFamily:T.mono,fontSize:"0.84rem",color:T.textSub }}>
            {b.cost === 0 ? "—" : `$${b.cost}`}
          </div>
        </div>
      </div>

      {/* SHAP mini */}
      <div style={{ marginBottom:"1.25rem" }}>
        <div style={{ fontFamily:T.sans,fontSize:"0.58rem",fontWeight:500,
          letterSpacing:"0.1em",textTransform:"uppercase",color:T.textMuted,marginBottom:"0.55rem" }}>
          Top Factors
        </div>
        {b.factors.map(({ label, val, pct, color }) => (
          <div key={label} style={{ marginBottom:"0.45rem" }}>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"0.2rem" }}>
              <span style={{ fontFamily:T.sans,fontSize:"0.70rem",color:T.textSub }}>{label}</span>
              <span style={{ fontFamily:T.mono,fontSize:"0.68rem",color }}>
                {val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}
              </span>
            </div>
            <div style={{ height:"2px",background:"rgba(255,255,255,0.06)",borderRadius:"1px" }}>
              <div style={{ width:`${pct}%`,height:"100%",background:color,borderRadius:"1px",
                transition:`width 0.4s ${T.ease}` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        paddingTop:"1rem", borderTop:`1px solid ${T.border}`,
      }}>
        <button onClick={() => setIdx(i => (i - 1 + DEMO_BORROWERS.length) % DEMO_BORROWERS.length)}
          style={{
            fontFamily:T.sans,fontSize:"0.70rem",fontWeight:500,
            color:T.textMuted, background:"transparent",
            border:`1px solid ${T.border}`, borderRadius:"4px",
            padding:"0.35rem 0.75rem", cursor:"pointer",
            transition:"color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color=T.text; e.currentTarget.style.borderColor="rgba(255,255,255,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.color=T.textMuted; e.currentTarget.style.borderColor=T.border; }}
        >← Prev</button>
        <span style={{ fontFamily:T.mono,fontSize:"0.65rem",color:T.textMuted }}>
          {idx + 1} of {DEMO_BORROWERS.length}
        </span>
        <button onClick={() => setIdx(i => (i + 1) % DEMO_BORROWERS.length)}
          style={{
            fontFamily:T.sans,fontSize:"0.70rem",fontWeight:500,
            color:T.textMuted, background:"transparent",
            border:`1px solid ${T.border}`, borderRadius:"4px",
            padding:"0.35rem 0.75rem", cursor:"pointer",
            transition:"color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color=T.text; e.currentTarget.style.borderColor="rgba(255,255,255,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.color=T.textMuted; e.currentTarget.style.borderColor=T.border; }}
        >Next →</button>
      </div>
    </DemoWindow>
  );
};

const DecisionEngineSection = ({ onRequestAccess }) => (
  <Section id="decision-engine">
    <div style={{
      display:"grid", gridTemplateColumns:"1fr 1fr",
      gap:"6rem", alignItems:"center",
    }} className="prod-two-col">
      <Reveal>
        <ProductCopy
          n="01" color={T.accent} name="Decision Engine"
          tagline="From risk score to revenue-optimal action."
          chain={[
            { label:"Problem", text:"Your model outputs a probability. Your team still decides what to do with it." },
            { label:"System",  text:"EV-calibrated scoring maps every borrower to an economic action in under 50ms." },
            { label:"Output",  text:"Structured decision payload: action type, cost, EV, confidence, SHAP factors." },
          ]}
          onExplore={onRequestAccess}
        />
      </Reveal>
      <Reveal delay={0.1}>
        <DecisionEngineDemo />
      </Reveal>
    </div>
  </Section>
);

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT 02 — Policy Optimizer
// ─────────────────────────────────────────────────────────────────────────────
const PolicyOptimizerDemo = () => {
  const [budget, setBudget] = useState(180000);
  const cutoff = LP_CUMCOST.findIndex(c => c > budget);
  const n = Math.max(1, cutoff === -1 ? LP_USERS.length : cutoff);
  const totalEV = Math.round(LP_USERS.slice(0, n).reduce((s, u) => s + u.ev, 0));
  const calls   = Math.round(n * 0.35);
  const emails  = Math.round(n * 0.42);
  const waivers = n - calls - emails;

  return (
    <DemoWindow label="Policy Optimizer  ·  LP Allocation" color={T.green}>
      {/* Slider */}
      <SliderInput
        label="Intervention Budget" value={budget}
        min={20000} max={400000} step={5000}
        onChange={setBudget} format={fmtK} color={T.green}
      />

      {/* Metric tiles */}
      <div style={{
        display:"grid", gridTemplateColumns:"repeat(3,1fr)",
        gap:"0.75rem", marginBottom:"1.25rem",
      }}>
        <MetricTile value={n.toLocaleString()} label="Borrowers" />
        <MetricTile value={fmtK(totalEV)} label="Total EV" color={T.green} />
        <MetricTile value="+18%" label="vs. Greedy" color={T.green} />
      </div>

      {/* LP bar chart */}
      <div style={{
        background:T.surfaceAlt, border:`1px solid ${T.border}`,
        borderRadius:"4px", overflow:"hidden", marginBottom:"1.25rem",
      }}>
        <div style={{
          padding:"0.45rem 0.85rem",
          borderBottom:`1px solid ${T.border}`,
          fontFamily:T.sans,fontSize:"0.58rem",fontWeight:500,
          letterSpacing:"0.1em",textTransform:"uppercase",color:T.textMuted,
        }}>Users ranked by EV / cost</div>
        <div style={{
          display:"flex", alignItems:"flex-end", gap:"2px",
          height:"64px", padding:"0.75rem 0.85rem 0.25rem",
        }}>
          {LP_USERS.map((u, i) => (
            <div key={i} style={{
              flex:1, minHeight:"3px",
              height:`${Math.max(3, u.h * 60)}px`,
              borderRadius:"1px 1px 0 0",
              background: i < n ? T.green : T.border,
              opacity: i < n ? 0.4 + u.h * 0.6 : 0.18,
              transition:`background 0.35s ${T.ease}`,
            }} />
          ))}
          {/* Cutoff line */}
          <div style={{
            position:"absolute",
            top:0, bottom:0,
            left:`${(n / LP_USERS.length) * 100}%`,
            width:"1px",
            background:`linear-gradient(to bottom,${T.green},transparent)`,
            opacity:0.6,
            transition:`left 0.35s ${T.ease}`,
            pointerEvents:"none",
          }} />
        </div>
      </div>

      {/* Action distribution */}
      <div>
        <div style={{ fontFamily:T.sans,fontSize:"0.58rem",fontWeight:500,
          letterSpacing:"0.1em",textTransform:"uppercase",color:T.textMuted,marginBottom:"0.6rem" }}>
          Action Distribution
        </div>
        {[
          { label:"Call",   count:calls,   pct:35, color:T.blue   },
          { label:"Email",  count:emails,  pct:42, color:T.accent  },
          { label:"Waiver", count:waivers, pct:23, color:T.purple  },
        ].map(({ label, count, pct, color }) => (
          <div key={label} style={{ marginBottom:"0.45rem" }}>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"0.2rem" }}>
              <span style={{ fontFamily:T.sans,fontSize:"0.70rem",color:T.textSub }}>{label}</span>
              <span style={{ fontFamily:T.mono,fontSize:"0.68rem",color:T.textMuted }}>
                {count.toLocaleString()} · {pct}%
              </span>
            </div>
            <div style={{ height:"2px",background:"rgba(255,255,255,0.06)",borderRadius:"1px" }}>
              <div style={{
                width:`${pct}%`, height:"100%", background:color, borderRadius:"1px",
                transition:`width 0.4s ${T.ease}`,
              }} />
            </div>
          </div>
        ))}
      </div>
    </DemoWindow>
  );
};

const PolicyOptimizerSection = ({ onRequestAccess }) => (
  <Section id="policy-optimizer" alt>
    <div style={{
      display:"grid", gridTemplateColumns:"1fr 1fr",
      gap:"6rem", alignItems:"center",
    }} className="prod-two-col">
      <Reveal>
        <PolicyOptimizerDemo />
      </Reveal>
      <Reveal delay={0.1}>
        <ProductCopy
          n="02" color={T.green} name="Policy Optimizer"
          tagline="Budget in. Maximum recovery out."
          chain={[
            { label:"Problem", text:"Intervention capacity is finite. Which 400 of your 4,000 at-risk borrowers do you contact?" },
            { label:"System",  text:"Constrained LP selects borrowers by EV/cost ratio — provably optimal within your budget." },
            { label:"Output",  text:"Optimal action assignments across the full portfolio. 15–20% better than greedy selection." },
          ]}
          onExplore={onRequestAccess}
        />
      </Reveal>
    </div>
  </Section>
);

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT 03 — Analyst Workbench
// ─────────────────────────────────────────────────────────────────────────────
const SHAP_FACTORS = [
  { label:"High credit utilization",   val:+0.18, pct:60, color:T.red    },
  { label:"Missed payment history",    val:+0.14, pct:47, color:T.orange },
  { label:"Low income stability",      val:+0.09, pct:30, color:T.yellow },
  { label:"Long account tenure",       val:-0.06, pct:20, color:T.green  },
];

const OVERRIDE_ACTIONS = ["CALL", "EMAIL", "WAIVER", "HOLD"];

const AnalystWorkbenchDemo = () => {
  const [status, setStatus]       = useState("pending"); // pending|approved|overridden|flagged
  const [overrideAction, setOvr]  = useState("CALL");
  const [showPicker, setShowPick] = useState(false);

  const statusLabels = {
    pending:    { label:"Pending Review", color:T.textMuted },
    approved:   { label:"Approved",       color:T.green     },
    overridden: { label:"Overridden",     color:T.yellow    },
    flagged:    { label:"Flagged",        color:T.red       },
  };
  const st = statusLabels[status];

  return (
    <DemoWindow label="Analyst Workbench  ·  BRW-4821" color={T.yellow}>
      {/* Borrower header */}
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"flex-start",
        marginBottom:"1.25rem", paddingBottom:"1.25rem",
        borderBottom:`1px solid ${T.border}`,
      }}>
        <div>
          <div style={{ fontFamily:T.mono,fontSize:"0.70rem",color:T.textMuted,marginBottom:"0.2rem" }}>
            BRW-4821
          </div>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:"0.35rem",
            padding:"0.2rem 0.5rem",
            background:`${T.red}10`, border:`1px solid ${T.red}28`,
            borderRadius:"3px",
          }}>
            <span style={{ width:"5px",height:"5px",borderRadius:"50%",background:T.red }} />
            <span style={{ fontFamily:T.sans,fontSize:"0.60rem",fontWeight:500,
              letterSpacing:"0.1em",color:T.red }}>HIGH RISK</span>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontFamily:T.serif,fontSize:"1.5rem",fontWeight:700,
            color:T.text,letterSpacing:"-0.03em",lineHeight:1 }}>0.73</div>
          <div style={{ fontFamily:T.sans,fontSize:"0.62rem",color:T.textMuted }}>P(default)</div>
        </div>
      </div>

      {/* SHAP factors */}
      <div style={{ marginBottom:"1.25rem" }}>
        <div style={{ fontFamily:T.sans,fontSize:"0.58rem",fontWeight:500,
          letterSpacing:"0.1em",textTransform:"uppercase",color:T.textMuted,marginBottom:"0.6rem" }}>
          Decision Drivers
        </div>
        {SHAP_FACTORS.map(({ label, val, pct, color }) => (
          <div key={label} style={{ marginBottom:"0.55rem" }}>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"0.22rem" }}>
              <span style={{ fontFamily:T.sans,fontSize:"0.72rem",color:T.textSub }}>{label}</span>
              <span style={{ fontFamily:T.mono,fontSize:"0.68rem",color }}>
                {val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}
              </span>
            </div>
            <div style={{
              display:"flex", alignItems:"center", gap:"0.4rem",
            }}>
              {val < 0 && (
                <div style={{ flex:1, height:"2px", background:"rgba(255,255,255,0.06)", borderRadius:"1px",
                  display:"flex", justifyContent:"flex-end" }}>
                  <div style={{ width:`${pct}%`,height:"100%",background:color,borderRadius:"1px",opacity:0.7 }} />
                </div>
              )}
              <div style={{
                width:"1px",height:"10px",
                background:"rgba(255,255,255,0.12)",flexShrink:0,
              }} />
              {val > 0 && (
                <div style={{ flex:1, height:"2px", background:"rgba(255,255,255,0.06)", borderRadius:"1px" }}>
                  <div style={{ width:`${pct}%`,height:"100%",background:color,borderRadius:"1px" }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Status */}
      <div style={{
        padding:"0.6rem 0.85rem",
        background:`${st.color}08`,
        border:`1px solid ${st.color}28`,
        borderRadius:"4px",
        marginBottom:"1rem",
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <span style={{ fontFamily:T.sans,fontSize:"0.74rem",fontWeight:300,color:T.textSub }}>
          {status === "overridden" ? `Overridden → ${overrideAction}` : "System recommendation: EMAIL"}
        </span>
        <span style={{ fontFamily:T.mono,fontSize:"0.62rem",fontWeight:500,
          letterSpacing:"0.08em",color:st.color }}>{st.label}</span>
      </div>

      {/* Override picker */}
      {showPicker && (
        <div style={{
          display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0.4rem",
          marginBottom:"0.75rem",
          padding:"0.75rem",
          background:T.surfaceAlt, border:`1px solid ${T.border}`,
          borderRadius:"6px",
        }}>
          {OVERRIDE_ACTIONS.map(a => (
            <button key={a}
              onClick={() => { setOvr(a); setStatus("overridden"); setShowPick(false); }}
              style={{
                fontFamily:T.mono,fontSize:"0.62rem",fontWeight:500,
                letterSpacing:"0.05em",
                color: overrideAction===a ? "#fff" : T.textSub,
                background: overrideAction===a ? T.accent : "transparent",
                border:`1px solid ${overrideAction===a ? T.accent : T.border}`,
                borderRadius:"3px", padding:"0.35rem 0", cursor:"pointer",
                transition:"all 0.15s ease",
              }}
              onMouseEnter={e => { if(overrideAction!==a){ e.currentTarget.style.color=T.text; e.currentTarget.style.borderColor="rgba(255,255,255,0.18)"; }}}
              onMouseLeave={e => { if(overrideAction!==a){ e.currentTarget.style.color=T.textSub; e.currentTarget.style.borderColor=T.border; }}}
            >{a}</button>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0.5rem" }}>
        {[
          { label:"Approve",  action:() => { setStatus("approved"); setShowPick(false); },  color:T.green  },
          { label:"Override", action:() => setShowPick(p => !p), color:T.yellow },
          { label:"Flag",     action:() => { setStatus("flagged"); setShowPick(false); },   color:T.red    },
        ].map(({ label, action, color }) => (
          <button key={label}
            onClick={action}
            style={{
              fontFamily:T.sans,fontSize:"0.72rem",fontWeight:500,
              letterSpacing:"0.03em",
              color,
              background:`${color}0a`,
              border:`1px solid ${color}28`,
              borderRadius:"4px", padding:"0.5rem", cursor:"pointer",
              transition:"background 0.15s ease, border-color 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background=`${color}18`; e.currentTarget.style.borderColor=`${color}50`; }}
            onMouseLeave={e => { e.currentTarget.style.background=`${color}0a`; e.currentTarget.style.borderColor=`${color}28`; }}
          >{label}</button>
        ))}
      </div>
    </DemoWindow>
  );
};

const AnalystWorkbenchSection = ({ onRequestAccess }) => (
  <Section id="analyst-workbench">
    <div style={{
      display:"grid", gridTemplateColumns:"1fr 1fr",
      gap:"6rem", alignItems:"center",
    }} className="prod-two-col">
      <Reveal>
        <ProductCopy
          n="03" color={T.yellow} name="Analyst Workbench"
          tagline="Machine recommendations. Human judgment."
          chain={[
            { label:"Problem", text:"Automated decisions without transparency erode trust and fail compliance reviews." },
            { label:"System",  text:"Every recommendation includes SHAP attribution and a structured override mechanism." },
            { label:"Output",  text:"Analyst-reviewed, audit-ready intervention queue with full decision trace." },
          ]}
          onExplore={onRequestAccess}
        />
      </Reveal>
      <Reveal delay={0.1}>
        <AnalystWorkbenchDemo />
      </Reveal>
    </div>
  </Section>
);

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT 04 — Risk Intelligence
// ─────────────────────────────────────────────────────────────────────────────
const PSIBarChart = ({ alertActive }) => {
  const days    = ["M","T","W","T","F","S","S"];
  const normal  = [0.04, 0.05, 0.06, 0.07, 0.08, 0.08, 0.09];
  const alerted = [0.04, 0.05, 0.06, 0.07, 0.08, 0.08, 0.24];
  const values  = alertActive ? alerted : normal;
  const threshold = 0.20;
  const H = 72, max = 0.30;

  return (
    <div style={{ marginBottom:"1rem" }}>
      <div style={{ fontFamily:T.sans,fontSize:"0.58rem",fontWeight:500,
        letterSpacing:"0.1em",textTransform:"uppercase",color:T.textMuted,marginBottom:"0.5rem",
        display:"flex",justifyContent:"space-between" }}>
        <span>PSI — 7 days</span>
        <span style={{ color: alertActive ? T.red : T.textMuted }}>
          {alertActive ? "⚠ THRESHOLD BREACHED" : "Threshold: 0.20"}
        </span>
      </div>
      <svg viewBox={`0 0 196 ${H + 14}`} style={{ width:"100%",display:"block",overflow:"visible" }}>
        {/* Threshold line */}
        <line
          x1={0} x2={196}
          y1={H - (threshold / max) * H}
          y2={H - (threshold / max) * H}
          stroke="rgba(248,113,113,0.35)"
          strokeWidth={0.8}
          strokeDasharray="4 3"
        />
        {values.map((v, i) => {
          const barH = Math.max(4, (v / max) * H);
          const x = i * 28 + 2;
          const y = H - barH;
          const isAlert = v > threshold;
          const color = isAlert ? T.red : v > 0.14 ? T.yellow : T.accent;
          return (
            <g key={i}>
              <rect
                x={x} y={y} width={20} height={barH}
                rx={2}
                fill={color}
                opacity={isAlert ? 1 : 0.65}
                style={{ transition:"all 0.45s cubic-bezier(0.22,1,0.36,1)" }}
              />
              <text
                x={x + 10} y={H + 11}
                textAnchor="middle"
                style={{
                  fontFamily:"monospace", fontSize:"7px",
                  fill:"rgba(237,237,240,0.3)",
                }}
              >{days[i]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const RiskCard = ({ icon, title, metric, status, statusColor, fillPct, threshold }) => (
  <div style={{
    background:T.surfaceAlt, border:`1px solid ${T.border}`,
    borderRadius:"6px", padding:"1rem",
    display:"flex", flexDirection:"column", gap:"0.65rem",
  }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
        <span style={{ fontSize:"0.75rem",color:T.textMuted }}>{icon}</span>
        <span style={{ fontFamily:T.sans,fontSize:"0.78rem",fontWeight:500,color:T.text }}>{title}</span>
      </div>
      <div style={{
        display:"inline-flex", alignItems:"center", gap:"0.3rem",
        padding:"0.18rem 0.5rem",
        background:`${statusColor}10`, border:`1px solid ${statusColor}28`,
        borderRadius:"3px",
      }}>
        <span style={{
          width:"4px",height:"4px",borderRadius:"50%",
          background:statusColor,
          animation:"prodBlink 2.2s ease-in-out infinite",
          flexShrink:0,
        }} />
        <span style={{ fontFamily:T.mono,fontSize:"0.58rem",fontWeight:500,
          letterSpacing:"0.1em",color:statusColor }}>{status}</span>
      </div>
    </div>
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"0.3rem" }}>
        <span style={{ fontFamily:T.mono,fontSize:"0.68rem",color:statusColor }}>{metric}</span>
        <span style={{ fontFamily:T.sans,fontSize:"0.62rem",color:T.textMuted }}>{threshold}</span>
      </div>
      <div style={{ height:"2px",background:"rgba(255,255,255,0.06)",borderRadius:"1px" }}>
        <div style={{ width:`${fillPct}%`,height:"100%",background:statusColor,
          borderRadius:"1px",boxShadow:`0 0 4px ${statusColor}40` }} />
      </div>
    </div>
  </div>
);

const RiskIntelligenceDemo = () => {
  const [alert, setAlert] = useState(false);

  return (
    <DemoWindow label="Risk Intelligence  ·  System Health" color={T.red}>
      {/* PSI chart */}
      <PSIBarChart alertActive={alert} />

      {/* Alert banner */}
      {alert && (
        <div style={{
          padding:"0.65rem 0.85rem",
          background:"rgba(248,113,113,0.06)",
          border:`1px solid rgba(248,113,113,0.25)`,
          borderRadius:"4px", marginBottom:"1rem",
          display:"flex", alignItems:"center", gap:"0.6rem",
          animation:"prodFadeIn 0.3s ease both",
        }}>
          <span style={{ color:T.red,fontSize:"0.75rem",flexShrink:0 }}>⚠</span>
          <div>
            <div style={{ fontFamily:T.sans,fontSize:"0.74rem",fontWeight:500,color:T.red }}>
              PSI breach — utilization feature
            </div>
            <div style={{ fontFamily:T.sans,fontSize:"0.68rem",fontWeight:300,color:T.textSub }}>
              Retraining job queued · On-call notified
            </div>
          </div>
        </div>
      )}

      {/* Status cards */}
      <div style={{ display:"flex",flexDirection:"column",gap:"0.5rem",marginBottom:"1.25rem" }}>
        <RiskCard
          icon="◎" title="Calibration"
          metric={`ECE: ${alert ? "0.051" : "0.024"}`}
          status={alert ? "DEGRADED" : "NOMINAL"}
          statusColor={alert ? T.yellow : T.green}
          fillPct={alert ? 51 : 48}
          threshold="Limit: 0.050"
        />
        <RiskCard
          icon="■" title="Circuit Breakers"
          metric={`Confidence: ${alert ? "83%" : "91%"}`}
          status={alert ? "ACTIVE" : "STANDBY"}
          statusColor={alert ? T.red : T.yellow}
          fillPct={alert ? 83 : 91}
          threshold="Floor: 85%"
        />
      </div>

      {/* Simulate button */}
      <button onClick={() => setAlert(a => !a)} style={{
        width:"100%",
        fontFamily:T.sans,fontSize:"0.72rem",fontWeight:500,letterSpacing:"0.04em",
        color: alert ? T.green : T.red,
        background: alert ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
        border: `1px solid ${alert ? "rgba(74,222,128,0.22)" : "rgba(248,113,113,0.22)"}`,
        borderRadius:"4px", padding:"0.6rem",cursor:"pointer",
        transition:"all 0.2s ease",
      }}
        onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      >
        {alert ? "✓ Resolve Alert" : "Simulate Drift Alert →"}
      </button>

      <style>{`
        @keyframes prodBlink {
          0%,100% { opacity:1; }
          50%     { opacity:0.3; }
        }
        @keyframes prodFadeIn {
          from { opacity:0; transform:translateY(-4px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </DemoWindow>
  );
};

const RiskIntelligenceSection = ({ onRequestAccess }) => (
  <Section id="risk-intelligence" alt>
    <div style={{
      display:"grid", gridTemplateColumns:"1fr 1fr",
      gap:"6rem", alignItems:"center",
    }} className="prod-two-col">
      <Reveal>
        <RiskIntelligenceDemo />
      </Reveal>
      <Reveal delay={0.1}>
        <ProductCopy
          n="04" color={T.red} name="Risk Intelligence"
          tagline="Know when your model stops working."
          chain={[
            { label:"Problem", text:"Distribution shift silently degrades model performance in production. No alerts fire." },
            { label:"System",  text:"PSI monitoring, ECE calibration tracking, and circuit breakers catch drift early." },
            { label:"Output",  text:"Real-time model health signals with automated fallback and retraining triggers." },
          ]}
          onExplore={onRequestAccess}
        />
      </Reveal>
    </div>
  </Section>
);

// ─── CTA ──────────────────────────────────────────────────────────────────────
const ProductCta = ({ onRequestAccess }) => (
  <section style={{
    position:"relative", overflow:"hidden",
    padding:"9rem 2rem", background:T.bg, textAlign:"center",
  }}>
    <div style={{
      position:"absolute", top:"50%", left:"50%",
      transform:"translate(-50%,-50%)",
      width:"700px", height:"400px", pointerEvents:"none",
      background:"radial-gradient(ellipse at center,rgba(61,90,254,0.06) 0%,transparent 65%)",
      filter:"blur(60px)",
    }} />
    <div style={{
      position:"absolute", top:"50%", left:"5%", right:"5%", height:"1px",
      background:`linear-gradient(90deg,transparent,${T.border} 20%,${T.border} 80%,transparent)`,
      transform:"translateY(-80px)", pointerEvents:"none",
    }} />
    <div style={{ position:"relative", zIndex:1, maxWidth:"540px", margin:"0 auto" }}>
      <Reveal>
        <p style={{
          fontFamily:T.sans, fontSize:"0.62rem", fontWeight:500,
          letterSpacing:"0.18em", textTransform:"uppercase",
          color:T.textMuted, marginBottom:"1.5rem",
        }}>Deploy the Suite</p>
        <h2 style={{
          fontFamily:T.serif, fontSize:"clamp(2.1rem,5vw,3.6rem)",
          fontWeight:700, color:T.text, lineHeight:1.06,
          letterSpacing:"-0.025em", marginBottom:"1.25rem",
        }}>
          Four products.<br />
          <em style={{ fontStyle:"italic", color:T.textMuted }}>One decision system.</em>
        </h2>
        <p style={{
          fontFamily:T.sans, fontSize:"0.92rem", fontWeight:300,
          color:T.textSub, lineHeight:1.82, marginBottom:"2.75rem",
          textAlign:"center",
        }}>
          Use individually or as a suite. Connect via REST in under a day.
        </p>
        <div style={{
          display:"flex", gap:"0.75rem", justifyContent:"center",
          flexWrap:"wrap", alignItems:"center",
        }}>
          <Button T={T} primary onClick={onRequestAccess}>Request Early Access</Button>
          <Button T={T}>Talk to an Engineer</Button>
        </div>
        <p style={{
          fontFamily:T.sans, fontSize:"0.70rem",
          color:T.textMuted, marginTop:"1.5rem",
        }}>No commitment. Response within 24 hours.</p>
      </Reveal>
    </div>
  </section>
);

// ─── Footer ───────────────────────────────────────────────────────────────────
const FooterLink = ({ children }) => {
  const [hov, setHov] = useState(false);
  return (
    <a href="#"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"block", fontFamily:T.sans, fontSize:"0.78rem", fontWeight:300,
        color: hov ? T.text : T.textSub, marginBottom:"0.6rem",
        transition:"color 0.15s ease",
      }}>{children}</a>
  );
};

const ProductFooter = () => {
  const cols = [
    { head:"Products", links:["Decision Engine","Policy Optimizer","Analyst Workbench","Risk Intelligence"] },
    { head:"Company",  links:["About","Blog","Careers","Press"] },
    { head:"Legal",    links:["Privacy","Terms","DPA","Compliance"] },
  ];
  return (
    <footer style={{
      background:T.bg, borderTop:`1px solid ${T.border}`,
      padding:"4rem 2rem 2rem",
    }}>
      <div style={{ maxWidth:"1080px", margin:"0 auto" }}>
        <div className="footer-grid" style={{ marginBottom:"3.5rem" }}>
          <div>
            <span style={{ fontFamily:T.serif,fontSize:"1rem",fontWeight:700,
              color:T.text,display:"block",marginBottom:"0.75rem" }}>Intervenix</span>
            <p style={{ fontFamily:T.sans,fontSize:"0.78rem",fontWeight:300,
              color:T.textSub,lineHeight:1.7,maxWidth:"240px" }}>
              Real-time autonomous risk intervention for financial institutions.
            </p>
          </div>
          {cols.map(({ head, links }) => (
            <div key={head}>
              <p style={{ fontFamily:T.sans,fontSize:"0.68rem",fontWeight:500,
                letterSpacing:"0.1em",textTransform:"uppercase",
                color:T.textMuted,marginBottom:"1rem" }}>{head}</p>
              {links.map(l => <FooterLink key={l}>{l}</FooterLink>)}
            </div>
          ))}
        </div>
        <div style={{
          borderTop:`1px solid ${T.border}`, paddingTop:"1.5rem",
          display:"flex",justifyContent:"space-between",
          alignItems:"center",flexWrap:"wrap",gap:"0.75rem",
        }}>
          <span style={{ fontFamily:T.sans,fontSize:"0.70rem",color:T.textMuted }}>
            © 2026 Intervenix. An academic project of Vishwakarma Institute of Technology.
          </span>
          <span style={{ fontFamily:T.sans,fontSize:"0.70rem",color:T.textMuted }}>
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
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position:"fixed",inset:0,zIndex:10000,
      background:"rgba(8,8,12,0.88)", backdropFilter:"blur(10px)",
      overflowY:"auto", display:"flex",
      alignItems:"flex-start", justifyContent:"center",
    }}>
      <button onClick={onClose} style={{
        position:"fixed",top:"1.25rem",right:"1.5rem",
        background:"rgba(255,255,255,0.04)",
        border:"1px solid rgba(255,255,255,0.07)",
        color:"rgba(237,237,240,0.4)",
        fontFamily:T.mono,fontSize:"0.75rem",
        padding:"0.4rem 0.85rem",cursor:"pointer",
        borderRadius:"4px",zIndex:10001,
        letterSpacing:"0.04em",
        transition:"color 0.15s, background 0.15s",
      }}
        onMouseEnter={e => { e.currentTarget.style.color="#EDEDF0"; e.currentTarget.style.background="rgba(255,255,255,0.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.color="rgba(237,237,240,0.4)"; e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
        aria-label="Close"
      >✕ esc</button>
      <div style={{ width:"100%",minHeight:"100vh" }}>
        <RequestAccess />
      </div>
    </div>
  );
};

// ─── Page root ────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [showAccess, setShowAccess] = useState(false);
  const open  = () => setShowAccess(true);
  const close = () => setShowAccess(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <style>{`
        @media (max-width:900px) {
          .prod-two-col {
            grid-template-columns: 1fr !important;
            gap: 3rem !important;
          }
        }
        @media (max-width:640px) {
          .prod-two-col > *:first-child { order: 1 !important; }
          .prod-two-col > *:last-child  { order: 2 !important; }
        }
      `}</style>

      <Grain />
      <Nav T={T} onRequestAccess={open} />

      <div style={{ animation:"prodPageFade 0.32s ease both" }}>
        <ProductHero onRequestAccess={open} />
        <Divider />
        <DecisionEngineSection  onRequestAccess={open} />
        <Divider />
        <PolicyOptimizerSection onRequestAccess={open} />
        <Divider />
        <AnalystWorkbenchSection onRequestAccess={open} />
        <Divider />
        <RiskIntelligenceSection onRequestAccess={open} />
        <ProductCta onRequestAccess={open} />
        <ProductFooter />
      </div>

      {showAccess && <AccessModal onClose={close} />}
      <style>{`@keyframes prodPageFade{from{opacity:0}to{opacity:1}}`}</style>
    </>
  );
}
