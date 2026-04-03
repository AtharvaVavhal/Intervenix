import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:          "#08080c",
  surface:     "#0d0d12",
  surfaceAlt:  "#0f0f15",
  border:      "rgba(255,255,255,0.06)",
  borderFoc:   "rgba(61,90,254,0.45)",
  borderErr:   "rgba(248,113,113,0.45)",
  accent:      "#3D5AFE",
  accentLight: "rgba(61,90,254,0.10)",
  text:        "#EDEDF0",
  textSub:     "rgba(237,237,240,0.45)",
  textMuted:   "rgba(237,237,240,0.22)",
  red:         "#f87171",
  serif:       "'Playfair Display', serif",
  sans:        "'DM Sans', sans-serif",
  ease:        "cubic-bezier(0.22, 1, 0.36, 1)",
};

const TOTAL_STEPS = 3;

// ── Validation helpers ────────────────────────────────────────────────────────
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function validateStep(step, fields) {
  const errors = {};
  if (step === 1) {
    if (!fields.fullName.trim())          errors.fullName = "Required";
    if (!fields.email.trim())             errors.email    = "Required";
    else if (!isEmail(fields.email))      errors.email    = "Enter a valid work email";
    if (!fields.company.trim())           errors.company  = "Required";
    if (!fields.role)                     errors.role     = "Select a role";
  }
  if (step === 2) {
    if (!fields.volume.trim())            errors.volume      = "Required";
    else if (isNaN(Number(fields.volume)) || Number(fields.volume) <= 0)
                                          errors.volume      = "Enter a valid number";
    if (!fields.useCase)                  errors.useCase     = "Select a use case";
    if (!fields.problem.trim())           errors.problem     = "Required";
  }
  if (step === 3) {
    if (!fields.stack.trim())             errors.stack = "Required";
  }
  return errors;
}

// ── Primitive field components ────────────────────────────────────────────────

function FieldWrapper({ label, error, children, required }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
      <label style={{
        fontFamily: T.sans, fontSize: "0.70rem", fontWeight: 500,
        letterSpacing: "0.10em", textTransform: "uppercase",
        color: error ? T.red : T.textMuted,
        transition: "color 0.15s ease",
      }}>
        {label}{required && <span style={{ color: T.accent, marginLeft: "0.2rem" }}>*</span>}
      </label>
      {children}
      {error && (
        <span style={{
          fontFamily: T.sans, fontSize: "0.72rem",
          color: T.red, lineHeight: 1.4,
          animation: "errIn 0.2s ease both",
        }}>
          {error}
        </span>
      )}
    </div>
  );
}

function inputStyle(focused, error) {
  return {
    fontFamily: T.sans, fontSize: "0.88rem", fontWeight: 400,
    color: T.text,
    background: "rgba(255,255,255,0.025)",
    border: `1px solid ${error ? T.borderErr : focused ? T.borderFoc : T.border}`,
    borderRadius: "6px",
    padding: "0.78rem 1rem",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    boxShadow: error
      ? "0 0 0 3px rgba(248,113,113,0.08)"
      : focused
        ? "0 0 0 3px rgba(61,90,254,0.10)"
        : "none",
    caretColor: T.accent,
  };
}

function Input({ label, type = "text", value, onChange, placeholder, error, autoFocus, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldWrapper label={label} error={error} required={required}>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={inputStyle(focused, error)}
      />
    </FieldWrapper>
  );
}

function Select({ label, value, onChange, options, placeholder, error, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldWrapper label={label} error={error} required={required}>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            ...inputStyle(focused, error),
            appearance: "none",
            WebkitAppearance: "none",
            cursor: "pointer",
            paddingRight: "2.5rem",
            color: value ? T.text : T.textMuted,
          }}
        >
          <option value="" disabled hidden style={{ color: T.textMuted }}>
            {placeholder}
          </option>
          {options.map(o => (
            <option key={o.value} value={o.value} style={{ background: "#0d0d12", color: T.text }}>
              {o.label}
            </option>
          ))}
        </select>
        <span style={{
          position: "absolute", right: "0.9rem", top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          color: T.textMuted, fontSize: "0.7rem",
        }}>
          ▾
        </span>
      </div>
    </FieldWrapper>
  );
}

