# Reflex Platform — Engineering Specification

> **Date:** 2026-03-27
> **Version:** 1.0
> **Status:** Draft — Pending team review
> **Synthesized from:** Product transcript, Run 1 risk matrix (20 risks), Run 1 executive summary, Run 2 cloud platform recommendation, Run 2 data architecture, Run 2 API/backend architecture, Run 2 frontend/UX architecture

---

## 1. Executive Summary

Reflex is a lightweight workflow optimization platform for mid-size oil refineries (50,000–200,000 BPD) that connects live process historian data and market pricing to existing LP (linear program) models, automatically re-solves when meaningful process or price shifts occur, translates dense mathematical output into plain-English recommendations via Claude API, and delivers those recommendations to shift supervisors through structured messaging channels (Teams/Slack/email) with a built-in constraint feedback loop. Reflex does not replace existing LP models, does not control plant equipment, and does not require operators to learn new software — it acts as an automated data-entry clerk and translator sitting between systems that already exist but are manually disconnected.

**Key technical decisions:**
- **Cloud platform:** Azure-primary with cloud-agnostic services (InfluxDB replaced by TimescaleDB on PostgreSQL; Claude via direct Anthropic API)
- **Architecture:** Modular monolith (Python/FastAPI) with one external Windows LP Worker
- **Database:** Single PostgreSQL 16 + TimescaleDB instance for all relational and time-series data
- **Edge:** Lightweight Python Docker container in customer DMZ reading PI Web API; outbound-only HTTPS
- **LLM safety:** All numbers programmatically extracted; Claude used only for natural language formatting; deterministic template fallback
- **Delivery:** Structured 5-tap input via Teams Adaptive Cards / Slack Block Kit to shift supervisors and process engineers — not field operators

**Cloud platform rationale (Azure):** Azure wins on the single most important technical dimension — industrial IoT connectivity. Azure IoT Edge has a first-party OPC-UA Publisher module, PI Integrator for Azure is an official AVEVA product, Microsoft Defender for IoT provides Purdue Model-aware OT monitoring, and refineries are overwhelmingly Microsoft 365 / Teams shops. Student credits ($100/year + Microsoft for Startups up to $150K) make it cost-effective for a pilot.

---

## 1.5. Changes & Shifts from Original Plan

The original product concept (from the team discussion transcript) made several assumptions that research validated, adjusted, or contradicted. Every divergence is documented below with rationale.

### Shift 1: Primary User — Field Operators → Shift Supervisors & Process Engineers

| | Detail |
|---|--------|
| **Original assumption** | Operators receive Slack messages on the plant floor and type feedback like "can't push unit 2, heat exchanger 201 is fouling" |
| **Research finding** | Three independent research threads (R2, Score 125) converge: control rooms run DCS consoles, not chat apps. Process areas are ATEX hazardous zones where standard phones cannot be carried. Chemical-resistant gloves make phone keyboards unusable. Voice-to-text degrades to ~65% accuracy at industrial noise levels. WiFi is spotty across 3–4 sq mile sites. No published case study shows Slack/Teams used by frontline refinery operators on shift. |
| **New approach** | The primary user is the **shift supervisor and process engineer** who works at a desk with IT network access. Field operators receive information through existing channels (DCS console, radio, supervisor handoff). The feedback loop flows through the supervisor, not directly through field operators. |
| **Justification** | If operators cannot receive or respond to recommendations, the feedback loop — Reflex's core differentiator — does not exist. Redefining the user is a prerequisite for a viable product. |

### Shift 2: Data Connector — Seeq Integration → Direct PI Web API

| | Detail |
|---|--------|
| **Original assumption** | "Reflex connects directly to the plant's process historian, ideally through an integration layer like Seeq" |
| **Research finding** | Seeq is an enterprise analytics layer on top of PI with enterprise pricing ($100K+/year). It adds value for pattern detection and advanced analytics but is overkill for data collection. PI Web API is REST-based, well-documented, and explicitly designed for DMZ access at Purdue Level 3.5. Going through Seeq adds cost, complexity, and a dependency on a third-party vendor for core data access. |
| **New approach** | Connect directly to PI Web API over HTTPS with Basic Auth. Use StreamSets endpoint for bulk current-value reads (100+ tags per call). No Seeq dependency. |
| **Justification** | Eliminates $100K+/year cost, removes single point of failure, simplifies architecture. Seeq integration can be added later as an optional analytics layer. |

### Shift 3: Delivery Channel — Slack/Teams Only → Multi-Channel with Structured Input

| | Detail |
|---|--------|
| **Original assumption** | Deliver recommendations "directly to the operators via Slack or Teams. No new software to log into, no training required." |
| **Research finding** | Teams requires per-customer IT admin approval (multi-tenant bot creation deprecated July 2025). Budget 2–8 weeks per customer. Operators in PPE cannot type messages. Free-text NLP constraint extraction achieves only 46–85% accuracy on complex industrial problems (R5, Score 80). The "no training required" claim conflicts with OSHA PSM Management of Change requirements (R7, Score 80). |
| **New approach** | Three delivery channels: (1) Teams Adaptive Cards with structured 5-tap input for supervisors (primary), (2) Slack Block Kit for engineers/planners (alternative), (3) Email as universal fallback. Web dashboard for complex interactions. Never claim "no training required" — instead provide MOC documentation package and phased onboarding (shadow mode → guided adoption → full deployment). |
| **Justification** | Structured input eliminates NLP error rates entirely. Multi-channel ensures delivery regardless of IT approval timelines. MOC compliance prevents safety manager from blocking the purchase. |

### Shift 4: Feedback Mechanism — Free-Text Chat → Structured 5-Tap Interface

| | Detail |
|---|--------|
| **Original assumption** | Operators reply in Slack: "can't push unit 2, heat exchanger 201 is fouling" — Reflex extracts the constraint via NLP |
| **Research finding** | NLP constraint extraction from free-text achieves only 46–85% accuracy (R5). The core problem is missing quantitative information — the operator didn't specify whether fouling means 5% or 35% capacity reduction. Gloves make typing physically impossible. |
| **New approach** | Replace free-text with structured 5-tap wizard: select unit (1 tap) → select constraint type (1 tap) → select specific constraint (1 tap) → select severity with predefined magnitudes (1 tap) → confirm (1 tap). Optional voice note or photo. Total: 15–30 seconds, fully glove-compatible. NLP extraction retained as fallback with mandatory human confirmation. |
| **Justification** | 100% structured data accuracy vs. 46–85% NLP accuracy. Works with PPE. Eliminates the "missing quantitative information" problem entirely. |

### Shift 5: AI Role — Claude Processes LP Output → Claude Formats Only (Numbers Decoupled)

| | Detail |
|---|--------|
| **Original assumption** | "Reflex uses Claude to process the raw mathematical output from the LP" and "extracts the exact delta from the Excel model's hard outputs" |
| **Research finding** | LLMs repeat or fabricate numerical errors in up to 83% of cases when errors are present in source material (R5, Score 80). Misreading "2.3 MBPD" as "23 MBPD" or inverting increase/decrease in a refinery context is dangerous. A single hallucinated number resets months of trust-building (R14). |
| **New approach** | Programmatically extract ALL numerical values from LP output using deterministic code. Store numbers in structured `deltas` JSON. Send pre-validated numbers to Claude with strict instructions to use ONLY provided numbers. Cross-validate every number in Claude output against source data. Build deterministic template fallback for LLM downtime or validation failure. |
| **Justification** | In a safety-critical environment, incorrect numbers destroy trust immediately and create liability. Decoupling numbers from the LLM eliminates the highest-impact failure mode at ~1 week of engineering cost. |

### Shift 6: Trigger Design — Fixed $2/bbl Threshold → Percentage-Based, Mode-Gated Triggers

