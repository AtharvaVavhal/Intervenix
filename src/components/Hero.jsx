import { useEffect, useState, useRef } from "react";
import CorridorCanvas from "./Canvas/CorridorCanvas";
import Button from "./UI/Button";

export default function Hero({ T }) {
  const [scrollY, setScrollY] = useState(0);
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    // Stagger in the hero content
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const fn = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const move = (e) => {
      const rect = el.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };
    el.addEventListener("mousemove", move);
    return () => el.removeEventListener("mousemove", move);
  }, []);

  return (
    <section
      ref={heroRef}
      style={{
        position: "relative",
        // 100svh = "small viewport height" — excludes the browser chrome bar.
        // On iOS Safari / mobile Chrome, 100vh is measured without the chrome
        // visible, so when it reappears on scroll the hero overflows below the
        // fold and causes unwanted bounce/scroll. 100svh is the guaranteed
        // minimum visible area. Browsers that don't support svh fall back to
        // 100vh via CSS cascade (add the fallback in App.css if needed).
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: "0 1.5rem",
        textAlign: "center",
        background: "#08080c",
      }}
    >
      {/* 3D Canvas */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <CorridorCanvas mouseRef={mouseRef} />
      </div>

      {/* Gradient overlays for text readability */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse 90% 80% at 50% 50%, rgba(8,8,12,0.15) 0%, rgba(8,8,12,0.72) 65%, rgba(8,8,12,0.92) 100%)",
      }} />
      {/* Top fade */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "180px", zIndex: 2, pointerEvents: "none",
        background: "linear-gradient(to bottom, #08080c 0%, transparent 100%)",
      }} />
      {/* Bottom fade */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "260px", zIndex: 2, pointerEvents: "none",
        background: "linear-gradient(to top, #08080c 0%, transparent 100%)",
      }} />

      {/* Content */}
      <div style={{
        position: "relative",
        zIndex: 10,
        maxWidth: "900px",
        width: "100%",
        transform: `translateY(${scrollY * -0.08}px)`,
      }}>

        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "2.5rem",
            padding: "0.3rem 0.85rem 0.3rem 0.6rem",
            background: "rgba(61,90,254,0.08)",
            border: "1px solid rgba(61,90,254,0.2)",
            borderRadius: "100px",
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s ease 0.1s, transform 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s",
          }}
        >
          <span style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: "#3D5AFE", flexShrink: 0,
            animation: "dotBlink 2.4s ease-in-out infinite",
          }} />
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.67rem",
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(100,130,255,0.9)",
          }}>
            Real-time Risk Intelligence
          </span>
        </div>

        {/* Main headline */}
        <div style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.75s ease 0.2s, transform 0.75s cubic-bezier(0.22,1,0.36,1) 0.2s",
        }}>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(3.4rem, 8.5vw, 7rem)",
            fontWeight: 700,
            lineHeight: 1.0,
            letterSpacing: "-0.03em",
            color: "#EDEDF0",
            marginBottom: "0",
          }}>
            engineered for
          </h1>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(3.4rem, 8.5vw, 7rem)",
            fontWeight: 700,
            fontStyle: "italic",
            lineHeight: 1.0,
            letterSpacing: "-0.03em",
            color: "rgba(237,237,240,0.18)",
            marginBottom: "0",
          }}>
            intelligent
          </h1>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(3.4rem, 8.5vw, 7rem)",
            fontWeight: 700,
            lineHeight: 1.0,
            letterSpacing: "-0.03em",
            color: "#EDEDF0",
            marginBottom: "2.25rem",
          }}>
            intervention
          </h1>
        </div>

        {/* Subtitle */}
        <div style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.75s ease 0.32s, transform 0.75s cubic-bezier(0.22,1,0.36,1) 0.32s",
        }}>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "1rem",
            fontWeight: 300,
            color: "rgba(237,237,240,0.45)",
            lineHeight: 1.72,
            maxWidth: "380px",
            margin: "0 auto 2.75rem",
            letterSpacing: "0.005em",
          }}>
            Real-time risk signals. Autonomous decision layers.
            <br />Built for institutions that cannot afford to be wrong.
          </p>
        </div>

        {/* CTA row */}
        <div style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.75s ease 0.42s, transform 0.75s cubic-bezier(0.22,1,0.36,1) 0.42s",
          display: "flex",
          gap: "0.75rem",
          justifyContent: "center",
          flexWrap: "wrap",
          alignItems: "center",
        }}>
          <Button T={T} primary>Get Early Access</Button>
          <Button T={T}>See How It Works</Button>
        </div>

        {/* Trust note */}
        <div style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.75s ease 0.55s",
          marginTop: "2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}>
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.70rem",
            color: "rgba(237,237,240,0.22)",
            letterSpacing: "0.02em",
          }}>
            SOC 2 Type II · ISO 27001 · GDPR Ready
          </span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div style={{
        position: "absolute", bottom: "2.5rem", left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        opacity: mounted ? 0.35 : 0,
        transition: "opacity 1s ease 1.2s",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.4rem",
      }}>
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.60rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(237,237,240,0.5)",
        }}>Scroll</span>
        <div style={{
          width: "1px",
          height: "28px",
          background: "linear-gradient(to bottom, rgba(61,90,254,0.7), transparent)",
          animation: "fadeIn 1.5s ease-in-out infinite alternate",
        }} />
      </div>

      <style>{`
        @keyframes dotBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes fadeIn {
          from { opacity: 0.2; }
          to   { opacity: 1; }
        }
      `}</style>
    </section>
  );
}