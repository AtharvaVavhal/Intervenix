import { useState, useEffect } from "react";
import Button from "./UI/Button";

const LINKS = ["Product", "How It Works", "Capabilities", "Docs"];

export default function Nav({ T, onRequestAccess }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <nav style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 1000,
        height: "60px",
        display: "flex",
        alignItems: "center",
        padding: "0 2rem",
        transition: "background 0.4s ease, border-color 0.4s ease",
        background: scrolled || open ? "rgba(8,8,12,0.95)" : "transparent",
        borderBottom: `1px solid ${scrolled || open ? "rgba(255,255,255,0.06)" : "transparent"}`,
        backdropFilter: scrolled || open ? "blur(20px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled || open ? "blur(20px) saturate(180%)" : "none",
      }}>
        {/* Logo */}
        <div style={{ flex: "1 0 auto" }}>
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.02rem",
            fontWeight: 700,
            color: "#EDEDF0",
            letterSpacing: "-0.01em",
            userSelect: "none",
          }}>
            Intervenix
          </span>
        </div>

        {/* Desktop nav links */}
        <div className="nav-links" style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.25rem",
        }}>
          {LINKS.map((l) => <NavLink key={l}>{l}</NavLink>)}
        </div>

        {/* Desktop CTAs */}
        <div className="nav-links" style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}>
          <Button T={T} ghost small>Sign in</Button>
          <Button T={T} primary small onClick={onRequestAccess}>Request Access</Button>
        </div>

        {/* Hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
          style={{
            display: "none",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "5px",
            width: "36px",
            height: "36px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            zIndex: 1100,
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: "block",
              width: "22px",
              height: "1.5px",
              background: "#EDEDF0",
              borderRadius: "2px",
              transition: "all 0.25s ease",
              transform: open
                ? i === 0 ? "translateY(6.5px) rotate(45deg)"
                : i === 2 ? "translateY(-6.5px) rotate(-45deg)"
                : "scaleX(0)"
                : "none",
              opacity: open && i === 1 ? 0 : 1,
            }} />
          ))}
        </button>
      </nav>

      {/* Mobile menu overlay */}
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "rgba(8,8,12,0.98)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0)" : "translateY(-12px)",
        pointerEvents: open ? "auto" : "none",
      }}>
        {LINKS.map((l, i) => (
          <a
            key={l}
            href="#"
            onClick={() => setOpen(false)}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "1.5rem",
              fontWeight: 400,
              color: "rgba(237,237,240,0.75)",
              padding: "0.75rem 2rem",
              letterSpacing: "-0.01em",
              transition: `opacity 0.3s ease ${i * 0.05}s, transform 0.3s ease ${i * 0.05}s`,
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0)" : "translateY(10px)",
            }}
          >
            {l}
          </a>
        ))}

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          marginTop: "2rem",
          width: "200px",
          transition: "opacity 0.3s ease 0.2s",
          opacity: open ? 1 : 0,
        }}>
          <Button T={T} ghost>Sign in</Button>
          <Button T={T} primary onClick={() => { setOpen(false); onRequestAccess(); }}>
            Request Access
          </Button>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .nav-hamburger { display: flex !important; }
          .nav-links { display: none !important; }
        }
      `}</style>
    </>
  );
}

function NavLink({ children }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      href="#"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "0.80rem",
        fontWeight: 400,
        color: hov ? "rgba(237,237,240,0.9)" : "rgba(237,237,240,0.45)",
        padding: "0.4rem 0.85rem",
        borderRadius: "6px",
        background: hov ? "rgba(255,255,255,0.05)" : "transparent",
        transition: "color 0.15s ease, background 0.15s ease",
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </a>
  );
}