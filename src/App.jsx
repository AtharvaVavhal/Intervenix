import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import "./App.css";
import Hero from "./components/Hero";
import Nav from "./components/Nav";
import Reveal from "./components/UI/Reveal";
import Button from "./components/UI/Button";
import RequestAccess from "./components/RequestAccess";
import HowItWorksPage from "./pages/HowItWorksPage";
import CapabilitiesPage from "./pages/CapabilitiesPage";
import DocsPage from "./pages/DocsPage";
import ProductsPage from "./pages/ProductsPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";

// ─── Design tokens ────────────────────────────────────────────────────────────
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
  serif:  "'Playfair Display', serif",
  sans:   "'DM Sans', sans-serif",
  mono:   "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
  ease:   "cubic-bezier(0.22, 1, 0.36, 1)",
  easeIn: "cubic-bezier(0.4, 0, 0.2, 1)",
};

// ─── Primitives ───────────────────────────────────────────────────────────────
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

// ─── Grain overlay ────────────────────────────────────────────────────────────
const Grain = () => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 9999,
    pointerEvents: "none", opacity: 0.022, mixBlendMode: "overlay",
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    backgroundSize: "160px 160px",
  }} />
);

// ─── Problem ──────────────────────────────────────────────────────────────────
const STATS = [
  { value: "340ms",  label: "Average fraud decision window" },
  { value: "$4.7T",  label: "Lost annually to financial crime" },
  { value: "67%",    label: "Alerts still handled manually" },
];

const Problem = () => (
  <Section>
    <div style={{ maxWidth: "620px", marginBottom: "4.5rem" }}>
      <Reveal>
        <Label>The Problem</Label>
        <SectionTitle>
          Systems that react<br />
          <em style={{ fontStyle: "italic", color: T.textMuted }}>after the damage is done.</em>
        </SectionTitle>
        <Body>
          Legacy risk engines flag anomalies in batches, escalate through silos, and arrive at decisions minutes too late. The window for intelligent intervention has already closed.
        </Body>
      </Reveal>
    </div>

    <Reveal delay={0.1}>
      <div className="stats-grid">
        {STATS.map(({ value, label }, i) => (
          <StatCell key={value} value={value} label={label} i={i} last={i === STATS.length - 1} />
        ))}
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
        padding: "2.75rem 2.5rem 2.75rem 0",
        paddingLeft: i > 0 ? "2.5rem" : "0",
        borderRight: !last ? `1px solid ${T.border}` : "none",
        transition: "all 0.25s ease",
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
        marginBottom: "0.6rem",
        transition: "text-shadow 0.3s ease",
        textShadow: hov ? `0 0 40px ${T.accentGlow}` : "none",
      }}>{value}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.78rem",
        fontWeight: 400, color: T.textSub, lineHeight: 1.5,
      }}>{label}</div>
    </div>
  );
};

// ─── Solution ─────────────────────────────────────────────────────────────────
const Solution = () => (
  <Section alt>
    <div className="solution-grid">
      <Reveal>
        <Label>The Solution</Label>
        <SectionTitle>Decision intelligence that moves at machine speed.</SectionTitle>
        <Body style={{ marginBottom: "2rem" }}>
          Intervenix embeds a live decision graph across your transaction layer — scoring, routing, and acting on risk signals before they compound. Not a dashboard. An autonomous intervention engine.
        </Body>
        <Button T={T} primary>See the Architecture →</Button>
      </Reveal>
      <Reveal delay={0.12}>
        <ArchDiagram />
      </Reveal>
    </div>
  </Section>
);

