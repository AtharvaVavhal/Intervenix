import { useState } from "react";
import "./App.css";
import Hero from "./components/Hero";
import Nav from "./components/Nav";
import Reveal from "./components/UI/Reveal";
import Button from "./components/UI/Button";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:            "#0a0a0d",
  surface:       "#0e0e12",
  surfaceAlt:    "#111116",
  border:        "rgba(255,255,255,0.05)",
  borderHov:     "rgba(61,90,254,0.30)",
  accent:        "#3D5AFE",
  accentHov:     "#5470ff",
  accentGlow:    "rgba(61,90,254,0.35)",
  textPrimary:   "#F0F0F0",
  textSecondary: "#7a7a88",
  textTertiary:  "rgba(239,239,239,0.20)",
  serif: "'Playfair Display', serif",
  sans:  "'Inter', sans-serif",
  ease:     "cubic-bezier(0.16, 1, 0.3, 1)",
  easeSlow: "cubic-bezier(0.4, 0, 0.2, 1)",
};

// ─── Primitives ───────────────────────────────────────────────────────────────
const Label = ({ children }) => (
  <div style={{
    fontFamily: T.sans, fontSize: "0.60rem", fontWeight: 500,
    letterSpacing: "0.22em", textTransform: "uppercase",
    color: T.textTertiary, marginBottom: "1.25rem",
  }}>{children}</div>
);

const SectionTitle = ({ children }) => (
  <h2 style={{
    fontFamily: T.serif,
    fontSize: "clamp(1.85rem, 3.6vw, 2.75rem)",
    fontWeight: 700,
    color: T.textPrimary,
    lineHeight: 1.08,
    letterSpacing: "-0.02em",
    margin: "0 0 1.5rem",
  }}>{children}</h2>
);

const Body = ({ children, style = {} }) => (
  <p style={{
    fontFamily: T.sans, fontSize: "0.91rem", fontWeight: 400,
    color: T.textSecondary, lineHeight: 1.82, maxWidth: "520px",
    ...style,
  }}>{children}</p>
);

const Divider = () => (
  <div style={{
    width: "100%", height: "1px",
    background: `linear-gradient(90deg, transparent, ${T.border}, transparent)`,
  }} />
);

const Section = ({ children, alt = false, style = {} }) => (
  <section style={{
    background: alt ? T.surfaceAlt : "transparent",
    padding: "8rem 2rem",
    ...style,
  }}>
    <div style={{ maxWidth: "1040px", margin: "0 auto" }}>
      {children}
    </div>
  </section>
);

// ─── Film Grain ───────────────────────────────────────────────────────────────
const GrainOverlay = () => (
  <div style={{
    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
    pointerEvents: "none", zIndex: 9999, opacity: 0.025,
    mixBlendMode: "overlay",
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
    backgroundRepeat: "repeat",
    backgroundSize: "128px 128px",
  }} />
);

// ─── Problem ──────────────────────────────────────────────────────────────────
const stats = [
  { value: "340 ms", label: "average fraud decision window" },
  { value: "$4.7T",  label: "lost annually to financial crime" },
  { value: "67%",    label: "alerts still handled manually" },
];

const Problem = () => (
  <Section>
    <Reveal>
      <Label>The Problem</Label>
      <SectionTitle>
        Systems that react<br />
        <em style={{ fontStyle: "italic", color: T.textTertiary }}>after the damage is done.</em>
      </SectionTitle>
      <Body style={{ marginBottom: "4rem" }}>
        Legacy risk engines flag anomalies in batches, escalate through silos, and arrive at decisions minutes too late. The window for intelligent intervention has already closed.
      </Body>
    </Reveal>

    <Reveal delay={0.1}>
      <div style={{ borderTop: `1px solid ${T.border}` }}>
        <div className="stats-grid">
          {stats.map(({ value, label }, i) => (
            <StatCell key={value} value={value} label={label} i={i} last={i === stats.length - 1} />
          ))}
        </div>
      </div>
    </Reveal>
  </Section>
);

