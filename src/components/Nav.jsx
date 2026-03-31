import { useState, useEffect } from "react";
import Button from "./UI/Button";

const LINKS = ["Product", "How It Works", "Capabilities", "Docs"];

export default function Nav({ T }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 1000,
        height: "60px",
        display: "flex",
        alignItems: "center",
        padding: "0 2rem",
        transition: "background 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease",
        background: scrolled ? "rgba(8,8,12,0.82)" : "transparent",
        borderBottom: `1px solid ${scrolled ? "rgba(255,255,255,0.06)" : "transparent"}`,
        backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
      }}
    >
      {/* Logo */}
      <div style={{ flex: "0 0 auto" }}>
        <span
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.02rem",
            fontWeight: 700,
            color: "#EDEDF0",
            letterSpacing: "-0.01em",
            userSelect: "none",
          }}
        >
          Intervenix
        </span>
      </div>

      {/* Center nav links */}
      <div
        className="nav-links"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.25rem",
        }}
      >
        {LINKS.map((l) => (
          <NavLink key={l}>{l}</NavLink>
        ))}
      </div>

      {/* Right CTA */}
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Button T={T} ghost small>Sign in</Button>
        <Button T={T} primary small>Request Access</Button>
      </div>
    </nav>
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