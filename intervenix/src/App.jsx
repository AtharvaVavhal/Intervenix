import { useState, useEffect, useRef } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:          "#0a0a0d",
  surface:     "#0e0e12",
  surfaceAlt:  "#111116",
  border:      "rgba(255,255,255,0.05)",
  borderHov:   "rgba(61,90,254,0.32)",
  accent:      "#3D5AFE",
  accentHov:   "#5470ff",
  accentGlow:  "rgba(61,90,254,0.35)",
  textPrimary:   "#F0F0F0",
  textSecondary: "#7a7a88",
  textTertiary:  "rgba(239,239,239,0.22)",
  serif: "'Playfair Display', serif",
  sans:  "'Inter', sans-serif",
  ease:     "cubic-bezier(0.16, 1, 0.3, 1)",
  easeSlow: "cubic-bezier(0.4, 0, 0.2, 1)",
};

// ─── Hooks ────────────────────────────────────────────────────────────────────
const useInView = (threshold = 0.12) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
};

const useParallax = () => {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrollY;
};

const useMouseGlow = () => {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e) => {
      const rect = el.getBoundingClientRect();
      setPos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
    };
    el.addEventListener("mousemove", handler, { passive: true });
    return () => el.removeEventListener("mousemove", handler);
  }, []);
  return [ref, pos];
};

// ─── Reveal ───────────────────────────────────────────────────────────────────
const Reveal = ({ children, delay = 0, style = {} }) => {
  const [ref, visible] = useInView();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.98)",
      transition: `opacity 0.9s ${T.ease} ${delay}s, transform 0.9s ${T.ease} ${delay}s`,
      willChange: "opacity, transform",
      ...style,
    }}>
      {children}
    </div>
  );
};

// ─── Primitives ───────────────────────────────────────────────────────────────
const Label = ({ children }) => (
  <div style={{
    fontFamily: T.sans, fontSize: "0.62rem", fontWeight: 500,
    letterSpacing: "0.22em", textTransform: "uppercase",
    color: T.textTertiary, marginBottom: "1.25rem",
  }}>{children}</div>
);

const SectionTitle = ({ children }) => (
  <h2 style={{
    fontFamily: T.serif,
    fontSize: "clamp(1.85rem, 3.6vw, 2.8rem)",
    fontWeight: 700,
    color: T.textPrimary,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    margin: "0 0 1.5rem",
  }}>{children}</h2>
);

const Body = ({ children, style = {} }) => (
  <p style={{
    fontFamily: T.sans, fontSize: "0.92rem", fontWeight: 400,
    color: T.textSecondary, lineHeight: 1.8, maxWidth: "520px",
    ...style,
  }}>{children}</p>
);

const Divider = () => (
  <div style={{
    width: "100%", height: "1px",
    background: `linear-gradient(90deg, transparent, ${T.border}, transparent)`,
  }} />
);

const Button = ({ children, primary = false }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: T.sans, fontSize: "0.78rem", fontWeight: 500,
        letterSpacing: "0.06em",
        padding: "0.95rem 2.2rem", borderRadius: "3px", cursor: "pointer",
        transition: `all 0.25s ${T.easeSlow}`,
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        position: "relative",
        ...(primary ? {
          background: hov ? T.accentHov : T.accent,
          color: "#fff", border: "none",
          boxShadow: hov
            ? `0 0 30px ${T.accentGlow}, 0 4px 20px rgba(61,90,254,0.25)`
            : `0 0 20px rgba(61,90,254,0.15)`,
        } : {
          background: "transparent",
          color: hov ? T.textPrimary : T.textSecondary,
          border: `1px solid ${hov ? "rgba(255,255,255,0.13)" : T.border}`,
          boxShadow: "none",
        }),
      }}
    >{children}</button>
  );
};

const Section = ({ children, alt = false }) => (
  <section style={{ background: alt ? T.surfaceAlt : "transparent", padding: "8rem 2rem" }}>
    <div style={{ maxWidth: "1040px", margin: "0 auto" }}>
      {children}
    </div>
  </section>
);

// ─── Film Grain ───────────────────────────────────────────────────────────────
const GrainOverlay = () => (
  <div style={{
    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
    pointerEvents: "none", zIndex: 9999, opacity: 0.028,
    mixBlendMode: "overlay",
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
    backgroundRepeat: "repeat",
    backgroundSize: "128px 128px",
  }} />
);

