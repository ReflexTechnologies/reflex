# Reflex Adoption Risk Assessment

> **Date:** 2026-03-27
> **Scope:** Operator adoption, trust, usability, and human factors risks for the Reflex platform
> **Method:** Web research across 10 domains, synthesized from academic studies, industry standards, incident reports, labor law, and vendor case studies

---

## Risk #1: Slack/Teams Does Not Reach Operators on Shift

**Severity: CRITICAL**

The entire Reflex product depends on operators seeing and responding to Slack/Teams messages during shifts. The research strongly indicates this channel will not reliably reach the people who need to act on recommendations.

### Evidence

- **Physical barriers:** Refinery process areas are classified as ATEX/IECEx hazardous zones. Standard consumer phones (running Slack) cannot be carried into Zone 0 or Zone 1 areas. 35% of ignition incidents in hazardous areas originate from unauthorized electronics. 80% of industrial safety managers require ATEX-certified devices. Intrinsically safe phones ($1,000-2,000+) exist but run specialized apps, not Slack.
- **Network barriers:** Refinery networks follow the Purdue Model with strict OT/IT segmentation. Slack operates at Level 5 (enterprise IT); operators work at Levels 0-3 (OT). These networks are explicitly separated. WiFi coverage across a 3-4 sq mile refinery is described as "spotty and unpredictable."
- **Regulatory barriers:** TSA Security Directive Pipeline-2021-02F, NIST SP 800-82 Rev. 3, and IEC 62443 all restrict connectivity between enterprise IT and OT systems. CISO approval for new SaaS tools at critical infrastructure sites takes 6-18 months and may be denied.
- **Behavioral barriers:** Board operators monitor DCS consoles (Honeywell Experion, Yokogawa CENTUM VP, Emerson DeltaV), not chat apps. Field operators use two-way radios and rugged tablets with dedicated inspection apps. No published case study shows Slack/Teams used by frontline refinery operators on shift.
- **What operators actually use:** DCS/HMI console alarms (always in front of them), two-way radios (universal), PA systems, pagers, and increasingly rugged tablets running Honeywell Forge or Yokogawa Field Assistant.

### Suggested Mitigation

**Adopt a dual-channel strategy:**
1. **Primary (operators):** Push recommendations as advisory notifications to the DCS console via OPC-UA integration, or display on a dedicated control room screen. Alternatively, embed in rugged tablet apps operators already use.
2. **Secondary (engineers/management):** Keep Slack/Teams for process engineers, reliability engineers, and plant management who work at desks with IT network access and influence operational decisions.
3. **Shift supervisor as bridge:** Deliver to shift supervisors who can communicate to operators via radio or in-person, matching existing workflows.

---

## Risk #2: NLP Constraint Extraction Is Unreliable for Safety-Critical Applications

**Severity: CRITICAL**

Reflex uses Claude to extract mathematical constraints from natural language Slack messages (e.g., "heat exchanger 201 is fouling" must become a specific capacity bound). The research shows this is an unsolved problem with dangerous failure modes.

### Evidence

- **Accuracy on complex industrial problems: 46-85%.** The Autoformulation benchmark (ICML 2025) shows LLM error rates exceeding 15% on most benchmarks and reaching 54% on complex industrial problems (IndustryOR dataset). Even the best system (ConstraintLLM, EMNLP 2025) achieves meaningful accuracy only on well-structured problems, not informal Slack messages.
- **The core problem: missing quantitative information.** "Heat exchanger 201 is fouling" contains zero quantitative data. The LLM must hallucinate a number -- is it 5% capacity reduction or 35%? The operator didn't say, and the consequences of getting it wrong in a refinery are potentially dangerous.
- **NASA assessment (2025):** Characterized LLMs as generators of output "uttered without regard for its truth value" -- fundamentally problematic for safety-critical applications. If the LLM "fails to identify critical defeaters a human expert would have included, developers and stakeholders may have false confidence."
- **Silent failure mode:** The LLM confidently extracts a wrong constraint magnitude, the operator (busy, fatigued) approves it without careful review, and the LP model produces an unsafe operating plan.
- **~80% of operator knowledge is tacit** (Nonaka SECI model) -- it cannot be easily articulated in text. The two-path feedback system captures only the explicit fraction.

### Suggested Mitigation

1. **Never auto-apply extracted constraints.** Always present the interpretation back to the operator for confirmation: "I interpreted 'HX-201 is fouling' as 'reduce max throughput by 15%.' Is that right? [5%] [10%] [15%] [20%] [Other]"
2. **Ground with a plant-specific knowledge base** mapping equipment IDs to typical constraint ranges, historical fouling rates, and design limits via RAG.
3. **Offer structured fallback** when LLM confidence is low: predefined constraint categories and severity levels that require selection rather than free text.
4. **Track extraction accuracy** over time and build correction feedback loops.