| | Detail |
|---|--------|
| **Original assumption** | "If the crack spread moves materially, say, the margin jumps by two dollars or more per barrel" — fixed dollar threshold, triggers fire continuously |
| **Research finding** | A $2/bbl threshold represents 8–20% of a normal spread but only ~5% of an elevated spread, causing over-triggering in volatile markets and under-triggering in stable markets (R9, Score 64). During plant shutdowns/startups/upsets (50% of safety incidents occur here), nearly all sensors change dramatically — triggering meaningless recommendations when operators are under maximum cognitive load. |
| **New approach** | Percentage-based thresholds (e.g., 10% of trailing 20-day average spread). Operating mode (Normal/Startup/Shutdown/Upset/Turnaround/Emergency) as first-class system concept. All optimization triggers auto-suppressed during non-normal modes. Hysteresis, debounce (2-minute minimum persistence), and cooldown (60-minute minimum between triggers). Target: 1–2 recommendations per shift. |
| **Justification** | Alert fatigue from false recommendations during the first shutdown event will permanently destroy operator trust. Fixed thresholds fail across different market regimes. |

### Shift 7: Opportunity Cost Dashboard — Loss Framing → Gain Framing, Audience-Separated

| | Detail |
|---|--------|
| **Original assumption** | "A rolling 30 or 90-day dashboard showing exactly how much money is bleeding out through the friction" — tracks money lost from operator overrides |
| **Research finding** | Research shows loss-framing feedback decreases performance ~33% of the time (R8, Score 64). The USW is actively bargaining over AI in refineries. NLRB's 2022 memo establishes that AI surveillance affecting working conditions is a mandatory bargaining subject. If operators know overrides are tracked with dollar costs tied to individuals, they face pressure to follow AI blindly — a safety risk. |
| **New approach** | Track overrides by equipment/unit, NEVER by individual operator. Management sees financial summaries: "$1.2M captured (82% capture rate)" — never "$450K lost from overrides." Operators see "value captured" framing and upcoming recommendations, never individual override costs. Override data contractually restricted from use in performance evaluation. |
| **Justification** | Union grievance or NLRB complaint during a pilot would be devastating. Dashboard design done wrong creates the opposite of the intended behavior change — operators either follow AI blindly (safety risk) or disengage entirely. |

### Shift 8: LP Tool Landscape — Excel Solver Assumed → Must Validate, PIMS/GRTMPS Likely

| | Detail |
|---|--------|
| **Original assumption** | "That hyper-complex optimization math literally lives in a Microsoft Excel spreadsheet" — Excel Solver is the universal LP tool |
| **Research finding** | Many mid-size refineries use Aspen PIMS (400+ refineries worldwide), Haverly GRTMPS, or Honeywell RPMS — not Excel Solver (R3, Score 100). These are standalone LP engines that use Excel only as a data I/O layer. Microsoft explicitly does not support server-side Excel automation (R1, Score 125). Documented failure modes include modal dialog hangs, zombie processes, 50GB memory leaks, and deadlocks. |
| **New approach** | Survey 10–15 target refineries to determine actual LP tool landscape BEFORE committing architecture. Build Excel COM automation with safexl/pywin32 for Excel Solver sites (with watchdog, process isolation, queue backpressure). Invest in parallel PuLP + HiGHS migration path as strategic escape hatch. If >60% of targets use PIMS/GRTMPS, pivot LP automation strategy. |
| **Justification** | This is a binary market validation question. If the target market primarily uses PIMS, not Excel Solver, the product concept must be rearchitected. The entire Reflex value proposition requires automated, reliable LP execution. |

### Shift 9: Market Data — Reflex Connects to OPIS/Platts → "Bring Your Own Data"

| | Detail |
|---|--------|
| **Original assumption** | "It connects to live market data feeds like OPIS or Platts to watch crack spreads and crude differentials" |
| **Research finding** | OPIS/Platts subscriptions cost $10K–$50K+/year with redistribution licensing restrictions (R17). Refineries already have these subscriptions. Redistributing raw pricing data creates legal liability. |
| **New approach** | Customer supplies their own OPIS/Platts data via CSV upload, email parsing, or API forwarding — Reflex ingests but never redistributes raw pricing. For MVP/demo, use free EIA Open Data API v2 (daily) + OilPriceAPI ($0–15/month for intra-day). |
| **Justification** | Eliminates $10K–$50K/year licensing costs, removes redistribution legal risk, costs $0 to implement. |

### Shift 10: Training & Onboarding — "No Training Required" → MOC-Compliant Phased Onboarding

| | Detail |
|---|--------|
| **Original assumption** | "No new software to log into, no training required" |
| **Research finding** | OSHA PSM (29 CFR 1910.119) requires Management of Change documentation and training for any tool that changes how operators make decisions about process parameters (R7, Score 80). "It's just Slack messages" provides no exemption. The 2005 Texas City explosion was partly attributed to MOC failures. If deployed without MOC, the customer faces OSHA citation risk — a direct sales barrier. |
| **New approach** | Every sales engagement includes a pre-built MOC package (technical basis document, impact assessment template, training curriculum, operating procedure modifications). Phased onboarding: Shadow mode (2–4 weeks, recommendations shown alongside existing workflow) → Guided adoption with training → Full deployment. Position as "minimal training with structured onboarding and MOC documentation included." |
| **Justification** | Refinery safety managers will ask about MOC compliance in the first meeting. Without a ready answer, the deal is dead. Shadow mode also addresses algorithm aversion (R14) by letting operators build calibrated trust through evidence. |

### Shift 11: Target Market Size — 80–120 Sites → 60–70 Sites (Beachhead: 12–24)

| | Detail |
|---|--------|
| **Original assumption** | "80 to 120 target sites in North America" with "$8 to 15 million in annual recurring revenue" |
| **Research finding** | EIA data shows exactly 60 mid-size US refineries in the target range, ~68–70 including Canada (R16, Score 30). Many already use commercial LP tools. Sales cycles are 9–18 months with multi-stakeholder sign-off. Each lost deal permanently shrinks the market by 1.4–1.7%. The realistic beachhead is 12–24 underserved refineries. |
| **New approach** | Plan for realistic $2–3M ARR in Year 3, not $8–15M. Secure 2–3 design partner refineries for free/discounted pilots. Pursue EPC firm partnerships (Bechtel, Worley, Fluor) for leverage. Budget 18–24 months of runway before meaningful revenue. |
| **Justification** | Overstated TAM leads to undercapitalized business plans. Honest projections ensure sufficient runway for the actual sales cycle. |

### Shift 12: Pricing — $75K–$125K Assumed Viable → Likely Viable but Start Low

| | Detail |
|---|--------|
| **Original assumption** | "$75,000 to $125,000 per site per year" |
| **Research finding** | Pricing appears reasonable relative to value delivered ($500K+ annual margin improvement target) and enterprise alternatives ($300K–$800K/year). However, risk R20 (Score 6) suggests pricing may actually be too low for value, while R10 (Score 75) suggests starting at the low end to reduce friction during brutally long sales cycles. |
| **New approach** | Maintain $75K–$125K range. Start at $75K for design partners, increase with proven ROI case studies. Cloud infrastructure costs are <1.5% of revenue ($3K–$10K/year at 10 sites). Pricing is not a blocking concern. |
| **Justification** | Right price range — low enough to be a no-brainer vs. enterprise alternatives, high enough to build a real business. Optimize pricing after proving value at 3+ sites. |

### Shift 13: Team Credibility — Not Addressed → Critical Blocker