// Mini architecture diagram
const ArchDiagram = () => (
  <div style={{
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: "8px",
    padding: "2rem",
    fontFamily: T.mono,
    fontSize: "0.74rem",
    lineHeight: 2,
    color: T.textSub,
  }}>
    {[
      { label: "Transaction Stream", color: "#4ade80", icon: "▶" },
      { label: "Behavioral Engine",  color: "#60a5fa", icon: "◈" },
      { label: "Risk Graph",         color: T.accent,  icon: "⬡" },
      { label: "Decision Layer",     color: "#fbbf24", icon: "◆" },
      { label: "Audit Trail",        color: "#a78bfa", icon: "■" },
    ].map(({ label, color, icon }, i) => (
      <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {i > 0 && (
          <div style={{
            marginLeft: "0.2rem",
            width: "1px", height: "16px",
            background: T.border,
            marginBottom: "-14px",
            marginTop: "-2px",
          }} />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}>
          <span style={{ color, fontSize: "0.65rem", width: "12px", textAlign: "center" }}>{icon}</span>
          <span style={{ color: T.text, flex: 1 }}>{label}</span>
          <span style={{
            fontSize: "0.60rem", fontFamily: T.sans, letterSpacing: "0.08em",
            color: i === 3 ? "#fbbf24" : T.textMuted,
            background: i === 3 ? "rgba(251,191,36,0.08)" : "transparent",
            padding: i === 3 ? "0.15rem 0.4rem" : "0",
            borderRadius: "3px",
            border: i === 3 ? "1px solid rgba(251,191,36,0.2)" : "none",
          }}>{i === 3 ? "ACTIVE" : i < 3 ? "→" : "←"}</span>
        </div>
      </div>
    ))}
  </div>
);

// ─── How It Works ─────────────────────────────────────────────────────────────
const STEPS = [
  { n: "01", title: "Ingest",    body: "Connect via REST or stream. Intervenix ingests transactions, behavioral events, and contextual signals in real time.", tag: "< 2ms" },
  { n: "02", title: "Score",     body: "Multi-model ensemble scoring across fraud, credit, and compliance — simultaneously, in under 50ms.", tag: "< 50ms" },
  { n: "03", title: "Intervene", body: "Trigger automated actions: block, flag, reroute, or escalate — with a full audit trail and explainability.", tag: "Automated" },
];

const HowItWorks = () => (
  <Section>
    <Reveal>
      <div style={{ textAlign: "center", maxWidth: "520px", margin: "0 auto 0" }}>
        <Label>How It Works</Label>
        <SectionTitle center>Three layers. One intervention.</SectionTitle>
      </div>
    </Reveal>
    <div className="steps-grid" style={{ background: T.border }}>
      {STEPS.map((s, i) => (
        <Reveal key={s.n} delay={i * 0.07}>
          <StepCard {...s} />
        </Reveal>
      ))}
    </div>
  </Section>
);

const StepCard = ({ n, title, body, tag }) => {
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
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "1px",
        background: hov ? `linear-gradient(90deg, transparent, ${T.accent}, transparent)` : "transparent",
        transition: `background 0.3s ${T.easeIn}`,
      }} />
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem",
      }}>
        <span style={{
          fontFamily: T.serif, fontSize: "1.5rem", fontWeight: 700,
          color: hov ? "rgba(61,90,254,0.5)" : "rgba(61,90,254,0.18)",
          lineHeight: 1,
          transition: `color 0.25s ${T.easeIn}`,
        }}>{n}</span>
        <span style={{
          fontFamily: T.sans, fontSize: "0.62rem", fontWeight: 500,
          letterSpacing: "0.08em",
          color: T.accent,
          background: T.accentLight,
          border: `1px solid rgba(61,90,254,0.18)`,
          padding: "0.2rem 0.55rem",
          borderRadius: "3px",
        }}>{tag}</span>
      </div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.88rem", fontWeight: 500,
        color: T.text, marginBottom: "0.75rem", letterSpacing: "0.005em",
      }}>{title}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.82rem", fontWeight: 300,
        color: T.textSub, lineHeight: 1.78,
      }}>{body}</div>
    </div>
  );
};

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  { title: "Adaptive Risk Graph",  body: "Dynamic entity relationships that evolve with each signal.", icon: "⬡" },
  { title: "Sub-50ms Latency",     body: "Scoring pipelines that keep pace with transaction velocity.", icon: "◈" },
  { title: "Explainable AI",       body: "Every decision ships with a human-readable rationale.", icon: "◎" },
  { title: "Compliance Layer",     body: "Built-in alignment for AML, KYC, and PSD2 regulations.", icon: "■" },
  { title: "Behavioral Signals",   body: "Device, session, and interaction patterns in every score.", icon: "◆" },
  { title: "Custom Thresholds",    body: "Tunable per segment, geography, and product line.", icon: "▲" },
];

