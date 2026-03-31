# Reflex Platform — Architecture Q&A Reference

> **Date:** 2026-03-27
> **Purpose:** Comprehensive FAQ for anyone unfamiliar with Reflex — covering product, architecture, AI, data, security, business, and student team guidance.
> **Sources:** Product transcript, Engineering Spec v1.0, Run 1 Risk Matrix, Run 2 research documents

---

## Table of Contents

1. [General](#general)
2. [Technical Architecture](#technical-architecture)
3. [AI / LLM](#ai--llm)
4. [Data & Security](#data--security)
5. [Business & Operations](#business--operations)
6. [For the Student Team](#for-the-student-team)

---

## General

### Q1: What is Reflex?

Reflex is a lightweight workflow optimization platform for mid-size oil refineries (50,000–200,000 barrels per day). It connects live process historian data and market pricing to existing LP (linear program) models, automatically re-solves when meaningful process or price shifts occur, translates dense mathematical output into plain-English recommendations via Claude API, and delivers those recommendations to shift supervisors through structured messaging channels (Teams/Slack/email) with a built-in constraint feedback loop.

Reflex does not replace existing LP models, does not control plant equipment, and does not require operators to learn new software — it acts as an automated data-entry clerk and translator sitting between systems that already exist but are manually disconnected.

### Q2: Who are the users?

There are four primary user roles:

1. **Shift Supervisors** (primary) — Work at desks with IT network access in the control room. Receive recommendations via Teams/Slack, respond with structured constraint feedback, manage the constraint registry. They are the human-in-the-loop decision makers.

2. **Process Engineers / LP Planners** — Maintain and tune the LP models. Use the analytics dashboard for coefficient reconciliation, drift detection, and constraint pattern analysis. Can manually trigger LP re-solves.

3. **Management** — View financial dashboards showing margin captured by equipment/unit (gain framing). Never see individual operator override costs. Use data for CapEx prioritization (which equipment to fix during turnaround).

4. **Plant Operators** (indirect) — Field operators interact with Reflex indirectly through their supervisors, which matches how refineries already work. They don't use the software directly because they work in ATEX hazardous zones where phones and computers aren't accessible.

### Q3: What problem does Reflex solve?

The LP planner at a mid-size refinery starts their morning manually pulling data from the process historian (sensor database), production reports, and market pricing feeds. They physically type this data into an Excel spreadsheet, rerun the optimization model, interpret the results, and email a recommendation to the operations team. This takes hours, so it happens once a day at best — sometimes only weekly.

Meanwhile, crude prices move, equipment conditions change, and crack spreads fluctuate continuously. The recommendation sent at 8 AM may be completely wrong by noon. But because there's no automated trigger to rerun the math, nobody does. The plant operates on stale instructions, losing money every hour.

Reflex automates this entire workflow: data collection → trigger detection → LP re-solve → translation → delivery → feedback. It turns a once-daily manual process into a continuous automated loop.

### Q4: How does Reflex make money?

**Pricing:** $75,000–$125,000 per site per year. This is a fraction of enterprise RTO alternatives ($300K–$800K/year for Aspen PIMS, Honeywell RPMS), making it an easy budget decision for mid-market plant managers.

**Revenue projections:**
- Year 3 realistic target: $2–3M ARR (not the original $8–15M — see Q43 for why)
- Design partners at $0–$75K during pilot phase
- Price increases with proven ROI case studies

**Exit strategy:** $100–250M acquisition by an industrial giant (AspenTech, Seeq, AVEVA, Honeywell) who would rather buy a proven mid-market channel than build a lightweight version of their heavy software.

**Infrastructure costs:** <1% of revenue ($3K–$10K/year at 10 sites). LLM costs are negligible (~$70–180/month at 10 sites).

### Q5: What is an LP (linear program)?

A linear program is a mathematical optimization model that finds the best possible outcome given a set of constraints. In refining, the objective is always maximizing margin. You feed it all your inputs — crude oil costs, equipment capacities, product market prices — and the LP calculates exactly how much of each product to make, at what rate, and on which processing units to generate maximum profit. Think of it as Google Maps for the refinery: input the road conditions (equipment capacities) and destination (maximum profit), and it gives you the optimal route. The math itself solves in seconds — the bottleneck is entirely in the manual workflow surrounding the math.

### Q6: What is a process historian?

A process historian is a massive industrial time-series database that stores every sensor reading from the plant — temperatures, pressures, flow rates, levels — typically at 1-second to 1-minute intervals. The dominant product in refining is OSIsoft PI (now AVEVA PI). A mid-size refinery has thousands of sensors, but Reflex monitors the top 100–200 that are most relevant to LP model inputs and key operating constraints.

### Q7: What is a crack spread?

The crack spread is the margin between crude oil input costs and refined product output prices. The most common is the "3:2:1 crack spread" — the profit from refining 3 barrels of crude oil into 2 barrels of gasoline and 1 barrel of diesel. Formula: `[(2 × Gasoline $/gal × 42) + (1 × Diesel $/gal × 42) - (3 × Crude $/bbl)] / 3`. When the crack spread widens, refining is more profitable and the LP should be re-solved to capture the opportunity.

### Q8: Why not just replace the Excel spreadsheet entirely?

Because refineries have spent years — sometimes decades — fine-tuning their Excel LP models to perfectly map their specific plant. These models contain deep institutional knowledge about equipment limits, process interactions, and yield relationships that would take months to recreate in any other format. Reflex's genius is that it works with the existing model unchanged — it just automates the data entry and translation that currently happens manually. Requiring model migration would be a deal-killing adoption barrier.

---

## Technical Architecture

### Q9: Why Azure over AWS?

Azure wins on the single most important dimension — industrial IoT connectivity:

1. **Azure IoT Edge** has a first-party OPC-UA Publisher module (open source, Microsoft-maintained). AWS requires custom integration or the less flexible SiteWise Edge Gateway.
2. **PI Integrator for Azure** is an official AVEVA/OSIsoft product that streams PI historian data into Azure. No equivalent exists for AWS.
3. **Microsoft Defender for IoT** provides Purdue Model-aware OT network monitoring. No AWS equivalent.
4. **Teams is dominant in oil & gas.** Azure Bot Service + Adaptive Cards gives native structured input. Building Teams bots on AWS still requires Azure AD — you end up on Azure anyway.
5. **Azure for Students** provides $100/year with just a .edu email (no credit card).

### Q10: Why NOT AWS?

AWS has a stronger general developer community and simpler security (GuardDuty). But for Reflex specifically: no official PI historian integration, no OPC-UA Publisher equivalent, no OT-specific security monitoring, Teams bots require Azure AD registration regardless, and no direct student credits since AWS Educate changed (~2022). AWS Bedrock hosts Claude, but the Claude API is cloud-agnostic — there's no reason to choose AWS for LLM access.

### Q11: How does Reflex connect to the refinery?

Through a **Reflex Edge Agent** — a lightweight Python Docker container (~60 MB) deployed in the customer's DMZ at Purdue Level 3.5. It reads from a read-only PI Data Archive replica via PI Web API over HTTPS. Data flows outbound only — no inbound firewall rules are ever required. The edge agent never writes to any OT system. It's compatible with hardware data diodes (physically one-way connections).

### Q12: How does it handle the OT/IT network boundary?

Refineries enforce strict Purdue Model network segmentation with 5 levels:
- **Level 0–2 (OT):** DCS, PLCs, sensors, primary PI historian — Reflex NEVER touches these
- **Level 3.5 (DMZ):** PI Data Archive replica, PI Web API, Reflex Edge Agent — this is where the edge agent lives
- **Level 4–5 (IT/Cloud):** Reflex cloud platform, dashboards, messaging

The edge agent sits in the DMZ, reads from the historian replica (not the primary), and pushes data outbound via HTTPS. This is the standard architecture pattern for industrial cloud connectivity and is the only design that passes OT security review.

### Q13: What happens when the cloud is unreachable?

The edge agent has a **SQLite buffer** for store-and-forward resilience. When the cloud API is unreachable, sensor readings buffer locally in SQLite and automatically flush when connectivity returns. No data is lost during outages. The main dashboard shows a "Last update: X seconds ago" badge and connection health indicators so supervisors always know the system's status.

### Q14: How does the trigger system work?

Two trigger types, both percentage-based and mode-gated:

1. **Process drift trigger:** A monitored sensor deviates from its rolling 4-hour baseline by more than a configured percentage of its operating range (e.g., 5%). Must persist for a minimum duration (e.g., 10 minutes) to filter transient spikes.

2. **Price movement trigger:** Crack spread or key price index moves by more than a configured percentage of its trailing 20-day average (e.g., 10%). This adapts to market volatility — unlike the original fixed $2/bbl threshold, which would over-trigger in volatile markets and under-trigger in stable ones.

**Safety mechanisms:**
- All triggers suppressed during non-Normal operating modes (Startup, Shutdown, Upset, Turnaround, Emergency)
- 60-minute minimum cooldown between triggers
- 2-minute minimum persistence before a trigger fires
- Hard cap: 3 triggers per 12-hour shift
- Queue backpressure: if LP solve is already running, triggers coalesce

### Q15: How does it interact with Excel?

The LP Orchestrator dispatches solve requests via Celery to a **Windows LP Worker** running on a separate Windows VM. The worker:

1. Opens the customer's Excel workbook via COM automation (safexl + pywin32 DispatchEx for isolated instances)
2. Writes input values (live sensor data, market prices) to mapped cells
3. Triggers Excel Solver or a VBA macro
4. Waits for completion with a 5-minute hard timeout
5. Reads output values from mapped cells
6. Returns structured results

Safeguards: DisplayAlerts=False (suppress modal dialogs), watchdog checks every 30s for hung Excel, zombie EXCEL.EXE cleanup every 60s, max 3 consecutive failures before full restart.

### Q16: Why not replace Excel entirely?

Because of adoption risk. Customers have spent years tuning their models, and requiring migration kills deals. However, Reflex is building a parallel escape hatch using PuLP + HiGHS (free, MIT-licensed LP solvers) that can run on Linux without COM automation. This will be offered as a professional service — "LP model migration" — for customers who want to eliminate Excel dependency. The LP Orchestrator is solver-agnostic at the configuration layer (JSONB-driven input/output mappings).

### Q17: What is the modular monolith architecture?

Reflex is built as a single deployable FastAPI application with 11 internal modules, each with defined interfaces and owned database tables:

1. **Data Ingestion** — receives sensor + market data
2. **Data Quality Gateway** — validates data, detects operating mode
3. **Trigger Engine** — evaluates ~200 rules against validated data
4. **LP Orchestrator** — queues and dispatches LP solve requests
5. **AI Translation** — deterministic numbers + Claude formatting
6. **Messaging Service** — delivers via Teams/Slack/email
7. **Feedback Processor** — processes structured constraint responses
8. **Constraint Registry** — maintains active constraints
9. **Reconciliation Engine** — predicted vs. actual yield comparison
10. **Dashboard API** — serves aggregated data to frontend
11. **Auth & Admin** — JWT, RBAC, API keys, audit log

Modules communicate through Python interfaces and Redis pub/sub. The only external process is the Windows LP Worker (inherently separate due to Excel COM). Clean boundaries allow module extraction into services if needed at scale.

### Q18: Why a monolith instead of microservices?

A team of 3–5 students cannot manage N services × (logging + monitoring + deployment + versioning). The monolith gives: single deployment, single repo, ACID transactions across modules, in-process function calls (no network latency), simple debugging with stack traces, one CI/CD pipeline. At 1–5 customers, microservices would be pure overhead with zero benefit. Module extraction is possible when/if a specific module needs to scale independently.

### Q19: What database does Reflex use?

A single PostgreSQL 16 instance with the TimescaleDB extension. TimescaleDB adds time-series capabilities (hypertables with automatic partitioning, 90%+ compression, continuous aggregates, retention policies) while keeping full PostgreSQL functionality (JOINs, foreign keys, transactions, JSONB, Row-Level Security).

**Time-series tables (hypertables):** sensor_readings, market_prices, crack_spreads, sensor_5min (continuous aggregate)
**Relational tables:** sites, users, tag_config, trigger_rules, operating_modes, lp_models, lp_runs, recommendations, constraints, overrides, opportunity_costs, sensor_substitutions, coefficient_snapshots, audit_log

Storage estimate: ~140 MB/year per site at 1-minute intervals with 90% compression. Cost: $20–50/month.

### Q20: Why TimescaleDB instead of InfluxDB?

The cloud platform research initially recommended InfluxDB Cloud (for its free tier). The data architecture and backend architecture research both overrode this with TimescaleDB. Reasons:

1. **One database instead of two** — simpler to operate, monitor, back up
2. **Full SQL JOINs** — coefficient reconciliation, opportunity cost tracking, and constraint pattern analysis all require joining time-series with relational data. With InfluxDB, this requires cross-database data movement.
3. **Standard PostgreSQL SQL** — no new query language to learn
4. **Comparable performance** — 150 rows/second is trivial for TimescaleDB (designed for 100K+)
5. **Azure student credits cover PostgreSQL** — InfluxDB's free tier advantage is offset

### Q21: How does the constraint registry work?

When a supervisor responds to a recommendation (e.g., "can't push Unit 2, HX-201 is fouling"), the structured 5-tap input captures: which unit, what type of constraint, which specific equipment, severity (% capacity reduction), and duration. This creates a constraint record in the registry, tracked by equipment (never by operator).

If the constraint is quantifiable (e.g., "reduce Unit 2 max throughput by 15%"), it's applied as a new bound in the LP model and triggers an automatic re-solve. The system comes back with a revised recommendation that respects the constraint. If the constraint is qualitative (e.g., "turnaround in 3 weeks"), it's logged, timestamped, and routed to the planning team.

The LP model will never re-recommend a move that conflicts with an active constraint until a human explicitly clears it — eliminating alert fatigue.

### Q22: What happens during a plant shutdown or upset?

The Data Quality Gateway runs an **operating mode state machine** with 6 modes: Normal, Startup, Shutdown, Upset, Turnaround, Emergency. Mode transitions are detected by: manual operator/supervisor override (always respected), automatic detection (>30% of sensors changing simultaneously, key unit status tags, rapid throughput decrease), or scheduled turnaround windows.

During any non-Normal mode, ALL optimization triggers are automatically suppressed. Safety alerts remain active regardless of mode. This prevents the system from generating meaningless recommendations when operators are under maximum cognitive load. This was identified as the #1 cause of permanent trust loss (R9, R14).

### Q23: What is the data flow from sensor to recommendation?

1. **Ingestion:** Edge Agent reads PI historian via PI Web API StreamSets (30–60s intervals)
2. **Quality:** Data Quality Gateway validates (staleness, range, rate-of-change, digital states, compression artifacts, operating mode)
3. **Storage:** Validated data written to TimescaleDB hypertables; continuous aggregates auto-compute 5-minute rollups
4. **Triggering:** Python rule evaluator checks ~200 rules → process drift (% of operating range) and price movement (% of trailing average) → mode-gated, debounced, coalesced
5. **LP Solve:** Celery task dispatched to Windows LP Worker → Excel COM → write inputs, trigger Solver, extract outputs (with watchdog, timeout, cleanup)
6. **Translation:** Deterministic code extracts numerical deltas → Claude API formats plain-English recommendation → cross-validation → template fallback if needed
7. **Delivery:** Azure Bot Service formats as Adaptive Card/Block Kit → Teams/Slack/email
8. **Feedback:** Supervisor responds via structured 5-tap input → constraint stored by equipment → triggers LP re-solve if quantifiable

---

## AI / LLM

### Q24: Why Claude specifically?

Claude is used for one narrow task: translating deterministic LP output into plain-English recommendations. The choice of Claude over GPT-4 or other LLMs is based on:

1. **First-class Python SDK** from Anthropic — simple integration
2. **Haiku model** at ~$0.001/call is extremely cost-effective for routine translation
3. **Sonnet** for complex constraint interpretation at ~$0.005/call
4. **Provider-agnostic API** — no cloud lock-in (works identically from Azure, AWS, or anywhere)
5. **Tool calling support** for structured NLP constraint extraction (with mandatory human confirmation)

The LLM choice is not a critical architectural decision because Claude handles only natural language formatting. If Claude disappeared tomorrow, the deterministic template fallback produces identical actionable information without any LLM.

### Q25: What if Claude hallucinates?

The architecture is specifically designed to make LLM hallucination irrelevant for safety:

1. **Numbers are NEVER generated by the LLM.** All numerical values are programmatically extracted from LP output using deterministic Python code. Claude receives pre-validated numbers and is instructed to use ONLY those numbers.
2. **Cross-validation** verifies every number in Claude's output against source data. Direction words (increase/decrease) are verified against the sign of the delta. Any mismatch → template fallback is used instead.
3. **Template fallback** produces identical actionable information without any LLM involvement. It's visually distinguishable so operators know the difference.
4. **NLP-extracted constraints never auto-apply.** When free-text is used, Claude extracts structured constraints via tool calling, but the system always presents its interpretation back with predefined options for confirmation.

In short: Claude can hallucinate freely without affecting any number that an operator sees. The worst case is awkward prose, not a wrong number.

### Q26: How do you validate AI output?

Every recommendation goes through a 5-step validation pipeline:

1. **Deterministic number extraction** — Python code extracts all values from LP output (no LLM)
2. **Delta calculation** — Python code compares current solve vs. previous solve
3. **Template selection** — choose prompt template based on trigger type
4. **Claude API call** — send extracted numbers + context + template; receive natural language
5. **Number cross-validation** — verify every number in Claude's text against extracted values; verify direction (increase/decrease matches sign); verify units; any mismatch → template fallback

### Q27: What are the AI cost projections?

| Scale | Model Mix | Monthly Cost | % of Revenue |
|-------|-----------|-------------|-------------|
| 1 site (pilot) | Haiku + Sonnet blend | $7–18 | N/A (pilot) |
| 10 sites | Haiku + Sonnet blend | $70–180 | <0.03% of $750K ARR |
| 50 sites | Haiku + Sonnet blend | $350–900 | <0.03% of $3.75M ARR |

LLM costs are negligible at any realistic scale. The cost driver is cloud infrastructure, not AI.

### Q28: How do you handle prompt versioning?

Prompt templates are stored in the `prompt_templates` table in PostgreSQL with versioning. Each template is associated with a trigger type and recommendation category. Changes to prompt templates are logged in the audit trail. The template fallback (deterministic, no LLM) serves as the baseline — any prompt change that produces worse results than the template is rolled back.

### Q29: What does the Claude prompt look like?

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

The prompt is designed to be constraining — it limits what Claude can do rather than expanding it.

### Q30: What is the deterministic template fallback?

When Claude is unavailable, rate-limited, or fails cross-validation, the system falls back to a deterministic template that produces the same actionable information without any LLM:

```
[PRICE MOVEMENT — HIGH PRIORITY]
Gasoline crack spread widened 12.3% ($2.26/bbl) over 2-hour trailing average.

Recommended changes:
  • Unit 3: Increase naphtha yield 22.0% → 30.0%
  • Unit 4: Increase feed rate 45,000 → 48,500 BPD

Estimated margin opportunity: +$44,000/day

Active constraints: HX-201 fouling (-15% capacity), Unit 6 catalyst aging (-8% yield)
```

This is visually distinguishable from LLM prose (no paragraph, bullet-point format) so operators know which type they're reading.

---

## Data & Security

### Q31: Where is data stored?

All data lives in a single managed PostgreSQL 16 + TimescaleDB instance on Azure. This includes:
- **Time-series:** sensor readings, market prices, crack spreads (in TimescaleDB hypertables with 90%+ compression)
- **Relational:** site config, users, constraints, LP models, recommendations, audit logs
- **LP model files:** Azure Blob Storage (versioned)
- **Cache/broker:** Redis (Celery task queue, application cache, pub/sub)

On customer premises, the edge agent has a small SQLite buffer for store-and-forward (temporary, flushed to cloud).

### Q32: How is data encrypted?

**At rest:**
- Azure PostgreSQL: Transparent Data Encryption (TDE) enabled by default
- Azure Blob Storage: AES-256 encryption
- Redis: Encryption at rest (Azure Cache for Redis)
- Windows VM disks: BitLocker

**In transit:**
- All external communication over TLS 1.2+
- Edge Agent → Cloud: HTTPS with certificate pinning
- PI Web API → Edge Agent: HTTPS within DMZ
- Slack/Teams webhooks: HTTPS
- Inter-module communication: in-process (no network)

### Q33: What about data sovereignty?

All data processing occurs in Azure regions selected per customer requirements. For North American refineries, data stays in US Azure regions. For European/Canadian expansion (Phase 3+), regional deployments can be added. The edge agent processes data in the customer's own DMZ before sending it to the cloud — raw PI historian data never leaves the customer network; only validated, summarized readings are transmitted.

### Q34: How does multi-tenancy work?

Single PostgreSQL database with Row-Level Security (RLS). Every table includes a `site_id` column. JWT tokens carry the user's authorized `site_ids` and role. RLS policies ensure users can only query data for their authorized sites. This is enforced at the database engine level — it cannot be bypassed by application bugs. Fleet managers with cross-site access have multiple `site_ids` in their JWT claims.

### Q35: What compliance standards does Reflex meet?

| Standard | Approach |
|----------|----------|
| **ISA/IEC 62443** | Edge agent follows Purdue Model; read-only access; outbound-only HTTPS; Defender for IoT |
| **OSHA PSM (29 CFR 1910.119)** | Pre-built MOC package; phased onboarding with shadow mode; complete audit trail |
| **SOC 2 Type II** | Preparation begins Phase 2 (6–12 month process); Defender for Cloud compliance dashboard |
| **TSA SD-02F** | Purdue Model compliance; outbound-only architecture |
| **NLRB / USW** | Override tracking by equipment only; contractual restrictions; gain framing |

### Q36: How is the audit trail structured?

The `audit_log` table captures every significant event with timestamp, actor, and details — designed for MOC (Management of Change) documentation requirements. Retained for 7 years (regulatory). Partitioned by month, archived to blob storage after 1 year. Every recommendation, override, constraint change, mode transition, and configuration change is logged.

### Q37: What data does the edge agent send to the cloud?

Only validated, summarized sensor readings: tag name, value, timestamp, quality flag. The edge agent does NOT send raw historian data — it runs the Data Quality Gateway locally, filtering out bad readings before transmission. A typical payload is ~100 tag values batched into a single HTTPS POST every 30–60 seconds. No PII, no control commands, no proprietary process information beyond the sensor values needed for LP optimization.

---

## Business & Operations

### Q38: How does pricing work?

$75,000–$125,000 per site per year. Start at $75K for design partners, increase with proven ROI case studies. This is a fraction of enterprise alternatives:

| Solution | Annual Cost |
|----------|------------|
| Aspen PIMS / Honeywell RPMS | $300K–$800K + staff |
| Total cost of ownership (enterprise RTO) | $1M+ |
| **Reflex** | **$75K–$125K** |

At target margins of $500K+ annual improvement per site, Reflex offers 4–7x ROI at the low price point.

### Q39: What does implementation look like?

**Phase 0 (2–4 weeks):** Site assessment — LP tool landscape, historian setup, network topology, MOC requirements
**Phase 1 (2–4 weeks):** Edge agent deployment — install in DMZ, configure PI Web API connection, validate data flow
**Phase 2 (2–4 weeks):** Shadow mode — recommendations generated alongside existing workflow; operators note agreement/disagreement
**Phase 3 (ongoing):** Active use — transition from shadow mode when accuracy >75% and false positives <10%

Total: 6–12 weeks from contract to active recommendations.

### Q40: How long to onboard a new site?

6–12 weeks total:
- 2–4 weeks for site assessment and edge agent deployment
- 2–4 weeks for shadow mode calibration
- 2–4 weeks for guided adoption with training

The biggest variable is IT/OT security approval, which can add 2–8 weeks depending on the customer's procurement process. Smaller refiners with shorter approval cycles are targeted first.

### Q41: What's the MVP vs full product?

**MVP (Phase 1, ~20 weeks of development):**
- Edge agent with PI Web API connection + data quality gateway
- Single-site trigger engine (process drift + price movement)
- LP Orchestrator with Excel COM automation
- Claude AI translation with template fallback
- Teams/Slack delivery with structured constraint input
- Operations dashboard with recommendation feed + constraint registry
- Shadow mode UX for first 2–4 weeks

**Full Product (Phase 2–3, additional ~64 weeks):**
- Analytics dashboard (opportunity cost waterfall, coefficient drift, sensor health)
- Coefficient reconciliation engine
- Constraint pattern detection
- Multi-site management and fleet dashboards
- LP model migration service (Excel → PuLP/HiGHS)
- SOC 2 Type II certification
- Tablet offline support
- DCS console integration

### Q42: What's the addressable market?

**Original claim:** 80–120 sites in North America, $8–15M ARR
**Research-adjusted:** 60–70 mid-size US + Canadian refineries in the target range. Realistic beachhead: 12–24 underserved refineries. Plan for $2–3M ARR in Year 3, not $8–15M.

Why the adjustment: EIA data shows exactly 60 mid-size US refineries. Many already use commercial LP tools. Sales cycles are 9–18 months. Each lost deal permanently shrinks the market by 1.4–1.7%.

Beyond refineries: specialty chemical plants and fuel blenders have the same problem, expanding the addressable market internationally.

### Q43: Why was the TAM reduced from $8–15M to $2–3M?

Three factors:
1. **Fewer sites:** EIA data shows 60 mid-size US refineries (not 80–120), ~68–70 including Canada
2. **Brutal sales cycles:** 9–18 months with multi-stakeholder sign-off (operations, engineering, IT, OT, safety, procurement, legal, C-suite)
3. **Realistic penetration:** With 12–24 beachhead sites and 9–18 month cycles, Year 3 revenue of $2–3M is honest. $8–15M would require >50% market penetration in an industry where sales cycles take 18 months.

### Q44: What does the competitive landscape look like?

| Competitor | Strength | Weakness for Mid-Market |
|------------|----------|------------------------|
| Aspen PIMS | Industry standard LP platform (400+ refineries) | $300K–$800K/year; requires dedicated staff; too expensive for mid-market |
| Honeywell RPMS | Integrated with Honeywell DCS ecosystem | Similar pricing; locked to Honeywell hardware |
| AVEVA (Schneider) | Process simulation + PI historian ecosystem | Focused on large refineries; 2–4 year window before they target mid-market |
| Imubit | AI-driven process optimization | Targets large refineries with >$1M deals; doesn't solve the Excel workflow problem |

Reflex's moat is not patents — it's speed to market, integration depth, and site-specific constraint knowledge bases that don't transfer to competitors.

### Q45: Why is team credibility a critical risk?

Every successful industrial software startup (Seeq, Imubit, OSIsoft) has founders with 10+ years of process industry experience. Refinery procurement requires vendors who understand FCC units, crude distillation, APC systems, and blending. A sales rep who can't distinguish a CDU from a coker will be dismissed in the first meeting. The refinery world is extremely small — one bad interaction travels fast.

**Resolution:** Non-negotiable requirement to recruit a process industry veteran (15+ years) as co-founder, CTO, or lead advisor with equity. This person leads all customer-facing conversations. "Advisor-led sales" model: domain expert leads, student team builds.

---

## For the Student Team

### Q46: What should we build first?

**Phase 0 (Weeks 1–8): Validation — before writing production code.**

Answer three go/no-go questions:
1. **What LP tools do target refineries actually use?** Survey 10–15 mid-size refineries. If >60% use PIMS/GRTMPS (not Excel Solver), the Excel COM automation strategy must change.
2. **Can Excel COM automation work on a real LP model?** Run a 72-hour stress test with a real customer model. If it can't sustain, invest in Python LP engine first.
3. **Can you recruit a domain expert?** If no credible domain expert by Week 8, pause the project.

**Phase 1 (Months 3–8): MVP — Single Pilot Site**

Build in this order (each builds on the previous):
| Weeks | Deliverable |
|-------|-------------|
| 1–2 | Edge Agent (PI Web API reader + Data Quality Gateway + SQLite buffer) |
| 3–4 | Cloud backend (FastAPI scaffold, TimescaleDB schema, data ingestion) |
| 5–6 | Trigger engine (process drift + price movement, operating mode) |
| 7–8 | LP Orchestrator (Celery, Windows LP Worker, Excel COM + watchdog) |
| 9–10 | AI Translation (number extraction + Claude + template fallback) |
| 11–12 | Messaging (Teams Adaptive Cards + Slack + constraint input) |
| 13–14 | Frontend (Operations dashboard + recommendation feed + shadow mode) |
| 15–16 | Constraint Registry + shift handover |
| 17–18 | Auth, RBAC, audit trail, admin dashboard |
| 19–20 | Integration testing + shadow mode deployment at design partner |

### Q47: What can we skip for the MVP?

Skip for MVP (build in Phase 2–3):
- Analytics dashboard (opportunity cost waterfall, coefficient drift, sensor health)
- Coefficient reconciliation engine
- Constraint pattern detection ("HX-201 invoked 11 times in 60 days")
- Multi-site management
- LP model migration to PuLP/HiGHS
- SOC 2 Type II certification
- Tablet offline support
- DCS console integration
- Advanced sensor substitution management

Focus MVP on: **data in → trigger → LP solve → translate → deliver → feedback loop.** That's the core value proposition.

### Q48: How do we test without a real refinery?

**Simulated historian data:**
1. Generate synthetic PI historian data using Python — realistic sensor profiles with noise, drift, and occasional faults
2. Use publicly available refinery process data (search for "Tennessee Eastman Process" dataset — classic chemical process simulation)
3. Build a PI Web API mock server that returns simulated StreamSets responses
4. Create a simplified Excel LP model (3–5 variables) for testing the full pipeline

**Simulated market data:**
- EIA API v2 provides free, real daily commodity prices — use actual market data
- OilPriceAPI ($0–15/month) provides intra-day prices for more realistic testing

**Integration testing:**
- Docker Compose environment: FastAPI + TimescaleDB + Redis + mock PI Web API + mock Excel LP
- Playwright E2E tests for the frontend
- Full pipeline test: simulated sensor spike → trigger fires → LP re-solves → Claude translates → Teams/Slack delivers → constraint submitted → LP re-solves with new bound

### Q49: What skills do we need to learn?

**Must-have (learn immediately):**
- Python async programming (FastAPI, asyncio)
- PostgreSQL + TimescaleDB (hypertables, continuous aggregates, RLS)
- Docker + Docker Compose (local development environment)
- Git workflow + GitHub Actions CI/CD
- Next.js 15 / React 19 / TypeScript basics
- Claude API integration (Anthropic Python SDK)

**Need for Phase 1 MVP:**
- pywin32 / COM automation (for Excel LP Worker)
- Azure Container Apps deployment
- Azure Bot Service + Teams Adaptive Cards
- Celery task queue patterns
- SSE (Server-Sent Events) for real-time updates

**Can learn during Phase 2:**
- TimescaleDB compression policies and continuous aggregates
- ECharts for analytical visualizations
- Terraform for infrastructure-as-code
- SOC 2 compliance processes

### Q50: How do we simulate historian data?

Create a Python script that generates realistic sensor profiles:

```python
import numpy as np
from datetime import datetime, timedelta

def generate_sensor_data(tag_name, base_value, noise_std, drift_rate, hours=24, interval_sec=60):
    """Generate realistic sensor data with noise, drift, and occasional faults."""
    n_points = int(hours * 3600 / interval_sec)
    timestamps = [datetime.utcnow() - timedelta(hours=hours) + timedelta(seconds=i*interval_sec) for i in range(n_points)]

    # Base signal with slow drift
    drift = np.linspace(0, drift_rate * hours, n_points)
    # Add realistic noise
    noise = np.random.normal(0, noise_std, n_points)
    # Add occasional step changes (shift changes, setpoint adjustments)
    steps = np.zeros(n_points)
    for _ in range(np.random.randint(1, 4)):
        step_idx = np.random.randint(0, n_points)
        steps[step_idx:] += np.random.normal(0, noise_std * 3)

    values = base_value + drift + noise + steps
    return list(zip(timestamps, values))

# Example: reactor inlet temperature (typical: 340-360°F, noise ±2°F)
reactor_temp = generate_sensor_data("TI-201.PV", base_value=350, noise_std=2, drift_rate=0.5)
```

Build a mock PI Web API endpoint that serves this data in the StreamSets response format. This lets you test the entire pipeline without any refinery connection.

### Q51: How do we stay under budget?

**Year 1 cost breakdown (pilot, 1 site):**

| Service | Monthly Cost |
|---------|-------------|
| Azure Container Apps | $0 (always-free tier) |
| Azure Functions | $0 (always-free tier) |
| Azure PostgreSQL | $0 (free 12 months, student credits) |
| Azure Bot Service | $0 (free for Teams/Slack) |
| Azure Key Vault | $0 (always-free tier) |
| Claude API | $7–18 (blended Haiku + Sonnet) |
| Windows VM | $0–15 (student credits) |
| Azure Blob Storage | $0.10–0.50 |
| **TOTAL** | **$8–75/month ($100–900/year)** |

**Budget strategies:**
1. Sign up for Azure for Students ($100 credit, .edu email, instant)
2. Apply for GitHub Student Developer Pack (free CI minutes)
3. Apply for Microsoft for Startups ($1K–$150K credits)
4. Use Claude Haiku ($0.001/call) for routine tasks, Sonnet only when needed
5. Use EIA API (free) for market data instead of OPIS/Platts
6. Docker Compose for local development (zero cloud cost while developing)

### Q52: How do we handle the Excel COM testing on our development machines?

You need at least one Windows machine (physical or VM) with Excel installed for LP Worker testing. Options:

1. **Azure B1s VM** ($0 with student credits for 750 hrs/month) — cheapest cloud option
2. **Local Windows machine** or **Boot Camp / Parallels** on Mac
3. **GitHub Actions Windows runner** — for CI testing of COM automation

For development, mock the LP Worker interface so Linux/Mac developers can work on everything except COM automation. Only the LP Worker integration tests need Windows.

### Q53: What's the simplest way to get started today?

1. **Sign up** for Azure for Students, GitHub Student Pack, Anthropic API, and InfluxDB Cloud (even though we chose TimescaleDB, it's useful for experimentation)
2. **Set up Docker Compose** with: FastAPI + TimescaleDB + Redis + Next.js
3. **Build the data ingestion endpoint** (`POST /api/v1/ingest/sensors`) and write test sensor data to TimescaleDB
4. **Build a mock PI Web API** that returns simulated StreamSets data
5. **Connect them**: mock PI → edge agent → cloud ingestion → TimescaleDB → query it back via dashboard

This gives you a working data pipeline in a weekend. Everything else builds on top of it.

### Q54: What are the biggest technical gotchas to watch out for?

1. **Excel COM hangs are real.** The watchdog and zombie cleanup aren't optional — they're essential. Test with modal dialogs, error states, and network disconnections.
2. **TimescaleDB hypertable creation is one-way.** You can't un-hypertable a table. Plan your schema carefully before creating hypertables.
3. **Teams bot approval takes 2–8 weeks per customer.** Start this process immediately with your design partner. Email fallback is your safety net.
4. **PI Web API WebID resolution is per-deployment.** Cache WebIDs but handle WebID changes (server upgrades, PI reinstalls).
5. **RLS policies must be tested rigorously.** A missing RLS policy = data leak across tenants. Write integration tests that verify role-based data isolation.
6. **SSE connections get killed by corporate proxies** after 30–60 seconds of inactivity. The 20-second heartbeat is essential.
7. **Azure Container Apps cold starts** can take 5–10 seconds. Keep at least one instance warm for the dashboard.

### Q55: How do we demo this without a real refinery?

Build a compelling demo environment:

1. **Simulated refinery** — Python script generating realistic sensor data for a simplified 3-unit refinery (CDU, FCC, Hydrotreater)
2. **Real market data** — EIA API v2 provides actual daily commodity prices for free
3. **Simplified LP model** — 5-variable Excel LP that optimizes yield split across 3 products
4. **Live trigger demo** — inject a price spike and show the full pipeline: trigger → LP solve → Claude recommendation → Teams message → constraint response → re-solve

The demo should show the feedback loop in real-time. Have someone play the "shift supervisor" and respond to recommendations via Teams while the audience watches the dashboard update.

### Q56: What's the most important thing to get right?

The **feedback loop**. It's Reflex's core differentiator. Not the data collection, not the LP solve, not the AI translation — those are all plumbing. The magic is: recommendation → operator responds with constraint → system remembers and re-solves → revised recommendation that respects the constraint → constraint registry that accumulates institutional knowledge.

If you build beautiful dashboards but the feedback loop doesn't work, you have a monitoring tool. If the feedback loop works but the dashboards are ugly, you have a product.

### Q57: How should we split work across the team?

Recommended team allocation for 4 developers:

| Developer | Focus | Key Technologies |
|-----------|-------|-----------------|
| **Dev 1 (Backend Lead)** | FastAPI modules, database schema, trigger engine, LP orchestrator | Python, PostgreSQL, TimescaleDB, Celery |
| **Dev 2 (Edge + Integration)** | Edge agent, PI Web API mock, data quality gateway, market data connector | Python, Docker, requests, SQLite |
| **Dev 3 (Frontend)** | Next.js dashboard, recommendation feed, constraint wizard, charting | TypeScript, React, Mantine, ECharts |
| **Dev 4 (AI + Messaging)** | Claude integration, template fallback, Teams/Slack bots, structured input | Python, Anthropic SDK, Azure Bot Service |

Everyone should understand the full architecture, but specialize for velocity.

### Q58: What documentation should we maintain?

- **ENGINEERING-SPEC.md** — already written, this is the truth document
- **Architecture Decision Records** — this document (architecture-decisions.md)
- **API documentation** — auto-generated by FastAPI's OpenAPI support
- **Deployment runbook** — step-by-step for each environment
- **MOC package** — technical basis, impact assessment, training materials (for customers)
- **README.md** — getting started for new developers (Docker Compose setup)

Do NOT maintain: separate design documents that duplicate the engineering spec, code comments that explain what (the code should be self-explanatory), or meeting notes (use project memories instead).

---

*This document should be updated as the architecture evolves, particularly after Phase 0 validation and first design partner deployment.*