| | Detail |
|---|--------|
| **Original assumption** | Not explicitly addressed in the transcript — implicitly assumes the team can sell directly |
| **Research finding** | Every successful industrial software startup (Seeq, Imubit, OSIsoft) has founders with 10+ years of process industry experience (R4, Score 100). A sales rep who can't distinguish a CDU from a coker will be dismissed in the first meeting. The refinery world is extremely small — one bad interaction travels fast. |
| **New approach** | Recruit a process industry veteran (15+ years) as co-founder, CTO, or lead advisor with equity. This person leads all customer-facing conversations. Use "advisor-led sales" model: domain expert leads, student team builds. Engage KBC and Solomon consultants as technology gatekeepers. This is non-negotiable. |
| **Justification** | Without domain credibility, you cannot get design partners, and without design partners, you cannot validate or sell anything. This gates every other activity. |

---

## 2. System Architecture Overview

### High-Level Component Diagram

```
                    REFINERY SITE (Customer Premises)
    ┌─────────────────────────────────────────────────────┐
    │  Purdue Level 0-2: Process Control Network (OT)     │
    │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
    │  │ DCS/PLC  │  │ Sensors  │  │ PI Data Archive  │  │
    │  │ (Control)│  │ (100+    │  │ (Historian)       │  │
    │  └──────────┘  │  tags)   │  └────────┬─────────┘  │
    │                └──────────┘  (replicates to DMZ)    │
    │                                       │             │
    │  Purdue Level 3.5: DMZ                │             │
    │  ┌────────────────────────────────────┼───────────┐ │
    │  │  PI Data Archive (read-only replica)│           │ │
    │  │         │                                      │ │
    │  │  PI Web API (IIS, HTTPS/443)                   │ │
    │  │         │                                      │ │
    │  │  REFLEX EDGE AGENT (Python Docker, ~60 MB)     │ │
    │  │  ┌─────────────────────────────────────────┐   │ │
    │  │  │ PI Reader → Data Quality Gateway →      │   │ │
    │  │  │ SQLite Buffer → HTTPS Push (outbound)   │   │ │
    │  │  └─────────────────────────────────────────┘   │ │
    │  └────────────────────────────────────────────────┘ │
    └───────────────────────┬─────────────────────────────┘
                            │ HTTPS outbound only
                   ═════════╪═════════  FIREWALL
                            │
                            ▼
              REFLEX CLOUD (Azure-primary)
    ┌────────────────────────────────────────────────────┐
    │                                                    │
    │  ┌──────────────┐     ┌─────────────────────────┐ │
    │  │ Azure IoT Hub│────▶│ FastAPI Modular Monolith │ │
    │  │ (ingestion)  │     │                         │ │
    │  └──────────────┘     │  Data Ingestion Module  │ │
    │                       │  Data Quality Gateway   │ │
    │                       │  Trigger Engine         │ │
    │                       │  LP Orchestrator ───────┼─┼──▶ Windows LP Worker
    │                       │  AI Translation Service │ │    (separate VM)
    │                       │  Messaging Service      │ │
    │                       │  Feedback Processor     │ │
    │                       │  Constraint Registry    │ │
    │                       │  Reconciliation Engine  │ │
    │                       │  Dashboard API          │ │
    │                       │  Auth & Admin           │ │
    │                       └────────┬────────────────┘ │
    │                                │                   │
    │          ┌─────────────────────┼──────────────┐   │
    │          ▼                     ▼              ▼   │
    │  ┌──────────────────┐  ┌───────────┐  ┌───────┐ │
    │  │ PostgreSQL 16 +  │  │ Redis 7   │  │Claude │ │
    │  │ TimescaleDB      │  │ (cache +  │  │ API   │ │
    │  │ (all data)       │  │  broker + │  │(Anthr)│ │
    │  └──────────────────┘  │  pub/sub) │  └───────┘ │
    │                        └───────────┘             │
    │                                                    │
    │  ┌─────────────────────────────────────────────┐  │
    │  │ Next.js 15 Frontend (Azure Container Apps)  │  │
    │  │ Operations Dashboard | Analytics Dashboard  │  │
    │  │ Admin Dashboard | Shadow Mode UX            │  │
    │  └─────────────────────────────────────────────┘  │
    │                                                    │
    │  ┌─────────────────────────────────────────────┐  │
    │  │ Azure Bot Service (Teams + Slack + Email)   │  │
    │  │ Adaptive Cards / Block Kit structured input  │  │
    │  └─────────────────────────────────────────────┘  │
    └────────────────────────────────────────────────────┘
```

### Data Flow (End-to-End)

1. **Ingestion:** Edge Agent reads PI historian via PI Web API StreamSets (30–60s intervals) → Data Quality Gateway validates (staleness, range, rate-of-change, digital states, compression artifacts, operating mode detection) → pushes validated data outbound via HTTPS to Azure IoT Hub
2. **Storage:** Azure Functions receives events → writes to TimescaleDB hypertables (sensor_readings, market_prices, crack_spreads) → continuous aggregates auto-compute 5-minute rollups
3. **Triggering:** Python in-memory rule evaluator checks ~200 rules against incoming data → process drift (percentage of operating range) and price movement (percentage of trailing 20-day average) triggers → mode-gated (suppressed during non-Normal modes) → debounced + cooldown enforced → triggers coalesced within 30-second window
4. **LP Solve:** Orchestrator dispatches Celery task to Windows LP Worker → Worker opens Excel via safexl/pywin32 COM → writes input values to mapped cells → triggers Solver → extracts output values from mapped cells → returns structured results (with watchdog, 5-min timeout, zombie cleanup)
5. **Translation:** Deterministic code extracts all numerical deltas from LP output → pre-validated numbers sent to Claude API with strict prompt template → Claude generates plain-English recommendation → cross-validation verifies every number matches source → template fallback if validation fails or API is down
6. **Delivery:** Azure Bot Service formats as Teams Adaptive Card / Slack Block Kit message → delivers to shift supervisors / process engineers → email as universal fallback
7. **Feedback:** Supervisor responds via structured 5-tap input (unit → type → constraint → severity → confirm) → constraint stored in PostgreSQL registry by equipment (never by operator) → if quantifiable, triggers LP re-solve with new bound → revised recommendation delivered
8. **Dashboard:** Next.js frontend served from Azure Container Apps → SSE for live recommendations and mode changes → HTTP polling for analytics → role-gated views (management sees financials by equipment with gain framing; operators see recommendations and constraint status)

### Network Architecture (OT/IT Boundary)

The Reflex Edge Agent is the only component deployed on customer premises. It sits in the DMZ at Purdue Level 3.5, reads from a read-only PI Data Archive replica via PI Web API, and communicates outbound-only via HTTPS to the Reflex cloud. No inbound firewall rules are ever required. The edge agent never writes to OT systems — it is strictly read-only. Data diode compatibility is inherent (outbound-only HTTPS).

---

## 3. Technology Stack

