/**
 * RequestAccess.jsx — "ORACLE" Edition
 *
 * Concept: The form behaves like an AI evaluating the applicant in real time.
 * Every keystroke is "analysed". Fields unlock progressively based on score.
 * The submission is a multi-stage ceremony, not a spinner.
 *
 * New systems added over baseline:
 * ① Dynamic scoring engine   — per-field quality score, 0–100, drives visual feedback
 * ② Progressive field reveal — next field unlocks only when current passes threshold
 * ③ Intelligent hints        — context-aware suggestions that update as user types
 * ④ Multi-stage submission   — 5-phase animated pipeline with live status labels
 * ⑤ Profile synthesis        — AI builds a "risk profile" summary from inputs
 *
 * Architecture:
 * - All state in useReducer (no prop drilling, single source of truth)
 * - Scoring runs in a useCallback, debounced 180ms to avoid thrash
 * - Hints are derived from score + value, never stored in state
 * - Submit stages driven by a ref-based async sequencer
 * - All animations: CSS keyframes + class toggling (zero GSAP dependency)
 * - memo() on every pure subcomponent
 */

import {
  useReducer,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  memo,
  useState,
} from "react";
import styles from "./RequestAccess.module.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  "Chief Risk Officer",
  "Chief Technology Officer",
  "Head of Credit Risk",
  "Quantitative Analyst",
  "Risk Engineer",
  "Product Manager",
  "Strategy / Partnerships",
  "Other",
];

const FIELDS = ["name", "email", "company", "role", "useCase"];

// Score threshold to unlock the next field
const UNLOCK_THRESHOLD = 55;

const FIELD_META = {
  name: {
    label: "Full Name",
    placeholder: "Jane Smith",
    tooltip: "Used to personalise your onboarding call.",
    type: "text",
    autoComplete: "name",
  },
  email: {
    label: "Work Email",
    placeholder: "jane@institution.com",
    tooltip: "Institutional addresses only. No personal domains.",
    type: "email",
    autoComplete: "email",
  },
  company: {
    label: "Company",
    placeholder: "Acme Capital",
    tooltip: "Helps us understand your institution's scale and risk profile.",
    type: "text",
    autoComplete: "organization",
  },
  role: {
    label: "Role",
    tooltip:
      "We tailor access tiers by function. CTOs and CROs get priority review.",
    type: "select",
  },
  useCase: {
    label: "Use Case",
    placeholder:
      "Describe the specific risk decision you're trying to automate — loan approval thresholds, early warning signals, portfolio stress testing…",
    tooltip:
      "The more specific, the faster your application moves through review.",
    type: "textarea",
  },
};

// Submit pipeline stages
const SUBMIT_STAGES = [
  { id: "encrypt",  label: "Encrypting submission",        duration: 600  },
  { id: "profile",  label: "Building risk profile",        duration: 900  },
  { id: "score",    label: "Scoring application fit",      duration: 700  },
  { id: "route",    label: "Routing to review queue",      duration: 500  },
  { id: "confirm",  label: "Confirming receipt",           duration: 400  },
];

// ─── Scoring Engine ───────────────────────────────────────────────────────────
// Returns 0–100. Each field has its own scoring heuristics.

