import { useState } from "react";

export default function Button({
  children,
  primary = false,
  small = false,
  ghost = false,
  T,
  onClick,
  style: extraStyle = {},
}) {
  const [hov, setHov] = useState(false);
  const [active, setActive] = useState(false);

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.4rem",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: small ? "0.70rem" : "0.78rem",
    fontWeight: 500,
    letterSpacing: "0.025em",
    padding: small ? "0.5rem 1.1rem" : "0.78rem 1.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    transition: "all 0.18s cubic-bezier(0.4,0,0.2,1)",
    transform: active ? "scale(0.97)" : hov ? "translateY(-1px)" : "none",
    ...extraStyle,
  };

  if (primary) {
    return (
      <button
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => { setHov(false); setActive(false); }}
        onMouseDown={() => setActive(true)}
        onMouseUp={() => setActive(false)}
        onClick={onClick}
        style={{
          ...base,
          background: hov
            ? "linear-gradient(135deg, #4f6bff 0%, #3D5AFE 100%)"
            : "linear-gradient(135deg, #3D5AFE 0%, #2d47f0 100%)",
          color: "#fff",
          border: "1px solid rgba(100,130,255,0.3)",
          boxShadow: hov
            ? "0 0 0 1px rgba(61,90,254,0.4), 0 4px 24px rgba(61,90,254,0.35), inset 0 1px 0 rgba(255,255,255,0.12)"
            : "0 0 0 1px rgba(61,90,254,0.2), 0 2px 12px rgba(61,90,254,0.18), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {children}
      </button>
    );
  }

  if (ghost) {
    return (
      <button
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => { setHov(false); setActive(false); }}
        onMouseDown={() => setActive(true)}
        onMouseUp={() => setActive(false)}
        onClick={onClick}
        style={{
          ...base,
          background: "transparent",
          color: hov ? "#EDEDF0" : "rgba(237,237,240,0.45)",
          border: "none",
          padding: small ? "0.5rem 0.75rem" : "0.78rem 1rem",
          boxShadow: "none",
          transform: "none",
        }}
      >
        {children}
      </button>
    );
  }

  // Default: outlined
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onClick={onClick}
      style={{
        ...base,
        background: hov ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
        color: hov ? "#EDEDF0" : "rgba(237,237,240,0.55)",
        border: `1px solid ${hov ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)"}`,
        boxShadow: hov ? "0 2px 12px rgba(0,0,0,0.3)" : "none",
      }}
    >
      {children}
    </button>
  );
}