| Layer | Technology | Why Chosen | Alternatives Considered |
|-------|-----------|------------|------------------------|
| **Backend framework** | Python 3.12 + FastAPI | Team knows Python; async native; Claude SDK is first-class; pywin32 for Excel COM; pandas/numpy for reconciliation; auto-generated OpenAPI docs | NestJS (team would need to learn TypeScript), Go (no Excel COM support, steeper curve) |
| **Frontend framework** | Next.js 15 + React 19 + TypeScript | SSR for slow control-room networks; App Router for multi-dashboard layout; Server Components reduce bundle size; type safety prevents numerical display errors | Vue/Nuxt (smaller industrial charting ecosystem), SvelteKit (smaller talent pool) |
| **Database** | PostgreSQL 16 + TimescaleDB | Single DB for relational + time-series; full SQL JOINs across data types; 90%+ compression; LISTEN/NOTIFY for events; RLS for multi-tenancy | InfluxDB (separate DB to manage, no JOINs), QuestDB (less mature ecosystem) |
| **Cache / Broker** | Redis 7 | Celery broker + app cache + pub/sub in one service; simple to operate | RabbitMQ (more reliable but more complex; upgrade path if needed) |
| **Task queue** | Celery | Python-native; priorities, retries, timeouts; scheduled tasks via Beat | Dramatiq (less ecosystem), custom (unnecessary) |
| **Time-series** | TimescaleDB hypertables | PostgreSQL extension, not separate product; continuous aggregates for dashboards; compression policies | InfluxDB Cloud (free tier but separate DB, no JOINs), ADX (overkill at $90+/mo minimum) |
| **Edge agent** | Python Docker (~60 MB) + SQLite buffer | Lightweight; store-and-forward for resilience; runs on Linux or Windows in DMZ | Azure IoT Edge (heavier, more complex for MVP) |
| **Historian access** | PI Web API (REST, HTTPS, Basic Auth) | Explicitly designed for DMZ access; StreamSets for bulk reads; well-documented | Seeq ($100K+/year overkill), OPC-UA (lives at Level 2-3, not DMZ) |
| **LLM** | Claude API (direct Anthropic) | Provider-agnostic; Haiku for routine translation (~$3/mo), Sonnet for complex interpretation; no cloud lock-in | Azure OpenAI (adds complexity, locks to Azure), Bedrock (locks to AWS) |
| **Charting** | ECharts (analytical) + Tremor (KPI cards) | ECharts: 60fps Canvas, 10K+ data points, dark mode; Tremor: lightweight Tailwind-native dashboard components | D3 (too low-level for student team), Recharts (SVG too slow for real-time), Plotly (heavier bundle) |
| **UI components** | Mantine v7 + Shadcn/ui (custom) | Mantine: 200+ components, dark mode, WCAG AA, lighter than Ant Design; Shadcn: copy-paste model for pixel-level custom components (ISA-101 compliance) | Ant Design (500KB bundle, steeper learning curve) |
| **State management** | TanStack Query (server state) + Zustand (UI state) | Auto cache invalidation, optimistic updates, stale-while-revalidate; Zustand minimal API for student team | Redux (too much boilerplate), SWR (less features) |
| **Real-time** | SSE (primary) + HTTP polling (fallback) | SSE works through corporate proxies; built-in browser reconnection; unidirectional matches data flow | WebSocket (more complex, blocked by some proxies) |
| **Messaging** | Azure Bot Service + Adaptive Cards / Block Kit | Teams-native structured input; large button targets for glove compatibility; email fallback via Azure Communication Services | Custom webhook (loses structured card capabilities) |
| **CI/CD** | GitHub Actions | Free 2000 min/mo; GitHub Student Pack; cloud-agnostic | Azure DevOps (more complex), CircleCI (paid) |
| **IaC** | Terraform (Azure provider) | Cloud-agnostic; team can learn HCL | Bicep (Azure-only) |
| **Excel automation** | safexl + pywin32 (short-term) | Context manager guarantees COM cleanup; DispatchEx for isolated instances | xlwings (less control over COM lifecycle) |
| **LP solver (future)** | PuLP + HiGHS | Free (MIT/BSD); cross-platform; sub-second solves; strategic escape from Excel | Pyomo (heavier), OR-Tools (less LP-focused) |
| **Market data** | EIA API v2 (free, daily) + OilPriceAPI ($0–15/mo, intra-day) + customer OPIS/Platts | Free for MVP; customer supplies own premium data | Direct OPIS/Platts ($10K–$50K/year + redistribution risk) |

### Conflict Resolution: InfluxDB vs. TimescaleDB

The cloud platform recommendation (Agent 2A) chose InfluxDB Cloud for time-series data. The data architecture (Agent 2B) and backend architecture (Agent 2C) both recommended TimescaleDB on PostgreSQL. **We go with TimescaleDB.** Rationale:

1. One database instead of two (simpler to operate, monitor, back up)
2. Full SQL JOINs between time-series and relational data (required for coefficient reconciliation, opportunity cost tracking, constraint pattern analysis)
3. Zero new query language (standard PostgreSQL SQL)
4. Comparable performance at this scale (150 tags × 1 reading/sec = well within TimescaleDB capacity)
5. Azure for Students provides free PostgreSQL hosting for 12 months

The InfluxDB free tier advantage is offset by Azure student credits covering PostgreSQL. The Telegraf OPC-UA plugin is irrelevant since we use PI Web API, not OPC-UA.

### Conflict Resolution: Azure IoT Edge vs. Lightweight Python Agent

The cloud platform recommendation (Agent 2A) proposed Azure IoT Edge as the edge agent framework. The data architecture (Agent 2B) and backend architecture (Agent 2C) proposed a lightweight Python Docker container. **We go with the lightweight Python agent for MVP, with Azure IoT Edge as the Phase 3+ migration target.** Rationale:

1. Azure IoT Edge adds significant complexity for a single-site pilot
2. A ~60 MB Python container is simpler to deploy and debug in a customer DMZ
3. The core data flow (PI Web API → validate → HTTPS push) doesn't need IoT Edge's module orchestration
4. IoT Edge becomes valuable at 10+ sites when module management, nested edge, and OPC-UA Publisher matter

### Conflict Resolution: Railway/Render vs. Azure Container Apps

The backend architecture (Agent 2C) suggested Railway/Render for Phase 1-2 hosting. The cloud platform recommendation (Agent 2A) recommended Azure Container Apps. **We go with Azure Container Apps from the start.** Rationale:

1. Azure Container Apps has an always-free tier (2M requests + 180K vCPU-seconds/month)
2. Student credits cover overages
3. Starting on Azure avoids a migration later
4. Azure Bot Service (Teams integration) requires Azure anyway

---

## 4. Data Architecture

### Complete Data Model

The database uses a single PostgreSQL 16 + TimescaleDB instance with these table groups:

**Time-Series (TimescaleDB Hypertables):**

| Table | Purpose | Volume (per site/year) |
|-------|---------|----------------------|
| `sensor_readings` | Raw sensor values from historian | ~5M rows (1-min intervals) |
| `sensor_5min` | Continuous aggregate — 5-minute rollups | ~1M rows (auto-computed) |
| `market_prices` | Commodity spot prices (EIA, OPIS, Platts) | ~10K rows |
| `crack_spreads` | Computed crack spread values | ~10K rows |

**Relational (Core):**

| Table | Purpose | Volume |
|-------|---------|--------|
| `sites` | Site configuration (name, region, capacity, timezone) | 1–5 |
| `users` | User accounts, roles, delivery channel preferences | 20–50 per site |
| `tag_config` | Per-tag quality rules, physical limits, PI WebIDs | 100–200 per site |
| `trigger_rules` | Threshold rules (process drift, price movement, sensor health) | 100–300 per site |
| `operating_modes` | Operating mode state machine history | ~200 per site/year |
| `lp_models` | LP model config, input/output cell mappings (JSONB) | 1–3 per site |
| `lp_runs` | LP solve execution history (inputs, outputs, status) | 500–2,000 per site/year |
| `recommendations` | Generated recommendations with deterministic deltas (JSONB) + LLM text | 500–2,000 per site/year |
| `constraints` | Operator feedback constraint registry (by equipment, not operator) | 500–5,000 per site/year |
| `overrides` | Recommendation response tracking (by equipment, not operator) | 500–2,000 per site/year |
| `opportunity_costs` | Value captured/identified by equipment/unit | 500–2,000 per site/year |
| `sensor_substitutions` | Broken sensor → substitute tag mapping | 10–50 per site |
| `coefficient_snapshots` | Predicted vs. actual yield comparisons (JSONB) | 12–52 per site/year |
| `audit_log` | Complete MOC-ready audit trail (every event with timestamp, actor, details) | 10K–50K per site/year |

### Storage Strategy

