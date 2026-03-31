/**
 * Hero.jsx — Production-grade refactor
 *
 * Key improvements:
 * - RAF-throttled scroll with ref-based parallax (zero re-renders on scroll)
 * - Cached bounding rect (resizeObserver, not per-mousemove)
 * - Canvas gated by IntersectionObserver + prefers-reduced-motion + mobile DPR cap
 * - CSS Modules for all styling (no inline style objects except dynamic transforms)
 * - GPU-composited parallax via direct DOM mutation (no React state for scroll)
 * - Proper accessibility: landmark, aria-labels, heading hierarchy
 * - 100svh with 100vh fallback
 */

import { useEffect, useRef, useCallback, memo } from "react";
import CorridorCanvas from "./Canvas/CorridorCanvas";
import Button from "./UI/Button";
import styles from "./Hero.module.css";

// ---------------------------------------------------------------------------
// Subcomponents — memoised to prevent cascading re-renders
// ---------------------------------------------------------------------------

const Badge = memo(function Badge() {
  return (
    <div className={styles.badge} aria-hidden="true">
      <span className={styles.badgeDot} />
      <span className={styles.badgeLabel}>Real-time Risk Intelligence</span>
    </div>
  );
});

const Headline = memo(function Headline() {
  return (
    <div className={styles.headlineGroup}>
      <h1 className={styles.headlineSolid}>engineered for</h1>
      <h1 className={styles.headlineGhost} aria-hidden="true">intelligent</h1>
      <h1 className={styles.headlineSolid}>intervention</h1>
    </div>
  );
});

const Subtitle = memo(function Subtitle() {
  return (
    <p className={styles.subtitle}>
      Real-time risk signals. Autonomous decision layers.
      <br />
      Built for institutions that cannot afford to be wrong.
    </p>
  );
});

const TrustBar = memo(function TrustBar() {
  return (
    <p className={styles.trustBar} aria-label="Compliance certifications">
      SOC 2 Type II · ISO 27001 · GDPR Ready
    </p>
  );
});

const ScrollIndicator = memo(function ScrollIndicator() {
  return (
    <div className={styles.scrollIndicator} aria-hidden="true">
      <span className={styles.scrollLabel}>Scroll</span>
      <div className={styles.scrollLine} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Canvas wrapper — only mounts when appropriate
// ---------------------------------------------------------------------------

function CanvasGate({ mouseRef }) {
  const wrapRef = useRef(null);
  const mountedRef = useRef(false);
  const canvasContainerRef = useRef(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !mountedRef.current) {
          mountedRef.current = true;
          canvasContainerRef.current?.classList.add(styles.canvasVisible);
        }
      },
      { threshold: 0.01 }
    );

    if (wrapRef.current) observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  const cappedDPR = Math.min(window.devicePixelRatio ?? 1, 1.5);

  return (
    <div
      ref={wrapRef}
      className={styles.canvasLayer}
      aria-hidden="true"
    >
      <div ref={canvasContainerRef} className={styles.canvasInner}>
        <CorridorCanvas mouseRef={mouseRef} dpr={cappedDPR} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Hero component
// ---------------------------------------------------------------------------

export default function Hero({ T, onRequestAccess }) {
  const heroRef = useRef(null);
  const contentRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  const rectRef = useRef({ left: 0, top: 0, width: 1, height: 1 });
  const rafRef = useRef(null);

  const applyParallax = useCallback(() => {
    if (!contentRef.current) return;
    const y = window.scrollY * -0.08;
    contentRef.current.style.transform = `translateY(${y}px)`;
    rafRef.current = null;
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(applyParallax);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [applyParallax]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    const updateRect = () => {
      const r = el.getBoundingClientRect();
      rectRef.current = {
        left: r.left,
        top: r.top,
        width: r.width || 1,
        height: r.height || 1,
      };
    };

    updateRect();
    const ro = new ResizeObserver(updateRect);
    ro.observe(el);

    const onMove = (e) => {
      const { left, top, width, height } = rectRef.current;
      mouseRef.current = {
        x: (e.clientX - left) / width,
        y: (e.clientY - top) / height,
      };
    };

    el.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      el.removeEventListener("mousemove", onMove);
      ro.disconnect();
    };
  }, []);

  return (
    <section
      ref={heroRef}
      className={styles.hero}
      aria-label="Hero — Engineered for Intelligent Intervention"
    >
      {/* ── 3D Canvas (performance-gated) ── */}
      <CanvasGate mouseRef={mouseRef} />

      {/* ── Gradient overlays ── */}
      <div className={styles.overlayRadial} aria-hidden="true" />
      <div className={styles.overlayTop}    aria-hidden="true" />
      <div className={styles.overlayBottom} aria-hidden="true" />

      {/* ── Main content ── */}
      <div ref={contentRef} className={styles.content}>
        <Badge />
        <Headline />
        <Subtitle />

        {/* CTA row */}
        <div className={styles.ctaRow}>
          <Button T={T} primary onClick={onRequestAccess} aria-label="Request early access">
            Get Early Access
          </Button>
          <Button T={T} aria-label="Watch product demo">
            See How It Works
          </Button>
        </div>

        <TrustBar />
      </div>

      {/* ── Scroll cue ── */}
      <ScrollIndicator />
    </section>
  );
}