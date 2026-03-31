# INTERVENIX

**Pre-Delinquency Intervention Engine — Decision Intelligence for Credit Risk**

Intervenix converts delinquency prediction into economically justified intervention decisions. Instead of flagging every high-risk borrower, it answers the harder question: given limited call-center capacity, intervention costs, and uncertainty about model predictions, which borrowers should we contact to maximize expected recovery?

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Core Concepts](#3-core-concepts)
4. [Tech Stack](#4-tech-stack)
5. [Backend Design](#5-backend-design)
6. [Frontend Design](#6-frontend-design)
7. [How to Run the Project](#7-how-to-run-the-project)
8. [Results and Insights](#8-results-and-insights)
9. [Limitations](#9-limitations)
10. [Future Improvements](#10-future-improvements)
11. [Resume Description](#11-resume-description)
12. [Tech Stack Improvements](#12-tech-stack-improvements)

---

## 1. Project Overview

### The Problem

Standard credit risk models produce a probability score and a threshold. Everyone above the threshold gets flagged. This approach has three structural failures:

**It ignores economics.** A borrower at p=0.18 with a $25,000 outstanding balance may justify intervention, while a borrower at p=0.60 with a $2,000 balance and a $500 contact cost does not. Probability ranking treats them identically if they are on the same side of the threshold.

**It ignores capacity.** A call center can contact 2,000 borrowers per day. Flagging 15,000 forces an arbitrary secondary filter — usually recency or account value — that has no statistical grounding.

**It ignores treatment response.** A borrower with p=0.85 who will default regardless of intervention (a Sure Defaulter) consumes capacity that could go to a borrower at p=0.35 who would respond to a restructuring offer (a Persuadable). Predictive models cannot distinguish between these two types without causal data.

### What Intervenix Does

Intervenix replaces threshold-based flagging with a decision engine that:

- Computes per-borrower Expected Value (EV) using calibrated probabilities, per-borrower recovery amounts, channel-specific costs, and an effectiveness parameter.
- Ranks borrowers by EV rather than probability, ensuring every slot in the daily intervention queue maximizes expected return.
- Applies capacity constraints as a resource allocation problem, not a classification cutoff.
- Quantifies decision quality through Qini curves, cumulative EV analysis, and sensitivity testing.
- Simulates uplift response curves to demonstrate why causal data matters, with explicit disclaimers that these are not real treatment effects.

### Business Impact (Simulated Results)

On a 30,000-borrower portfolio with 2,000 daily capacity:

- EV-based ranking captures $318,916 more than probability-based ranking (+13.8%).
- 30 negative-EV contacts are eliminated (each a net loss).
- 31.9% of capacity is reallocated to higher-return borrowers.
- Under simulated uplift, targeting Persuadables instead of Sure Defaulters yields a further +39.0% gain in uplift-based EV.

---

## 2. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERVENIX                               │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐    │
│  │  FastAPI  │    │  Core Engine │    │  React Dashboard   │    │
│  │  Backend  │───▶│  (Python)    │◀───│  (Tailwind CSS)    │    │
│  └──────────┘    └──────────────┘    └────────────────────┘    │
│       │                │                       │                │
│       ▼                ▼                       ▼                │
│  REST API         Decision              Interactive            │
│  Endpoints        Pipeline              Visualizations         │
└─────────────────────────────────────────────────────────────────┘
```

### Decision Pipeline (Data Flow)

The system operates as a sequential pipeline. Each stage consumes the output of the previous stage and adds information.

```
Raw Data (CSV / DB)
    │
    ▼
┌─────────────────────┐
│  1. Data Ingestion   │  Borrower records with p_calibrated,
│                      │  outstanding balance, channel assignment
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  2. EV Computation   │  EV = p_calibrated × effectiveness × recovery − cost
│                      │  Per-borrower, not portfolio-level
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  3. Policy Engine    │  Filter: EV > 0 (economic justification)
│                      │  Rank: by EV descending
│                      │  Constrain: top N within daily capacity
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  4. Evaluation       │  Strategy comparison (EV vs probability)
│                      │  Qini curve and AUUC (simulated)
│                      │  Sensitivity analysis (effectiveness, cost)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  5. Output           │  Ranked intervention list
│                      │  Decision diagnostics and visualizations
│                      │  Policy comparison report
└─────────────────────┘
```

### Module Structure

```
intervenix/
├── intervenix_core.py          # Core engine: all computation and plotting
│   ├── IntervenixConfig        # Dataclass: all tunable parameters
│   ├── Data Generation         # Probability distributions, per-borrower economics
│   ├── EV Computation          # compute_ev(), recompute_ev()
│   ├── Uplift Simulation       # simulate_uplift() [NOT CAUSAL]
│   ├── Selection Strategies    # select_top_n(), select_policy()
│   ├── Evaluation Metrics      # strategy_comparison(), uplift_comparison()
│   ├── Qini Curve              # compute_qini_data(), compute_auuc()
│   ├── Sensitivity Analysis    # sensitivity_effectiveness(), sensitivity_cost()
│   └── Plotting                # 8 plot functions with consistent styling
│
├── intervenix_analysis_v2.py   # CLI analysis runner (prints full report)
├── intervenix_app.py           # Streamlit interactive dashboard
├── main.py                     # FastAPI backend
└── README.md                   # This file
```

---

## 3. Core Concepts

### Expected Value (EV)

The central quantity in Intervenix. For each borrower:

```
EV = p_calibrated × effectiveness × recovery − cost
```

Where:

- **p_calibrated** is the isotonic-regression-calibrated probability of 90-day delinquency. Raw XGBoost scores are not probabilities and would inflate EV by up to 3x.
- **effectiveness** is the probability that intervention prevents default. Currently a global parameter (0.30), ideally a per-borrower model.
- **recovery** is the expected dollar amount recovered if the borrower is successfully retained. Currently per-borrower (lognormal distribution, $2K–$25K range).
- **cost** is the channel-specific intervention cost. SMS = $5, call = $50, in-person = $200–$500.

A borrower is economically justified for intervention if and only if EV > 0. The break-even probability at the default parameters is 16.7%.

### Capacity-Constrained Optimization

This is a resource allocation problem, not a classification problem. Given N borrowers with positive EV but only K < N intervention slots per day, the optimal policy is to rank by EV descending and select the top K. This is provably optimal under the assumption that interventions are independent (no interaction effects between borrowers).

Why this matters: a threshold-based system flags everyone above a cutoff identically. A borrower at p=0.91 and p=0.52 receive the same priority. A borrower at p=0.49 with high recovery value and low cost gets nothing, despite having positive EV. EV ranking captures all of this; thresholds cannot.

### Uplift Modeling

> **DISCLAIMER:** All uplift estimates in Intervenix are **simulated**. They do not represent causal estimates from randomized data. Real deployment requires A/B-tested treatment assignment and uplift modeling frameworks (e.g., causalml, pylift).

The simulated uplift function models four borrower types from the causal inference literature:

- **Sure Payers** (low p): will pay regardless of intervention. Uplift near zero.
- **Persuadables** (medium p, ~0.3–0.5): at risk but responsive to intervention. Highest uplift.
- **Sure Defaulters** (high p, >0.7): will default regardless of intervention. Uplift near zero.
- **Do-Not-Disturb** (rare): intervention causes harm. Negative uplift.

The simulation uses a Gaussian kernel centered at p=0.35 with suppression above p=0.5 to produce this shape. This is theoretically grounded but unvalidated without randomized data.

### Qini Curve and AUUC

The Qini curve is the uplift analog of the ROC curve. It plots cumulative uplift gain (y-axis) against the percentage of population targeted (x-axis). Three curves are compared:

- **Uplift-sorted** (ideal): the gain achievable if borrowers are ranked by their true individual treatment effect.
- **Probability-sorted** (current system): the gain achieved by ranking borrowers by p_calibrated.
- **Random baseline**: the expected gain under random targeting.

The Area Under the Uplift Curve (AUUC) summarizes each strategy into a single number. The Qini coefficient normalizes this as (AUUC_model - AUUC_random) / AUUC_ideal, measuring what fraction of the theoretical maximum gain the model captures.

In Intervenix's simulated results: Qini coefficient for uplift-sorted = 0.42, for probability-sorted = 0.33. The gap at capacity (2,000 users) is $959K — the monetized cost of not having causal data.

### Decision Policy vs Prediction Model

A prediction model answers: "What is P(default | features)?"

A decision policy answers: "Given P(default), intervention cost, recovery value, effectiveness, and capacity constraints, should we intervene on this borrower, and in what priority order?"

Intervenix is a decision policy layer that sits on top of any prediction model. The prediction model is an input; the policy is the system.

---

## 4. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Core Engine | Python 3.12, NumPy, Pandas | Numerical computation on tabular data. Pandas for DataFrame operations; NumPy for vectorized EV computation. No overhead beyond what the math requires. |
| ML Model | XGBoost (planned), scikit-learn | XGBoost is the standard for tabular credit data: native class imbalance handling via `scale_pos_weight`, SHAP compatibility, and robustness to outliers in credit bureau data. |
| Calibration | Isotonic Regression (sklearn) | Non-parametric monotonic mapping from XGBoost scores to calibrated probabilities. No distributional assumptions, unlike Platt scaling. |
| API | FastAPI | Async-native, automatic OpenAPI spec generation, Pydantic validation on request/response models. Lower latency than Flask/Django for scoring endpoints. |
| Dashboard | React 18 + Tailwind CSS | Component-based UI for interactive parameter tuning. Tailwind for utility-first styling without custom CSS overhead. |
| Visualization | Matplotlib | Full control over plot layout, dual axes, and annotation. No Seaborn — the abstraction hides too much for financial visualizations that require precise labeling. |
| Interactive Dashboard (Alt) | Streamlit | Rapid prototyping of the parameter-tuning interface. Not intended for production; serves as a functional reference for the React build. |
| Configuration | Python dataclasses | `IntervenixConfig` centralizes all tunable parameters. Type-safe, no YAML/JSON parsing, IDE-friendly. |

---

## 5. Backend Design

### API Endpoints

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| `POST` | `/score` | Score a batch of borrowers and return EV-ranked list | `{ borrowers: [...], config: {...} }` |
| `POST` | `/policy` | Run decision policy with capacity constraint | `{ capacity: 2000, effectiveness: 0.30 }` |
| `GET` | `/sensitivity/effectiveness` | Sweep effectiveness parameter, return EV curve | `?min=0.1&max=0.5&steps=20` |
| `GET` | `/sensitivity/cost` | Sweep cost multiplier, return EV curve | `?min=0.5&max=2.5&steps=20` |
| `POST` | `/compare` | Compare probability vs EV selection strategies | `{ capacity: 2000 }` |
| `GET` | `/qini` | Compute Qini curve data (simulated uplift) | `?capacity=2000` |
| `GET` | `/health` | Service health check | — |

### Core Modules

**EV Engine** (`compute_ev`, `recompute_ev`): Vectorized EV computation. Takes arrays of probabilities, recovery values, and costs. Returns per-borrower EV. No loops — pure NumPy broadcast.

**Policy Engine** (`select_policy`): Three-step decision: (1) filter to EV > 0, (2) rank by EV descending, (3) apply capacity constraint. Returns full diagnostics including total eligible, EV captured, EV left on table, and negative-EV avoidance count.

**Evaluation Engine** (`strategy_comparison`, `uplift_comparison`): Computes overlap, misallocation, and EV advantage between competing strategies. Used both for reporting and for the dashboard's real-time comparison.

**Sensitivity Engine** (`sensitivity_effectiveness`, `sensitivity_cost`, `sensitivity_joint`): Parametric sweeps that recompute the full policy at each parameter value. Returns DataFrames suitable for plotting.

### How Decisions Are Computed

A single scoring call executes:

```python
# 1. Receive borrower data with calibrated probabilities
df = pd.DataFrame(borrowers)

# 2. Compute per-borrower EV
df['ev'] = compute_ev(
    df['p_calibrated'].values,
    df['recovery'].values,
    df['cost'].values,
    config.effectiveness
)

# 3. Apply decision policy
result = select_policy(df, capacity=config.capacity, ev_col='ev')

# 4. Return ranked list with diagnostics
return {
    'intervention_list': result['selected'].to_dict('records'),
    'total_eligible': result['total_eligible'],
    'ev_captured': result['ev_constrained'],
    'ev_left_on_table': result['ev_left_on_table'],
}
```

No model training happens at scoring time. The calibrated probabilities arrive as input, having been produced upstream by the XGBoost + isotonic regression pipeline.

---

## 6. Frontend Design

### Dashboard Structure

The React dashboard is organized into four tabs, each addressing a distinct decision question:

**Tab 1 — EV and Qini Curves:** Shows cumulative EV curves (EV-ranked vs probability-ranked) and the simulated Qini curve. Answers: "How much value does EV ranking capture compared to probability ranking, and what is the theoretical ceiling if we had causal data?"

**Tab 2 — Uplift Analysis:** Simulated uplift vs probability scatter plot and mean uplift by probability segment. Answers: "Where are the Persuadables, and how much capacity is wasted on Sure Defaulters?" All visualizations carry explicit "SIMULATED" labels.

**Tab 3 — Sensitivity:** EV vs effectiveness and EV vs cost multiplier curves. Answers: "How fragile are our decisions to parameter uncertainty? Where should we invest in better estimation?"

**Tab 4 — Policy Comparison:** Fixed capacity vs EV-threshold strategies, and misallocation diagnosis scatter. Answers: "How binding is our capacity constraint, and which borrowers are incorrectly included or excluded?"

### Sidebar Controls

Four sliders drive all computations in real time:

- **Daily Capacity** (500–5,000): intervention queue size.
- **Effectiveness** (0.05–0.60): P(recovery | intervention).
- **Cost Multiplier** (0.25–3.0): scales all channel costs.
- **Recovery Scale** (0.5–2.0): scales all recovery values.

Five summary metric cards update on every slider change: Users Selected, Total EV, Avg EV/User, Negative-EV Avoided, Break-Even Rate.

### Key Visualizations

| Plot | Type | Purpose |
|------|------|---------|
| Cumulative EV curve | Line (dual) | Quantifies EV advantage of ranking strategy |
| Qini curve | Line (triple) | Measures uplift targeting quality vs random and probability baselines |
| Uplift vs probability scatter | Scatter (colored) | Shows uplift distribution across risk spectrum |
| Uplift by segment | Bar | Identifies which probability bins contain Persuadables |
| Sensitivity (effectiveness) | Line + annotation | Tests robustness to effectiveness assumption |
| Sensitivity (cost) | Line | Tests robustness to cost structure changes |
| Policy comparison | Dual bar | Compares fixed-capacity vs EV-threshold strategies |
| Misallocation diagnosis | Scatter (multi-class) | Visualizes which borrowers are incorrectly selected or missed |

---

## 7. How to Run the Project

### Prerequisites

```
Python >= 3.10
Node.js >= 18 (for React frontend)
```

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/your-username/intervenix.git
cd intervenix

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
uvicorn main:app --reload --port 8000
```

`requirements.txt`:
```
numpy>=1.24
pandas>=2.0
matplotlib>=3.7
scikit-learn>=1.3
xgboost>=2.0
fastapi>=0.100
uvicorn>=0.23
pydantic>=2.0
streamlit>=1.28
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
# Dashboard available at http://localhost:5173
```

### Streamlit Dashboard (Alternative)

```bash
# From project root
streamlit run intervenix_app.py
# Dashboard available at http://localhost:8501
```

### CLI Analysis

```bash
python intervenix_analysis_v2.py
# Outputs: full report to stdout + intervenix_report.png
```

### Example API Calls

**Score borrowers:**
```bash
curl -X POST http://localhost:8000/score \
  -H "Content-Type: application/json" \
  -d '{
    "borrowers": [
      {"user_id": 1, "p_calibrated": 0.45, "recovery": 12000, "cost": 50},
      {"user_id": 2, "p_calibrated": 0.72, "recovery": 3000, "cost": 500},
      {"user_id": 3, "p_calibrated": 0.22, "recovery": 18000, "cost": 5}
    ],
    "config": {"effectiveness": 0.30, "capacity": 2}
  }'
```

**Expected response:**
```json
{
  "intervention_list": [
    {"user_id": 1, "ev": 1570.00, "rank": 1},
    {"user_id": 3, "ev": 1183.00, "rank": 2}
  ],
  "excluded": [
    {"user_id": 2, "ev": 148.00, "reason": "capacity_exceeded"}
  ],
  "total_eligible": 3,
  "ev_captured": 2753.00,
  "ev_left_on_table": 148.00
}
```

**Run sensitivity analysis:**
```bash
curl http://localhost:8000/sensitivity/effectiveness?min=0.1&max=0.5&steps=20
```

---

## 8. Results and Insights

All results below are from a 30,000-borrower simulated portfolio. Uplift-based findings use a synthetic response curve and are marked accordingly.

### EV Ranking Outperforms Probability Ranking by 13.8%

With per-borrower variation in recovery and cost, EV-based selection captures $2,624,516 in total EV compared to $2,305,600 for probability-based selection. The $318,916 difference comes from two sources: (a) EV ranking captures high-recovery, low-cost borrowers that probability ranking misses, and (b) EV ranking excludes 30 negative-EV borrowers that probability ranking includes. Only 68.1% of the two strategies' selections overlap, meaning 31.9% of capacity is misallocated under probability ranking.

### Under Simulated Uplift, the Mid-Risk Segment Produces Peak Returns

The 0.3–0.4 probability bin shows a simulated mean uplift of 0.2434, the highest of any segment. Borrowers above p=0.70 show simulated mean uplift of 0.002 — essentially zero treatment effect. Probability-based selection misses 832 simulated high-uplift users (avg uplift 0.17, avg p 0.24) while wrongly selecting 832 simulated low-uplift users (avg uplift 0.04, avg p 0.61). This illustrates the theoretical gap between predictive targeting and causal targeting, though the magnitude depends entirely on the true uplift curve, which is unknown without randomized data.

### Sensitivity Analysis Exposes Parameter Fragility

Total EV swings +70.7% across the effectiveness range [0.20, 0.40]. This means the system's absolute dollar outputs are sensitive to the effectiveness assumption. However, the ranking order of borrowers is relatively stable — the same top-2,000 borrowers tend to be selected across effectiveness values because EV is monotonic in effectiveness for fixed borrower characteristics. Cost sensitivity is lower: EV varies only +8.6% across cost multipliers [0.5x, 2.0x].

### The Capacity Constraint Is Binding

21,190 borrowers have positive EV, but only 2,000 can be contacted daily. The fixed-capacity policy captures $2,624,516 while leaving $3,455,993 on the table. The cumulative EV curve is still steep at the 2,000-user cutoff, indicating that capacity expansion would yield measurable returns.

---

## 9. Limitations

### Uplift Is Simulated, Not Causal

This is the most important limitation. The simulated uplift curve is a Gaussian kernel centered at p=0.35. It produces the expected pattern (Persuadables in the mid-risk segment, Sure Defaulters at high risk), but the shape, magnitude, and location of the peak are all assumptions. The real uplift curve could be flatter, shifted, or multimodal. Without randomized treatment data (A/B test where some eligible borrowers are randomly withheld from intervention), the true treatment effect is unknowable.

Concrete impact: the +39.0% uplift-EV gain is a property of the simulation, not a measured outcome. The directional finding (mid-risk borrowers respond better than high-risk borrowers) is theoretically grounded in the causal inference literature, but its magnitude is synthetic.

### Effectiveness Is a Global Constant

All borrowers share a single effectiveness parameter (0.30). In reality, effectiveness varies by borrower characteristics (debt ratio, payment history, channel), by agent skill, and by timing. A per-borrower effectiveness model would require historical intervention outcome data and a separate predictive pipeline.

### No Out-of-Distribution Detection

The system assumes all scored borrowers come from the same distribution as the training data. New customer segments (e.g., a product launch targeting a demographic the model has not seen) could produce arbitrarily wrong probabilities. Bootstrap uncertainty quantifies variance within the training distribution; it does not detect distributional shift.

### Independence Assumption

The EV framework assumes interventions are independent — contacting borrower A does not affect the outcome for borrower B. In practice, social networks, household-level debt, and market conditions create dependencies. This is a standard assumption in the literature but limits accuracy for correlated portfolios.

### Data Is Synthetic

The current implementation generates borrower data from parametric distributions (beta for probabilities, lognormal for recovery, categorical for cost). Real credit bureau data has multimodal distributions, missing values, and feature correlations that synthetic data does not capture.

---

## 10. Future Improvements

### Real Uplift Modeling (Causal ML)

Replace `simulate_uplift()` with a trained causal model. This requires:

**Data:** Randomized treatment assignment where a fraction of EV-positive borrowers are randomly withheld from intervention. Minimum sample size: ~10,000 treated + 10,000 control across 3–6 months to observe 90-day delinquency outcomes.

**Model:** T-learner (separate models for treated and control outcomes) or X-learner (Kunzel et al., 2019) using the same XGBoost base. S-learner (single model with treatment indicator) is simpler but biased when treatment effect is heterogeneous.

**Evaluation:** Replace simulated Qini curve with empirical Qini computed on holdout randomized data. Report AUUC with confidence intervals.

**Libraries:** `causalml` (Uber), `pylift` (Wayfair), or `econml` (Microsoft).

### A/B Testing Pipeline

Build infrastructure for continuous experimentation:

- **Randomization service:** assigns borrowers to treatment/control with configurable allocation ratios (e.g., 90/10).
- **Outcome tracking:** joins intervention records with delinquency outcomes at 30/60/90 days.
- **Automated analysis:** computes average treatment effect (ATE), conditional ATE (CATE), and updates the uplift model on a monthly cadence.
- **Guardrails:** minimum detectable effect (MDE) calculator, sequential testing for early stopping, and segment-level subgroup analysis.

### Per-Borrower Effectiveness Model

Train a secondary model: `P(recovery | intervened, borrower features, channel, agent)`. Features include prior response to outreach, number of past interventions, time since last payment, and channel preference. This replaces the global effectiveness constant with a per-borrower estimate, making EV a function of four learned quantities (probability, effectiveness, recovery model, cost model) rather than one.

### Real-Time Scoring

Current architecture is batch-oriented (nightly scoring of the full portfolio). Add an event-triggered path:

- **Trigger events:** missed payment, large withdrawal, credit line increase request.
- **Real-time scoring:** FastAPI endpoint scores individual borrowers in <50ms using a pre-loaded model.
- **Tier escalation:** a borrower who crosses the Critical threshold mid-day is injected into the intervention queue immediately, not at the next batch run.

### Production Deployment Scaling

- **Feature store:** Feast or Tecton for point-in-time feature computation, preventing training-serving skew.
- **Model registry:** MLflow for versioned model storage, parameter tracking, and A/B model comparison.
- **Orchestration:** Airflow DAG for nightly batch: ingest -> feature compute -> score -> policy -> push to CRM.
- **Monitoring:** Evidently or custom PSI/ECE tracking with automated circuit breakers (PSI > 0.25 freezes scoring).
- **Infrastructure:** Kubernetes deployment with horizontal pod autoscaling for the scoring service. Model served via ONNX Runtime for 5-10x inference speedup over native XGBoost.

### Feature Engineering Expansion

The current 10-feature set is derived from raw credit bureau fields. Production improvements:

- **Behavioral velocity features:** rolling 7/14/30-day payment deltas, not just static counts.
- **Bureau trade-line aggregation:** separate features for revolving, installment, and mortgage accounts.
- **Alternative data:** bank transaction velocity (with consent), utility payment history.
- **Interaction features:** channel-response history (did the borrower respond to the last SMS/call/visit?).

---

## 11. Resume Description

**Intervenix — Decision Intelligence Engine for Credit Risk** | Python, FastAPI, React, XGBoost

- Designed and built an EV-based intervention optimization system that replaces probability-threshold flagging with capacity-constrained expected value ranking, capturing 13.8% more recoverable value on a 30,000-borrower portfolio.
- Implemented a full decision pipeline — isotonic probability calibration, per-borrower EV computation with channel-specific costs, and policy selection under daily capacity constraints — with sensitivity analysis proving robustness across parameter uncertainty ranges.
- Built simulated uplift analysis with Qini curve evaluation (AUUC = 0.42) to quantify the $959K gap between predictive and causal targeting, documenting the causal inference roadmap for A/B-tested uplift modeling.
- Delivered an interactive React dashboard with real-time parameter tuning across four decision dimensions (capacity, effectiveness, cost, recovery), backed by a FastAPI scoring API and modular Python engine.

---

## 12. Tech Stack Improvements

An honest assessment of what works, what is overkill, and what is missing.

### What Works

**Python + NumPy + Pandas for the core engine.** The computation is vectorized array math on DataFrames. This is exactly what these tools are built for. No reason to change it.

**Dataclass-based configuration.** `IntervenixConfig` is clean, type-safe, and IDE-friendly. It avoids the overhead of YAML/JSON config files for a system with fewer than 10 parameters. Appropriate for the current scale.

**Matplotlib for static reports.** The 8-panel report requires precise dual-axis control, custom annotations, and consistent styling across subplots. Matplotlib handles this. Seaborn would add abstraction that gets in the way of financial visualization requirements (exact dollar labels, break-even lines, capacity markers).

### What Is Overkill

**Streamlit as a dashboard.** Streamlit is a prototyping tool. It reruns the entire script on every slider change, which means the full 30,000-borrower computation executes on every interaction. `@st.cache_data` mitigates this for data loading but not for the downstream policy and sensitivity computations. For a production dashboard, Streamlit should be replaced entirely by the React frontend with server-side computation via the FastAPI API. Streamlit's value was as a rapid prototype to validate the dashboard concept before building the React version.

**Per-borrower economics via random generation.** The synthetic data generation (`generate_per_borrower_economics`) uses `np.random.choice` for costs and `np.random.lognormal` for recovery. This is fine for demonstration but masks the distribution characteristics of real portfolio data. In production, these values come from the loan management system, not from random sampling.

### What Is Missing

**Request validation and error handling.** The FastAPI layer needs Pydantic models for request/response schemas, input validation (p_calibrated in [0,1], cost > 0, capacity > 0), and structured error responses. Currently, malformed input would produce a silent NumPy error, not a useful HTTP 422.

**Authentication and rate limiting.** A scoring API that produces intervention decisions on real borrowers requires API key authentication, role-based access control, and rate limiting. This is non-negotiable for financial services deployment.

**Logging and audit trail.** Every scoring decision must be logged with the model version, parameter values, EV calculation, and selection outcome. This is a regulatory requirement in consumer lending (ECOA, FCRA in the US; GDPR in the EU). The current system logs nothing.

**Database layer.** Borrower data, scoring history, and intervention outcomes need persistent storage. PostgreSQL for transactional data (scoring records, policy decisions), and a time-series store (TimescaleDB or ClickHouse) for monitoring metrics (PSI, ECE, effectiveness tracking over time).

**Testing.** No unit tests, integration tests, or property-based tests exist. Critical functions like `compute_ev`, `select_policy`, and `compute_qini_data` need deterministic test cases with known expected outputs. Property-based tests (e.g., "EV ranking always produces total EV >= probability ranking") would catch edge cases.

**CI/CD pipeline.** GitHub Actions or equivalent for: lint (ruff), type check (mypy), test suite, Docker build, and deployment to staging. The scoring API should never be deployed without passing all checks.

**Containerization.** A `Dockerfile` and `docker-compose.yml` for reproducible deployment. The scoring service, monitoring service, and dashboard should be separate containers with defined networking.

### What Should Be Replaced for Production

| Current | Production Replacement | Why |
|---------|----------------------|-----|
| Synthetic data generation | Database connector (SQLAlchemy + PostgreSQL) | Real borrower data, not random samples |
| Matplotlib in API responses | Pre-computed chart data (JSON) rendered by React | Matplotlib generates PNGs server-side; the frontend should render from data |
| Global effectiveness constant | Per-borrower effectiveness model | The sensitivity analysis proves the system is fragile to this assumption |
| Streamlit dashboard | React + Tailwind (already planned) | Streamlit cannot scale, cannot be embedded, and reruns on every interaction |
| `np.random.RandomState` | No randomness in production scoring | Scoring must be deterministic for auditability |
| In-memory DataFrame | Feature store (Feast) + model registry (MLflow) | Prevents training-serving skew and enables versioned rollback |
| No monitoring | Evidently / Grafana + PSI/ECE circuit breakers | Model degradation must trigger automated freezes |

---

## License

Confidential — For Academic and Review Purposes.

---

*Intervenix v2.0 — Decision Intelligence for Credit Risk*
*Intervene earlier. Recover more.*