| Data Type | Storage | Retention | Compression |
|-----------|---------|-----------|-------------|
| Raw sensor readings | TimescaleDB hypertable, 1-day chunks | 2 years hot | 90%+ after 7 days (auto-policy) |
| 5-minute aggregates | TimescaleDB continuous aggregate | 5 years | Auto-compressed |
| Market prices | TimescaleDB hypertable, 7-day chunks | Indefinite | 90%+ after 30 days |
| Constraints & overrides | Regular PostgreSQL tables | Indefinite (audit requirement) | N/A |
| Audit log | Regular PostgreSQL table | 7 years (regulatory) | Partition by month, archive to blob storage after 1 year |
| LP model files | Azure Blob Storage (versioned) | Indefinite | N/A |

**Storage estimate (per site):** ~140 MB/year at 1-minute sensor intervals with 90% compression. A $20–50/month managed PostgreSQL instance is more than sufficient.

### Data Retention Policies

```sql
-- Auto-compress sensor data older than 7 days (90%+ space reduction)
SELECT add_compression_policy('sensor_readings', INTERVAL '7 days');

-- Drop raw sensor data older than 2 years (aggregates retained longer)
SELECT add_retention_policy('sensor_readings', INTERVAL '2 years');

-- 5-minute aggregates auto-refresh every 5 minutes
SELECT add_continuous_aggregate_policy('sensor_5min',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes');
```

---

## 5. Service Architecture

### Architecture: Modular Monolith

Reflex is built as a **modular monolith** for Phases 1–3 (1–5 customers). The only external process is the Windows LP Worker (inherently separate due to Excel COM requirements). Modules communicate through defined Python interfaces, each owns its database tables, and async communication uses an internal event bus (Redis pub/sub, replaceable with a real message broker later).

**Why not microservices:** Team of 3–5 students cannot manage N services × (logging + monitoring + deployment + versioning). Single deployment, single repo, ACID transactions across modules, in-process function calls, stack traces for debugging. The monolith is designed with clean module boundaries that allow extraction when needed (e.g., when LP Orchestrator needs to scale independently at 10+ concurrent solves).

### Module Boundaries & Responsibilities

| Module | Responsibility | Key Tables Owned | Key Events |
|--------|---------------|-----------------|------------|
| **Data Ingestion** | Receive sensor + market data from edge agents; normalize, timestamp, persist | `sensor_readings`, `market_prices`, `edge_agents` | Emits: `SensorDataReceived`, `MarketPriceReceived` |
| **Data Quality Gateway** | Validate all incoming data; detect staleness, range violations, compression artifacts, operating mode | `quality_rules`, `quality_events`, `operating_modes` | Emits: `ValidatedDataReady`, `OperatingModeChanged` |
| **Trigger Engine** | Evaluate ~200 rules against validated data; fire optimization triggers (mode-gated, debounced, cooldown) | `trigger_configs`, `trigger_events` | Emits: `OptimizationTriggered` |
| **LP Orchestrator** | Queue solve requests, dispatch to Windows LP Worker (Celery), enforce timeouts, extract results | `solve_requests`, `solve_results`, `lp_model_configs` | Emits: `SolveCompleted`, `SolveFailed` |
| **AI Translation** | Deterministic number extraction → Claude API formatting → cross-validation → template fallback | `recommendations`, `prompt_templates` | Emits: `RecommendationReady` |
| **Messaging Service** | Deliver recommendations via Teams/Slack/email; handle structured feedback input | `message_deliveries`, `channel_mappings` | Emits: `OperatorResponseReceived` |
| **Feedback Processor** | Process structured operator responses; create/update constraints; trigger re-solves | `feedback_events` | Emits: `ConstraintCreated`, `ResolveRequested` |
| **Constraint Registry** | Maintain authoritative active constraints; expiry lifecycle; pattern detection | `constraints`, `constraint_history` | Emits: `ConstraintExpired`, `ConstraintPatternDetected` |
| **Reconciliation Engine** | Compare LP-predicted vs. actual yields; detect coefficient drift; flag for LP planner review | `reconciliation_snapshots`, `coefficient_drift_alerts` | Emits: `CoefficientDriftDetected` |
| **Dashboard API** | Serve aggregated data to frontend; opportunity cost tracking; sensor health matrix | `opportunity_cost_ledger` | Provides: REST + SSE endpoints |
| **Auth & Admin** | Multi-tenant auth (JWT), RBAC, API key management, site config, audit log | `users`, `roles`, `api_keys`, `audit_log` | — |

### Key API Contracts

**Data Ingestion:**
```
POST /api/v1/ingest/sensors          — Edge Agent pushes batched readings (API key auth)
POST /api/v1/ingest/market-prices    — Market data push endpoint
```

**Trigger Engine:**
```
GET  /api/v1/triggers/{site_id}              — List trigger configs
PUT  /api/v1/triggers/{site_id}/{trigger_id} — Update trigger thresholds
GET  /api/v1/triggers/{site_id}/history      — Trigger event history
```

**LP Orchestrator:**
```
GET  /api/v1/lp/solves/{site_id}         — Solve history
GET  /api/v1/lp/solves/{solve_id}        — Specific solve result
POST /api/v1/lp/solves/{site_id}/manual  — Manual solve trigger (LP planners)
```

**Recommendations:**
```
GET  /api/v1/recommendations/{site_id}            — Recommendation history
GET  /api/v1/recommendations/{recommendation_id}  — Specific recommendation
```

**Constraint Registry:**
```
GET    /api/v1/constraints/{site_id}          — Active constraints
POST   /api/v1/constraints/{site_id}          — Create constraint (structured input)
DELETE /api/v1/constraints/{constraint_id}     — Clear/expire constraint
GET    /api/v1/constraints/{site_id}/patterns  — Detected recurring patterns
```

**Dashboard:**
```
GET  /api/v1/dashboard/{site_id}/overview          — Main dashboard data
GET  /api/v1/dashboard/{site_id}/opportunity-cost   — 30/90-day opportunity cost (gain framing)
GET  /api/v1/dashboard/{site_id}/sensor-health      — Sensor health matrix
GET  /api/v1/dashboard/{site_id}/reconciliation     — Coefficient drift summary
SSE  /api/v1/dashboard/{site_id}/live               — Real-time updates (recommendations, mode changes)
```

**Auth:**
```
POST /api/v1/auth/login    — JWT token issuance
POST /api/v1/auth/refresh  — JWT refresh
```

### Inter-Service Communication

| Pattern | Use Case | Technology |
|---------|----------|------------|
| **Synchronous (REST)** | Edge Agent → ingest, Dashboard UI → data queries, Messaging webhooks | FastAPI HTTP endpoints |
| **Asynchronous (Celery)** | LP Solve execution (30s–7min), Claude API translation, reconciliation batch, pattern detection | Celery + Redis broker |
| **Event-driven (pub/sub)** | Module-to-module loose coupling (SensorDataReceived → Quality Gateway → Trigger Engine → LP Orchestrator → Translation → Messaging) | Redis pub/sub (in-process for now) |

### Authentication & Authorization

| Role | Operations Dashboard | Analytics Dashboard | Admin | Constraint Input | Financial Data |
|------|---------------------|--------------------|----|-----------------|----------------|
| **Admin** | Full | Full | Full | Yes | Full |
| **LP Planner** | Full | Full | Trigger config only | Yes | Full |
| **Shift Supervisor** | Full | "Value captured" KPIs only | No | Yes | Gain-framed only |
| **Management** | View only | Full (by equipment, never by operator) | No | No | Full |
| **Edge Agent** | N/A | N/A | N/A | N/A | N/A (API key auth, ingest only) |

Multi-tenancy enforced via `site_id` on every table with PostgreSQL Row-Level Security (RLS). JWT tokens carry site_ids and roles. Management role is architecturally prevented from seeing individual operator override costs — the API does not return this data for that role.