function scoreField(field, value) {
  const v = (value || "").trim();
  if (!v) return 0;

  switch (field) {
    case "name": {
      const parts = v.split(/\s+/).filter(Boolean);
      let score = 20;
      if (parts.length >= 2) score += 40;
      if (parts.length >= 2 && parts[0].length > 1) score += 20;
      if (v.length > 5) score += 20;
      return Math.min(score, 100);
    }
    case "email": {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 20;
      const personal = ["gmail", "yahoo", "hotmail", "outlook", "icloud", "proton"];
      const domain = v.split("@")[1]?.split(".")[0]?.toLowerCase();
      if (personal.includes(domain)) return 15;
      const parts = v.split("@");
      let score = 60;
      if (parts[1]?.includes(".")) score += 20;
      if (parts[1]?.split(".").pop()?.length === 2) score += 10; // country TLD
      if (v.length > 15) score += 10;
      return Math.min(score, 100);
    }
    case "company": {
      let score = 30;
      if (v.length > 4) score += 20;
      if (v.length > 8) score += 20;
      if (/\b(capital|fund|bank|credit|risk|financial|asset|investment|advisory|group|partners|holdings)\b/i.test(v)) score += 30;
      return Math.min(score, 100);
    }
    case "role": {
      if (!v) return 0;
      const highValue = ["Chief Risk Officer", "Chief Technology Officer", "Head of Credit Risk", "Quantitative Analyst", "Risk Engineer"];
      return highValue.includes(v) ? 100 : 75;
    }
    case "useCase": {
      const len = v.length;
      if (len < 20) return Math.floor((len / 20) * 25);
      let score = 30;
      if (len >= 30) score += 15;
      if (len >= 60) score += 15;
      if (len >= 100) score += 10;
      const keywords = ["loan", "credit", "risk", "portfolio", "model", "automate", "threshold", "predict", "stress", "default", "approval", "fraud", "scoring", "exposure", "limit"];
      const hits = keywords.filter(k => v.toLowerCase().includes(k)).length;
      score += Math.min(hits * 10, 30);
      return Math.min(score, 100);
    }
    default:
      return v ? 60 : 0;
  }
}

// ─── Hints Engine ────────────────────────────────────────────────────────────
// Pure function — derives a hint string from field + value + score. No state.

function deriveHint(field, value, score) {
  const v = (value || "").trim();

  if (field === "name") {
    if (!v) return null;
    if (v.split(/\s+/).length < 2) return "Add your surname for a stronger signal.";
    if (score >= 80) return "Full name confirmed.";
    return null;
  }

  if (field === "email") {
    if (!v) return null;
    const personal = ["gmail", "yahoo", "hotmail", "outlook", "icloud", "proton"];
    const domain = v.split("@")[1]?.split(".")[0]?.toLowerCase();
    if (domain && personal.includes(domain)) return "⚠ Personal domain detected. Use your work email.";
    if (v.includes("@") && !v.includes(".")) return "Check your domain — missing TLD.";
    if (score >= 80) return "Institutional address verified.";
    return null;
  }

  if (field === "company") {
    if (!v) return null;
    const fin = /\b(capital|fund|bank|credit|risk|financial|asset|investment|advisory|group|partners|holdings)\b/i.test(v);
    if (fin && score >= 70) return "Financial institution recognised.";
    if (v.length < 4) return "Enter the full company name.";
    return null;
  }

  if (field === "role") {
    if (!v) return null;
    const priority = ["Chief Risk Officer", "Chief Technology Officer", "Head of Credit Risk"];
    if (priority.includes(v)) return "Priority review track — your application moves to the front.";
    if (v === "Quantitative Analyst" || v === "Risk Engineer") return "Technical track flagged — deployment timeline will be accelerated.";
    return "Standard review track.";
  }

  if (field === "useCase") {
    if (!v) return null;
    if (v.length < 30) return `${30 - v.length} more characters to meet minimum threshold.`;
    const keywords = ["loan", "credit", "risk", "portfolio", "model", "automate", "threshold", "predict", "stress", "default", "approval", "fraud", "scoring"];
    const hits = keywords.filter(k => v.toLowerCase().includes(k));
    if (hits.length === 0 && v.length < 80) return "Add domain-specific terms (e.g. credit scoring, default prediction) to improve fit score.";
    if (hits.length >= 2 && score >= 75) return `Strong use case — ${hits.slice(0,2).join(", ")} signals detected.`;
    if (score >= 60) return "Use case is clear. More specificity will improve your score.";
    return null;
  }

  return null;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(field, value) {
  const v = (value || "").trim();
  if (!v) return "Required.";
  if (field === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email.";
    const personal = ["gmail", "yahoo", "hotmail", "outlook", "icloud", "proton"];
    const domain = v.split("@")[1]?.split(".")[0]?.toLowerCase();
    if (personal.includes(domain)) return "Use your work email address.";
  }
  if (field === "useCase" && v.length < 30) return "Minimum 30 characters required.";
  return undefined;
}

function validateAll(values) {
  const errors = {};
  FIELDS.forEach((f) => {
    const e = validate(f, values[f]);
    if (e) errors[f] = e;
  });
  return errors;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const initialScores = { name: 0, email: 0, company: 0, role: 0, useCase: 0 };

const initialState = {
  values:       { name: "", email: "", company: "", role: "", useCase: "" },
  errors:       {},
  touched:      {},
  scores:       initialScores,
  unlockedUpTo: 0, // index into FIELDS — which field is currently unlocked
  status:       "idle", // idle | submitting | success | error
  submitStage:  -1,     // index into SUBMIT_STAGES
  activeField:  0,
};

function reducer(state, action) {
  switch (action.type) {
    case "CHANGE":
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: undefined },
      };

    case "UPDATE_SCORE": {
      const newScores = { ...state.scores, [action.field]: action.score };
      // Unlock next field if current score crosses threshold
      const idx = FIELDS.indexOf(action.field);
      const newUnlocked = action.score >= UNLOCK_THRESHOLD
        ? Math.max(state.unlockedUpTo, idx + 1)
        : state.unlockedUpTo;
      return { ...state, scores: newScores, unlockedUpTo: Math.min(newUnlocked, FIELDS.length - 1) };
    }

    case "BLUR":
      return {
        ...state,
        touched: { ...state.touched, [action.field]: true },
        errors:  { ...state.errors,  [action.field]: validate(action.field, state.values[action.field]) },
      };

    case "SET_ACTIVE":
      return { ...state, activeField: action.index };

    case "SUBMIT_START":
      return {
        ...state,
        status:      "submitting",
        submitStage: 0,
        touched:     Object.fromEntries(FIELDS.map((f) => [f, true])),
      };

    case "NEXT_STAGE":
      return { ...state, submitStage: action.stage };

    case "SUBMIT_ERRORS":
      return { ...state, status: "idle", submitStage: -1, errors: action.errors };

    case "SUBMIT_SUCCESS":
      return { ...state, status: "success", submitStage: SUBMIT_STAGES.length };

    case "SUBMIT_FAIL":
      return { ...state, status: "error", submitStage: -1 };

    default:
      return state;
  }
}

