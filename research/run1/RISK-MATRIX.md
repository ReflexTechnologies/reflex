# Reflex Platform — Unified Risk Matrix

> **Date:** 2026-03-27
> **Synthesized from:** Technical Risk Assessment, Business Risk Assessment, Adoption Risk Assessment
> **Method:** Deduplicated 33 individual risks into 20 unique risks, scored on Severity (1-5) x Likelihood (1-5) x Timeline Impact (1-5). Maximum combined score = 125.

---

## Scoring Key

| Dimension | 1 | 2 | 3 | 4 | 5 |
|-----------|---|---|---|---|---|
| **Severity** | Cosmetic | Degraded experience | Major feature gap | Product viability threat | Company-killing |
| **Likelihood** | Unlikely (<10%) | Possible (10-30%) | Probable (30-60%) | Highly likely (60-90%) | Certain (>90%) |
| **Timeline Impact** | No delay | Weeks of delay | 1-3 month delay | 3-6 month delay | 6+ month delay / pivot required |

---

## Master Risk Ranking

| Rank | Risk ID | Risk Name | Sev | Lik | Time | Score | Must-Solve-Before-Building? |
|------|---------|-----------|-----|-----|------|-------|---------------------------|
| 1 | R1 | Excel COM automation is unsupported & unscalable | 5 | 5 | 5 | **125** | YES |
| 2 | R2 | Operator delivery channel doesn't work (Slack/Teams/PPE) | 5 | 5 | 5 | **125** | YES |
| 3 | R3 | Proprietary LP solvers (PIMS/GRTMPS) block core architecture | 5 | 4 | 5 | **100** | YES |
| 4 | R4 | Team credibility gap (student founders selling to refineries) | 5 | 5 | 4 | **100** | YES |
| 5 | R5 | LLM numerical hallucination + NLP constraint extraction failures | 5 | 4 | 4 | **80** | YES |
| 6 | R6 | OT network security / Purdue model / cybersecurity procurement | 4 | 5 | 4 | **80** | YES |
| 7 | R7 | OSHA PSM / Management of Change / regulatory compliance | 4 | 5 | 4 | **80** | YES |
| 8 | R8 | Union/labor blowback + opportunity cost dashboard blame culture | 4 | 4 | 4 | **64** | YES |
| 9 | R9 | Shutdown/startup/upset floods + alert fatigue + trigger calibration | 4 | 4 | 4 | **64** | YES |
| 10 | R10 | Brutal sales cycle in tiny, concentrating market | 5 | 5 | 3 | **75** | YES |
| 11 | R11 | Sensor glitches vs. real process changes | 4 | 4 | 3 | **48** | Defer (solve during pilot) |
| 12 | R12 | PI System integration complexity (Kerberos, Windows) | 3 | 5 | 3 | **45** | Defer (known engineering) |
| 13 | R13 | Historian compression artifacts / stale data | 3 | 4 | 3 | **36** | Defer (solve during pilot) |
| 14 | R14 | Algorithm aversion — one bad rec poisons the well | 4 | 3 | 3 | **36** | Defer (mitigate via shadow mode) |
| 15 | R15 | Shift handover integration gap | 4 | 3 | 3 | **36** | Defer (solve during pilot) |
| 16 | R16 | Overstated TAM / ARR projections | 3 | 5 | 2 | **30** | Defer (reframe, don't block) |
| 17 | R17 | Market data feed costs | 3 | 4 | 2 | **24** | Defer ("bring your own data") |
| 18 | R18 | Energy transition / shrinking market window | 3 | 3 | 2 | **18** | Defer (strategic, not blocking) |
| 19 | R19 | AVEVA/Schneider competitive threat | 3 | 2 | 2 | **12** | Defer (2-4 year window) |
| 20 | R20 | Pricing too low for value delivered | 2 | 3 | 1 | **6** | Defer (optimize later) |

---

## TOP 10: Must-Solve-Before-Building

### R1: Excel COM Automation Is Unsupported & Unscalable
**Score: 125 (5x5x5) — CRITICAL**

*Merged from: Tech #2 (COM unsupported), Tech #10 (single-threaded performance)*

Microsoft explicitly does not support server-side Excel automation. Documented failure modes include modal dialog hangs, zombie processes, 50GB memory leaks, clipboard crashes, and deadlocks. VBA/COM add-ins force single-threaded execution, creating a 30-second to 7+ minute floor per LP solve with no parallelization path. 32-bit Excel (still common) caps at 2GB RAM. There is no server-side alternative that supports Solver + VBA + COM add-ins.

**Why this blocks building:** The entire Reflex value proposition requires automated, reliable, unattended Excel execution. If this doesn't work, there is no product.

**Required resolution:**
- Validate with a real customer's LP model (not a toy model) that unattended COM automation works reliably over 72+ continuous hours
- Build watchdog process for hang detection, zombie cleanup, automatic restart
- Pin pywin32 to v301; use `DispatchEx` for isolated instances; set `DisplayAlerts = False`
- Implement queue backpressure to coalesce triggers when solve time exceeds trigger interval
- Begin parallel investment in Python LP engine (PuLP/Pyomo/OR-Tools) as strategic escape hatch

---

### R2: Operator Delivery Channel Doesn't Work
**Score: 125 (5x5x5) — CRITICAL**

*Merged from: Tech #11 (Teams bot approval), Adoption #1 (Slack doesn't reach operators), Adoption #5 (PPE input impossible)*

Three independent research threads converge on the same conclusion: Slack/Teams will not reliably reach refinery operators. Control rooms run DCS consoles (Honeywell Experion, Yokogawa CENTUM VP, Emerson DeltaV), not chat apps. Process areas are ATEX hazardous zones where standard phones cannot be carried. Even if operators had phones, typing Slack messages in chemical-resistant gloves is physically impossible. Voice-to-text degrades to ~65% accuracy at industrial noise levels. WiFi coverage across a 3-4 sq mile refinery is spotty. Teams requires per-customer IT admin approval (multi-tenant bot creation deprecated July 2025).

**Why this blocks building:** If operators cannot receive or respond to recommendations, the feedback loop — Reflex's core differentiator — does not exist.

**Required resolution:**
- **Redefine the primary user as the shift supervisor and process engineer**, not the field operator. These people work at desks with IT network access.
- Design a dual-channel delivery: Slack/Teams for engineers and supervisors; DCS console advisory notifications or dedicated control room display for operators
- Replace free-text Slack constraint input with structured 5-tap interface (large buttons, dropdowns, glove-compatible)
- Build email as universal fallback
- Budget 2-8 weeks per customer for Teams IT approval

---

### R3: Proprietary LP Solvers Block Core Architecture
**Score: 100 (5x4x5) — CRITICAL**

*From: Tech #3*

Many mid-size refineries use Aspen PIMS (400+ refineries worldwide), Haverly GRTMPS, or Honeywell RPMS — not Excel Solver. These are standalone LP engines that use Excel only as a data I/O layer. Automating them requires undocumented, vendor-specific COM/API integration. If the target market primarily uses PIMS/GRTMPS, Reflex's generic Excel automation approach fails entirely.

**Why this blocks building:** This is a binary market validation question. If most target customers use PIMS, not Excel Solver, the product concept must be rearchitected.

**Required resolution:**
- **Survey 10-15 target refineries immediately** to determine LP tool landscape (Excel Solver vs. PIMS vs. GRTMPS vs. RPMS)
- Segment the market: build for Excel Solver sites first
- For PIMS sites: investigate PIMS COM/OLE automation feasibility (poorly documented but exists)
- Consider LP model conversion to open-source solvers as professional service offering

---

### R4: Team Credibility Gap
**Score: 100 (5x5x4) — CRITICAL**

*From: Business #1*

Every successful industrial software startup (Seeq, Imubit, OSIsoft) has founders with 10+ years of process industry experience. Refinery procurement requires vendors who understand FCC units, crude distillation, APC systems, and blending. A sales rep who can't distinguish a CDU from a coker will be dismissed in the first meeting. The refinery world is small — one bad interaction travels fast.

**Why this blocks building:** Without domain credibility, you cannot get design partners, and without design partners, you cannot validate or sell anything.

**Required resolution:**
- Recruit a process industry veteran (15+ years at a major refinery or AspenTech/Honeywell/KBC) as co-founder, CTO, or lead advisor with equity
- Build advisory board with former refinery managers (Valero, PBF Energy, Marathon)
- Use "advisor-led sales" model: domain expert leads customer conversations, student team builds product
- Engage KBC and Solomon consultants — they are technology gatekeepers

---

### R5: LLM Hallucination + NLP Constraint Extraction Failures
**Score: 80 (5x4x4) — CRITICAL**

*Merged from: Tech #5 (numerical hallucination), Adoption #2 (NLP constraint extraction)*

Two distinct but related failure modes. First, LLMs repeat or fabricate numerical errors in up to 83% of cases when errors are present in source material. Misreading "2.3 MBPD" as "23 MBPD" or inverting increase/decrease in a refinery is dangerous. Second, extracting mathematical constraints from operator Slack messages ("heat exchanger 201 is fouling") achieves only 46-85% accuracy on complex industrial problems, with the core problem being missing quantitative information — the operator didn't specify whether fouling means 5% or 35% capacity reduction.

**Why this blocks building:** Incorrect numbers or constraints in a safety-critical environment destroys trust immediately (algorithm aversion) and creates liability.

**Required resolution:**
- **Decouple numbers from LLM entirely.** Programmatically extract all numerical values from LP output; use LLM only for natural language formatting
- Cross-validate every number in LLM output against source data; verify direction (increase/decrease matches sign)
- Build deterministic template-based fallback for LLM downtime or validation failure
- **Never auto-apply extracted constraints.** Always present interpretation back with structured options: "I interpreted 'HX-201 fouling' as 'reduce max throughput by 15%.' [5%] [10%] [15%] [20%] [Other]"
- Ground constraint extraction with plant-specific knowledge base (equipment IDs, historical fouling rates, design limits)

---

### R6: OT Network Security / Purdue Model / Cybersecurity Procurement
**Score: 80 (4x5x4) — CRITICAL**

*Merged from: Tech #1 (Purdue model), Business #8 (regulatory barriers), Adoption #9 (cybersecurity procurement)*

Refineries enforce strict Purdue Model network segmentation. Cloud tools cannot directly connect to OT historians. All data must flow through a DMZ via historian replicas. Some sites use hardware data diodes (physically one-way). Security approval takes 6-18 months requiring SOC 2 Type II, pen test results, IEC 62443 compliance, SBOM, and right-to-audit clauses. TSA Pipeline Security Directive SD-02F (effective May 2025) adds further requirements.

**Why this blocks building:** Architecture decisions made now determine whether the product can actually be deployed. Getting this wrong means 6+ months of rework.

**Required resolution:**
- Build **Reflex Edge Agent** deployed in customer DMZ (Level 3.5) that reads historian replicas and pushes data outbound via HTTPS. Never require inbound firewall rules.
- Design for read-only historian access — never write to OT systems
- Begin SOC 2 Type II preparation immediately (6-12 month process)
- Position as "decision support only" to reduce regulatory burden vs. autonomous control
- Target smaller refiners first where approval cycles are shorter

---

### R7: OSHA PSM / Management of Change / Training Requirements
**Score: 80 (4x5x4) — CRITICAL**

*Merged from: Adoption #3 (OSHA PSM), Business #8 (regulatory barriers)*

OSHA PSM (29 CFR 1910.119) requires written MOC procedures for changes to process technology and procedures. A tool that changes how operators make decisions about process parameters constitutes a change requiring MOC documentation, impact assessment, and training — regardless of delivery mechanism. Claiming "it's just Slack messages" provides no exemption. MOC is one of the most frequently cited PSM elements. The 2005 Texas City explosion was partly attributed to MOC failures. If deployed without MOC, the customer faces OSHA citation risk — a direct sales barrier.

**Why this blocks building:** Refinery safety managers will ask about MOC compliance in the first meeting. Without a ready answer, the deal is dead.

**Required resolution:**
- Build MOC support package into the sales process: technical basis document, impact assessment template, training curriculum, operating procedure modifications
- Design phased onboarding: Shadow mode (2-4 weeks) → Guided adoption → Full deployment
- **Never claim "no training required."** Instead: "Minimal training with structured onboarding and MOC documentation included"
- Position Reflex as enhancing existing procedures, not introducing new ones

---

### R8: Union/Labor Blowback + Dashboard Blame Culture
**Score: 64 (4x4x4) — HIGH**

*Merged from: Adoption #4 (union/labor), Adoption #8 (dashboard blame culture)*

The USW is actively bargaining over AI in refineries (2026 national pattern bargaining covers ~30,000 workers). The opportunity cost dashboard tracking operator overrides creates specific legal exposure: NLRB's 2022 memo establishes that AI surveillance affecting working conditions is a mandatory bargaining subject. If operators know overrides are tracked with dollar costs, they face pressure to follow AI blindly — a safety risk. Research shows loss-framing feedback actually decreases performance ~33% of the time.

**Why this blocks building:** Union grievance or NLRB complaint during a pilot would be devastating. Dashboard design done wrong creates the opposite of the intended behavior change.

**Required resolution:**
- Track overrides by equipment/unit, not by individual operator
- Contractually guarantee override data will never be used for performance evaluation, discipline, or termination
- Separate audiences: management sees financial summaries; operators never see dollar-denominated scorecards of their overrides
- Reframe from loss to capture: "$1.2M captured (82% capture rate)" not "$450K lost from overrides"
- Engage unions proactively before deployment; create joint labor-management committees

---

### R9: Shutdown/Startup/Upset Floods + Alert Fatigue + Trigger Calibration
**Score: 64 (4x4x4) — HIGH**

*Merged from: Tech #4 (shutdown floods), Adoption #10 (price trigger miscalibration)*

During plant shutdowns/startups/upsets (50% of safety incidents occur here), nearly all sensors change dramatically. These are expected transitions, not optimization signals. If Reflex triggers re-solves during these periods, it generates meaningless recommendations when operators are under maximum cognitive load. The $2/bbl crack spread threshold is also problematic — it represents 8-20% of a normal spread but only ~5% of an elevated spread, causing over-triggering in volatile markets.

**Why this blocks building:** Alert fatigue from false recommendations during the first shutdown event will permanently destroy operator trust.

**Required resolution:**
- Implement **operating mode detection** as first-class concept (Normal, Startup, Shutdown, Upset, Turnaround, Emergency)
- Auto-suppress all optimization triggers during non-normal modes; allow manual override
- Use percentage-based or volatility-adjusted price thresholds (e.g., 10% of trailing 20-day average spread)
- Separate safety alerts (always active) from economic optimization alerts (mode-gated)
- Target 1-2 recommendations per shift during normal operations; track actionability rate

---

### R10: Brutal Sales Cycle in Tiny, Concentrating Market
**Score: 75 (5x5x3) — CRITICAL**

*Merged from: Business #2 (sales cycle), Business #5 (customer concentration)*

Sales cycles are 9-18 months with multi-stakeholder sign-off (operations, engineering, IT, OT, safety/EHS, procurement, legal, C-suite). Getting on an Approved Vendor List alone takes 3-6 months. With only 60-70 addressable mid-size refineries in North America, each lost deal permanently shrinks the market by 1.4-1.7%. The real beachhead is 12-24 underserved refineries, not 80-120.

**Why this blocks building:** Insufficient runway to survive 2-3 sales cycles before first revenue will kill the company regardless of product quality.

**Required resolution:**
- Secure 2-3 design partner refineries willing to run free/discounted pilots — these become reference customers
- Budget for 18-24 months of runway before meaningful revenue
- Pursue EPC firm partnerships (Bechtel, Worley, Fluor) — a single endorsement unlocks dozens of refineries
- Consider "land with analytics, expand to optimization" — sell lighter monitoring first to shorten cycle
- Target refineries during specific pain points: post-turnaround, margin squeeze, senior planner retirement

---

## Risks Acceptable to Defer

| ID | Risk | Score | Why Deferrable |
|----|------|-------|---------------|
| R11 | Sensor glitches vs. real changes | 48 | Solve iteratively during pilot with real data; multi-signal validation is known engineering |
| R12 | PI System integration complexity | 45 | Known patterns, per-customer work; budget 2-4 weeks per site |
| R13 | Historian compression artifacts | 36 | Data quality gateway built incrementally; audit compression settings per customer |
| R14 | Algorithm aversion from early errors | 36 | Mitigated by shadow mode deployment; curate first 10-20 recommendations |
| R15 | Shift handover integration gap | 36 | Integrate with existing tools (j5, ShiftConnector) during pilot; not a blocker for MVP |
| R16 | Overstated TAM/ARR projections | 30 | Reframe expectations; doesn't block product development |
| R17 | Market data feed costs | 24 | "Bring your own data" model eliminates this entirely |
| R18 | Energy transition / shrinking window | 18 | Strategic concern; focus on Gulf Coast; plan 5-7 year window |
| R19 | AVEVA competitive threat | 12 | 2-4 year window from incumbent distraction; move fast |
| R20 | Pricing too low | 6 | Optimize pricing after proving value; start low to reduce friction |

---

## Risk Interdependency Map

```
R3 (LP Solver Landscape) ──determines──> R1 (Excel COM Automation)
   │  If customers use PIMS, not Excel, then R1 is moot
   │  but a new "PIMS automation" risk replaces it
   │
R4 (Team Credibility) ──gates──> R10 (Sales Cycle)
   │  Without credibility, sales cycle is infinite
   │  With a domain expert, cycle shortens to 9-12 months
   │
R6 (OT Security / Edge Agent) ──gates──> R12 (PI Integration)
   │  Edge agent architecture must be right before
   │  PI integration details matter
   │
R2 (Delivery Channel) ──gates──> R5 (LLM/NLP Accuracy)
   │  If you can't reach operators, accuracy of
   │  the message content is irrelevant
   │
R2 (Delivery Channel) ──gates──> R8 (Union/Dashboard)
   │  Dashboard design depends on knowing who
   │  sees what on which channel
   │
R9 (Alert Fatigue) ──amplifies──> R14 (Algorithm Aversion)
   │  False alerts during shutdowns are the #1
   │  cause of permanent trust loss
   │
R5 (LLM Accuracy) ──amplifies──> R14 (Algorithm Aversion)
   │  A single hallucinated number resets months
   │  of trust-building
   │
R7 (OSHA/MOC) ──gates──> R10 (Sales Cycle)
   │  Without MOC documentation ready, safety
   │  managers block procurement
   │
R1 (Excel COM) ──constrains──> R9 (Alert Fatigue)
   │  If solve time is 5+ minutes, you can't
   │  trigger more than a few times per shift anyway
   │
R10 (Sales Cycle) ──constrains──> R16 (TAM)
   │  Long sales cycles in a small market mean
   │  realistic penetration is even lower
```

**Critical chain:** R3 → R1 → R9 → R14. If the LP solver question isn't answered first, every downstream technical decision is speculative.

---

## GO/NO-GO Assessment by System Component

### 1. Historian Data Connector (Edge Agent)
**GO — with conditions**

| Factor | Assessment |
|--------|-----------|
| Technical feasibility | HIGH — PI Web API is REST-based, well-documented |
| Architecture risk | MEDIUM — edge deployment in DMZ is standard practice |
| Deployment friction | HIGH — 6-18 month security approval per customer |
| Blocking risks | R6 (OT security), R12 (PI integration) |

**Conditions:** Must build edge agent architecture from day one. Must begin SOC 2 Type II immediately. Must target smaller refiners with shorter approval cycles first.

---

### 2. Excel LP Automation Engine
**CONDITIONAL GO — requires immediate validation**

| Factor | Assessment |
|--------|-----------|
| Technical feasibility | LOW-MEDIUM — Microsoft explicitly does not support this |
| Architecture risk | CRITICAL — single point of failure, no alternative |
| Deployment friction | HIGH — requires Windows VM, watchdog, per-customer tuning |
| Blocking risks | R1 (COM unsupported), R3 (LP solver landscape) |

**Conditions:** Must validate with a real customer LP model within 30 days. If validation fails, must pivot to Python LP engine strategy. Must survey target market for PIMS/GRTMPS prevalence before committing architecture.

**NO-GO trigger:** If >60% of target customers use PIMS/GRTMPS (not Excel Solver), pivot the LP automation strategy entirely.

---

### 3. LLM Translation Layer (Claude)
**GO — with guardrails**

| Factor | Assessment |
|--------|-----------|
| Technical feasibility | HIGH — LLM text generation is mature |
| Architecture risk | MEDIUM — hallucination risk requires deterministic guardrails |
| Deployment friction | LOW — API integration is straightforward |
| Blocking risks | R5 (hallucination), R13 (Claude SLA) |

**Conditions:** Must decouple all numbers from LLM processing. Must build deterministic template fallback. Must cross-validate every number. Must never auto-apply NLP-extracted constraints.

---

### 4. Operator Communication Layer (Slack/Teams)
**CONDITIONAL GO — requires architecture redesign**

| Factor | Assessment |
|--------|-----------|
| Technical feasibility | MEDIUM — Slack/Teams work for desk workers, not field operators |
| Architecture risk | HIGH — current design targets wrong user with wrong channel |
| Deployment friction | HIGH — Teams IT approval, ATEX zones, PPE constraints |
| Blocking risks | R2 (delivery channel), R8 (union/dashboard) |

**Conditions:** Must redefine primary user as shift supervisor and process engineer. Must design structured (not free-text) constraint input. Must build email fallback. Must plan for DCS console integration as a future channel.

**NO-GO trigger:** If pilot sites have no IT network access for any operations-adjacent staff, the communication architecture must be fundamentally rethought.

---

### 5. Constraint Registry + Feedback Loop
**GO — with legal safeguards**

| Factor | Assessment |
|--------|-----------|
| Technical feasibility | HIGH — database + workflow is standard engineering |
| Architecture risk | LOW — proven concept maps to "Standing Orders" in existing tools |
| Deployment friction | MEDIUM — union/labor relations, handover integration |
| Blocking risks | R7 (OSHA/MOC), R8 (union/labor), R15 (shift handover) |

**Conditions:** Must track by equipment, not by operator. Must provide MOC documentation package. Must integrate with existing handover tools. Must contractually limit override data use.

---

### 6. Opportunity Cost Dashboard
**GO — with audience separation**

| Factor | Assessment |
|--------|-----------|
| Technical feasibility | HIGH — analytics dashboard is standard |
| Architecture risk | LOW-MEDIUM — behavioral risk, not technical risk |
| Deployment friction | MEDIUM — union concerns, audience design |
| Blocking risks | R8 (blame culture), R4 (union/labor) |

**Conditions:** Must separate management view from operator view. Must frame as "value captured" not "value lost." Must never show individual operator override costs.

---

### 7. Coefficient Reconciliation Engine
**GO**

| Factor | Assessment |
|--------|-----------|
| Technical feasibility | HIGH — statistical comparison of predicted vs. actual |
| Architecture risk | LOW — well-defined mathematical problem |
| Deployment friction | LOW — value-add feature, not core dependency |
| Blocking risks | R11 (sensor quality), R13 (data compression) |

**Conditions:** Requires reliable historian data (addressed by Data Quality Gateway). Can be built as Phase 2 feature.

---

## Risk-Adjusted Architecture Recommendations

Based on the risk analysis, the following design changes are recommended versus the architecture described in the product transcript:

### 1. Redefine the Primary User

**Transcript assumption:** Field operators receive Slack messages and type feedback.
**Risk-adjusted design:** The primary user is the **shift supervisor and process engineer** who works at a desk with IT network access. Field operators receive information through existing channels (DCS console, radio, supervisor handoff). The feedback loop flows through the supervisor, not directly through field operators.

### 2. Build "Reflex Edge Agent" as Core Architecture

**Transcript assumption:** Cloud-based tool connects to historian (possibly via Seeq).
**Risk-adjusted design:** Deploy a lightweight edge agent in the customer's DMZ that reads from historian replicas via PI Web API and pushes data outbound over HTTPS. Never depend on Seeq as the data access layer. Never require inbound firewall rules. This is not optional — it is the only architecture that passes OT security review.

### 3. Build a Data Quality Gateway

**Transcript assumption:** Live historian data feeds directly into trigger logic.
**Risk-adjusted design:** All historian data passes through a Data Quality Gateway before reaching any trigger or LP logic. The gateway checks for: digital states, staleness, rate-of-change violations, cross-signal consistency, compression artifacts, operating mode, and sensor health. No raw historian data directly triggers an LP re-solve.

### 4. Decouple Numbers from LLM

**Transcript assumption:** Claude processes LP output and generates recommendations with numbers.
**Risk-adjusted design:** Programmatically extract all numerical values from LP output. Use LLM only for natural language context and formatting. Cross-validate every number against source data. Build a deterministic template-based fallback for LLM downtime or validation failure. Never let the LLM handle raw numerical extraction.

### 5. Replace Free-Text Feedback with Structured Input

**Transcript assumption:** Operators type constraint feedback in Slack (e.g., "can't push unit 2, heat exchanger 201 is fouling").
**Risk-adjusted design:** Offer structured constraint capture: select unit (1 tap) → select constraint type (1 tap) → select severity (1 tap) → optional voice note or photo. Never auto-apply NLP-extracted constraints without explicit confirmation with predefined options.

### 6. Implement Operating Mode Detection

**Transcript assumption:** Process and price triggers fire continuously.
**Risk-adjusted design:** Operating mode (Normal, Startup, Shutdown, Upset, Turnaround, Emergency) is a first-class system concept. All optimization triggers are automatically suppressed during non-normal modes. Safety alerts remain active regardless of mode. Target 1-2 recommendations per shift during normal operations.

### 7. Audience-Separated Dashboard Design

**Transcript assumption:** Opportunity cost dashboard shows money lost from operator overrides.
**Risk-adjusted design:** Management dashboard shows financial summaries by equipment/unit ("Unit 3: 47 constraint interactions, top 3 root causes"). Operator-facing view shows "value captured" framing and upcoming recommendations, never individual override costs. Override data is contractually restricted from use in performance evaluation.

### 8. "Bring Your Own Data" Model

**Transcript assumption:** Reflex connects to market data feeds like OPIS or Platts.
**Risk-adjusted design:** Customer supplies their own OPIS/Platts data (they already have subscriptions). Reflex ingests it, never redistributes raw pricing. For MVP/demo, use EIA + OilPriceAPI at near-zero cost. This eliminates $10K-$50K/year licensing costs and redistribution legal risk.

### 9. LP Tool Validation Gate

**Transcript assumption:** LP models live in Excel spreadsheets.
**Risk-adjusted design:** Before committing to the Excel automation architecture, validate with 10-15 target refineries what LP tools they actually use. If the market primarily uses PIMS/GRTMPS, the automation strategy must change. This is a 30-day market validation exercise that should precede any engineering investment.

### 10. MOC-Ready Sales Process

**Transcript assumption:** "No training required" because it's just Slack messages.
**Risk-adjusted design:** Every sales engagement includes a pre-built MOC package (technical basis, impact assessment, training curriculum, procedure modifications). Phased onboarding: Shadow mode (2-4 weeks) → Guided adoption with training → Full deployment. Position as "minimal training with structured onboarding" — never "no training required."

---

*This matrix should be revisited after the LP tool landscape survey (R3) and first design partner engagement (R4/R10), as those findings will materially change the risk profile.*
