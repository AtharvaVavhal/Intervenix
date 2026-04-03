import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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

// ── Reusable field ────────────────────────────────────────────────────────────
function Field({ label, type, value, onChange, placeholder, autoFocus, hint }) {
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
      {hint && (
        <span style={{ fontFamily: T.sans, fontSize: "0.72rem", color: T.textMuted, lineHeight: 1.4 }}>
          {hint}
        </span>
      )}
    </div>
  );
}

// ── Password strength bar ─────────────────────────────────────────────────────
function StrengthBar({ password }) {
  const score  = getStrength(password);
  const colors = ["transparent", "#f87171", "#fbbf24", "#4ade80"];
  const labels = ["", "Weak", "Fair", "Strong"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <div style={{ display: "flex", gap: "4px" }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: "2px", borderRadius: "2px",
            background: score >= i ? colors[score] : "rgba(255,255,255,0.06)",
            transition: "background 0.25s ease",
          }} />
        ))}
      </div>
      {password.length > 0 && (
        <span style={{ fontFamily: T.sans, fontSize: "0.68rem", color: colors[score], letterSpacing: "0.05em" }}>
          {labels[score]}
        </span>
      )}
    </div>
  );
}

// ── Submit button ─────────────────────────────────────────────────────────────
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
      {loading ? "Creating account…" : children}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SignupPage() {
  const { signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email || !pass || !confirm) { setError("Please fill in all fields."); return; }
    if (pass.length < 8)             { setError("Password must be at least 8 characters."); return; }
    if (pass !== confirm)            { setError("Passwords do not match."); return; }

    try {
      setLoading(true);
      await signup(email, pass);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  const mismatch = confirm.length > 0 && pass !== confirm;

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
        width: "100%", maxWidth: "420px",
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
          Create an account
        </h1>
        <p style={{
          fontFamily: T.sans, fontSize: "0.83rem",
          color: T.textSub, margin: "0 0 2rem",
        }}>
          Get access to the Decision Intelligence Engine.
        </p>

        {error && (
          <div style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.18)",
            borderRadius: "6px", padding: "0.65rem 0.9rem",
            marginBottom: "1.25rem",
            fontFamily: T.sans, fontSize: "0.80rem",
            color: T.red, lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <Field
            label="Email" type="email"
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com" autoFocus
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            <Field
              label="Password" type="password"
              value={pass} onChange={e => setPass(e.target.value)}
              placeholder="••••••••" hint="Minimum 8 characters"
            />
            {pass.length > 0 && <StrengthBar password={pass} />}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            <Field
              label="Confirm password" type="password"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
            {mismatch && (
              <span style={{ fontFamily: T.sans, fontSize: "0.72rem", color: T.red }}>
                Passwords don't match
              </span>
            )}
          </div>

          <div style={{ marginTop: "0.25rem" }}>
            <SubmitBtn loading={loading}>Create account</SubmitBtn>
          </div>
        </form>

        <div style={{
          margin: "1.75rem 0 1.5rem",
          borderTop: `1px solid ${T.border}`,
        }} />
        <p style={{ textAlign: "center", fontFamily: T.sans, fontSize: "0.80rem", color: T.textSub, margin: 0 }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "rgba(100,130,255,0.9)", textDecoration: "none", fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>

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
    </div>
  );
}

function getStrength(password) {
  if (password.length < 8) return 1;
  let score = 1;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 3);
}

function friendlyError(err) {
  const msg    = (err?.message ?? "").toLowerCase();
  const status = err?.status;

  if (status === 409 || msg.includes("already"))
    return "An account with this email already exists.";
  if (status === 422)
    return "Please enter a valid email and password.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Cannot reach the server. Check your connection.";
  return err?.message || "Something went wrong. Please try again.";
}