---

## Risk #3: "No Training Required" Likely Violates OSHA PSM Law

**Severity: CRITICAL**

The transcript claims "no training required" because Reflex delivers Slack messages. Deploying a tool that changes operational decision-making at PSM-covered refineries triggers federal Management of Change and training requirements.

### Evidence

- **OSHA PSM (29 CFR 1910.119)** requires employers to "establish and implement written procedures to manage changes to process chemicals, technology, equipment, and procedures." Employees "shall be informed of, and trained in, the change prior to start-up of the process or affected part of the process."
- **MOC is one of the most frequently cited PSM elements.** The 2005 Texas City refinery explosion was partly attributed to failure to implement proper MOC procedures.
- **A tool that changes how operators make decisions about process parameters constitutes a change in "technology" and/or "procedures" under PSM**, regardless of delivery mechanism. Claiming "it's just Slack messages" does not exempt it.
- **58% of employees** say their employer uses advanced digital tools but doesn't offer required training (general workforce stat). For decision support systems specifically, research on AI-enabled systems found "limited exposure and training shaped trust, confidence, and uptake."
- **Industry norm is weeks-to-months of training.** Imubit reports operators develop "meaningful proficiency within a few months." The industry uses Operator Training Simulators (OTS) for structured, simulation-based training before new tools touch live operations.
- **If deployed without MOC, the customer (refinery) faces OSHA citation risk.** This is a direct sales barrier -- refinery safety managers will ask about MOC compliance.

### Suggested Mitigation

1. **Build MOC support into the sales process.** Provide customers with a pre-written MOC package: technical basis for the change, impact assessment, training curriculum, and operating procedure modifications.
2. **Design a phased onboround program:** Shadow mode (recommendations shown alongside current workflow, no action expected) for 2-4 weeks, then guided adoption with hands-on training, then full deployment.
3. **Never claim "no training required"** in sales materials. Instead: "Minimal training required -- integrates into existing workflows with a structured onboarding program and MOC documentation included."

---

## Risk #4: Union/Labor Relations Blowback

**Severity: CRITICAL**

The United Steelworkers (USW) is actively bargaining over AI in refineries. The opportunity cost dashboard tracking operator overrides creates specific legal exposure.

### Evidence

- **Active labor dispute:** In the 2026 USW national pattern bargaining (covering ~30,000 refinery workers), the union "called for guarantees that artificial intelligence would not be used to eliminate jobs." Workers specifically called out "new AI-based production monitoring systems" as threats.
- **Override tracking = potential NLRA violation.** The NLRB General Counsel's 2022 memo established that employer surveillance practices that "would tend to interfere with or prevent a reasonable employee from engaging in activity protected by the Act" are presumptively illegal. AI systems affecting "employees' wages, hours and other conditions of employment" are mandatory subjects of bargaining.
- **Chilling effect on safety:** If operators know overrides are tracked and assigned dollar costs, they face pressure to follow AI recommendations even when professional judgment says otherwise. In a refinery, this is a safety risk.
- **Precedent:** The ILA port workers' 2024 strike won a complete ban on fully automated technology. The UPS/Teamsters CBA "prevents the company from disciplining workers based solely on data collected through tracking technologies."
- **Deskilling concern is documented.** Endoscopists using AI became worse at finding polyps when AI was turned off (detection rates dropped from 28% to 22%). Research consistently shows AI decision support degrades operator skills over time.

### Suggested Mitigation

1. **Engage unions proactively before deployment.** Create joint labor-management committees to discuss purpose, scope, and data use.
2. **Establish binding limits on override data use.** Contractually guarantee that override tracking data will never be used for individual performance evaluation, discipline, or termination.
3. **Frame as augmentation.** Position explicitly as "a second opinion tool that helps operators capture margin" rather than "a system that monitors operator compliance."
4. **Track overrides by equipment/unit, not by operator.** Root-cause analysis should point to equipment issues and model limitations, not operator judgment.

---

## Risk #5: Constraint Input UX Is Physically Impossible in PPE

**Severity: HIGH**

Reflex asks operators to type constraint feedback via Slack (e.g., "can't push unit 2, heat exchanger 201 is fouling"). This is effectively impossible for operators in PPE.

### Evidence