const Features = () => (
  <Section alt>
    <Reveal>
      <div className="features-header">
        <div>
          <Label>Capabilities</Label>
          <SectionTitle>Built for the edge<br />of every transaction.</SectionTitle>
        </div>
        <div className="features-header-btn">
          <Button T={T}>View all features →</Button>
        </div>
      </div>
    </Reveal>
    <Reveal delay={0.08}>
      <div className="features-grid">
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </Reveal>
  </Section>
);

const FeatureCard = ({ title, body, icon }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "1.75rem",
        background: hov ? "rgba(61,90,254,0.035)" : T.surfaceAlt,
        transition: `background 0.2s ${T.easeIn}`,
        cursor: "default",
        position: "relative",
      }}
    >
      <div style={{
        fontSize: "0.82rem",
        color: hov ? T.accent : T.textMuted,
        marginBottom: "1.1rem",
        transition: `color 0.2s ease`,
      }}>{icon}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.84rem", fontWeight: 500,
        color: T.text, marginBottom: "0.5rem",
      }}>{title}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.80rem", fontWeight: 300,
        color: T.textSub, lineHeight: 1.72,
      }}>{body}</div>
    </div>
  );
};

// ─── Output / API ─────────────────────────────────────────────────────────────
const Output = () => (
  <Section>
    <div className="output-grid">
      <Reveal>
        <Label>Output</Label>
        <SectionTitle>Every decision,<br />fully auditable.</SectionTitle>
        <Body style={{ marginBottom: "2rem" }}>
          Every scoring event returns a structured payload — risk score, contributing factors, recommended action, and an audit-ready trace. Plug into any downstream system in minutes.
        </Body>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {["REST API", "Webhooks", "Kafka", "gRPC"].map(tag => (
            <span key={tag} style={{
              fontFamily: T.sans, fontSize: "0.70rem", fontWeight: 500,
              letterSpacing: "0.06em",
              color: T.textSub,
              background: T.surface,
              border: `1px solid ${T.border}`,
              padding: "0.3rem 0.7rem",
              borderRadius: "4px",
            }}>{tag}</span>
          ))}
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <APICard />
      </Reveal>
    </div>
  </Section>
);

