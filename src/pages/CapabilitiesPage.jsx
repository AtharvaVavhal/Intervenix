/**
 * CapabilitiesPage.jsx
 *
 * Sections (in order):
 *   CapHero → DecisionIntelSection → OptimizationSection →
 *   ExplainabilitySection → SimulationSection →
 *   UncertaintySection → ReliabilitySection → CapCta → CapFooter
 *
 * Interactive state:
 *   optimBudget              — LP optimization slider
 *   simBudget / simCostMult / simEffectiveness — simulation panel
 *
 * Design system: identical to landing + HowItWorksPage.
 * No Tailwind, no Framer Motion — consistent with existing codebase.
 */

import { useState, useMemo, useEffect } from "react";
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
  accentLight: "rgba(61,90,254,0.12)",
  accentGlow:  "rgba(61,90,254,0.3)",
  text:        "#EDEDF0",
  textSub:     "rgba(237,237,240,0.45)",
  textMuted:   "rgba(237,237,240,0.22)",
  textFaint:   "rgba(237,237,240,0.10)",
  serif:  "'Playfair Display', serif",
  sans:   "'DM Sans', sans-serif",
  mono:   "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
  ease:   "cubic-bezier(0.22, 1, 0.36, 1)",
  easeIn: "cubic-bezier(0.4, 0, 0.2, 1)",
};

// ─── Shared primitives ────────────────────────────────────────────────────────
const Grain = () => (
  <div style={{
    position:"fixed",inset:0,zIndex:9999,pointerEvents:"none",
    opacity:0.022,mixBlendMode:"overlay",
    backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    backgroundSize:"160px 160px",
  }} />
);

const Label = ({ children }) => (
  <div style={{
    fontFamily:T.sans,fontSize:"0.62rem",fontWeight:500,
    letterSpacing:"0.18em",textTransform:"uppercase",
    color:T.textMuted,marginBottom:"1rem",
  }}>{children}</div>
);

const SectionTitle = ({ children, center=false }) => (
  <h2 style={{
    fontFamily:T.serif,fontSize:"clamp(1.9rem,3.5vw,2.8rem)",
    fontWeight:700,color:T.text,lineHeight:1.1,
    letterSpacing:"-0.025em",margin:"0 0 1.25rem",
    textAlign:center?"center":"left",
  }}>{children}</h2>
);

const Body = ({ children, style={}, center=false }) => (
  <p style={{
    fontFamily:T.sans,fontSize:"0.92rem",fontWeight:300,
    color:T.textSub,lineHeight:1.82,
    textAlign:center?"center":"left",...style,
  }}>{children}</p>
);

const Divider = () => (
  <div style={{
    width:"100%",height:"1px",
    background:`linear-gradient(90deg,transparent 0%,${T.border} 30%,${T.border} 70%,transparent 100%)`,
  }} />
);

const Section = ({ children, alt=false, style:extra={}, id }) => (
  <section id={id} style={{background:alt?T.surfaceAlt:T.bg,padding:"7rem 2rem",...extra}}>
    <div style={{maxWidth:"1080px",margin:"0 auto"}}>{children}</div>
  </section>
);

// ─── LP optimisation data (static, computed once) ─────────────────────────────
// 80 users sorted by EV/cost efficiency — represents LP solution space
const LP_USERS = (() => {
  const u = [];
  for (let i = 0; i < 80; i++) {
    const h = Math.max(0.06, Math.min(1,
      (1 - (i/80)*0.82) +
      Math.sin(i*2.3+0.8)*0.06 +
      Math.cos(i*1.7+2.1)*0.04
    ));
    const cost = 150 + i*14 + Math.floor(Math.abs(Math.sin(i*3.1+1))*60);
    u.push({ h, cost, ev: h * 1200 });
  }
  return u;
})();
const LP_CUMCOST = LP_USERS.reduce((a,u,i) => [...a, (a[i-1]||0)+u.cost], []);

// ─── SHAP drivers ─────────────────────────────────────────────────────────────
const SHAP_DRIVERS = [
  { label:"High credit utilization",    contrib:+0.18, pct:60, color:"#f87171", dir:"pos" },
  { label:"History of missed payments", contrib:+0.14, pct:47, color:"#fb923c", dir:"pos" },
  { label:"Low income stability index", contrib:+0.09, pct:30, color:"#fbbf24", dir:"pos" },
  { label:"Long account tenure",        contrib:-0.06, pct:20, color:"#4ade80", dir:"neg" },
  { label:"Recent on-time payment",     contrib:-0.04, pct:13, color:"#34d399", dir:"neg" },
];

// ─── Uncertainty cases ────────────────────────────────────────────────────────
const UNCERTAINTY_CASES = [
  { id:"BRW-4821", score:0.73, pLow:0.71, pHigh:0.76,
    levelColor:"#4ade80", label:"High Confidence",
    sublabel:"Automated action", action:"Email → Waiver", isReview:false },
  { id:"BRW-2047", score:0.51, pLow:0.42, pHigh:0.61,
    levelColor:"#fbbf24", label:"Medium Confidence",
    sublabel:"Action with flag", action:"Call → Follow-up", isReview:false },
  { id:"BRW-9183", score:0.42, pLow:0.18, pHigh:0.67,
    levelColor:"#f87171", label:"Low Confidence",
    sublabel:"Analyst review", action:"Routed to analyst", isReview:true },
];

// ─── Reliability cards ────────────────────────────────────────────────────────
const RELIABILITY_CARDS = [
  {
    icon:"◈", title:"Drift Monitoring", subtitle:"Population Stability Index",
    desc:"PSI monitored hourly across all input features. Alert threshold: PSI > 0.20.",
    metric:"PSI: 0.08", threshold:"Limit: 0.20", fillPct:40,
    status:"NOMINAL", statusColor:"#4ade80",
  },
  {
    icon:"◎", title:"Calibration Check", subtitle:"Expected Calibration Error",
    desc:"ECE validated against holdout set daily. Recalibration queue fires at ECE > 0.05.",
    metric:"ECE: 0.024", threshold:"Limit: 0.050", fillPct:48,
    status:"NOMINAL", statusColor:"#4ade80",
  },
  {
    icon:"■", title:"Circuit Breakers", subtitle:"Model Confidence Floor",
    desc:"Conservative rule fallback when model confidence drops below the 85% floor.",
    metric:"Confidence: 91%", threshold:"Floor: 85%", fillPct:91,
    status:"STANDBY", statusColor:"#fbbf24",
  },
];