- **Glove incompatibility:** Capacitive touchscreens register through gloves no thicker than 5mm. Chemical-resistant and insulated gloves exceed this. Even with touchscreen-compatible gloves, the larger contact area makes hitting phone keyboard keys extremely difficult.
- **SCBA:** With self-contained breathing apparatus, operators cannot use a phone at all.
- **Compliance risk:** "Gloves that interfere with task performance are more likely to be removed, creating moments of unnecessary risk." Asking operators to remove PPE to type a Slack message is a safety anti-pattern.
- **Voice-to-text degrades to ~65% accuracy** in industrial noise (85-100+ dB). Error correction requires typing.
- **What works:** Successful industrial mobile apps (Honeywell Forge, Yokogawa Field Assistant) use structured selection (dropdowns, large buttons, checklists), NFC/QR scanning, and optional photo/voice attachments. They require 3-5 taps, not paragraphs of text.
- **2AM cognitive vulnerability:** Research on petrochemical operators found "all cognitive performance variables significantly decreased" between 2-6 AM. Interfaces must be simpler during night shift, not more demanding.

### Suggested Mitigation

Replace free-text Slack with structured constraint capture:
1. **Glanceable plan view** (ISA-101 gray background, color only for items needing input)
2. **Select unit** (1 tap, large 64px+ touch targets)
3. **Select constraint type** (1 tap: Equipment Issue / Feed Quality / Safety / Staffing)
4. **Select specific constraint** (1 tap: context-aware options pre-populated from asset registry)
5. **Severity + optional detail** (1 tap + optional voice note or photo)

Total: 5 taps, 15-30 seconds, fully glove-compatible, offline-capable.

---

## Risk #6: Algorithm Aversion -- One Bad Recommendation Poisons the Well

**Severity: HIGH**

Operator trust follows a fragile, asymmetric pattern: trust builds slowly over months of consistent performance, but a single visible error triggers disproportionate rejection.

### Evidence

- **Dietvorst et al. (2015):** "People more quickly lose confidence in algorithms than in human forecasters after seeing them make the same mistake." A single observed error triggers disproportionate rejection.
- **Trust timeline:** Imubit reports the transition starts with "weeks to months in advisory mode." There is no shortcut. Each error resets the clock significantly.
- **Rejection drivers (in order):** Professional identity threat ("AI knows better than me"), loss of autonomy/control, lack of transparency, habit disruption, job security fear.
- **The fix:** Dietvorst et al. (2018) found that "people will use imperfect algorithms if they can even slightly modify them." The decision-support-only framing is correct. Operators who choose to act feel ownership.
- **Parasuraman & Riley (1997):** Defined four failure modes -- use (correct), misuse (over-trust), disuse (rejection), abuse (deploying without regard for human consequences). False alarms are the primary cause of disuse.
- **Transparency paradox:** Research shows too much detail backfires. Explanations that are too complicated increase mistrust. Optimal: lead with action and outcome, offer reasoning on demand.

### Suggested Mitigation

1. **Get early recommendations right.** The first 10-20 recommendations must be accurate and obviously valuable. Consider curating initial recommendations with human engineering review before they reach operators.
2. **Start in shadow mode.** Show recommendations alongside existing workflows for 2-4 weeks. Let operators compare to their own judgment and build calibrated trust.
3. **Include confidence indicators.** Flag when the system is uncertain rather than presenting all recommendations with equal confidence.
4. **Limit frequency.** 2-3 high-value recommendations per shift will be trusted more than 20 of mixed quality.
5. **Frame as "second opinion."** Never as replacement for operator judgment.

---

## Risk #7: Shift Handover Integration Gap

**Severity: HIGH**

The constraint registry must integrate with existing shift handover processes. If constraints entered by one shift are not properly surfaced to the next, the consequences can be fatal.

### Evidence

- **40% of plant incidents** occur during startup, shutdown, and changeover periods (AFPM).
- **Piper Alpha (1988):** A single constraint (PSV removed) not communicated at handover killed 167 people.
- **BP Texas City (2005):** A faulty alarm not reported to the incoming shift contributed to 15 deaths.
- **The constraint registry concept is validated** -- it maps to "Standing Orders" in tools like Hexagon j5, an established concept in refinery operations. But standing orders work because they are actively surfaced during handover and require acknowledgment.
- **Digital handover tools already exist** (eschbach ShiftConnector, Hexagon j5, Yokogawa eLogBook, Honeywell DynAMo). Reflex must integrate with these, not create a parallel system.
- **80% of oil & gas logbooks remain unstructured** -- the constraint registry could improve on the status quo if properly integrated.

### Suggested Mitigation