---

## 6. Frontend Architecture

### Design Philosophy

The frontend follows ISA-101 High Performance HMI and ISA-18.2 alarm management principles. Design for worst case: 2AM, 12-hour shift, fatigued supervisor, upset conditions.

- **Greyscale backgrounds** — color for deviation only (green=healthy, amber=warning, red=critical, grey=normal)
- **3-second rule** — any screen conveys primary status within 3 seconds without reading text
- **Progressive disclosure** — status visible by default → details on demand → diagnostics behind drill-down
- **Consistent spatial positioning** — elements never reflow (control room operators build spatial memory)
- **Monospace numbers** — all numerical values in `JetBrains Mono` or `IBM Plex Mono` (prevents misreading, R5)
- **No color-blind-dependent info** — all status uses shape + color + text label
- **Target 1–2 recommendations per shift** during normal operations

### Component Hierarchy

```
Shell Components
├── AppShell              — Mantine AppShell with sidebar + header
├── Sidebar               — Navigation, site selector, user menu
├── Header                — Operating mode banner, shift info, connection health
├── OperatingModeBanner   — Full-width mode indicator (most prominent UI element)
└── ShiftContextBar       — Current shift, time remaining, handover countdown

Page Components
├── OperationsDashboard   — Recommendation feed + constraints + overrides
├── AnalyticsDashboard    — Opportunity cost + coefficients + sensor health
└── AdminDashboard        — Site config + connections + triggers + users

Feature Components
├── RecommendationFeed    — SSE-driven live feed with priority sorting
├── RecommendationCard    — Single rec with action buttons (Acknowledge/Constrain/Dismiss)
├── ConstraintRegistry    — Filterable/sortable constraint list by unit
├── ConstraintInputWizard — 5-tap structured input flow (64px+ tiles, glove-compatible)
├── OpportunityCostChart  — ECharts waterfall with GAIN framing only
├── CoefficientDriftChart — ECharts multi-line with drift threshold zones
├── SensorHealthMatrix    — ECharts heatmap with click-to-detail
├── ShadowModeComparison  — Side-by-side recommended vs. actual
├── ShiftHandoverPanel    — Handover summary with acknowledgment flow
└── SiteOnboardingWizard  — Multi-step admin setup flow
```

### Dashboard Specifications

**Operations Dashboard (Default Landing — Shift Supervisors):**
- Left panel (60%): Live Recommendation Feed — each card shows priority badge (ISA-101 colors), plain-English recommendation, monospace numbers (programmatic, never LLM), estimated margin impact (gain framing), confidence indicator, action buttons
- Right panel (40%, tabbed): Active Constraints, Active Overrides, Shift Handover
- Bottom strip: KPI cards — recs delivered, actionability rate, active constraints, margin captured

**Analytics Dashboard (Management + LP Planners):**
- Opportunity Cost Waterfall (gain framing: "$1.2M captured (82% capture rate)")
- Coefficient Drift Timeline (30/90-day, flags when drift exceeds threshold)
- Sensor Health Matrix (heatmap by unit, click for substitution history + maintenance priority)
- Constraint Pattern Analysis (surfaces recurring constraints for permanent model updates)
- Does NOT show individual operator override data (R8 architectural enforcement)

**Shadow Mode UX (First 2–4 weeks at each site):**
- "SHADOW MODE" badge on every recommendation (muted blue)
- Side-by-side comparison: Reflex recommended vs. what actually ran
- "Note Agreement / Note Disagreement" instead of "Acknowledge / Dismiss"
- Readiness gauge: total recs delivered, accuracy rate, false positive rate
- Transition criteria: >20 recs AND >75% accuracy AND <10% false positives

### Slack/Teams Bot Design

**Recommendation Message (both channels):**
- Operating mode badge + trigger type
- LLM-generated recommendation text (or deterministic template fallback)
- Monospace table with programmatic numbers (current → recommended, margin impact, confidence)
- Action buttons: Acknowledge | Add Constraint | Dismiss

**Structured Constraint Input (triggered by "Add Constraint"):**
- Slack: Block Kit modal with dropdown selects (server-side filtering between steps)
- Teams: Adaptive Card with Input.ChoiceSet elements
- Both: unit → constraint type → specific constraint → severity → confirm (4–5 taps)
- Never allows free-text as sole input path; free text available as optional note only
- NLP-extracted constraints (from any free-text) NEVER auto-applied — always confirmed via structured options

---

## 7. AI/LLM Integration

### Claude API Usage Pattern

Claude is used for one thing: **translating deterministic LP output into plain-English recommendations.** It never generates, calculates, or validates numbers.

```
LP Output (deterministic) → Number Extraction (Python code) → Delta Calculation (Python code)
    → Template Selection → Claude API Call → Number Cross-Validation → Recommendation
```

### LLM Model Selection

| Task | Model | Est. Cost | Frequency |
|------|-------|-----------|-----------|
| Routine recommendation translation | Claude Haiku | ~$0.001/call | 50–100 calls/day per site |
| Complex constraint interpretation | Claude Sonnet | ~$0.005/call | 10–20 calls/day per site |
| Constraint pattern analysis | Claude Sonnet | ~$0.01/call | 1/week per site |
| **Total per site** | **Blended** | **$7–18/month** | |
| **At 50 sites** | | **$350–900/month** | |

### Prompt Template (Recommendation)

```
You are a process engineering communication assistant for an oil refinery.
Write a clear, concise recommendation for a shift supervisor.

RULES:
- Use ONLY the numbers provided below. Do not calculate, estimate, or round.
- Every number you write must appear exactly as given in the data below.
- Focus on WHAT changed, WHY it matters, and WHAT action to take.
- Keep it under 150 words.
- Frame financial impact as opportunity to capture, not loss to avoid.

TRIGGER: {trigger_summary}
RECOMMENDED CHANGES: {formatted_changes}
TOTAL MARGIN OPPORTUNITY: ${margin_delta_per_day}/day
ACTIVE CONSTRAINTS: {active_constraints}
```

### Validation & Safety Rails

1. **Numbers decoupled:** All numerical values programmatically extracted from LP output and stored in `recommendations.deltas` JSONB. Claude receives pre-validated numbers only.
2. **Cross-validation:** Every number in Claude's output is verified against source data. Direction words (increase/decrease) verified against sign of delta. Any mismatch → template fallback used instead.
3. **Template fallback:** Deterministic template produces identical actionable information without LLM. Visually distinguishable (no prose paragraph) so operators know the difference.
4. **NLP constraints never auto-applied:** When free-text is used, Claude extracts structured constraints via tool calling, but the system always presents its interpretation back with predefined options for confirmation.
5. **Caching:** Similar triggers within the same shift reuse translations with updated numbers injected. Cache TTL: 4 hours.

### Cost Projections

| Scale | Claude API Cost | % of Revenue |
|-------|----------------|-------------|
| 1 site (pilot) | $7–18/month | N/A (pilot) |
| 10 sites | $70–180/month | <0.03% of $750K+ ARR |
| 50 sites | $350–900/month | <0.03% of $3.75M+ ARR |

LLM costs are negligible at any realistic scale.

---

## 8. Infrastructure & Deployment

### Cloud Architecture

**Primary cloud:** Azure (industrial IoT ecosystem, Teams integration, student credits)
**Cloud-agnostic services:** Claude API (Anthropic direct), GitHub Actions (CI/CD)

### Cost Projections