function Textarea({ label, value, onChange, placeholder, error, required, rows = 4 }) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldWrapper label={label} error={error} required={required}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputStyle(focused, error),
          resize: "vertical",
          minHeight: `${rows * 1.6}rem`,
          lineHeight: 1.6,
        }}
      />
    </FieldWrapper>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        cursor: "pointer", userSelect: "none",
      }}
    >
      <div style={{
        width: "36px", height: "20px",
        borderRadius: "100px",
        background: checked ? T.accent : "rgba(255,255,255,0.08)",
        border: `1px solid ${checked ? "rgba(61,90,254,0.4)" : T.border}`,
        position: "relative",
        transition: "background 0.2s ease, border-color 0.2s ease",
        flexShrink: 0,
      }}>
        <div style={{
          position: "absolute",
          top: "2px",
          left: checked ? "18px" : "2px",
          width: "14px", height: "14px",
          borderRadius: "50%",
          background: checked ? "#fff" : "rgba(255,255,255,0.35)",
          transition: "left 0.2s cubic-bezier(0.22,1,0.36,1)",
          boxShadow: checked ? "0 1px 4px rgba(61,90,254,0.4)" : "none",
        }} />
      </div>
      <span style={{
        fontFamily: T.sans, fontSize: "0.84rem",
        color: checked ? T.text : T.textSub,
        transition: "color 0.15s ease",
      }}>
        {label}
      </span>
    </div>
  );
}

// ── Progress indicator ────────────────────────────────────────────────────────

function ProgressBar({ current, total }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "2.5rem" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{
          fontFamily: T.sans, fontSize: "0.68rem", fontWeight: 500,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: T.textMuted,
        }}>
          Step {current} of {total}
        </span>
        <span style={{
          fontFamily: T.sans, fontSize: "0.68rem",
          color: T.textMuted,
        }}>
          {STEP_LABELS[current - 1]}
        </span>
      </div>
      <div style={{
        height: "2px",
        background: "rgba(255,255,255,0.05)",
        borderRadius: "2px",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${(current / total) * 100}%`,
          background: `linear-gradient(90deg, #3D5AFE, #5c73ff)`,
          borderRadius: "2px",
          transition: "width 0.5s cubic-bezier(0.22,1,0.36,1)",
          boxShadow: "0 0 8px rgba(61,90,254,0.5)",
        }} />
      </div>
    </div>
  );
}

const STEP_LABELS = ["Identity", "Use Case", "Technical Context"];

// ── Nav buttons ───────────────────────────────────────────────────────────────

function NavButtons({ step, onBack, onNext, onSubmit, nextDisabled, loading }) {
  const [hovNext, setHovNext] = useState(false);
  const [hovBack, setHovBack] = useState(false);
  const isLast = step === TOTAL_STEPS;

  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginTop: "2rem", paddingTop: "1.5rem",
      borderTop: `1px solid ${T.border}`,
    }}>
      {step > 1 ? (
        <button
          onClick={onBack}
          onMouseEnter={() => setHovBack(true)}
          onMouseLeave={() => setHovBack(false)}
          style={{
            fontFamily: T.sans, fontSize: "0.80rem", fontWeight: 500,
            color: hovBack ? T.text : T.textSub,
            background: "none", border: "none", cursor: "pointer",
            padding: "0.5rem 0",
            display: "flex", alignItems: "center", gap: "0.4rem",
            transition: "color 0.15s ease",
          }}
        >
          ← Back
        </button>
      ) : <div />}

      <button
        onClick={isLast ? onSubmit : onNext}
        disabled={nextDisabled || loading}
        onMouseEnter={() => setHovNext(true)}
        onMouseLeave={() => setHovNext(false)}
        style={{
          fontFamily: T.sans, fontSize: "0.82rem", fontWeight: 500,
          letterSpacing: "0.02em",
          color: "#fff",
          background: nextDisabled || loading
            ? "rgba(61,90,254,0.35)"
            : hovNext
              ? "linear-gradient(135deg, #4f6bff 0%, #3D5AFE 100%)"
              : "linear-gradient(135deg, #3D5AFE 0%, #2d47f0 100%)",
          border: "1px solid rgba(100,130,255,0.3)",
          borderRadius: "6px",
          padding: "0.72rem 1.6rem",
          cursor: nextDisabled || loading ? "not-allowed" : "pointer",
          transition: "all 0.18s ease",
          boxShadow: (!nextDisabled && !loading && hovNext)
            ? "0 4px 20px rgba(61,90,254,0.35)"
            : "0 2px 10px rgba(61,90,254,0.15)",
          transform: (!nextDisabled && !loading && hovNext) ? "translateY(-1px)" : "none",
        }}
      >
        {loading ? "Sending…" : isLast ? "Submit request" : "Continue →"}
      </button>
    </div>
  );
}

// ── Step panels ───────────────────────────────────────────────────────────────