// ─── Nav ──────────────────────────────────────────────────────────────────────
const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      height: "64px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 2.5rem",
      background: scrolled ? "rgba(10,10,13,0.92)" : "transparent",
      backdropFilter: scrolled ? "blur(24px) saturate(1.6)" : "none",
      borderBottom: scrolled ? `1px solid ${T.border}` : "1px solid transparent",
      transition: `all 0.5s ${T.easeSlow}`,
    }}>
      <span style={{
        fontFamily: T.serif, fontSize: "1.1rem", fontWeight: 700,
        color: T.textPrimary, letterSpacing: "0.01em",
      }}>Intervenix</span>

      <div style={{ display: "flex", gap: "2.5rem", alignItems: "center" }}>
        {["Product", "Docs", "Pricing"].map(l => <NavLink key={l}>{l}</NavLink>)}
        <Button primary>Request Access</Button>
      </div>
    </nav>
  );
};

const NavLink = ({ children }) => {
  const [hov, setHov] = useState(false);
  return (
    <a href="#" onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: T.sans, fontSize: "0.78rem", fontWeight: 400,
        letterSpacing: "0.04em",
        color: hov ? T.textPrimary : T.textSecondary,
        textDecoration: "none",
        transition: `color 0.2s ${T.easeSlow}`,
      }}>{children}</a>
  );
};

// ─── Hero ─────────────────────────────────────────────────────────────────────
const Hero = () => {
  const scrollY = useParallax();
  const [heroRef, mousePos] = useMouseGlow();

  return (
    <section ref={heroRef} style={{
      position: "relative", minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", background: T.bg,
      padding: "0 2rem", textAlign: "center",
    }}>
      <HeroBg scrollY={scrollY} mousePos={mousePos} />

      {/* Content — moves faster than bg on scroll */}
      <div style={{
        position: "relative", zIndex: 5, maxWidth: "860px", width: "100%",
        transform: `translateY(${scrollY * -0.12}px)`,
        willChange: "transform",
      }}>
        {/* Headline — dominates everything */}
        <h1 style={{
          fontFamily: T.serif,
          fontSize: "clamp(3.8rem, 10vw, 7.6rem)",
          fontWeight: 700, lineHeight: 0.95, letterSpacing: "-0.035em",
          color: T.textPrimary, margin: "0 0 2.2rem",
          animation: `ivxRise 1.1s ${T.ease} 0.2s both`,
          textShadow: "0 0 80px rgba(61,90,254,0.12), 0 0 160px rgba(61,90,254,0.06)",
        }}>
          engineered for<br />
          <em style={{
            fontStyle: "italic",
            color: "rgba(239,239,239,0.28)",
            letterSpacing: "-0.04em",
          }}>
            intelligent{" "}
          </em>
          intervention
        </h1>

        {/* Subtext — restrained, not competing */}
        <p style={{
          fontFamily: T.sans, fontSize: "clamp(0.85rem, 1.4vw, 0.95rem)",
          fontWeight: 400, color: T.textSecondary, lineHeight: 1.8,
          maxWidth: "400px", margin: "0 auto 3.2rem",
          animation: `ivxRise 1.1s ${T.ease} 0.45s both`,
          opacity: 0.85,
        }}>
          Real-time risk signals. Autonomous decision layers.
          Built for institutions that cannot afford to be wrong.
        </p>

        {/* CTAs */}
        <div style={{
          display: "flex", gap: "0.875rem", justifyContent: "center",
          animation: `ivxRise 1.1s ${T.ease} 0.62s both`,
        }}>
          <Button primary>Get Early Access</Button>
          <Button>See How It Works</Button>
        </div>
      </div>

      {/* Bottom fade — spatial depth */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "240px",
        background: `linear-gradient(to bottom, transparent, ${T.bg})`,
        pointerEvents: "none", zIndex: 6,
      }} />

      {/* Top vignette */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "200px",
        background: `linear-gradient(to bottom, rgba(6,6,8,0.6), transparent)`,
        pointerEvents: "none", zIndex: 6,
      }} />

      <style>{`
        @keyframes ivxRise {
          from { opacity: 0; transform: translateY(28px) scale(0.97); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes ivxPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        @keyframes ivxDrift {
          0%, 100% { transform: translate(-50%, -55%) scale(1); }
          50% { transform: translate(-50%, -58%) scale(1.03); }
        }
        @keyframes ivxLineGrow {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
      `}</style>
    </section>
  );
};