**Year 1: Pilot (1 Refinery Site, ~100 Tags)**

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Azure Container Apps | $0 | Always-free tier |
| Azure Functions | $0 | Always-free tier |
| Azure IoT Hub | $0–25 | Free tier: 8K msg/day |
| Azure PostgreSQL (+ TimescaleDB) | $0 | Free 12 months (student credits) |
| Azure Key Vault | $0 | Always-free tier |
| Azure Bot Service | $0 | Free for Teams/Slack |
| Azure Blob Storage | $0.10–0.50 | Config, logs (~5–10 GB) |
| Redis (Azure Cache or self-managed) | $0–15 | Minimal usage |
| Claude API (Anthropic) | $7–18 | Blended Haiku + Sonnet |
| Windows VM (LP solver) | $0–15 | Azure B2s, student credits |
| **TOTAL** | **$8–75/month** | **$100–900/year** |

**Year 2: Scale (10 Sites, ~1,000 Tags)**

| Service | Monthly Cost |
|---------|-------------|
| Azure Container Apps | $15–40 |
| Azure Functions | $5–15 |
| Azure IoT Hub | $25–75 |
| Azure PostgreSQL | $25–50 |
| Redis | $15–30 |
| Azure Blob Storage | $2–10 |
| Claude API | $70–180 |
| Windows VMs (2–3 shared) | $50–150 |
| Monitoring / Logging | $10–30 |
| **TOTAL** | **$220–580/month ($2,600–7,000/year)** |

At $75K/site/year × 10 sites = $750K ARR. Cloud costs represent <1% of revenue.

### Deployment Pipeline

```
Developer pushes to GitHub
    → GitHub Actions CI
        → Lint (ruff) + Type check (mypy) + Unit tests (pytest)
        → Frontend: lint + type check + Vitest + Playwright E2E
        → Build Docker images
    → Merge to main
        → Auto-deploy to staging (Azure Container Apps)
        → Run integration tests against staging
    → Manual promotion to production
        → Blue-green deploy via Azure Container Apps revisions
```

### Environment Strategy

| Environment | Purpose | Infrastructure |
|-------------|---------|---------------|
| **Local dev** | Development | Docker Compose (FastAPI + TimescaleDB + Redis + Next.js) |
| **Staging** | Pre-production testing | Azure Container Apps (separate resource group, mock historian data) |
| **Production** | Live customer sites | Azure Container Apps (production resource group, real historian connections) |
| **Windows LP Worker** | Excel COM automation | Separate Azure B2s VM per 3–5 sites (cannot be containerized on Linux) |

---

## 9. Security Architecture

### OT/IT Network Boundary

```
Purdue Level 0-2 (OT)          Level 3.5 (DMZ)              Level 4-5 (IT/Cloud)
┌────────────────────┐    ┌───────────────────────┐    ┌────────────────────┐
│ DCS, PLCs, Sensors │    │ PI Archive (replica)  │    │ Reflex Cloud       │
│ PI Data Archive    │───▶│ PI Web API            │    │ (Azure)            │
│                    │rep │ Reflex Edge Agent     │───▶│                    │
│ NEVER accessed by  │    │                       │out │ Never requires     │
│ Reflex directly    │    │ Outbound HTTPS only   │    │ inbound firewall   │
└────────────────────┘    └───────────────────────┘    └────────────────────┘
```

- Edge Agent reads from PI Data Archive **replica** (never the primary)
- All communication is **outbound HTTPS only** — no inbound firewall rules required
- Edge Agent is **read-only** — never writes to any OT system
- Compatible with hardware data diodes (physically one-way)
- Edge Agent authenticates to PI Web API via Basic Auth over TLS (Kerberos optional for Windows deployments)

### Authentication Flows

1. **Edge Agent → Cloud:** API key (unique per agent, rotatable, stored in Azure Key Vault)
2. **User → Dashboard:** JWT tokens (issued via login endpoint, 1-hour expiry, refresh tokens)
3. **Dashboard → SSE:** JWT authentication on SSE endpoint
4. **Bot → Teams/Slack:** Azure Bot Service managed authentication (per-customer bot registration for Teams)
5. **Inter-module:** In-process function calls (no network authentication needed within monolith)

### Data Encryption

| At Rest | In Transit |
|---------|-----------|
| Azure PostgreSQL: TDE (transparent data encryption) enabled by default | All external communication over TLS 1.2+ |
| Azure Blob Storage: AES-256 encryption | Edge Agent → Cloud: HTTPS with certificate pinning |
| Redis: encryption at rest (Azure Cache for Redis) | PI Web API → Edge Agent: HTTPS within DMZ |
| Windows VM disks: BitLocker | Slack/Teams webhooks: HTTPS |

### Compliance Requirements

| Standard | Relevance | Reflex Approach |
|----------|-----------|----------------|
| **ISA/IEC 62443** | Industrial cybersecurity — required for OT-adjacent systems | Edge agent architecture follows Purdue Model. Read-only access. Outbound-only communication. Microsoft Defender for IoT for OT monitoring. |
| **OSHA PSM (29 CFR 1910.119)** | Management of Change — any tool changing operator decision-making | Pre-built MOC package (technical basis, impact assessment, training, procedure modifications). Phased onboarding with shadow mode. Complete audit trail. |
| **SOC 2 Type II** | Customer procurement requirement for cloud SaaS | Begin preparation in Phase 2 (6–12 month process). Use Defender for Cloud compliance dashboard. |
| **TSA SD-02F** | Pipeline security directive (May 2025) | Relevant for pipeline-connected refineries. Addressed by Purdue Model compliance and outbound-only architecture. |
| **NLRB / USW** | AI surveillance in workplaces; union bargaining | Override tracking by equipment only, never by operator. Contractual restrictions on override data use. Gain framing, not loss framing. |

---

## 10. Risk Mitigations Built Into Architecture

| Rank | Risk | Score | Architectural Mitigation |
|------|------|-------|-------------------------|
| 1 | **R1: Excel COM unsupported** | 125 | safexl + pywin32 with DispatchEx isolation, process-level watchdog (30s check), zombie cleanup, 5-minute hard timeout, queue backpressure with coalescing. LP Worker runs in separate Windows process via Celery. Strategic migration path to PuLP + HiGHS. |
| 2 | **R2: Delivery channel fails** | 125 | Primary user redefined as shift supervisor (desk + IT access). Structured 5-tap input (64px+ tiles, glove-compatible). Three channels: Teams Adaptive Cards, Slack Block Kit, email fallback. Never depend on field operator phone access. |
| 3 | **R3: Proprietary LP solvers** | 100 | LP tool landscape survey required before committing architecture (Phase 0). Excel Solver sites built first. PIMS/GRTMPS investigation as parallel track. If >60% of targets use PIMS, pivot strategy. LP model config is JSONB-driven — solver-agnostic at the orchestration layer. |
| 4 | **R4: Team credibility gap** | 100 | Non-negotiable: recruit process industry veteran with equity. Advisor-led sales model. Advisory board with former refinery managers. Engage KBC/Solomon consultants as technology gatekeepers. |
| 5 | **R5: LLM hallucination** | 80 | All numbers programmatically extracted — Claude handles natural language ONLY. Cross-validation on every output. Deterministic template fallback. NLP-extracted constraints never auto-applied — always confirmed via structured options. Numbers rendered in monospace font (frontend R5 enforcement). |
| 6 | **R6: OT network security** | 80 | Edge agent in DMZ (Level 3.5). Outbound-only HTTPS. Read-only historian access via PI Web API. Never writes to OT. Azure Defender for IoT. No inbound firewall rules. Data diode compatible. SOC 2 Type II preparation begins Phase 2. |
| 7 | **R7: OSHA PSM / MOC** | 80 | Complete audit_log table (every event with timestamp, actor, details). Pre-built MOC documentation package. Phased onboarding (shadow mode → guided → full). Positioned as "enhancing existing procedures" not introducing new ones. |
| 8 | **R8: Union/dashboard blame** | 64 | Overrides tracked by equipment/unit, NEVER by individual operator (no operator_id field in overrides table). "Value captured" gain framing throughout. Management dashboard architecturally prevented from showing individual operator data (API does not return it for that role). Contractual restrictions on override data use. |
| 9 | **R9: Alert fatigue** | 64 | Operating mode as first-class system concept (6 modes). All optimization suppressed during non-Normal modes. Percentage-based trigger thresholds (not fixed dollar). Hysteresis + debounce (2-min minimum) + cooldown (60-min minimum). Target: 1–2 recommendations per shift. Max 3 triggers per 12-hour shift hard cap. |
| 10 | **R10: Brutal sales cycle** | 75 | Secure 2–3 design partners for free/discounted pilots. Budget 18–24 months runway. Pursue EPC partnerships (Bechtel, Worley, Fluor). "Land with analytics, expand to optimization" to shorten cycle. Target refineries during pain points (post-turnaround, margin squeeze, senior planner retirement). |