// ─── Slider component ─────────────────────────────────────────────────────────
const SliderInput = ({ label, value, min, max, step, onChange, format, accentColor=T.accent }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"0.65rem" }}>
        <label style={{
          fontFamily:T.sans, fontSize:"0.62rem", fontWeight:500,
          letterSpacing:"0.1em", textTransform:"uppercase", color:T.textMuted,
        }}>{label}</label>
        <span style={{
          fontFamily:T.serif, fontSize:"1.1rem", fontWeight:700,
          color:T.text, letterSpacing:"-0.02em",
        }}>{format(value)}</span>
      </div>
      <div style={{ position:"relative", height:"2px", background:"rgba(255,255,255,0.08)", borderRadius:"2px" }}>
        <div style={{
          position:"absolute", left:0, top:0, height:"100%",
          width:`${pct}%`, background:accentColor, borderRadius:"2px",
          transition:`width 0.1s ${T.easeIn}`,
        }} />
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="cap-slider"
        style={{ marginTop:"-2px" }}
        aria-label={label}
      />
    </div>
  );
};

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
const Sparkline = ({ values }) => {
  const W = 320, H = 72;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const n = values.length;
  const toX = i => (i / (n-1)) * W;
  const toY = v => H - ((v-min)/range) * (H-8) - 4;
  const pts = values.map((v,i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const area = `0,${H} ${pts} ${W},${H}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ display:"block", overflow:"visible" }}>
      <defs>
        <linearGradient id="capSparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={T.accent} stopOpacity="0.22" />
          <stop offset="100%" stopColor={T.accent} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#capSparkGrad)" />
      <polyline points={pts} fill="none" stroke={T.accent}
        strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
};

// ─── 1. Hero ──────────────────────────────────────────────────────────────────
const CapHero = () => {
  const scrollToEngine = () =>
    document.getElementById("cap-engine")?.scrollIntoView({ behavior:"smooth", block:"start" });

  return (
    <section style={{
      position:"relative", minHeight:"72vh",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      overflow:"hidden", padding:"0 1.5rem",
      textAlign:"center", background:T.bg,
    }}>
      {/* Radar pulse rings */}
      {[0, 1.1, 2.2].map((delay, i) => (
        <div key={i} aria-hidden="true" style={{
          position:"absolute", top:"50%", left:"50%",
          width:"520px", height:"520px",
          borderRadius:"50%",
          border:`1px solid rgba(61,90,254,${0.22 - i*0.05})`,
          animation:`capRing 3.6s ${T.ease} ${delay}s infinite`,
          pointerEvents:"none",
        }} />
      ))}
      {/* Center glow */}
      <div aria-hidden="true" style={{
        position:"absolute", top:"50%", left:"50%",
        transform:"translate(-50%,-50%)",
        width:"8px", height:"8px", borderRadius:"50%",
        background:T.accent,
        boxShadow:`0 0 16px ${T.accent}, 0 0 40px rgba(61,90,254,0.5)`,
        pointerEvents:"none",
      }} />
      {/* Radial bg glow */}
      <div aria-hidden="true" style={{
        position:"absolute", top:"50%", left:"50%",
        transform:"translate(-50%,-50%)",
        width:"700px", height:"500px",
        background:"radial-gradient(ellipse at center,rgba(61,90,254,0.055) 0%,transparent 68%)",
        filter:"blur(40px)", pointerEvents:"none",
      }} />
      {/* Bottom fade */}
      <div aria-hidden="true" style={{
        position:"absolute", bottom:0, left:0, right:0, height:"200px",
        background:`linear-gradient(to top,${T.bg} 0%,transparent 100%)`,
        pointerEvents:"none",
      }} />

      <div style={{ position:"relative", zIndex:1, maxWidth:"760px", width:"100%" }}>
        {/* Badge */}
        <div style={{
          display:"inline-flex", alignItems:"center", gap:"0.5rem",
          marginBottom:"2.5rem", padding:"0.3rem 0.85rem 0.3rem 0.6rem",
          background:T.accentLight, border:`1px solid rgba(61,90,254,0.22)`,
          borderRadius:"100px",
          animation:"capFadeUp 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both",
        }}>
          <span style={{
            width:"6px", height:"6px", borderRadius:"50%",
            background:T.accent, flexShrink:0,
            animation:"capDotBlink 2.4s ease-in-out infinite",
          }} />
          <span style={{
            fontFamily:T.sans, fontSize:"0.67rem", fontWeight:500,
            letterSpacing:"0.12em", textTransform:"uppercase",
            color:"rgba(100,130,255,0.9)",
          }}>Decision Intelligence Engine</span>
        </div>

        {/* Headline */}
        <div style={{ animation:"capFadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.18s both", marginBottom:"2rem" }}>
          <h1 style={{
            fontFamily:T.serif, fontSize:"clamp(2.9rem,6.5vw,5.4rem)",
            fontWeight:700, color:T.text, lineHeight:1.0,
            letterSpacing:"-0.03em", margin:"0 0 0.04em",
          }}>From Prediction</h1>
          <h1 style={{
            fontFamily:T.serif, fontSize:"clamp(2.9rem,6.5vw,5.4rem)",
            fontWeight:700, fontStyle:"italic",
            color:"rgba(237,237,240,0.18)", lineHeight:1.0,
            letterSpacing:"-0.03em", margin:0,
          }} aria-hidden="true">to Decision.</h1>
        </div>

        {/* Subtitle */}
        <p style={{
          fontFamily:T.sans, fontSize:"1rem", fontWeight:300,
          color:T.textSub, lineHeight:1.78, maxWidth:"460px",
          margin:"0 auto 2.75rem",
          animation:"capFadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.3s both",
        }}>
          Most risk systems stop at a score. Intervenix converts probability
          into economic action — allocating capital, selecting interventions,
          and maximising recovery across the full portfolio.
        </p>

        {/* CTA */}
        <div style={{ animation:"capFadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.42s both" }}>
          <Button T={T} primary onClick={scrollToEngine}>Explore Engine →</Button>
        </div>
      </div>

      <style>{`
        @keyframes capRing {
          0%   { transform:translate(-50%,-50%) scale(0.12); opacity:0.55; }
          100% { transform:translate(-50%,-50%) scale(2.4);  opacity:0;    }
        }
        @keyframes capFadeUp {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @keyframes capDotBlink {
          0%,100% { opacity:1;   }
          50%     { opacity:0.3; }
        }
        @keyframes capPulse {
          0%,100% { box-shadow: 0 0 0 0   currentColor; }
          50%     { box-shadow: 0 0 0 4px transparent;  }
        }
        .cap-slider {
          -webkit-appearance:none; appearance:none;
          width:100%; height:2px; background:transparent;
          outline:none; cursor:pointer;
          position:relative; z-index:1; margin:0;
        }
        .cap-slider::-webkit-slider-thumb {
          -webkit-appearance:none; appearance:none;
          width:14px; height:14px; border-radius:50%;
          background:#3D5AFE;
          border:2px solid rgba(255,255,255,0.2);
          box-shadow:0 0 0 3px rgba(61,90,254,0.2);
          cursor:pointer;
          transition:box-shadow 0.15s ease, transform 0.15s ease;
        }
        .cap-slider::-webkit-slider-thumb:hover {
          box-shadow:0 0 0 5px rgba(61,90,254,0.3);
          transform:scale(1.15);
        }
        .cap-slider::-moz-range-thumb {
          width:14px; height:14px; border-radius:50%;
          background:#3D5AFE;
          border:2px solid rgba(255,255,255,0.2);
          cursor:pointer; box-sizing:border-box;
        }
        @media (prefers-reduced-motion:reduce) {
          [style*="capRing"],[style*="capFadeUp"],[style*="capDotBlink"] {
            animation:none !important; opacity:1 !important;
          }
        }
      `}</style>
    </section>
  );
};

// ─── 2. Decision Intelligence Engine ─────────────────────────────────────────
const DI_CARDS = [
  {
    icon:"◎",
    title:"Calibrated Risk",
    sub:"Probability estimates aligned to observed event rates. P(0.73) means 73 in 100 default.",
    visual: () => (
      <div style={{ marginTop:"1.75rem" }}>
        <div style={{ position:"relative", height:"6px", background:"rgba(255,255,255,0.07)", borderRadius:"3px" }}>
          <div style={{ width:"73%", height:"100%", borderRadius:"3px",
            background:`linear-gradient(90deg,rgba(61,90,254,0.35),${T.accent})` }} />
          <div style={{ position:"absolute", top:"-5px", left:"73%", transform:"translateX(-50%)",
            width:"1.5px", height:"16px", background:T.accent }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:"0.45rem" }}>
          <span style={{ fontFamily:T.mono, fontSize:"0.60rem", color:T.textMuted }}>0.00</span>
          <span style={{ fontFamily:T.mono, fontSize:"0.67rem", color:T.accent, letterSpacing:"0.04em" }}>P = 0.73</span>
          <span style={{ fontFamily:T.mono, fontSize:"0.60rem", color:T.textMuted }}>1.00</span>
        </div>
      </div>
    ),
  },
  {
    icon:"◆",
    title:"Expected Value",
    sub:"EV = P × recovery − (1−P) × loss. Every borrower ranked by economic outcome, not probability.",
    visual: () => (
      <div style={{ marginTop:"1.75rem", fontFamily:T.mono, fontSize:"0.72rem", lineHeight:2 }}>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <span style={{ color:T.textMuted }}>0.73 × $1,240</span>
          <span style={{ color:"#4ade80" }}>+$905</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <span style={{ color:T.textMuted }}>0.27 × $180</span>
          <span style={{ color:"#f87171" }}>−$49</span>
        </div>
        <div style={{ height:"1px", background:T.border, margin:"0.35rem 0" }} />
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <span style={{ color:T.textSub, fontSize:"0.62rem", letterSpacing:"0.08em" }}>EV</span>
          <span style={{ color:T.text, fontWeight:500, fontSize:"0.84rem" }}>$856</span>
        </div>
      </div>
    ),
  },
  {
    icon:"▶",
    title:"Action Recommendation",
    sub:"Beyond block or pass. Each borrower is assigned: call, email, waiver, or hold — by segment.",
    visual: () => {
      const acts = [
        { label:"Call",   pct:35, color:"#60a5fa" },
        { label:"Email",  pct:42, color:T.accent },
        { label:"Waiver", pct:23, color:"#a78bfa" },
      ];
      return (
        <div style={{ marginTop:"1.75rem" }}>
          {acts.map(({ label, pct, color }) => (
            <div key={label} style={{ marginBottom:"0.55rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.28rem" }}>
                <span style={{ fontFamily:T.sans, fontSize:"0.70rem", color:T.textSub }}>{label}</span>
                <span style={{ fontFamily:T.mono, fontSize:"0.68rem", color:T.textMuted }}>{pct}%</span>
              </div>
              <div style={{ height:"3px", background:"rgba(255,255,255,0.06)", borderRadius:"2px" }}>
                <div style={{ width:`${pct}%`, height:"100%", borderRadius:"2px", background:color }} />
              </div>
            </div>
          ))}
        </div>
      );
    },
  },
];

const DecisionCard = ({ icon, title, sub, visual: Visual, idx }) => {
  const [hov, setHov] = useState(false);
  return (
    <Reveal delay={idx * 0.08}>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: hov ? "rgba(61,90,254,0.03)" : T.surfaceAlt,
          border:`1px solid ${hov ? "rgba(61,90,254,0.2)" : T.border}`,
          borderRadius:"8px",
          padding:"2rem 1.75rem",
          height:"100%",
          transition:`background 0.2s ${T.easeIn}, border-color 0.2s ${T.easeIn}`,
          cursor:"default",
          position:"relative",
          overflow:"hidden",
        }}
      >
        {/* Top glow on hover */}
        <div style={{
          position:"absolute", top:0, left:0, right:0, height:"1px",
          background: hov ? `linear-gradient(90deg,transparent,${T.accent}50,transparent)` : "transparent",
          transition:`background 0.3s ease`,
        }} />
        <div style={{ fontSize:"0.88rem", color: hov ? T.accent : T.textMuted,
          marginBottom:"1.1rem", transition:"color 0.2s ease" }}>{icon}</div>
        <div style={{ fontFamily:T.sans, fontSize:"0.88rem", fontWeight:500,
          color:T.text, marginBottom:"0.6rem" }}>{title}</div>
        <div style={{ fontFamily:T.sans, fontSize:"0.80rem", fontWeight:300,
          color:T.textSub, lineHeight:1.76 }}>{sub}</div>
        <Visual />
      </div>
    </Reveal>
  );
};

const DecisionIntelSection = () => (
  <Section>
    <Reveal>
      <div style={{ maxWidth:"520px", marginBottom:"4rem" }}>
        <Label>Decision Intelligence</Label>
        <SectionTitle>This is not a classifier.</SectionTitle>
        <Body>
          A classifier assigns probability. Intervenix assigns economic value —
          then acts on it. Three layers make that possible.
        </Body>
      </div>
    </Reveal>
    <div style={{
      display:"grid", gridTemplateColumns:"repeat(3,1fr)",
      gap:"1.5rem",
    }} className="cap-di-grid">
      {DI_CARDS.map((c, i) => <DecisionCard key={c.title} {...c} idx={i} />)}
    </div>
    <style>{`
      @media (max-width:900px) { .cap-di-grid { grid-template-columns:1fr !important; } }
    `}</style>
  </Section>
);

// ─── 3. Optimisation Engine ───────────────────────────────────────────────────
const fmtK = v => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : `$${(v/1000).toFixed(0)}k`;

const LPBarChart = ({ selectedN }) => (
  <div style={{ position:"relative", height:"120px", display:"flex",
    alignItems:"flex-end", gap:"2px", borderBottom:`1px solid ${T.border}` }}>
    {LP_USERS.map((u, i) => (
      <div key={i} style={{
        flex:1, minHeight:"4px",
        height:`${Math.max(4, u.h * 116)}px`,
        borderRadius:"1px 1px 0 0",
        background: i < selectedN ? T.accent : T.border,
        opacity: i < selectedN ? 0.5 + u.h * 0.5 : 0.22,
        transition:`background 0.4s ${T.ease}, opacity 0.4s ease`,
      }} />
    ))}
    {/* LP cutoff line */}
    <div style={{
      position:"absolute", top:0, bottom:0,
      left:`${(selectedN / LP_USERS.length) * 100}%`,
      width:"1px",
      background:`linear-gradient(to bottom,${T.accent},rgba(61,90,254,0.1))`,
      boxShadow:`0 0 8px ${T.accentGlow}`,
      transition:`left 0.4s ${T.ease}`,
      pointerEvents:"none",
    }} />
  </div>
);

const ActionBars = ({ n }) => {
  const calls   = Math.round(n * 0.35);
  const emails  = Math.round(n * 0.42);
  const waivers = n - calls - emails;
  const items = [
    { label:"Call",   count:calls,   pct:35, color:"#60a5fa" },
    { label:"Email",  count:emails,  pct:42, color:T.accent  },
    { label:"Waiver", count:waivers, pct:n > 0 ? Math.round(waivers/n*100) : 23, color:"#a78bfa" },
  ];
  return (
    <div>
      {items.map(({ label, count, pct, color }) => (
        <div key={label} style={{ marginBottom:"0.65rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.3rem" }}>
            <span style={{ fontFamily:T.sans, fontSize:"0.72rem", color:T.textSub }}>{label}</span>
            <span style={{ fontFamily:T.mono, fontSize:"0.68rem", color:T.textMuted }}>
              {count.toLocaleString()} · {pct}%
            </span>
          </div>
          <div style={{ height:"3px", background:"rgba(255,255,255,0.06)", borderRadius:"2px" }}>
            <div style={{
              width:`${pct}%`, height:"100%",
              background:color, borderRadius:"2px",
              transition:`width 0.4s ${T.ease}`,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const MetricTile = ({ value, label, sub }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding:"1.5rem 1.25rem",
        background: hov ? T.surfaceHov : T.surface,
        border:`1px solid ${T.border}`,
        borderRadius:"6px",
        transition:`background 0.18s ease`,
        cursor:"default",
      }}
    >
      <div style={{
        fontFamily:T.serif, fontSize:"clamp(1.5rem,3vw,2rem)",
        fontWeight:700, color:T.text, letterSpacing:"-0.03em",
        lineHeight:1, marginBottom:"0.4rem",
        transition:"text-shadow 0.3s ease",
        textShadow: hov ? `0 0 32px ${T.accentGlow}` : "none",
      }}>{value}</div>
      <div style={{ fontFamily:T.sans, fontSize:"0.76rem", fontWeight:400, color:T.textSub }}>{label}</div>
      {sub && <div style={{ fontFamily:T.sans, fontSize:"0.68rem", fontWeight:300, color:T.textMuted, marginTop:"0.15rem" }}>{sub}</div>}
    </div>
  );
};

const OptimizationSection = () => {
  const [budget, setBudget] = useState(180000);
  const cutoff = LP_CUMCOST.findIndex(c => c > budget);
  const n = Math.max(1, cutoff === -1 ? LP_USERS.length : cutoff);
  const totalEV = Math.round(LP_USERS.slice(0, n).reduce((s, u) => s + u.ev, 0));

  return (
    <Section alt id="cap-engine">
      {/* Header */}
      <Reveal>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
          flexWrap:"wrap", gap:"1.5rem", marginBottom:"4rem" }}>
          <div style={{ maxWidth:"520px" }}>
            <Label>Optimisation Engine</Label>
            <SectionTitle>Maximum recovery,<br />not maximum alerts.</SectionTitle>
            <Body>
              Intervenix solves a constrained linear programme at scoring time —
              selecting the highest-EV interventions within your capital budget.
              Not a greedy sort. A provably optimal allocation.
            </Body>
          </div>
          {/* +18% badge */}
          <div style={{
            alignSelf:"center",
            padding:"0.85rem 1.25rem",
            background:"rgba(74,222,128,0.06)",
            border:"1px solid rgba(74,222,128,0.2)",
            borderRadius:"8px",
            textAlign:"center",
            flexShrink:0,
          }}>
            <div style={{ fontFamily:T.serif, fontSize:"1.75rem", fontWeight:700,
              color:"#4ade80", letterSpacing:"-0.03em", lineHeight:1 }}>+18%</div>
            <div style={{ fontFamily:T.sans, fontSize:"0.68rem", fontWeight:400,
              color:"rgba(74,222,128,0.7)", marginTop:"0.3rem", letterSpacing:"0.04em" }}>
              vs. greedy baseline
            </div>
          </div>
        </div>
      </Reveal>

      {/* Slider */}
      <Reveal>
        <div style={{ marginBottom:"2.5rem", maxWidth:"640px" }}>
          <SliderInput
            label="Intervention Budget"
            value={budget} min={20000} max={500000} step={5000}
            onChange={setBudget}
            format={fmtK}
          />
        </div>
      </Reveal>

      {/* Metric tiles */}
      <Reveal delay={0.05}>
        <div style={{
          display:"grid", gridTemplateColumns:"repeat(3,1fr)",
          gap:"1rem", marginBottom:"2.5rem",
        }} className="cap-metric-grid">
          <MetricTile value={n.toLocaleString()} label="Users selected" sub="LP-optimal" />
          <MetricTile value={fmtK(totalEV)} label="Total expected value" sub="Before intervention cost" />
          <MetricTile
            value={`${(totalEV / budget).toFixed(1)}×`}
            label="EV / budget ratio"
            sub="Efficiency index"
          />
        </div>
      </Reveal>

      {/* LP bar chart */}
      <Reveal delay={0.1}>
        <div style={{
          background:T.surface,
          border:`1px solid ${T.border}`,
          borderRadius:"8px",
          overflow:"hidden",
          marginBottom:"2rem",
        }}>
          <div style={{
            padding:"0.65rem 1.25rem",
            background:"rgba(255,255,255,0.02)",
            borderBottom:`1px solid ${T.border}`,
            display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <span style={{ fontFamily:T.sans, fontSize:"0.62rem", fontWeight:500,
              letterSpacing:"0.1em", textTransform:"uppercase", color:T.textMuted }}>
              Users sorted by EV / intervention cost
            </span>
            <span style={{ fontFamily:T.mono, fontSize:"0.65rem", color:T.textMuted }}>
              {n} selected · {80 - n} excluded
            </span>
          </div>
          <div style={{ padding:"1.5rem 1.25rem 1.25rem" }}>
            <LPBarChart selectedN={n} />
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:"0.5rem" }}>
              <span style={{ fontFamily:T.sans, fontSize:"0.62rem", color:T.textMuted }}>← Highest EV/cost</span>
              <span style={{ fontFamily:T.sans, fontSize:"0.62rem", color:T.textMuted }}>Lowest EV/cost →</span>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Action distribution */}
      <Reveal delay={0.12}>
        <div style={{
          background:T.surface, border:`1px solid ${T.border}`,
          borderRadius:"8px", overflow:"hidden",
        }}>
          <div style={{
            padding:"0.65rem 1.25rem",
            background:"rgba(255,255,255,0.02)",
            borderBottom:`1px solid ${T.border}`,
          }}>
            <span style={{ fontFamily:T.sans, fontSize:"0.62rem", fontWeight:500,
              letterSpacing:"0.1em", textTransform:"uppercase", color:T.textMuted }}>
              Action distribution
            </span>
          </div>
          <div style={{ padding:"1.25rem" }}>
            <ActionBars n={n} />
          </div>
        </div>
      </Reveal>

      <style>{`
        @media (max-width:640px) { .cap-metric-grid { grid-template-columns:1fr !important; } }
      `}</style>
    </Section>
  );
};

// ─── 4. Explainability (SHAP) ─────────────────────────────────────────────────
const ShapRow = ({ label, contrib, pct, color, dir, idx }) => {
  const [hov, setHov] = useState(false);
  return (
    <Reveal delay={idx * 0.06}>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          padding:"0.9rem 0",
          borderBottom:`1px solid ${T.border}`,
          cursor:"default",
        }}
      >
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.45rem" }}>
          <span style={{ fontFamily:T.sans, fontSize:"0.82rem", fontWeight:300,
            color: hov ? T.text : T.textSub,
            transition:"color 0.15s ease",
          }}>{label}</span>
          <span style={{
            fontFamily:T.mono, fontSize:"0.72rem", fontWeight:500,
            color, letterSpacing:"0.03em",
          }}>
            {contrib > 0 ? `+${contrib.toFixed(2)}` : contrib.toFixed(2)}
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
          {dir === "neg" && (
            <div style={{ flex:1, height:"3px", background:"rgba(255,255,255,0.05)", borderRadius:"2px",
              display:"flex", justifyContent:"flex-end" }}>
              <div style={{ width:`${pct}%`, height:"100%", borderRadius:"2px", background:color, opacity:0.7 }} />
            </div>
          )}
          <div style={{
            width:"1px", height:"12px",
            background: "rgba(255,255,255,0.15)", flexShrink:0,
          }} />
          {dir === "pos" && (
            <div style={{ flex:1, height:"3px", background:"rgba(255,255,255,0.05)", borderRadius:"2px" }}>
              <div style={{
                width:`${pct}%`, height:"100%",
                borderRadius:"2px", background:color,
                transition:`width 0.4s ${T.ease}`,
              }} />
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
};

const ExplainabilitySection = () => (
  <Section>
    <div style={{
      display:"grid", gridTemplateColumns:"1fr 1.4fr",
      gap:"6rem", alignItems:"start",
    }} className="cap-shap-grid">
      <Reveal>
        <Label>Explainability</Label>
        <SectionTitle>Every decision ships with a reason.</SectionTitle>
        <Body style={{ marginBottom:"2rem" }}>
          SHAP-attributed factor weights for every scoring event.
          No black box. Every block, every flag, every escalation is
          fully traceable to contributing signals.
        </Body>
        <div style={{ display:"flex", gap:"0.6rem", flexWrap:"wrap" }}>
          {["SHAP Values", "Per-decision", "Audit-ready"].map(t => (
            <span key={t} style={{
              fontFamily:T.sans, fontSize:"0.68rem", fontWeight:500,
              letterSpacing:"0.06em", color:T.textSub,
              background:T.surface, border:`1px solid ${T.border}`,
              padding:"0.25rem 0.65rem", borderRadius:"3px",
            }}>{t}</span>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        {/* Borrower card */}
        <div style={{
          background:T.surface, border:`1px solid ${T.border}`,
          borderRadius:"8px", overflow:"hidden",
        }}>
          {/* Card header */}
          <div style={{
            padding:"1.1rem 1.5rem",
            background:"rgba(255,255,255,0.025)",
            borderBottom:`1px solid ${T.border}`,
            display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <div>
              <div style={{ fontFamily:T.mono, fontSize:"0.68rem", color:T.textMuted, marginBottom:"0.2rem" }}>
                BORROWER #4821
              </div>
              <div style={{ fontFamily:T.sans, fontSize:"0.76rem", fontWeight:500,
                color:"#f87171", letterSpacing:"0.04em" }}>HIGH RISK</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:T.serif, fontSize:"2rem", fontWeight:700,
                color:T.text, letterSpacing:"-0.03em", lineHeight:1 }}>0.73</div>
              <div style={{ fontFamily:T.sans, fontSize:"0.65rem", color:T.textMuted, marginTop:"0.15rem" }}>
                Risk Score
              </div>
            </div>
          </div>

          {/* Action + EV row */}
          <div style={{
            padding:"0.7rem 1.5rem",
            borderBottom:`1px solid ${T.border}`,
            display:"flex", justifyContent:"space-between", alignItems:"center",
            background:"rgba(61,90,254,0.04)",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
              <span style={{ fontFamily:T.sans, fontSize:"0.62rem", fontWeight:500,
                letterSpacing:"0.1em", textTransform:"uppercase", color:T.textMuted }}>
                Recommended Action
              </span>
              <span style={{
                fontFamily:T.sans, fontSize:"0.62rem", fontWeight:500,
                letterSpacing:"0.06em", color:T.accent,
                background:T.accentLight, border:`1px solid rgba(61,90,254,0.2)`,
                padding:"0.18rem 0.5rem", borderRadius:"3px",
              }}>Email Outreach</span>
            </div>
            <span style={{ fontFamily:T.mono, fontSize:"0.72rem", color:"#4ade80" }}>EV $856</span>
          </div>

          {/* SHAP section headers */}
          <div style={{ padding:"0 1.5rem" }}>
            <div style={{
              display:"flex", justifyContent:"space-between",
              padding:"0.85rem 0 0.25rem",
              fontFamily:T.sans, fontSize:"0.58rem", fontWeight:500,
              letterSpacing:"0.12em", textTransform:"uppercase", color:T.textMuted,
            }}>
              <span>Risk Drivers</span>
              <span>Contribution</span>
            </div>
            {SHAP_DRIVERS.map((d, i) => (
              <ShapRow key={d.label} {...d} idx={i} />
            ))}
          </div>
          <div style={{ height:"0.75rem" }} />
        </div>
      </Reveal>
    </div>
    <style>{`
      @media (max-width:900px) { .cap-shap-grid { grid-template-columns:1fr !important; gap:3rem !important; } }
    `}</style>
  </Section>
);

// ─── 5. Simulation / What-If ──────────────────────────────────────────────────
const SimulationSection = () => {
  const [simBudget, setSimBudget]           = useState(100000);
  const [simCostMult, setSimCostMult]       = useState(1.0);
  const [simEffectiveness, setSimEffective] = useState(0.55);

  const cutoff = LP_CUMCOST.findIndex(c => c * simCostMult > simBudget);
  const simN   = Math.max(1, cutoff === -1 ? LP_USERS.length : cutoff);
  const simEV  = Math.round(
    LP_USERS.slice(0, simN).reduce((s, u) => s + u.ev * simEffectiveness, 0)
  );

  const sparkData = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => {
      const b  = 10000 + (i / 23) * 490000;
      const ci = LP_CUMCOST.findIndex(c => c * simCostMult > b);
      const cn = ci === -1 ? LP_USERS.length : Math.max(1, ci);
      return LP_USERS.slice(0, cn).reduce((s, u) => s + u.ev * simEffectiveness, 0);
    }),
  [simCostMult, simEffectiveness]);

  return (
    <Section alt>
      <div style={{
        display:"grid", gridTemplateColumns:"1fr 1fr",
        gap:"6rem", alignItems:"start",
      }} className="cap-sim-grid">
        <Reveal>
          <Label>Simulation</Label>
          <SectionTitle>What if conditions change?</SectionTitle>
          <Body style={{ marginBottom:"3rem" }}>
            Adjust budget, intervention cost, and effectiveness to model
            different portfolio scenarios before committing capital.
          </Body>

          <div style={{ display:"flex", flexDirection:"column", gap:"2rem" }}>
            <SliderInput
              label="Budget" value={simBudget}
              min={10000} max={500000} step={5000}
              onChange={setSimBudget} format={fmtK}
            />
            <SliderInput
              label="Cost Multiplier" value={simCostMult}
              min={0.5} max={3.0} step={0.1}
              onChange={setSimCostMult}
              format={v => `${v.toFixed(1)}×`}
              accentColor="#fbbf24"
            />
            <SliderInput
              label="Effectiveness %" value={simEffectiveness}
              min={0.2} max={0.8} step={0.01}
              onChange={setSimEffective}
              format={v => `${Math.round(v*100)}%`}
              accentColor="#4ade80"
            />
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          {/* Output panel */}
          <div style={{
            background:T.surface, border:`1px solid ${T.border}`,
            borderRadius:"8px", overflow:"hidden",
          }}>
            {/* Output metrics */}
            <div style={{
              display:"grid", gridTemplateColumns:"1fr 1fr",
              gap:"1px", background:T.border,
            }}>
              {[
                { label:"Interventions", value:simN.toLocaleString(), color:T.text },
                { label:"Expected Value", value:fmtK(simEV), color:"#4ade80" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  padding:"1.5rem 1.25rem",
                  background:T.surface,
                }}>
                  <div style={{ fontFamily:T.sans, fontSize:"0.62rem", fontWeight:500,
                    letterSpacing:"0.1em", textTransform:"uppercase",
                    color:T.textMuted, marginBottom:"0.5rem" }}>{label}</div>
                  <div style={{ fontFamily:T.serif, fontSize:"2rem", fontWeight:700,
                    color, letterSpacing:"-0.03em", lineHeight:1 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Sparkline */}
            <div style={{ padding:"1.25rem 1.25rem 1rem" }}>
              <div style={{ fontFamily:T.sans, fontSize:"0.60rem", fontWeight:500,
                letterSpacing:"0.1em", textTransform:"uppercase",
                color:T.textMuted, marginBottom:"0.75rem" }}>
                EV curve — budget $10k → $500k
              </div>
              <Sparkline values={sparkData} />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:"0.3rem" }}>
                <span style={{ fontFamily:T.mono, fontSize:"0.58rem", color:T.textMuted }}>$10k</span>
                <span style={{ fontFamily:T.mono, fontSize:"0.58rem", color:T.textMuted }}>$500k</span>
              </div>
            </div>

            {/* Footer note */}
            <div style={{
              padding:"0.75rem 1.25rem",
              borderTop:`1px solid ${T.border}`,
              background:"rgba(255,255,255,0.015)",
            }}>
              <span style={{ fontFamily:T.sans, fontSize:"0.70rem", fontWeight:300, color:T.textMuted }}>
                Curve updates as cost and effectiveness parameters change.
              </span>
            </div>
          </div>
        </Reveal>
      </div>
      <style>{`
        @media (max-width:900px) { .cap-sim-grid { grid-template-columns:1fr !important; gap:3rem !important; } }
      `}</style>
    </Section>
  );
};

// ─── 6. Uncertainty & Risk Handling ──────────────────────────────────────────
const ConfidenceBandCard = ({ id, score, pLow, pHigh, levelColor, label, sublabel, action, isReview, idx }) => {
  const [hov, setHov] = useState(false);
  return (
    <Reveal delay={idx * 0.07}>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: hov ? T.surfaceHov : T.surfaceAlt,
          border:`1px solid ${hov ? `${levelColor}30` : T.border}`,
          borderRadius:"8px", padding:"1.75rem",
          cursor:"default",
          transition:`background 0.2s ${T.easeIn}, border-color 0.2s ease`,
          position:"relative", overflow:"hidden",
        }}
      >
        {/* Level dot */}
        <div style={{
          display:"inline-flex", alignItems:"center", gap:"0.4rem",
          padding:"0.2rem 0.55rem",
          background:`${levelColor}10`, border:`1px solid ${levelColor}30`,
          borderRadius:"3px", marginBottom:"1.5rem",
        }}>
          <span style={{
            width:"5px", height:"5px", borderRadius:"50%",
            background:levelColor, flexShrink:0,
          }} />
          <span style={{ fontFamily:T.sans, fontSize:"0.60rem", fontWeight:500,
            letterSpacing:"0.1em", color:levelColor }}>{label}</span>
        </div>

        {/* ID + score */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:"1.5rem" }}>
          <span style={{ fontFamily:T.mono, fontSize:"0.70rem", color:T.textMuted }}>{id}</span>
          <span style={{ fontFamily:T.serif, fontSize:"1.6rem", fontWeight:700,
            color: hov ? levelColor : T.text,
            letterSpacing:"-0.03em", lineHeight:1,
            transition:"color 0.2s ease",
          }}>{score.toFixed(2)}</span>
        </div>

        {/* Confidence band */}
        <div style={{ marginBottom:"1rem" }}>
          <div style={{ position:"relative", height:"8px",
            background:"rgba(255,255,255,0.05)", borderRadius:"4px" }}>
            {/* Band fill */}
            <div style={{
              position:"absolute",
              left:`${pLow * 100}%`,
              width:`${(pHigh - pLow) * 100}%`,
              height:"100%", borderRadius:"4px",
              background:levelColor, opacity:0.35,
            }} />
            {/* Point estimate */}
            <div style={{
              position:"absolute", top:"50%",
              left:`${score * 100}%`,
              transform:"translate(-50%,-50%)",
              width:"12px", height:"12px",
              borderRadius:"50%",
              background:levelColor,
              border:`2px solid ${T.surfaceAlt}`,
              boxShadow:`0 0 6px ${levelColor}60`,
            }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:"0.4rem" }}>
            <span style={{ fontFamily:T.mono, fontSize:"0.60rem", color:T.textMuted }}>{pLow}</span>
            <span style={{ fontFamily:T.mono, fontSize:"0.60rem", color:T.textMuted }}>{pHigh}</span>
          </div>
        </div>

        {/* Action */}
        <div style={{
          padding:"0.65rem 0.85rem",
          background: isReview ? "rgba(248,113,113,0.06)" : "rgba(255,255,255,0.025)",
          border:`1px solid ${isReview ? "rgba(248,113,113,0.2)" : T.border}`,
          borderRadius:"4px",
          display:"flex", alignItems:"center", gap:"0.5rem",
        }}>
          {isReview && <span style={{ fontSize:"0.65rem" }}>⚑</span>}
          <span style={{ fontFamily:T.sans, fontSize:"0.76rem", fontWeight:300,
            color: isReview ? "#f87171" : T.textSub }}>{action}</span>
        </div>
      </div>
    </Reveal>
  );
};

const UncertaintySection = () => (
  <Section>
    <Reveal>
      <div style={{ maxWidth:"520px", marginBottom:"4rem" }}>
        <Label>Uncertainty & Risk Handling</Label>
        <SectionTitle>Uncertain cases don't get automated.</SectionTitle>
        <Body>
          Every score carries a confidence interval. High-uncertainty borrowers
          are routed to analyst review rather than automated action — because
          a wide confidence band is itself a decision signal.
        </Body>
      </div>
    </Reveal>

    <div style={{
      display:"grid", gridTemplateColumns:"repeat(3,1fr)",
      gap:"1.5rem",
    }} className="cap-unc-grid">
      {UNCERTAINTY_CASES.map((c, i) => (
        <ConfidenceBandCard key={c.id} {...c} idx={i} />
      ))}
    </div>
    <style>{`
      @media (max-width:900px) { .cap-unc-grid { grid-template-columns:1fr !important; } }
    `}</style>
  </Section>
);

// ─── 7. System Reliability ────────────────────────────────────────────────────
const ReliabilityCard = ({ icon, title, subtitle, desc, metric, threshold, fillPct, status, statusColor, idx }) => {
  const [hov, setHov] = useState(false);
  return (
    <Reveal delay={idx * 0.07}>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: hov ? "rgba(61,90,254,0.025)" : T.surfaceAlt,
          border:`1px solid ${hov ? "rgba(61,90,254,0.18)" : T.border}`,
          borderRadius:"8px", padding:"2rem 1.75rem",
          cursor:"default", height:"100%",
          transition:`background 0.2s ${T.easeIn}, border-color 0.2s ease`,
          position:"relative", overflow:"hidden",
        }}
      >
        <div style={{
          position:"absolute", top:0, left:0, right:0, height:"1px",
          background: hov ? `linear-gradient(90deg,transparent,${statusColor}40,transparent)` : "transparent",
          transition:"background 0.3s ease",
        }} />

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.5rem" }}>
          <span style={{ fontSize:"0.88rem", color: hov ? T.accent : T.textMuted,
            transition:"color 0.2s ease" }}>{icon}</span>
          {/* Status badge */}
          <div style={{
            display:"inline-flex", alignItems:"center", gap:"0.35rem",
            padding:"0.2rem 0.55rem",
            background:`${statusColor}10`, border:`1px solid ${statusColor}30`,
            borderRadius:"3px",
          }}>
            <span style={{
              width:"5px", height:"5px", borderRadius:"50%",
              background:statusColor, flexShrink:0,
              animation:"capPulse 2.2s ease-in-out infinite",
              color:statusColor,
            }} />
            <span style={{ fontFamily:T.sans, fontSize:"0.58rem", fontWeight:500,
              letterSpacing:"0.1em", color:statusColor }}>{status}</span>
          </div>
        </div>

        <div style={{ fontFamily:T.sans, fontSize:"0.86rem", fontWeight:500,
          color:T.text, marginBottom:"0.25rem" }}>{title}</div>
        <div style={{ fontFamily:T.sans, fontSize:"0.70rem", fontWeight:400,
          color:T.textMuted, letterSpacing:"0.04em", marginBottom:"1rem" }}>{subtitle}</div>
        <div style={{ fontFamily:T.sans, fontSize:"0.80rem", fontWeight:300,
          color:T.textSub, lineHeight:1.76, marginBottom:"1.75rem" }}>{desc}</div>

        {/* Progress bar */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.4rem" }}>
            <span style={{ fontFamily:T.mono, fontSize:"0.68rem", color:statusColor }}>{metric}</span>
            <span style={{ fontFamily:T.sans, fontSize:"0.65rem", color:T.textMuted }}>{threshold}</span>
          </div>
          <div style={{ height:"3px", background:"rgba(255,255,255,0.06)", borderRadius:"2px" }}>
            <div style={{
              width:`${fillPct}%`, height:"100%",
              background:statusColor, borderRadius:"2px",
              boxShadow:`0 0 6px ${statusColor}40`,
            }} />
          </div>
        </div>
      </div>
    </Reveal>
  );
};

const ReliabilitySection = () => (
  <Section alt>
    <Reveal>
      <div style={{ textAlign:"center", maxWidth:"520px", margin:"0 auto 4rem" }}>
        <Label>System Reliability</Label>
        <SectionTitle center>The system monitors itself.</SectionTitle>
        <Body center>
          Production ML systems degrade silently. Intervenix ships with
          three automated safeguards that detect drift, check calibration,
          and engage fallback logic before a bad decision reaches a borrower.
        </Body>
      </div>
    </Reveal>

    <div style={{
      display:"grid", gridTemplateColumns:"repeat(3,1fr)",
      gap:"1.5rem",
    }} className="cap-rel-grid">
      {RELIABILITY_CARDS.map((c, i) => (
        <ReliabilityCard key={c.title} {...c} idx={i} />
      ))}
    </div>
    <style>{`
      @media (max-width:900px) { .cap-rel-grid { grid-template-columns:1fr !important; } }
    `}</style>
  </Section>
);

// ─── 8. CTA ───────────────────────────────────────────────────────────────────
const CapCta = ({ onRequestAccess }) => (
  <section style={{
    position:"relative", overflow:"hidden",
    padding:"10rem 2rem", background:T.bg, textAlign:"center",
  }}>
    <div style={{
      position:"absolute", top:"50%", left:"50%",
      transform:"translate(-50%,-50%)",
      width:"700px", height:"400px", pointerEvents:"none",
      background:"radial-gradient(ellipse at center,rgba(61,90,254,0.07) 0%,transparent 65%)",
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
        }}>Deploy Intervenix</p>
        <h2 style={{
          fontFamily:T.serif,
          fontSize:"clamp(2.1rem,5vw,3.6rem)",
          fontWeight:700, color:T.text,
          lineHeight:1.06, letterSpacing:"-0.025em",
          marginBottom:"1.25rem",
        }}>
          Decision intelligence<br />
          <em style={{ fontStyle:"italic", color:T.textMuted }}>
            deployed in days, not quarters.
          </em>
        </h2>
        <Body center style={{ marginBottom:"2.75rem" }}>
          Connect via REST, stream transactions, and see optimal intervention
          allocations before the end of day one.
        </Body>
        <div style={{
          display:"flex", gap:"0.75rem",
          justifyContent:"center", flexWrap:"wrap", alignItems:"center",
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

const CapFooter = () => {
  const cols = [
    { head:"Product",  links:["Overview","How It Works","Capabilities","Changelog"] },
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
            <span style={{ fontFamily:T.serif, fontSize:"1rem", fontWeight:700,
              color:T.text, display:"block", marginBottom:"0.75rem" }}>Intervenix</span>
            <p style={{ fontFamily:T.sans, fontSize:"0.78rem", fontWeight:300,
              color:T.textSub, lineHeight:1.7, maxWidth:"240px" }}>
              Real-time autonomous risk intervention for financial institutions.
            </p>
          </div>
          {cols.map(({ head, links }) => (
            <div key={head}>
              <p style={{ fontFamily:T.sans, fontSize:"0.68rem", fontWeight:500,
                letterSpacing:"0.1em", textTransform:"uppercase",
                color:T.textMuted, marginBottom:"1rem" }}>{head}</p>
              {links.map(l => <FooterLink key={l}>{l}</FooterLink>)}
            </div>
          ))}
        </div>
        <div style={{
          borderTop:`1px solid ${T.border}`, paddingTop:"1.5rem",
          display:"flex", justifyContent:"space-between",
          alignItems:"center", flexWrap:"wrap", gap:"0.75rem",
        }}>
          <span style={{ fontFamily:T.sans, fontSize:"0.70rem", color:T.textMuted }}>
            © 2026 Intervenix. An academic project of Vishwakarma Institute of Technology.
          </span>
          <span style={{ fontFamily:T.sans, fontSize:"0.70rem", color:T.textMuted }}>
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
      position:"fixed", inset:0, zIndex:10000,
      background:"rgba(8,8,12,0.88)",
      backdropFilter:"blur(10px)",
      overflowY:"auto", display:"flex",
      alignItems:"flex-start", justifyContent:"center",
      animation:"fadeIn 0.25s ease forwards",
    }}>
      <button onClick={onClose} style={{
        position:"fixed", top:"1.25rem", right:"1.5rem",
        background:"rgba(255,255,255,0.04)",
        border:"1px solid rgba(255,255,255,0.07)",
        color:"rgba(237,237,240,0.4)",
        fontFamily:T.mono, fontSize:"0.75rem",
        padding:"0.4rem 0.85rem", cursor:"pointer",
        borderRadius:"4px", zIndex:10001,
        transition:"color 0.15s, background 0.15s",
        letterSpacing:"0.04em",
      }}
        onMouseEnter={e => { e.currentTarget.style.color="#EDEDF0"; e.currentTarget.style.background="rgba(255,255,255,0.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.color="rgba(237,237,240,0.4)"; e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
        aria-label="Close"
      >✕ esc</button>
      <div style={{ width:"100%", minHeight:"100vh" }}>
        <RequestAccess />
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
};

// ─── Page root ────────────────────────────────────────────────────────────────
export default function CapabilitiesPage() {
  const [showAccess, setShowAccess] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <Grain />
      <Nav T={T} onRequestAccess={() => setShowAccess(true)} />
      <div style={{ animation:"capFadeIn 0.3s ease both" }}>
        <CapHero />
        <Divider />
        <DecisionIntelSection />
        <Divider />
        <OptimizationSection />
        <Divider />
        <ExplainabilitySection />
        <Divider />
        <SimulationSection />
        <Divider />
        <UncertaintySection />
        <Divider />
        <ReliabilitySection />
        <CapCta onRequestAccess={() => setShowAccess(true)} />
        <CapFooter />
      </div>
      {showAccess && <AccessModal onClose={() => setShowAccess(false)} />}
      <style>{`@keyframes capFadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </>
  );
}