1. **Integrate with existing handover tools** (j5 Standing Orders, ShiftConnector, Yokogawa eLogBook) via API. Active constraints should appear as a mandatory section in shift handover reports.
2. **Require explicit acknowledgment** by incoming operators for all active constraints (matches HSE's three-element handover model).
3. **Implement constraint aging/escalation.** Constraints persisting beyond 36 hours should auto-escalate to supervision.
4. **Full audit trail:** Every constraint creation, modification, acknowledgment, and clearing must be timestamped and attributed (aligns with OSHA PSM compliance).
5. **Active surfacing, not passive availability.** Push constraints to incoming operators during handover; don't rely on them to query a database.

---

## Risk #8: Opportunity Cost Dashboard Creates Blame Culture, Not Behavior Change

**Severity: HIGH**

The opportunity cost dashboard showing "money lost from operator overrides" is more likely to be ignored or create resentment than to drive positive behavior change.

### Evidence

- **Kluger & DeNisi (1996) meta-analysis:** In approximately one-third of cases, performance feedback actually decreased subsequent performance. Feedback backfires when it directs attention to the self rather than the task, provokes anxiety, or is applied to complex tasks.
- **87% of organizations** have low BI/analytics maturity (Gartner). BI adoption has been stuck at 25-35% of the workforce for years. Up to 70% of enterprise software features go unused.
- **Loss framing reduces motivation.** "Emphasizing potential losses and negative outcomes reduces employees' enthusiasm and motivation" (MDPI). Red KPI metrics trigger "hiding or downplaying issues, blaming or defensiveness, and gaming the system."
- **Wrong audience problem:** Financial impact data serves management/engineering audiences making capital allocation decisions, not operators making real-time control moves. "Showing an operator a revenue figure that depends on strategic decisions they do not control creates frustration and erodes trust" (DataCult).
- **The dangerous gaming outcome:** Operators who see override costs may blindly follow LP recommendations to avoid being flagged, even when their operational judgment says otherwise. In a refinery, this is a safety risk.

### Suggested Mitigation

1. **Separate audiences completely.** Management sees financial summaries; operators never see dollar-denominated scorecards of their overrides.
2. **Reframe from loss to capture.** Instead of "$450K lost from overrides," show "$1.2M captured from LP recommendations (82% capture rate, up from 78%)."
3. **Track by equipment/unit, not by person.** "Unit 3 had 47 constraint interactions -- top 3 root causes: [list]" instead of "Operator X overrode 47 times."
4. **Push, don't pull.** The highest-value insights should be sent as monthly summaries, not left on a dashboard that requires active navigation.
5. **Follow the SQDC hierarchy:** Safety > Quality > Delivery > Cost. Cost metrics must never pressure operators to override safety judgment.

---

## Risk #9: Cybersecurity Procurement Bottleneck

**Severity: MEDIUM**

Even if Reflex works perfectly, getting it approved and deployed at critical infrastructure sites involves extensive security review.

### Evidence

- **TSA Security Directive Pipeline-2021-02F** mandates cybersecurity measures for pipeline and LNG facility operators. Compliance requirements restrict introduction of cloud-connected tools to operational environments.
- **NIST SP 800-82 Rev. 3** warns that "outbound tunnels opened by cloud-connected devices undermine DMZ boundaries."
- **IEC 62443** requires security zones and conduits restricting data flow between enterprise IT and OT.
- **CISO approval at refinery sites takes 6-18 months** and may be denied for anything touching operations.
- **Mid-size refineries may lack dedicated cybersecurity staff**, making the review process slower and more conservative.

### Suggested Mitigation

1. **Architect for OT-adjacent deployment** (on-premise or private cloud within the refinery's DMZ) rather than requiring external SaaS connectivity to operational systems.
2. **Pre-build security documentation** (SOC 2 Type II, IEC 62443 compliance mapping, penetration test results) to accelerate customer security reviews.
3. **Design for read-only historian access** -- Reflex should pull data from the historian, not push commands to the DCS. This dramatically simplifies the security posture.

---

## Risk #10: Alert Fatigue from Price Trigger Threshold

**Severity: MEDIUM**

The dual-trigger approach (process drift + price movement) is well-supported by research, but the specific $2/bbl crack spread threshold needs calibration.

### Evidence

- **The dual-trigger concept is validated.** Multi-condition triggers achieved 61-82% alarm reduction in healthcare ICU studies. State-based alarming is broadly endorsed in process industries ("very few if any chemical or refinery units would not benefit").
- **At 2-3 alerts/day, Reflex is within ISA/EEMUA standards.** EEMUA 191 considers <1 alarm per 10 minutes "very likely acceptable" (~144/day ceiling). Precognize SAM GUARD, a comparable system, generates only 212 alerts annually.
- **But the $2/bbl threshold is problematic.** It represents 8-20% of a normal $10-25/bbl spread but only ~5% of an elevated $40/bbl spread. During volatile markets (2022-style), it could fire daily. During stable markets, it may rarely fire.
- **Safety-critical equipment alerts should never be gated by economic triggers.** If a heat exchanger is drifting toward failure, the operator needs to know regardless of crack spread.
- **Even low-volume alerts cause fatigue if non-actionable.** The key metric is percentage of alerts leading to operator action (target: >80% per EEMUA guidance).

### Suggested Mitigation

1. **Use percentage-based or volatility-adjusted thresholds** (e.g., 10% of trailing 20-day average spread) rather than fixed dollar amounts.
2. **Separate safety alerts from economic alerts.** Equipment approaching safety limits should trigger alerts regardless of price conditions. Economic optimization alerts use the dual-trigger.
3. **Track and report the actionability rate.** If operators act on <50% of alerts, the threshold is too loose.
4. **Allow per-site threshold tuning** based on the refinery's specific economics and volatility exposure.

---

## Summary Matrix

| # | Risk | Severity | Core Issue |
|---|------|----------|------------|
| 1 | Slack/Teams doesn't reach operators | **CRITICAL** | Physical, network, regulatory barriers to Slack in hazardous areas |
| 2 | NLP constraint extraction unreliable | **CRITICAL** | 15-54% error rates on complex problems; safety implications |
| 3 | "No training required" violates OSHA PSM | **CRITICAL** | Federal MOC and training requirements are legally mandated |
| 4 | Union/labor relations blowback | **CRITICAL** | USW actively bargaining over AI; override tracking = potential NLRA violation |
| 5 | Constraint input impossible in PPE | **HIGH** | Typing on phone with chemical gloves is physically impossible |
| 6 | Algorithm aversion from early errors | **HIGH** | One bad recommendation destroys months of trust-building |
| 7 | Shift handover integration gap | **HIGH** | Constraints must integrate with existing handover; failure kills people |
| 8 | Dashboard creates blame, not change | **HIGH** | Loss framing backfires ~33% of the time; wrong audience |
| 9 | Cybersecurity procurement bottleneck | **MEDIUM** | 6-18 month security review at critical infrastructure sites |
| 10 | Price trigger threshold miscalibration | **MEDIUM** | $2/bbl is too static; needs volatility adjustment |

---

## Key Sources

- **Alarm Management:** ISA-18.2, IEC 62682, EEMUA 191; ASM Consortium (Honeywell/BP/ExxonMobil/Shell); Texaco Milford Haven (1994), Freeport LNG (2022) incident reports
- **Operator Trust:** Lee & See (2004) "Trust in Automation"; Dietvorst et al. (2015, 2018) "Algorithm Aversion"; Parasuraman & Riley (1997) "Use, Misuse, Disuse, Abuse"; Parasuraman & Manzey (2010) "Complacency and Bias"
- **Industrial Communication:** HSE UK Human Factors; Purdue Model (IEC 62443); TSA Security Directive Pipeline-2021-02F; NIST SP 800-82 Rev. 3
- **HMI/UX:** ISA-101 (ANSI/ISA-101.01-2015); ASM Consortium "Effective Console Operator HMI Design" (2nd ed.); Honeywell Forge Inspection Rounds; Yokogawa Field Assistant
- **NLP:** NL4Opt (NeurIPS 2022); Autoformulation (ICML 2025); ConstraintLLM (EMNLP 2025); OptiGuide (Microsoft Research); NASA/TM-20250001849
- **Shift Handover:** HSE UK Shift Handover guidance; Energy Institute; Piper Alpha (1988), BP Texas City (2005), Esso Longford (1998), Buncefield (2005) investigation reports; Hexagon j5, eschbach ShiftConnector
- **Dashboard Design:** Kluger & DeNisi (1996) Feedback Intervention Theory; ISA-101; ASM Consortium; DataCult (2026) Executive vs. Operator Dashboards
- **Training/Legal:** OSHA PSM 29 CFR 1910.119; OSHA 3918; Imubit training documentation; KBC OTS
- **Labor Relations:** NLRB GC Memo on Electronic Surveillance (2022); USW 2026 pattern bargaining (OPIS/Dow Jones); ILA port automation strike (2024); UPS/Teamsters CBA; AFL-CIO AI principles
- **Deskilling:** Dietvorst et al.; PMC studies on AI-induced skill degradation in medicine; CISA AI Safety Guidelines for Critical Infrastructure