---

## 11. Implementation Roadmap

### Phase 0: Validation (Weeks 1–8)

**Goal:** Answer three binary go/no-go questions before writing production code.

| Question | Method | Go/No-Go Criteria |
|----------|--------|-------------------|
| What LP tools do target refineries use? | Survey/interview 10–15 mid-size refineries | If >60% use PIMS/GRTMPS, pivot LP strategy |
| Can Excel COM automation work on a real LP model? | 72-hour stress test with a real customer model | If it can't sustain, invest in Python LP engine first |
| Can you recruit a domain expert? | Network through industry conferences, LinkedIn, advisory boards | If no credible domain expert by Week 8, pause the project |

**Cost:** Near zero (time only). **Output:** Go/no-go decision on whether to proceed.

### Phase 1: MVP — Single Pilot Site (Months 3–8, ~20 weeks)

**Goal:** Deploy a working system at 1 design partner refinery in shadow mode.

| Weeks | Deliverable |
|-------|-------------|
| 1–2 | Edge Agent: PI Web API reader + Data Quality Gateway + SQLite buffer + HTTPS push |
| 3–4 | Cloud backend: FastAPI scaffold, TimescaleDB schema, data ingestion + quality validation |
| 5–6 | Trigger engine: process drift + price movement rules, operating mode state machine |
| 7–8 | LP Orchestrator: Celery task queue, Windows LP Worker with Excel COM + watchdog |
| 9–10 | AI Translation: deterministic number extraction + Claude integration + template fallback + cross-validation |
| 11–12 | Messaging: Teams Adaptive Cards + Slack Block Kit + structured constraint input + email fallback |
| 13–14 | Frontend: Operations dashboard + recommendation feed + constraint registry + shadow mode UX |
| 15–16 | Constraint Registry: lifecycle management, equipment-level tracking, shift handover panel |
| 17–18 | Auth, RBAC, audit trail, admin dashboard skeleton, site onboarding wizard |
| 19–20 | Integration testing, shadow mode deployment at design partner, operator feedback collection |

**Key metric:** Do process engineers find recommendations accurate and actionable >80% of the time?

**Estimated effort:** 2–3 full-time engineers, 20 weeks.

### Phase 2: Beta — Scale to 3–5 Sites (Months 9–14, ~24 weeks)

**Goal:** Prove measurable margin improvement. Get first paying customers.

| Deliverable | Weeks |
|-------------|-------|
| Transition from shadow mode to active use at design partner | 2–3 |
| Analytics dashboard: opportunity cost waterfall, coefficient drift, sensor health matrix | 4–6 |
| Coefficient reconciliation engine (predicted vs. actual yields) | 3–4 |
| Constraint pattern detection ("HX-201 invoked 11 times in 60 days") | 2–3 |
| Sensor substitution management + maintenance prioritization | 2–3 |
| Onboard 2–4 additional pilot customers (parallel with above) | Ongoing |
| Publish case study with quantified ROI | 1–2 |
| Begin SOC 2 Type II preparation | Ongoing |

**Key metric:** Can you demonstrate $500K+ annual margin improvement at a real site?

**Estimated effort:** 3–4 full-time engineers, 24 weeks.

### Phase 3: GA — Production-Ready for 80+ Sites (Months 15–24, ~40 weeks)

**Goal:** 8–12 paying customers, $600K–$1.5M ARR, repeatable sales process.

| Deliverable |
|-------------|
| Standardized onboarding process (MOC package, training curriculum, shadow mode playbook) |
| Multi-site management (cross-site analytics, fleet-level dashboards) |
| LP model migration service (Excel → PuLP/HiGHS) as professional services |
| Evaluate migration: lightweight Python edge agent → Azure IoT Edge (for module management at scale) |
| Evaluate migration: TimescaleDB → Azure Data Explorer (if anomaly detection + KQL justify $90+/mo) |
| SOC 2 Type II certification completed |
| Tablet offline support (service worker, IndexedDB constraint queue) |
| Hire dedicated customer success / onboarding engineer |
| Explore adjacent verticals (petrochemical plants, fuel blenders) |
| Build relationships with Emerson, Honeywell, Schneider corporate development |

**Key metric:** Repeatable sales process with <12 month cycle. Net revenue retention >120%.

**Estimated effort:** 4–6 engineers + 1 customer success, 40 weeks.

---

## 12. Open Questions & Decisions Needed

### Unresolved Technical Questions

| # | Question | Impact | Decision Needed By |
|---|----------|--------|--------------------|
| 1 | **LP tool landscape:** What % of target refineries use Excel Solver vs. PIMS vs. GRTMPS? | Determines entire LP automation strategy. If >60% PIMS, major pivot needed. | Phase 0 (Week 4) |
| 2 | **Excel COM reliability:** Can a real customer LP model run unattended for 72+ hours? | If no, must accelerate PuLP/HiGHS migration path. | Phase 0 (Week 6) |
| 3 | **DCS console integration:** Should Reflex push advisory notifications to DCS (Honeywell Experion, Yokogawa)? | Reaches field operators directly but requires per-vendor OPC-UA integration. | Phase 2 planning |
| 4 | **Voice note transcription:** Should constraint voice notes be transcribed or stored as audio only? | Transcription reintroduces NLP accuracy concerns (R5). | Phase 1 Week 12 |

### Decisions Requiring Customer Input

| # | Question | Who Decides |
|---|----------|------------|
| 5 | Which specific PI tags should be monitored? (Top 100–150 per site) | Customer LP planner + process engineer |
| 6 | What are the appropriate trigger thresholds for each site? | Customer LP planner (calibrated during shadow mode) |
| 7 | What shift schedule does each site use? (8h × 3, 12h × 2, rotating) | Customer operations manager |
| 8 | Which Teams channels / Slack workspaces should receive recommendations? | Customer IT admin + shift supervisor |
| 9 | What MOC documentation format does each site require? | Customer PSM/safety manager |

### Agent Recommendation Conflicts (Resolved)

| Conflict | Agent 2A Said | Agent 2B/2C Said | Resolution |
|----------|--------------|-----------------|------------|
| Time-series DB | InfluxDB Cloud | TimescaleDB on PostgreSQL | **TimescaleDB** — one DB, full JOINs, no operational overhead (see Section 3) |
| Edge agent | Azure IoT Edge | Lightweight Python Docker | **Python Docker for MVP**, IoT Edge at Phase 3+ scale (see Section 3) |
| Hosting | Azure Container Apps | Railway/Render | **Azure Container Apps** — free tier + student credits + no migration needed (see Section 3) |
| Real-time protocol | Not specified | SSE vs. WebSocket | **SSE primary** — works through corporate proxies, simpler, matches unidirectional data flow |

---

*This specification should be revisited after Phase 0 validation. The LP tool landscape survey and domain expert recruitment outcomes will materially change the risk profile and may require rearchitecting the LP automation layer.*
