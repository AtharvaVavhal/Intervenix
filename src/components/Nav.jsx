import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "./UI/Button";
import { useAuth } from "../context/AuthContext";

// Links with optional route paths. Entries without `to` stay as anchor hrefs.
const PUBLIC_LINKS = [
  { label: "Product",      to: "/products" },
  { label: "How It Works", to: "/how-it-works" },
  { label: "Capabilities", to: "/capabilities" },
  { label: "Docs",         to: "/docs" },
];

const AUTH_LINKS = [
  { label: "Dashboard",    to: "/dashboard" },
  { label: "Product",      to: "/products" },
  { label: "Docs",         to: "/docs" },
];

export default function Nav({ T, onRequestAccess }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const navigate     = useNavigate();
  const ACTIVE_LINKS = isAuthenticated ? AUTH_LINKS : PUBLIC_LINKS;

  function handleLogout() {
    logout();
    navigate("/login");
  }

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
          {ACTIVE_LINKS.map((l) => <NavLink key={l.label} to={l.to}>{l.label}</NavLink>)}
        </div>

        {/* Desktop CTAs */}
        <div className="nav-links" style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}>
          {isAuthenticated ? (
            <Button T={T} ghost small onClick={handleLogout}>Log out</Button>
          ) : (
            <>
              <Button T={T} ghost small onClick={() => navigate("/login")}>Sign in</Button>
              <Button T={T} primary small onClick={onRequestAccess}>Request Access</Button>
            </>
          )}
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
        {ACTIVE_LINKS.map((l, i) => {
          const Tag = l.to ? Link : "a";
          const tagProps = l.to
            ? { to: l.to }
            : { href: "#" };
          return (
            <Tag
              key={l.label}
              {...tagProps}
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
              {l.label}
            </Tag>
          );
        })}

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          marginTop: "2rem",
          width: "200px",
          transition: "opacity 0.3s ease 0.2s",
          opacity: open ? 1 : 0,
        }}>
          {isAuthenticated ? (
            <Button T={T} ghost onClick={() => { setOpen(false); handleLogout(); }}>
              Log out
            </Button>
          ) : (
            <>
              <Button T={T} ghost onClick={() => { setOpen(false); navigate("/login"); }}>
                Sign in
              </Button>
              <Button T={T} primary onClick={() => { setOpen(false); onRequestAccess(); }}>
                Request Access
              </Button>
            </>
          )}
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

function NavLink({ children, to }) {
  const [hov, setHov] = useState(false);
  const location = useLocation();
  const active = to ? location.pathname === to : false;

  const sharedStyle = {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.80rem",
    fontWeight: active ? 500 : 400,
    color: active
      ? "rgba(237,237,240,0.9)"
      : hov
        ? "rgba(237,237,240,0.9)"
        : "rgba(237,237,240,0.45)",
    padding: "0.4rem 0.85rem",
    borderRadius: "6px",
    background: active
      ? "rgba(61,90,254,0.1)"
      : hov
        ? "rgba(255,255,255,0.05)"
        : "transparent",
    border: active ? "1px solid rgba(61,90,254,0.18)" : "1px solid transparent",
    transition: "color 0.15s ease, background 0.15s ease, border-color 0.15s ease",
    letterSpacing: "0.01em",
  };

  if (to) {
    return (
      <Link
        to={to}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={sharedStyle}
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      href="#"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={sharedStyle}
    >
      {children}
    </a>
  );
}