const StatCell = ({ value, label, i, last }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="stat-cell"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "2.5rem 0",
        paddingRight: !last ? "3rem" : "0",
        paddingLeft: i > 0 ? "3rem" : "0",
        borderRight: !last ? `1px solid ${T.border}` : "none",
        transition: `background 0.3s ${T.easeSlow}`,
      }}
    >
      <div style={{
        fontFamily: T.serif,
        fontSize: "clamp(2rem, 4vw, 2.9rem)",
        fontWeight: 700, color: T.textPrimary, lineHeight: 1,
        letterSpacing: "-0.02em", marginBottom: "0.65rem",
        transition: `text-shadow 0.3s ${T.easeSlow}`,
        textShadow: hov ? `0 0 32px ${T.accentGlow}` : "none",
      }}>{value}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.76rem", fontWeight: 400,
        color: T.textSecondary, lineHeight: 1.5, letterSpacing: "0.01em",
      }}>{label}</div>
    </div>
  );
};

// ─── Solution ─────────────────────────────────────────────────────────────────
const Solution = () => (
  <Section alt>
    <Reveal>
      <Label>The Solution</Label>
      <SectionTitle>Decision intelligence<br />that moves at machine speed.</SectionTitle>
      <Body style={{ maxWidth: "580px" }}>
        Intervenix embeds a live decision graph across your transaction layer — scoring, routing, and acting on risk signals before they compound. Not a dashboard. An autonomous intervention engine.
      </Body>
    </Reveal>
  </Section>
);

// ─── How It Works ─────────────────────────────────────────────────────────────
const steps = [
  { n: "01", title: "Ingest",    body: "Connect via REST or stream. Intervenix ingests transactions, behavioral events, and contextual signals in real time." },
  { n: "02", title: "Score",     body: "Multi-model ensemble scoring across fraud, credit, and compliance — simultaneously, in under 50ms." },
  { n: "03", title: "Intervene", body: "Trigger automated actions: block, flag, reroute, or escalate — with a full audit trail and explainability." },
];

const HowItWorks = () => (
  <Section>
    <Reveal>
      <Label>How It Works</Label>
      <SectionTitle>Three layers.<br />One intervention.</SectionTitle>
    </Reveal>
    <div className="steps-grid">
      {steps.map((s, i) => (
        <Reveal key={s.n} delay={i * 0.08}>
          <StepCard {...s} />
        </Reveal>
      ))}
    </div>
  </Section>
);

const StepCard = ({ n, title, body }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.surfaceAlt,
        border: `1px solid ${hov ? T.borderHov : T.border}`,
        borderRadius: "4px", padding: "2rem",
        transition: `border-color 0.3s ${T.easeSlow}, transform 0.35s ${T.ease}, box-shadow 0.3s ${T.easeSlow}`,
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov ? `0 8px 40px rgba(61,90,254,0.07)` : "none",
        height: "100%",
      }}
    >
      <div style={{
        fontFamily: T.serif, fontSize: "1.65rem", fontWeight: 700,
        color: hov ? "rgba(61,90,254,0.38)" : "rgba(61,90,254,0.14)",
        marginBottom: "1.5rem", lineHeight: 1,
        transition: `color 0.3s ${T.easeSlow}`,
      }}>{n}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.87rem", fontWeight: 600,
        color: T.textPrimary, marginBottom: "0.75rem", letterSpacing: "0.01em",
      }}>{title}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.83rem", fontWeight: 400,
        color: T.textSecondary, lineHeight: 1.78,
      }}>{body}</div>
    </div>
  );
};

// ─── Features ─────────────────────────────────────────────────────────────────
const features = [
  { title: "Adaptive Risk Graph",  body: "Dynamic entity relationships that evolve with each signal." },
  { title: "Sub-50ms Latency",     body: "Scoring pipelines that keep pace with transaction velocity." },
  { title: "Explainable AI",       body: "Every decision ships with a human-readable rationale." },
  { title: "Compliance Layer",     body: "Built-in alignment for AML, KYC, and PSD2 regulations." },
  { title: "Behavioral Signals",   body: "Device, session, and interaction patterns in every score." },
  { title: "Custom Thresholds",    body: "Tunable per segment, geography, and product line." },
];