const HeroBg = ({ scrollY, mousePos }) => {
  const bgShift = scrollY * 0.04;
  const lightX = 50 + (mousePos.x - 0.5) * 6;
  const lightY = 45 + (mousePos.y - 0.5) * 4;

  return (
    <>
      {/* === TUNNEL / CORRIDOR SYSTEM === */}

      {/* Deep ambient void */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse 70% 60% at ${lightX}% ${lightY}%, rgba(14,14,20,0.0) 0%, rgba(6,6,8,1) 100%)`,
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Primary light source — behind headline */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: `translate(-50%, calc(-55% + ${bgShift}px))`,
        width: "700px", height: "500px",
        background: `radial-gradient(ellipse at center, rgba(61,90,254,0.13) 0%, rgba(61,90,254,0.04) 40%, transparent 70%)`,
        pointerEvents: "none", zIndex: 0,
        animation: "ivxDrift 8s ease-in-out infinite",
      }} />

      {/* Secondary bloom — tighter, hotter */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: `translate(-50%, calc(-58% + ${bgShift * 0.6}px))`,
        width: "360px", height: "240px",
        background: "radial-gradient(ellipse at center, rgba(100,130,255,0.10) 0%, transparent 70%)",
        filter: "blur(30px)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Tertiary white-hot core */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: `translate(-50%, calc(-60% + ${bgShift * 0.3}px))`,
        width: "180px", height: "100px",
        background: "radial-gradient(ellipse at center, rgba(180,195,255,0.06) 0%, transparent 70%)",
        filter: "blur(20px)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Left wall — deep shadow corridor */}
      <div style={{
        position: "absolute", top: 0, left: 0, width: "40%", height: "100%",
        background: "linear-gradient(to right, rgba(4,4,6,0.97) 0%, rgba(6,6,9,0.7) 35%, rgba(8,8,12,0.25) 60%, transparent 100%)",
        pointerEvents: "none", zIndex: 1,
      }} />

      {/* Right wall — deep shadow corridor */}
      <div style={{
        position: "absolute", top: 0, right: 0, width: "40%", height: "100%",
        background: "linear-gradient(to left, rgba(4,4,6,0.97) 0%, rgba(6,6,9,0.7) 35%, rgba(8,8,12,0.25) 60%, transparent 100%)",
        pointerEvents: "none", zIndex: 1,
      }} />

      {/* Top compression — ceiling shadow */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "45%",
        background: "linear-gradient(to bottom, rgba(4,4,6,0.8) 0%, rgba(6,6,9,0.3) 40%, transparent 100%)",
        pointerEvents: "none", zIndex: 1,
      }} />

      {/* Floor plane illusion */}
      <div style={{
        position: "absolute", bottom: 0, left: "50%",
        transform: "translateX(-50%)",
        width: "120%", height: "35%",
        background: "linear-gradient(to top, rgba(4,4,6,0.9) 0%, rgba(8,8,12,0.3) 40%, transparent 100%)",
        pointerEvents: "none", zIndex: 1,
      }} />

      {/* === PERSPECTIVE LINES === */}

      {/* Horizon line — bright, sharp */}
      <div style={{
        position: "absolute", top: "44%", left: "50%",
        transform: `translateX(-50%) translateY(${bgShift * 0.5}px)`,
        width: "500px", height: "1px",
        background: "linear-gradient(90deg, transparent 0%, rgba(61,90,254,0.08) 20%, rgba(140,160,255,0.14) 50%, rgba(61,90,254,0.08) 80%, transparent 100%)",
        pointerEvents: "none", zIndex: 2,
        animation: "ivxLineGrow 1.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both",
      }} />

      {/* Floor vanishing lines — left */}
      <div style={{
        position: "absolute", bottom: "18%", left: "50%",
        transform: "translateX(-50%) rotate(2.5deg)",
        width: "600px", height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(61,90,254,0.04) 30%, transparent 50%)",
        transformOrigin: "center",
        pointerEvents: "none", zIndex: 2,
      }} />

      {/* Floor vanishing lines — right */}
      <div style={{
        position: "absolute", bottom: "18%", left: "50%",
        transform: "translateX(-50%) rotate(-2.5deg)",
        width: "600px", height: "1px",
        background: "linear-gradient(90deg, transparent 50%, rgba(61,90,254,0.04) 70%, transparent)",
        transformOrigin: "center",
        pointerEvents: "none", zIndex: 2,
      }} />

      {/* Vertical edge lines — left wall seam */}
      <div style={{
        position: "absolute", top: "15%", left: "18%",
        width: "1px", height: "70%",
        background: "linear-gradient(to bottom, transparent 0%, rgba(61,90,254,0.04) 30%, rgba(61,90,254,0.06) 50%, rgba(61,90,254,0.04) 70%, transparent 100%)",
        pointerEvents: "none", zIndex: 2,
      }} />

      {/* Vertical edge lines — right wall seam */}
      <div style={{
        position: "absolute", top: "15%", right: "18%",
        width: "1px", height: "70%",
        background: "linear-gradient(to bottom, transparent 0%, rgba(61,90,254,0.04) 30%, rgba(61,90,254,0.06) 50%, rgba(61,90,254,0.04) 70%, transparent 100%)",
        pointerEvents: "none", zIndex: 2,
      }} />

      {/* === ACCENT GLOW BLEED === */}
      <div style={{
        position: "absolute", top: "38%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "2px", height: "2px",
        borderRadius: "50%",
        boxShadow: `0 0 120px 60px rgba(61,90,254,0.08), 0 0 240px 120px rgba(61,90,254,0.04)`,
        pointerEvents: "none", zIndex: 2,
        animation: "ivxPulse 6s ease-in-out infinite",
      }} />
    </>
  );
};

// ─── Problem ──────────────────────────────────────────────────────────────────
const stats = [
  { value: "340ms", label: "average fraud decision window" },
  { value: "$4.7T",  label: "lost annually to financial crime" },
  { value: "67%",   label: "alerts still handled manually" },
];

const Problem = () => (
  <Section>
    <Reveal>
      <Label>The Problem</Label>
      <SectionTitle>
        Systems that react<br />
        <em style={{ fontStyle: "italic", color: T.textTertiary }}>after the damage is done.</em>
      </SectionTitle>
    </Reveal>
    <Reveal delay={0.12}>
      <Body style={{ marginBottom: "4rem" }}>
        Legacy risk engines flag anomalies in batches, escalate through silos, and arrive at decisions minutes too late. The window for intelligent intervention has already closed.
      </Body>
    </Reveal>
    <Reveal delay={0.22}>
      <div style={{ borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
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
        fontFamily: T.serif, fontSize: "clamp(2.2rem, 4vw, 3rem)",
        fontWeight: 700, color: T.textPrimary, lineHeight: 1,
        letterSpacing: "-0.02em", marginBottom: "0.6rem",
        transition: `text-shadow 0.3s ${T.easeSlow}`,
        textShadow: hov ? `0 0 30px ${T.accentGlow}` : "none",
      }}>{value}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.78rem", fontWeight: 400,
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
    </Reveal>
    <Reveal delay={0.12}>
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem", marginTop: "3.5rem" }}>
      {steps.map((s, i) => (
        <Reveal key={s.n} delay={i * 0.1}>
          <StepCard {...s} />
        </Reveal>
      ))}
    </div>
  </Section>
);

const StepCard = ({ n, title, body }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: T.surfaceAlt,
        border: `1px solid ${hov ? T.borderHov : T.border}`,
        borderRadius: "4px", padding: "2rem",
        transition: `border-color 0.3s ${T.easeSlow}, transform 0.35s ${T.ease}, box-shadow 0.3s ${T.easeSlow}`,
        transform: hov ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hov ? `0 8px 40px rgba(61,90,254,0.06)` : "none",
      }}>
      <div style={{
        fontFamily: T.serif, fontSize: "1.7rem", fontWeight: 700,
        color: hov ? "rgba(61,90,254,0.35)" : "rgba(61,90,254,0.15)", marginBottom: "1.5rem", lineHeight: 1,
        transition: `color 0.3s ${T.easeSlow}`,
      }}>{n}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.88rem", fontWeight: 600,
        color: T.textPrimary, marginBottom: "0.75rem", letterSpacing: "0.01em",
      }}>{title}</div>
      <div style={{ fontFamily: T.sans, fontSize: "0.84rem", fontWeight: 400, color: T.textSecondary, lineHeight: 1.75 }}>
        {body}
      </div>
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
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: "1px",
      marginTop: "3.5rem",
      border: `1px solid ${T.border}`,
      borderRadius: "4px",
      overflow: "hidden",
    }}>
      {features.map((f, i) => (
        <Reveal key={f.title} delay={i * 0.06}>
          <FeatureCard {...f} />
        </Reveal>
      ))}
    </div>
  </Section>
);

const FeatureCard = ({ title, body }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: "2rem",
        background: hov ? "rgba(61,90,254,0.03)" : T.surfaceAlt,
        transition: `background 0.25s ${T.easeSlow}`,
        cursor: "default",
      }}>
      <div style={{
        width: "3px", height: "3px", borderRadius: "50%",
        background: T.accent, marginBottom: "1.25rem",
        opacity: hov ? 1 : 0.4,
        boxShadow: hov ? `0 0 8px ${T.accentGlow}` : "none",
        transition: `opacity 0.25s ${T.easeSlow}, box-shadow 0.25s ${T.easeSlow}`,
      }} />
      <div style={{
        fontFamily: T.sans, fontSize: "0.85rem", fontWeight: 600,
        color: T.textPrimary, marginBottom: "0.6rem", letterSpacing: "0.01em",
      }}>{title}</div>
      <div style={{
        fontFamily: T.sans, fontSize: "0.82rem", fontWeight: 400,
        color: T.textSecondary, lineHeight: 1.72,
      }}>{body}</div>
    </div>
  );
};

// ─── Output ───────────────────────────────────────────────────────────────────
const Output = () => (
  <Section>
    <div className="output-grid" style={{
      display: "grid", gridTemplateColumns: "1fr 1fr",
      gap: "5rem", alignItems: "center",
    }}>
      <div>
        <Reveal><Label>Output</Label><SectionTitle>Every decision,<br />fully auditable.</SectionTitle></Reveal>
        <Reveal delay={0.12}>
          <Body>
            Every scoring event returns a structured payload — risk score, contributing factors, recommended action, and an audit-ready trace. Plug into any downstream system in minutes.
          </Body>
        </Reveal>
      </div>
      <Reveal delay={0.18}><APICard /></Reveal>
    </div>
  </Section>
);

const Ln  = ({ children, i }) => <div style={{ paddingLeft: i ? "1.25rem" : 0 }}>{children}</div>;
const K   = ({ children }) => <span style={{ color: "#6B8EFF" }}>{children}</span>;
const N   = ({ children }) => <span style={{ color: "#4ade80" }}>{children}</span>;
const S   = ({ children, c }) => <span style={{ color: c }}>{children}</span>;
const P   = ({ children }) => <span style={{ color: T.textPrimary, opacity: 0.45 }}>{children}</span>;
const Mu  = ({ children }) => <span style={{ color: T.textSecondary }}>{children}</span>;

const APICard = () => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.surfaceAlt, border: `1px solid ${hov ? T.borderHov : T.border}`,
        borderRadius: "4px", overflow: "hidden",
        fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
        fontSize: "0.78rem", lineHeight: 1.9,
        transition: `border-color 0.3s ${T.easeSlow}, box-shadow 0.3s ${T.easeSlow}`,
        boxShadow: hov ? `0 0 60px rgba(61,90,254,0.05)` : "none",
      }}
    >
      <div style={{
        background: "rgba(255,255,255,0.02)", padding: "0.7rem 1.25rem",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: "0.5rem",
      }}>
        {["#FF5F57","#FEBC2E","#28C840"].map(c => (
          <div key={c} style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, opacity: 0.65 }} />
        ))}
        <span style={{ color: T.textSecondary, marginLeft: "0.75rem", fontSize: "0.68rem", letterSpacing: "0.04em" }}>
          POST /v1/score → 200 OK
        </span>
      </div>
      <div style={{ padding: "1.5rem 1.75rem" }}>
        <Ln><Mu>{"{"}</Mu></Ln>
        <Ln i><K>"risk_score"</K><P>: </P><N>94.7</N><P>,</P></Ln>
        <Ln i><K>"decision"</K><P>: </P><S c="#fbbf24">"BLOCK"</S><P>,</P></Ln>
        <Ln i><K>"latency_ms"</K><P>: </P><N>38</N><P>,</P></Ln>
        <Ln i><K>"factors"</K><P>: [</P><S c="#f87171">"velocity_breach"</S><P>, </P><S c="#f87171">"geo_mismatch"</S><P>],</P></Ln>
        <Ln i><K>"audit_id"</K><P>: </P><S c="#a78bfa">"ivx_8f3k92"</S></Ln>
        <Ln><Mu>{"}"}</Mu></Ln>
      </div>
    </div>
  );
};

// ─── Final CTA ────────────────────────────────────────────────────────────────
const FinalCTA = () => (
  <section style={{
    position: "relative", overflow: "hidden",
    padding: "10rem 2rem",
    background: T.bg, textAlign: "center",
  }}>
    {/* Spatial glow */}
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: "500px", height: "300px",
      background: "radial-gradient(ellipse at center, rgba(61,90,254,0.08) 0%, transparent 70%)",
      filter: "blur(50px)", pointerEvents: "none",
    }} />
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: "200px", height: "120px",
      background: "radial-gradient(ellipse at center, rgba(100,130,255,0.06) 0%, transparent 70%)",
      filter: "blur(25px)", pointerEvents: "none",
    }} />
    <div style={{ position: "relative", zIndex: 1, maxWidth: "540px", margin: "0 auto" }}>
      <Reveal>
        <h2 style={{
          fontFamily: T.serif,
          fontSize: "clamp(2rem, 5vw, 3.5rem)",
          fontWeight: 700, color: T.textPrimary,
          lineHeight: 1.08, letterSpacing: "-0.025em",
          marginBottom: "1.5rem",
          textShadow: "0 0 60px rgba(61,90,254,0.08)",
        }}>
          The intervention starts<br />
          <em style={{ fontStyle: "italic", color: T.textTertiary }}>when you choose to act.</em>
        </h2>
      </Reveal>
      <Reveal delay={0.12}>
        <p style={{
          fontFamily: T.sans, fontSize: "0.92rem", fontWeight: 400,
          color: T.textSecondary, lineHeight: 1.8, marginBottom: "2.75rem",
        }}>
          Join institutions already running Intervenix across their risk stack.
        </p>
        <div style={{ display: "flex", gap: "0.875rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Button primary>Request Early Access</Button>
          <Button>Talk to an Engineer</Button>
        </div>
      </Reveal>
    </div>
  </section>
);

// ─── Footer ───────────────────────────────────────────────────────────────────
const Footer = () => (
  <footer style={{
    background: T.bg, borderTop: `1px solid ${T.border}`,
    padding: "2rem 2.5rem",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    flexWrap: "wrap", gap: "1rem",
  }}>
    <span style={{ fontFamily: T.serif, fontSize: "0.95rem", color: T.textPrimary }}>Intervenix</span>
    <span style={{ fontFamily: T.sans, fontSize: "0.72rem", color: T.textSecondary, letterSpacing: "0.02em" }}>
      © 2025 Intervenix. All rights reserved.
    </span>
    <div style={{ display: "flex", gap: "2rem" }}>
      {["Privacy", "Terms", "Security"].map(l => <FooterLink key={l}>{l}</FooterLink>)}
    </div>
  </footer>
);

const FooterLink = ({ children }) => {
  const [hov, setHov] = useState(false);
  return (
    <a href="#" onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: T.sans, fontSize: "0.72rem",
        color: hov ? T.textPrimary : T.textSecondary,
        textDecoration: "none",
        transition: `color 0.18s ${T.easeSlow}`,
        letterSpacing: "0.02em",
      }}>{children}</a>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body {
          background: ${T.bg};
          color: ${T.textPrimary};
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          overflow-x: hidden;
        }
        ::selection {
          background: rgba(61,90,254,0.3);
          color: #fff;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: rgba(61,90,254,0.28); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.accent}; }
        @media (max-width: 680px) {
          .output-grid { grid-template-columns: 1fr !important; gap: 3rem !important; }
        }
        @media (max-width: 600px) {
          nav > div > a { display: none; }
        }
      `}</style>

      <GrainOverlay />
      <Nav />
      <Hero />
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