function Step1({ fields, errors, set }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="tte-two-col">
        <Input
          label="Full Name" value={fields.fullName}
          onChange={v => set("fullName", v)}
          placeholder="Jane Smith"
          error={errors.fullName} required autoFocus
        />
        <Input
          label="Work Email" type="email" value={fields.email}
          onChange={v => set("email", v)}
          placeholder="jane@company.com"
          error={errors.email} required
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="tte-two-col">
        <Input
          label="Company" value={fields.company}
          onChange={v => set("company", v)}
          placeholder="Acme Financial"
          error={errors.company} required
        />
        <Select
          label="Role" value={fields.role}
          onChange={v => set("role", v)}
          placeholder="Select your role"
          options={[
            { value: "risk",        label: "Risk" },
            { value: "data",        label: "Data" },
            { value: "engineering", label: "Engineering" },
            { value: "other",       label: "Other" },
          ]}
          error={errors.role} required
        />
      </div>
    </div>
  );
}

function Step2({ fields, errors, set }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="tte-two-col">
        <Input
          label="Monthly Transaction Volume" type="number" value={fields.volume}
          onChange={v => set("volume", v)}
          placeholder="e.g. 500000"
          error={errors.volume} required autoFocus
        />
        <Select
          label="Primary Use Case" value={fields.useCase}
          onChange={v => set("useCase", v)}
          placeholder="Select use case"
          options={[
            { value: "fraud",       label: "Fraud detection" },
            { value: "credit",      label: "Credit risk" },
            { value: "collections", label: "Collections optimization" },
            { value: "other",       label: "Other" },
          ]}
          error={errors.useCase} required
        />
      </div>
      <Textarea
        label="Biggest Problem You're Trying to Solve"
        value={fields.problem}
        onChange={v => set("problem", v)}
        placeholder="Describe the core challenge — the more specific, the better."
        error={errors.problem} required rows={5}
      />
    </div>
  );
}

function Step3({ fields, errors, set }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <Input
        label="Current Tools / Stack" value={fields.stack}
        onChange={v => set("stack", v)}
        placeholder="e.g. Snowflake, dbt, Python, custom scoring model"
        error={errors.stack} required autoFocus
      />
      <Textarea
        label="Additional Notes"
        value={fields.notes}
        onChange={v => set("notes", v)}
        placeholder="Anything else we should know — integrations, timeline, team size."
        rows={4}
      />
      <div style={{
        padding: "1.1rem 1.25rem",
        background: T.accentLight,
        border: `1px solid rgba(61,90,254,0.14)`,
        borderRadius: "8px",
      }}>
        <Toggle
          label="Request a callback from our engineering team"
          checked={fields.callback}
          onChange={v => set("callback", v)}
        />
      </div>
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen() {
  const [hov, setHov] = useState(false);
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center", padding: "1rem 0 0.5rem",
      animation: "tteFadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both",
    }}>
      <div style={{
        width: "56px", height: "56px", borderRadius: "50%",
        background: "rgba(74,222,128,0.08)",
        border: "1px solid rgba(74,222,128,0.20)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.3rem", marginBottom: "1.75rem",
        boxShadow: "0 0 24px rgba(74,222,128,0.12)",
      }}>
        ✓
      </div>

      <h2 style={{
        fontFamily: T.serif, fontSize: "1.7rem", fontWeight: 700,
        color: T.text, margin: "0 0 0.65rem",
        letterSpacing: "-0.02em",
      }}>
        Request received.
      </h2>
      <p style={{
        fontFamily: T.sans, fontSize: "0.88rem",
        color: T.textSub, margin: "0 0 2.25rem",
        maxWidth: "320px", lineHeight: 1.6,
      }}>
        Our engineering team will reach out within 24 hours.
      </p>

      <Link
        to="/"
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          fontFamily: T.sans, fontSize: "0.82rem", fontWeight: 500,
          color: hov ? T.text : T.textSub,
          textDecoration: "none",
          padding: "0.65rem 1.4rem",
          border: `1px solid ${hov ? "rgba(255,255,255,0.14)" : T.border}`,
          borderRadius: "6px",
          transition: "all 0.15s ease",
          background: hov ? "rgba(255,255,255,0.04)" : "transparent",
        }}
      >
        Back to home
      </Link>
    </div>
  );
}

// ── Step heading ──────────────────────────────────────────────────────────────

const STEP_HEADINGS = [
  { title: "Tell us about yourself.",  sub: "We review every request personally." },
  { title: "What are you building?",   sub: "Help us understand the problem space." },
  { title: "Technical context.",        sub: "So we can show up prepared." },
];