const Features = () => (
  <Section alt>
    <Reveal>
      <Label>Capabilities</Label>
      <SectionTitle>Built for the edge<br />of every transaction.</SectionTitle>
    </Reveal>
    <Reveal delay={0.1}>
      <div className="features-grid">
        {features.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </Reveal>
  </Section>
);

const FeatureCard = ({ title, body }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "2rem",
        background: hov ? "rgba(61,90,254,0.04)" : T.surfaceAlt,
        transition: `background 0.25s ${T.easeSlow}`,
        cursor: "default",
      }}
    >
      <div style={{
        width: "4px", height: "4px", borderRadius: "50%",
        background: T.accent, marginBottom: "1.25rem",
        opacity: hov ? 1 : 0.35,
        boxShadow: hov ? `0 0 10px ${T.accentGlow}` : "none",
        transition: `opacity 0.25s ${T.easeSlow}, box-shadow 0.25s ${T.easeSlow}`,
      }} />
      <div style={{
        fontFamily: T.sans, fontSize: "0.84rem", fontWeight: 600,
        color: T.textPrimary, marginBottom: "0.6rem", letterSpacing: "0.01em",
      }}>{title}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.81rem", fontWeight: 400,
        color: T.textSecondary, lineHeight: 1.74,
      }}>{body}</div>
    </div>
  );
};

// ─── Output / API Card ────────────────────────────────────────────────────────
const Ln  = ({ children, indent }) => <div style={{ paddingLeft: indent ? "1.25rem" : 0 }}>{children}</div>;
const K   = ({ children }) => <span style={{ color: "#6B8EFF" }}>{children}</span>;
const N   = ({ children }) => <span style={{ color: "#4ade80" }}>{children}</span>;
const Str = ({ children, c }) => <span style={{ color: c }}>{children}</span>;
const Punc = ({ children }) => <span style={{ color: T.textPrimary, opacity: 0.4 }}>{children}</span>;
const Mu  = ({ children }) => <span style={{ color: T.textSecondary }}>{children}</span>;

const APICard = () => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.surfaceAlt,
        border: `1px solid ${hov ? T.borderHov : T.border}`,
        borderRadius: "4px", overflow: "hidden",
        fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
        fontSize: "0.78rem", lineHeight: 1.9,
        transition: `border-color 0.3s ${T.easeSlow}, box-shadow 0.3s ${T.easeSlow}`,
        boxShadow: hov ? `0 0 60px rgba(61,90,254,0.06)` : "none",
      }}
    >
      {/* Terminal title bar */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        padding: "0.7rem 1.25rem",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: "0.5rem",
      }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map(c => (
          <div key={c} style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, opacity: 0.65 }} />
        ))}
        <span style={{
          color: T.textSecondary, marginLeft: "0.75rem",
          fontSize: "0.67rem", letterSpacing: "0.04em",
        }}>
          POST /v1/score → 200 OK
        </span>
      </div>
      {/* JSON body */}
      <div style={{ padding: "1.5rem 1.75rem" }}>
        <Ln><Mu>{"{"}</Mu></Ln>
        <Ln indent><K>"risk_score"</K><Punc>: </Punc><N>94.7</N><Punc>,</Punc></Ln>
        <Ln indent><K>"decision"</K><Punc>: </Punc><Str c="#fbbf24">"BLOCK"</Str><Punc>,</Punc></Ln>
        <Ln indent><K>"latency_ms"</K><Punc>: </Punc><N>38</N><Punc>,</Punc></Ln>
        <Ln indent><K>"factors"</K><Punc>: [</Punc><Str c="#f87171">"velocity_breach"</Str><Punc>, </Punc><Str c="#f87171">"geo_mismatch"</Str><Punc>],</Punc></Ln>
        <Ln indent><K>"audit_id"</K><Punc>: </Punc><Str c="#a78bfa">"ivx_8f3k92"</Str></Ln>
        <Ln><Mu>{"}"}</Mu></Ln>
      </div>
    </div>
  );
};