const APICard = () => {
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
        boxShadow: hov ? `0 0 0 1px rgba(61,90,254,0.1), 0 8px 40px rgba(0,0,0,0.5)` : `0 4px 24px rgba(0,0,0,0.3)`,
      }}
    >
      <div style={{
        background: "rgba(255,255,255,0.025)",
        padding: "0.65rem 1.25rem",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: "0.4rem",
      }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map(c => (
          <div key={c} style={{ width: "9px", height: "9px", borderRadius: "50%", background: c, opacity: 0.7 }} />
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
        <Line k="risk_score"  v={<><Num>94.7</Num>,</>} />
        <Line k="decision"    v={<><Str color="#fbbf24">"BLOCK"</Str>,</>} />
        <Line k="latency_ms"  v={<><Num>38</Num>,</>} />
        <Line k="confidence"  v={<><Num>0.97</Num>,</>} />
        <Line k="factors"     v={<><Punc>[</Punc><Str color="#f87171">"velocity_breach"</Str><Punc>, </Punc><Str color="#f87171">"geo_mismatch"</Str><Punc>],</Punc></>} />
        <Line k="model_ver"   v={<><Str color="#86efac">"ivx-v2.4.1"</Str>,</>} />
        <Line k="audit_id"    v={<><Str color="#a78bfa">"ivx_8f3k92m"</Str></>} />
        <div><span style={{ color: T.textSub }}>{"}"}</span></div>
      </div>
    </div>
  );
};

const Line = ({ k, v }) => (
  <div style={{ paddingLeft: "1.25rem", display: "flex", gap: "0" }}>
    <span style={{ color: "#7aa2ff" }}>"{k}"</span>
    <span style={{ color: T.textMuted, opacity: 0.5 }}>: </span>
    {v}
  </div>
);
const Num  = ({ children }) => <span style={{ color: "#4ade80" }}>{children}</span>;
const Str  = ({ children, color }) => <span style={{ color }}>{children}</span>;
const Punc = ({ children }) => <span style={{ color: T.textMuted, opacity: 0.5 }}>{children}</span>;

// ─── Logos / Social proof ─────────────────────────────────────────────────────
const LogoBar = () => (
  <section style={{ background: T.bg, padding: "4rem 2rem", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
    <div style={{ maxWidth: "1080px", margin: "0 auto", textAlign: "center" }}>
      <p style={{
        fontFamily: T.sans, fontSize: "0.68rem", fontWeight: 500,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: T.textMuted, marginBottom: "2.5rem",
      }}>
        Trusted by risk teams at
      </p>
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: "3.5rem", flexWrap: "wrap",
      }}>
        {["Polygon", "FinAxis", "Meridian", "Crestview", "Archway"].map(name => (
          <span key={name} style={{
            fontFamily: T.serif, fontSize: "1.05rem",
            color: T.textMuted, letterSpacing: "-0.01em",
            opacity: 0.5,
          }}>{name}</span>
        ))}
      </div>
    </div>
  </section>
);

// ─── CTA ─────────────────────────────────────────────────────────────────────
const CTA = ({ onRequestAccess }) => (
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
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: "300px", height: "200px", pointerEvents: "none",
      background: "radial-gradient(ellipse at center, rgba(61,90,254,0.05) 0%, transparent 70%)",
      filter: "blur(30px)",
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
          <em style={{ fontStyle: "italic", color: T.textMuted }}>when you choose to act.</em>
        </h2>
        <Body center style={{ marginBottom: "2.75rem" }}>
          Join institutions already running Intervenix across their risk stack.
        </Body>
        <div className="cta-row" style={{ justifyContent: "center" }}>
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

// ─── Footer ───────────────────────────────────────────────────────────────────
const Footer = () => {
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
              {links.map(l => (
                <FooterLink key={l}>{l}</FooterLink>
              ))}
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

// ─── Request Access Modal ─────────────────────────────────────────────────────
const AccessModal = ({ onClose }) => {
  useState(() => {
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
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        animation: "modalFadeIn 0.25s ease forwards",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "fixed", top: "1.25rem", right: "1.5rem",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          color: "rgba(237,237,240,0.4)",
          fontFamily: T.mono,
          fontSize: "0.75rem",
          padding: "0.4rem 0.85rem",
          cursor: "pointer",
          borderRadius: "4px",
          zIndex: 10001,
          transition: "color 0.15s, background 0.15s, border-color 0.15s",
          letterSpacing: "0.04em",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = "#EDEDF0";
          e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = "rgba(237,237,240,0.4)";
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
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

// ─── Landing page ─────────────────────────────────────────────────────────────
function LandingPage() {
  const [showAccess, setShowAccess] = useState(false);
  const openAccess  = () => setShowAccess(true);
  const closeAccess = () => setShowAccess(false);

  return (
    <>
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <Grain />
      <Nav T={T} onRequestAccess={openAccess} />
      <Hero T={T} onRequestAccess={openAccess} />
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
      <LogoBar />
      <CTA onRequestAccess={openAccess} />
      <Footer />

      {showAccess && <AccessModal onClose={closeAccess} />}
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/"             element={<LandingPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/capabilities" element={<CapabilitiesPage />} />
        <Route path="/docs"         element={<DocsPage />} />
        <Route path="/login"        element={<LoginPage />} />
        <Route path="/signup"       element={<SignupPage />} />
        <Route path="/dashboard"    element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/products"     element={
          <ProtectedRoute><ProductsPage /></ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  );
}