// ─── Profile Synthesiser ─────────────────────────────────────────────────────
// Builds a 1-line AI "assessment" from the form values. Pure derivation.

function synthesiseProfile(values, scores) {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const avg = total / FIELDS.length;
  if (avg < 20) return null;

  const role = values.role;
  const company = values.company.trim();
  const tier = avg >= 80 ? "Priority" : avg >= 60 ? "Standard" : "Review";

  if (!role || !company) return null;

  const roleShort = role.replace("Chief ", "").replace("Head of ", "");
  return `${tier} track · ${roleShort}${company ? ` @ ${company}` : ""}`;
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

const ScoreBar = memo(function ScoreBar({ score, active }) {
  const tier =
    score >= 80 ? "high" :
    score >= 55 ? "mid"  :
    score >= 25 ? "low"  : "zero";

  return (
    <div className={`${styles.scoreBar} ${active ? styles.scoreBarActive : ""}`} aria-hidden="true">
      <div
        className={`${styles.scoreBarFill} ${styles[`scoreBarFill_${tier}`]}`}
        style={{ width: `${score}%` }}
      />
      {score > 0 && (
        <span className={styles.scoreNum}>{score}</span>
      )}
    </div>
  );
});

const HintLine = memo(function HintLine({ text }) {
  if (!text) return null;
  return (
    <p className={styles.hint} role="status" aria-live="polite">
      <span className={styles.hintIcon} aria-hidden="true">◈</span>
      {text}
    </p>
  );
});

const ErrorMsg = memo(function ErrorMsg({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className={styles.errorMsg} role="alert">
      {message}
    </p>
  );
});

const FieldLock = memo(function FieldLock() {
  return (
    <div className={styles.fieldLock} aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none">
        <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
      <span>Complete previous field to unlock</span>
    </div>
  );
});

// Overall fit score panel
const FitScore = memo(function FitScore({ scores, values }) {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const avg = Math.round(total / FIELDS.length);
  const profile = synthesiseProfile(values, scores);
  const completed = FIELDS.filter(f => scores[f] >= UNLOCK_THRESHOLD).length;

  return (
    <div className={styles.fitPanel}>
      <div className={styles.fitHeader}>
        <span className={styles.fitLabel}>APPLICATION SCORE</span>
        <span className={styles.fitNum} style={{ color: avg >= 70 ? "var(--color-accent)" : avg >= 40 ? "var(--color-warn)" : "var(--color-text-faint)" }}>
          {avg}
        </span>
      </div>
      <div className={styles.fitTrack}>
        <div className={styles.fitFill} style={{ width: `${avg}%` }} />
      </div>
      <div className={styles.fitMeta}>
        {profile
          ? <span className={styles.fitProfile}>{profile}</span>
          : <span className={styles.fitProfileEmpty}>Profile building…</span>
        }
        <span className={styles.fitCompleted}>{completed}/{FIELDS.length} verified</span>
      </div>
    </div>
  );
});

// Multi-stage submit overlay
const SubmitOverlay = memo(function SubmitOverlay({ stage, values, scores }) {
  const profile = synthesiseProfile(values, scores);
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const avg = Math.round(total / FIELDS.length);

  return (
    <div className={styles.submitOverlay}>
      <div className={styles.submitOverlayInner}>
        <div className={styles.submitPipeline}>
          {SUBMIT_STAGES.map((s, i) => {
            const state =
              i < stage  ? "done"    :
              i === stage ? "active"  : "pending";
            return (
              <div key={s.id} className={`${styles.pipelineStep} ${styles[`pipelineStep_${state}`]}`}>
                <div className={styles.pipelineIcon}>
                  {state === "done" ? (
                    <svg viewBox="0 0 16 16" fill="none">
                      <polyline points="3 8 6.5 11.5 13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  ) : state === "active" ? (
                    <span className={styles.pipelineSpinner} />
                  ) : (
                    <span className={styles.pipelineDot} />
                  )}
                </div>
                <span className={styles.pipelineLabel}>{s.label}</span>
                {state === "active" && <span className={styles.pipelinePulse} />}
              </div>
            );
          })}
        </div>

        {stage >= 2 && (
          <div className={styles.submitCard}>
            <div className={styles.submitCardRow}>
              <span className={styles.submitCardKey}>Applicant</span>
              <span className={styles.submitCardVal}>{values.name || "—"}</span>
            </div>
            <div className={styles.submitCardRow}>
              <span className={styles.submitCardKey}>Institution</span>
              <span className={styles.submitCardVal}>{values.company || "—"}</span>
            </div>
            <div className={styles.submitCardRow}>
              <span className={styles.submitCardKey}>Role</span>
              <span className={styles.submitCardVal}>{values.role || "—"}</span>
            </div>
            <div className={styles.submitCardRow}>
              <span className={styles.submitCardKey}>Fit Score</span>
              <span className={styles.submitCardVal} style={{ color: avg >= 70 ? "var(--color-accent)" : "var(--color-warn)" }}>
                {avg} / 100
              </span>
            </div>
            {profile && (
              <div className={styles.submitCardProfile}>{profile}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RequestAccess() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { values, errors, touched, scores, unlockedUpTo, status, submitStage, activeField } = state;
  const formRef = useRef(null);
  const scoreTimers = useRef({});

  // ── Debounced score update ──────────────────────────────────────────────────
  const scheduleScore = useCallback((field, value) => {
    clearTimeout(scoreTimers.current[field]);
    scoreTimers.current[field] = setTimeout(() => {
      const score = scoreField(field, value);
      dispatch({ type: "UPDATE_SCORE", field, score });
    }, 180);
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    dispatch({ type: "CHANGE", field: name, value });
    scheduleScore(name, value);
  }, [scheduleScore]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    dispatch({ type: "BLUR", field: name });
  }, []);

  const handleFocus = useCallback((e) => {
    const idx = FIELDS.indexOf(e.target.name);
    if (idx >= 0) dispatch({ type: "SET_ACTIVE", index: idx });
  }, []);

  // ── Submit sequencer ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const allErrors = validateAll(values);
    if (Object.keys(allErrors).length > 0) {
      dispatch({ type: "SUBMIT_ERRORS", errors: allErrors });
      const firstErr = FIELDS.find((f) => allErrors[f]);
      if (firstErr) {
        formRef.current?.querySelector(`[name="${firstErr}"]`)?.focus();
      }
      return;
    }

    dispatch({ type: "SUBMIT_START" });

    try {
      // Run each stage sequentially
      for (let i = 0; i < SUBMIT_STAGES.length; i++) {
        dispatch({ type: "NEXT_STAGE", stage: i });
        await new Promise((r) => setTimeout(r, SUBMIT_STAGES[i].duration));
      }
      // Real API call would go here:
      // await fetch("/api/request-access", { method: "POST", body: JSON.stringify(values) });
      dispatch({ type: "SUBMIT_SUCCESS" });
    } catch {
      dispatch({ type: "SUBMIT_FAIL" });
    }
  }, [values]);

  // Derived
  const overallScore = useMemo(() => {
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    return Math.round(total / FIELDS.length);
  }, [scores]);

  // ── Success State ────────────────────────────────────────────────────────────
  if (status === "success") {
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const avg = Math.round(total / FIELDS.length);
    const tier = avg >= 80 ? "Priority" : avg >= 60 ? "Standard" : "Extended";

    return (
      <div className={styles.page}>
        <BackgroundGrid />
        <div className={`${styles.successWrap}`}>
          <div className={styles.successScan} aria-hidden="true" />
          <div className={styles.successCheck}>
            <svg viewBox="0 0 24 24" fill="none">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className={styles.successEyebrow}>Application #{Math.floor(Math.random() * 9000) + 1000} received</p>
          <h1 className={styles.successHeading}>You're in the queue.</h1>
          <p className={styles.successBody}>
            Our review team will assess your application within <strong>48 hours</strong>.
            Based on your fit score of <strong>{avg}</strong>, you've been assigned to the{" "}
            <strong>{tier} Review</strong> track.
          </p>
          <div className={styles.successStats}>
            <div className={styles.successStat}>
              <span className={styles.successStatNum}>{avg}</span>
              <span className={styles.successStatLabel}>Fit score</span>
            </div>
            <div className={styles.successStatDivider} />
            <div className={styles.successStat}>
              <span className={styles.successStatNum}>{tier}</span>
              <span className={styles.successStatLabel}>Review track</span>
            </div>
            <div className={styles.successStatDivider} />
            <div className={styles.successStat}>
              <span className={styles.successStatNum}>48h</span>
              <span className={styles.successStatLabel}>Review SLA</span>
            </div>
          </div>
          <p className={styles.successNote}>No follow-up needed — we'll reach out directly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <BackgroundGrid />

      {/* Submit overlay */}
      {status === "submitting" && (
        <SubmitOverlay stage={submitStage} values={values} scores={scores} />
      )}

      <div className={styles.container}>

        {/* Left aside */}
        <aside className={styles.aside}>
          <div className={styles.asideInner}>
            <div className={styles.asideBadge}>
              <span className={styles.asideDot} />
              AI-Evaluated Access
            </div>
            <h2 className={styles.asideHeading}>
              Built for institutions.<br />Not everyone qualifies.
            </h2>
            <p className={styles.asideBody}>
              Intervenix evaluates every application in real time. Your responses
              are scored for institutional fit, use-case clarity, and deployment
              readiness.
            </p>

            <FitScore scores={scores} values={values} />

            <ul className={styles.asideList}>
              {[
                "48-hour review SLA",
                "Dedicated onboarding call",
                "SOC 2 Type II · ISO 27001",
                "No credit card required",
              ].map((item) => (
                <li key={item} className={styles.asideListItem}>
                  <span className={styles.asideCheck} aria-hidden="true">—</span>
                  {item}
                </li>
              ))}
            </ul>

            {/* Per-field score breakdown */}
            <div className={styles.scoreBreakdown}>
              <p className={styles.scoreBreakdownLabel}>Signal Breakdown</p>
              {FIELDS.map((f, i) => (
                <div key={f} className={styles.scoreBreakdownRow}>
                  <span className={styles.scoreBreakdownField}>{FIELD_META[f].label}</span>
                  <ScoreBar score={scores[f]} active={activeField === i} />
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Right: form */}
        <main className={styles.formCol}>
          <div className={styles.formHeader}>
            <p className={styles.formStep}>Request Access — Oracle Evaluation</p>
            <h1 className={styles.formHeading}>Apply for early access</h1>
            <p className={styles.formSubtitle}>
              Each field is scored. Score ≥ 55 to unlock the next.
            </p>
          </div>

          <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>

            {FIELDS.map((field, idx) => {
              const meta = FIELD_META[field];
              const isUnlocked = idx <= unlockedUpTo;
              const isLocked = !isUnlocked;
              const score = scores[field];
              const error = touched[field] && errors[field];
              const hint = isUnlocked ? deriveHint(field, values[field], score) : null;
              const isActive = activeField === idx;

              const inputClass = [
                meta.type === "textarea" ? styles.textarea :
                meta.type === "select"   ? styles.select   : styles.input,
                touched[field] && errors[field]                   ? styles.inputError : "",
                touched[field] && !errors[field] && values[field] ? styles.inputValid : "",
                isLocked ? styles.inputLocked : "",
              ].filter(Boolean).join(" ");

              return (
                <div
                  key={field}
                  className={`${styles.fieldGroup} ${isLocked ? styles.fieldGroupLocked : ""} ${isActive ? styles.fieldGroupActive : ""}`}
                >
                  <div className={styles.fieldHeaderRow}>
                    <label className={styles.label} htmlFor={field}>
                      {meta.label}
                    </label>
                    {isUnlocked && (
                      <ScoreBar score={score} active={isActive} />
                    )}
                  </div>

                  {isLocked ? (
                    <FieldLock />
                  ) : meta.type === "select" ? (
                    <div className={styles.selectWrap}>
                      <select
                        id={field}
                        name={field}
                        className={`${inputClass} ${!values[field] ? styles.selectPlaceholder : ""}`}
                        value={values[field]}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        onFocus={handleFocus}
                        disabled={status === "submitting"}
                        aria-describedby={error ? `${field}-error` : undefined}
                      >
                        <option value="" disabled>Select role</option>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <span className={styles.selectArrow} aria-hidden="true">↓</span>
                    </div>
                  ) : meta.type === "textarea" ? (
                    <div className={styles.textareaWrap}>
                      <textarea
                        id={field}
                        name={field}
                        className={inputClass}
                        placeholder={meta.placeholder}
                        value={values[field]}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        onFocus={handleFocus}
                        rows={4}
                        disabled={status === "submitting"}
                        aria-describedby={error ? `${field}-error` : undefined}
                      />
                      <div className={styles.textareaFooter}>
                        <ErrorMsg id={`${field}-error`} message={error} />
                        <span className={`${styles.charCount} ${values[field].length >= 30 ? styles.charCountOk : ""}`}>
                          {values[field].length} / 30 min
                        </span>
                      </div>
                    </div>
                  ) : (
                    <input
                      id={field}
                      name={field}
                      type={meta.type}
                      autoComplete={meta.autoComplete}
                      className={inputClass}
                      placeholder={meta.placeholder}
                      value={values[field]}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      onFocus={handleFocus}
                      disabled={status === "submitting"}
                      aria-describedby={error ? `${field}-error` : undefined}
                    />
                  )}

                  {/* Error and hint below input (not textarea — has own footer) */}
                  {meta.type !== "textarea" && (
                    <>
                      <ErrorMsg id={`${field}-error`} message={error} />
                      <HintLine text={hint} />
                    </>
                  )}
                  {meta.type === "textarea" && hint && (
                    <HintLine text={hint} />
                  )}
                </div>
              );
            })}

            {/* Submit */}
            <button
              type="submit"
              className={`${styles.submitBtn} ${status === "submitting" ? styles.submitBtnLoading : ""}`}
              disabled={status === "submitting" || overallScore < 10}
              aria-label="Submit access request"
            >
              <span className={styles.submitBtnText}>Submit Application</span>
              <span className={styles.submitBtnScore}>
                Score: {overallScore}
              </span>
              <span className={styles.submitArrow} aria-hidden="true">→</span>
            </button>

            {status === "error" && (
              <p className={styles.globalError} role="alert">
                Submission failed. Please try again or contact us directly.
              </p>
            )}

            <p className={styles.formDisclaimer}>
              By submitting, you agree to our{" "}
              <a href="/privacy" className={styles.disclaimerLink}>Privacy Policy</a>.
              We do not share your information.
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}

// ─── Background ───────────────────────────────────────────────────────────────

function BackgroundGrid() {
  return (
    <div className={styles.bgGrid} aria-hidden="true">
      <div className={styles.bgGlow} />
      <div className={styles.bgScanline} />
    </div>
  );
}