const Output = () => (
  <Section>
    <div className="output-grid">
      <Reveal>
        <div>
          <Label>Output</Label>
          <SectionTitle>Every decision,<br />fully auditable.</SectionTitle>
        </div>
        <Body>
          Every scoring event returns a structured payload — risk score, contributing factors, recommended action, and an audit-ready trace. Plug into any downstream system in minutes.
        </Body>
      </Reveal>
      <Reveal delay={0.12}>
        <APICard />
      </Reveal>
    </div>
  </Section>
);

// ─── Final CTA ────────────────────────────────────────────────────────────────
const FinalCTA = () => (
  <section style={{
    position: "relative", overflow: "hidden",
    padding: "10rem 2rem",
    background: T.bg, textAlign: "center",
  }}>
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: "600px", height: "340px",
      background: "radial-gradient(ellipse at center, rgba(61,90,254,0.07) 0%, transparent 70%)",
      filter: "blur(60px)", pointerEvents: "none",
    }} />
    <div style={{ position: "relative", zIndex: 1, maxWidth: "520px", margin: "0 auto" }}>
      <Reveal>
        <h2 style={{
          fontFamily: T.serif,
          fontSize: "clamp(2rem, 5vw, 3.4rem)",
          fontWeight: 700, color: T.textPrimary,
          lineHeight: 1.08, letterSpacing: "-0.025em",
          marginBottom: "1.5rem",
        }}>
          The intervention starts<br />
          <em style={{ fontStyle: "italic", color: T.textTertiary }}>when you choose to act.</em>
        </h2>
        <p style={{
          fontFamily: T.sans, fontSize: "0.91rem",
          color: T.textSecondary, lineHeight: 1.8,
          marginBottom: "2.75rem",
        }}>
          Join institutions already running Intervenix across their risk stack.
        </p>
        <div className="cta-buttons">
          <Button T={T} primary>Request Early Access</Button>
          <Button T={T}>Talk to an Engineer</Button>
        </div>
      </Reveal>
    </div>
  </section>
);

// ─── Footer ───────────────────────────────────────────────────────────────────
const FooterLink = ({ children }) => {
  const [hov, setHov] = useState(false);
  return (
    <a
      href="#"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: T.sans, fontSize: "0.71rem",
        color: hov ? T.textPrimary : T.textSecondary,
        textDecoration: "none",
        transition: `color 0.18s ${T.easeSlow}`,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </a>
  );
};

const Footer = () => (
  <footer style={{
    background: T.bg,
    borderTop: `1px solid ${T.border}`,
    padding: "2rem 2.5rem",
    display: "flex", justifyContent: "space-between",
    alignItems: "center", flexWrap: "wrap", gap: "1rem",
  }}>
    <span style={{ fontFamily: T.serif, fontSize: "0.95rem", color: T.textPrimary }}>
      Intervenix
    </span>
    <span style={{
      fontFamily: T.sans, fontSize: "0.70rem",
      color: T.textSecondary, letterSpacing: "0.02em",
    }}>
      © 2026 Intervenix. All rights reserved. An academic project of Vishwakarma Institute of Technology.
    </span>
    <div style={{ display: "flex", gap: "2rem" }}>
      {["Privacy", "Terms", "Security"].map(l => <FooterLink key={l}>{l}</FooterLink>)}
    </div>
  </footer>
);

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <>
      <GrainOverlay />
      <Nav T={T} />
      <Hero T={T} />
      <Divider />
      <Problem />
      <Divider />
      <Solution />
      <Divider />
      <HowItWorks />
      <Divider />
      <Features />
      <Divider />
      <Output />
      <Divider />
      <FinalCTA />
      <Footer />
    </>
  );
}