// ── Main page ─────────────────────────────────────────────────────────────────

const INITIAL_FIELDS = {
  fullName: "", email: "", company: "", role: "",
  volume: "", useCase: "", problem: "",
  stack: "", notes: "", callback: false,
};

export default function TalkToEngineerPage() {
  const [step,      setStep]      = useState(1);
  const [fields,    setFields]    = useState(INITIAL_FIELDS);
  const [errors,    setErrors]    = useState({});
  const [touched,   setTouched]   = useState({});
  const [direction, setDirection] = useState(1);  // 1 = forward, -1 = back
  const [animKey,   setAnimKey]   = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  function set(key, value) {
    setFields(f => ({ ...f, [key]: value }));
    setTouched(t => ({ ...t, [key]: true }));
    // Clear error on change
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function getStepErrors() {
    return validateStep(step, fields);
  }

  const stepErrors = getStepErrors();
  const hasErrors  = Object.keys(stepErrors).length > 0;

  function advance() {
    const errs = validateStep(step, fields);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Mark all current step fields as touched
      setTouched(t => Object.fromEntries([...Object.keys(t), ...Object.keys(errs)].map(k => [k, true])));
      return;
    }
    setDirection(1);
    setAnimKey(k => k + 1);
    setStep(s => s + 1);
    setErrors({});
  }

  function back() {
    setDirection(-1);
    setAnimKey(k => k + 1);
    setStep(s => s - 1);
    setErrors({});
  }

  async function submit() {
    const errs = validateStep(step, fields);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    // Simulate async submit (wire to backend later)
    await new Promise(r => setTimeout(r, 900));
    setLoading(false);
    setSubmitted(true);
  }

  const heading = STEP_HEADINGS[step - 1];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans }}>
      <Nav T={T} onRequestAccess={() => {}} />

      {/* Ambient glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 55% 45% at 50% 0%, rgba(61,90,254,0.06) 0%, transparent 70%)",
        zIndex: 0,
      }} />

      <main style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "calc(60px + 3rem) 2rem 4rem",
      }}>
        <div style={{
          width: "100%", maxWidth: "600px",
          animation: "tteFadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both",
        }}>
          {submitted ? (
            <div style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: "14px",
              padding: "3rem 2.5rem",
              boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
            }}>
              <SuccessScreen />
            </div>
          ) : (
            <div style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: "14px",
              padding: "2.75rem 2.5rem",
              boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
            }}>
              <ProgressBar current={step} total={TOTAL_STEPS} />

              {/* Step heading — animates on step change */}
              <div
                key={`heading-${animKey}`}
                style={{
                  marginBottom: "2rem",
                  animation: `${direction > 0 ? "stepIn" : "stepInBack"} 0.35s cubic-bezier(0.22,1,0.36,1) both`,
                }}
              >
                <h2 style={{
                  fontFamily: T.serif, fontSize: "1.45rem", fontWeight: 700,
                  color: T.text, margin: "0 0 0.35rem",
                  letterSpacing: "-0.02em", lineHeight: 1.2,
                }}>
                  {heading.title}
                </h2>
                <p style={{
                  fontFamily: T.sans, fontSize: "0.82rem",
                  color: T.textSub, margin: 0, lineHeight: 1.5,
                }}>
                  {heading.sub}
                </p>
              </div>

              {/* Fields — animate independently */}
              <div
                key={`fields-${animKey}`}
                style={{
                  animation: `${direction > 0 ? "stepIn" : "stepInBack"} 0.4s cubic-bezier(0.22,1,0.36,1) 0.04s both`,
                }}
              >
                {step === 1 && <Step1 fields={fields} errors={errors} set={set} />}
                {step === 2 && <Step2 fields={fields} errors={errors} set={set} />}
                {step === 3 && <Step3 fields={fields} errors={errors} set={set} />}
              </div>

              <NavButtons
                step={step}
                onBack={back}
                onNext={advance}
                onSubmit={submit}
                nextDisabled={false}
                loading={loading}
              />
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes tteFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes stepInBack {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes errIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; }
        input::placeholder, textarea::placeholder { color: rgba(237,237,240,0.18); }
        input:-webkit-autofill, input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #0d0d12 inset !important;
          -webkit-text-fill-color: #EDEDF0 !important;
          caret-color: #3D5AFE;
        }
        select option { background: #0d0d12; color: #EDEDF0; }
        textarea { font-family: 'DM Sans', sans-serif; }
        @media (max-width: 560px) {
          .tte-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
