import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const T = {
  bg:        "#08080c",
  surface:   "#0d0d12",
  border:    "rgba(255,255,255,0.06)",
  borderFoc: "rgba(61,90,254,0.45)",
  accent:    "#3D5AFE",
  text:      "#EDEDF0",
  textSub:   "rgba(237,237,240,0.45)",
  textMuted: "rgba(237,237,240,0.22)",
  red:       "#f87171",
  serif:     "'Playfair Display', serif",
  sans:      "'DM Sans', sans-serif",
};

function Field({ label, type, value, onChange, placeholder, autoFocus }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
      <label style={{
        fontFamily: T.sans, fontSize: "0.70rem", fontWeight: 500,
        letterSpacing: "0.10em", textTransform: "uppercase",
        color: focused ? "rgba(100,130,255,0.9)" : T.textMuted,
        transition: "color 0.15s ease",
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontFamily: T.sans, fontSize: "0.88rem",
          color: T.text,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${focused ? T.borderFoc : T.border}`,
          borderRadius: "6px",
          padding: "0.75rem 1rem",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          boxShadow: focused ? "0 0 0 3px rgba(61,90,254,0.12)" : "none",
          caretColor: T.accent,
        }}
      />
    </div>
  );
}

function SubmitBtn({ loading, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", padding: "0.80rem",
        fontFamily: T.sans, fontSize: "0.84rem", fontWeight: 500,
        letterSpacing: "0.02em", color: "#fff",
        background: loading
          ? "rgba(61,90,254,0.5)"
          : hov
            ? "linear-gradient(135deg, #4f6bff 0%, #3D5AFE 100%)"
            : "linear-gradient(135deg, #3D5AFE 0%, #2d47f0 100%)",
        border: "1px solid rgba(100,130,255,0.3)",
        borderRadius: "6px",
        cursor: loading ? "not-allowed" : "pointer",
        transition: "all 0.18s ease",
        boxShadow: hov && !loading ? "0 4px 24px rgba(61,90,254,0.35)" : "0 2px 12px rgba(61,90,254,0.18)",
        transform: hov && !loading ? "translateY(-1px)" : "none",
      }}
    >
      {loading ? "Signing in…" : children}
    </button>
  );
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const redirectTo = location.state?.from?.pathname ?? "/dashboard";

  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Already logged in — skip the page
  useEffect(() => {
    if (isAuthenticated) navigate(redirectTo, { replace: true });
  }, [isAuthenticated, navigate, redirectTo]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email || !pass) { setError("Please fill in all fields."); return; }

    try {
      setLoading(true);
      await login(email, pass);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: T.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "2rem", fontFamily: T.sans,
    }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(61,90,254,0.07) 0%, transparent 70%)",
      }} />

      <div style={{
        width: "100%", maxWidth: "400px",
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: "12px",
        padding: "2.5rem 2rem",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        position: "relative",
        animation: "authFadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both",
      }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <div style={{
            fontFamily: T.serif, fontSize: "1rem", fontWeight: 700,
            color: T.text, marginBottom: "2rem", letterSpacing: "-0.01em",
          }}>
            Intervenix
          </div>
        </Link>

        <h1 style={{
          fontFamily: T.serif, fontSize: "1.55rem", fontWeight: 700,
          color: T.text, margin: "0 0 0.4rem",
          letterSpacing: "-0.02em", lineHeight: 1.2,
        }}>
          Welcome back
        </h1>
        <p style={{
          fontFamily: T.sans, fontSize: "0.83rem",
          color: T.textSub, margin: "0 0 2rem",
        }}>
          Sign in to your Intervenix account.
        </p>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <Field label="Email"    type="email"    value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoFocus />
          <Field label="Password" type="password" value={pass}  onChange={e => setPass(e.target.value)}  placeholder="••••••••" />
          <div style={{ marginTop: "0.25rem" }}>
            <SubmitBtn loading={loading}>Sign in</SubmitBtn>
          </div>
        </form>

        <Divider />
        <p style={{ textAlign: "center", fontFamily: T.sans, fontSize: "0.80rem", color: T.textSub, margin: 0 }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: "rgba(100,130,255,0.9)", textDecoration: "none", fontWeight: 500 }}>
            Sign up
          </Link>
        </p>
      </div>

      <AuthStyles />
    </div>
  );
}

function ErrorBanner({ children }) {
  return (
    <div style={{
      background: "rgba(248,113,113,0.08)",
      border: "1px solid rgba(248,113,113,0.18)",
      borderRadius: "6px",
      padding: "0.65rem 0.9rem",
      marginBottom: "1.25rem",
      fontFamily: T.sans, fontSize: "0.80rem",
      color: "#f87171", lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div style={{
      margin: "1.75rem 0 1.5rem",
      borderTop: `1px solid ${T.border}`,
    }} />
  );
}

function AuthStyles() {
  return (
    <style>{`
      @keyframes authFadeUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      input::placeholder { color: rgba(237,237,240,0.18); }
      input:-webkit-autofill,
      input:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 1000px #0d0d12 inset !important;
        -webkit-text-fill-color: #EDEDF0 !important;
        caret-color: #3D5AFE;
      }
    `}</style>
  );
}

function friendlyError(err) {
  const msg = (err?.message ?? "").toLowerCase();
  const status = err?.status;

  if (status === 401 || msg.includes("incorrect") || msg.includes("invalid"))
    return "Invalid email or password.";
  if (status === 422)
    return "Please enter a valid email and password.";
  if (status === 429)
    return "Too many attempts. Please wait a moment.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Cannot reach the server. Check your connection.";
  return err?.message || "Something went wrong. Please try again.";
}
