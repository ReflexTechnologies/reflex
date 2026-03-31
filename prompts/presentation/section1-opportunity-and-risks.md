# Reflex Team Walkthrough — Sections 1 & 2

---

## SECTION 1: THE OPPORTUNITY

---SLIDE---
type: title
title: "Reflex — Team Walkthrough"
subtitle: "March 2026"
bullets:
- "Building the wire between refinery math and refinery reality"
speaker_notes: "Welcome everyone. Today we're walking through what Reflex is, why the opportunity exists, and — honestly — what could kill it before we build it. This is an internal team alignment session, not a pitch deck. We're going to be brutally honest about the risks."
deep_dive: "docs/product-transcript.md"
---END---

---SLIDE---
type: content
title: "The Problem: $10M Operations Run on a Spreadsheet"
bullets:
- "Mid-size refineries: sprawling multi-million-dollar complexes of steel, heat, and pressure — 800-degree reactors, millions of gallons of volatile liquids per day"
- "The actual brain of profitability? A Microsoft Excel spreadsheet on a planner's desktop"
- "The engineering is precise enough to refine crude oil into 12 different products — but the optimization math is completely disconnected from live plant data"
- "Enterprise RTO software exists (Aspen PIMS, Honeywell RPMS) — but costs $300K-$800K/yr in licensing alone, $1M+ total cost of ownership"
- "Result: 60-80 mid-size US refineries (50K-200K bbl/day) are priced out entirely and flying blind"
speaker_notes: "Picture this: you're standing next to an 800-degree catalytic cracker processing millions of dollars of crude oil per hour. Now picture the guy in the office upstairs who decides how to run that reactor — he's typing numbers into Excel. That's the disconnect. And it's not because these teams are unsophisticated. They have brilliant LP models they've spent decades fine-tuning. They just don't have a tool that connects those models to reality in real-time. The enterprise solutions exist, but they cost a million dollars a year. These mid-size plants are completely priced out."
deep_dive: "docs/product-transcript.md"
---END---

---SLIDE---
type: content
title: "The Daily Pain: An LP Planner's Tuesday Morning"
bullets:
- "7:00 AM — Manually pull process data from the historian (the plant's massive sensor database), production reports, and market pricing feeds"
- "8:00 AM — Physically type that data into their Excel LP model, rerun the solver, interpret results"
- "9:00 AM — Write an email to operations with a recommendation"
- "12:00 PM — The recommendation is already wrong. Crude prices moved, equipment drifted, crack spreads shifted. Nobody reruns the math."
- "This cycle repeats daily at best, weekly at worst — the plant runs on stale instructions every single day"
- "The financial gap between what the model recommends and what the plant actually does is measured in dollars per barrel, every hour — and nobody is even measuring the loss"
speaker_notes: "Think of it like having Google Maps on your phone, but you only update your GPS coordinates once a day by manually typing in your latitude and longitude. By the time it tells you to turn, you've already missed the exit. That's literally what's happening. The math solves in seconds — the math isn't the problem. The bottleneck is entirely human: pulling data from five different systems, typing it into a spreadsheet, running it, interpreting it, writing an email. And by the time that email goes out, market conditions have already changed. The crack spread — the margin between crude input costs and refined product prices — moves continuously. But because there's no automated trigger to rerun the math, nobody does."
deep_dive: "docs/product-transcript.md"
---END---

---SLIDE---
type: two-column
title: "The Market Gap: Mid-Market Is Completely Priced Out"
left_column:
- "Enterprise RTO (Top 20 Refiners):"
- "  Aspen PIMS / Honeywell RPMS"
- "  $300K-$800K/yr licensing"
- "  $1M+/yr total cost of ownership"
- "  Dedicated optimization engineers required"
- "  12-18 month implementation"
right_column:
- "Mid-Market (60-80 US Plants):"
- "  50K-200K barrels/day"
- "  Cannot justify $1M/yr software spend"
- "  Using Excel LP models they've tuned for decades"
- "  Sophisticated teams, just no affordable tool"
- "  ~$180M opportunity sitting on the table"
speaker_notes: "This is the gap. The top 20 global refiners can easily justify a million-dollar software budget. But there are 60-80 mid-size US plants — plus another 30-40 in Europe and Canada, plus specialty chemical plants and fuel blenders — who are entirely priced out. These aren't unsophisticated operators. They have complex LP models they've spent years perfecting. They just lack a software tool that's priced and scaled for their economic reality. They're forced to rely on Excel because it's literally the only viable container they have. That's a $180M opportunity just sitting there."
deep_dive: "docs/product-transcript.md"
---END---

---SLIDE---
type: visual
title: "Our Solution: Reflex — Building the Wire, Not Reinventing the Math"
subtitle: "Reflex connects existing systems in real-time and translates dense math into plain English"
bullets:
- "We don't replace the LP model. We don't replace the operator. We connect the pieces that already exist."
- "Trigger-based: only fires when something meaningful changes (equipment drift or crack spread moves $2+/bbl)"
- "Human-in-the-loop: strictly decision support — operator always makes the final call"
- "Constraint registry: remembers when operators say no, stops nagging, builds institutional knowledge"
speaker_notes: "Here's the key insight: the math exists, the data exists, the models exist. Nobody has wired them together. Reflex is that wire. The historian collects every sensor reading. The Excel LP model already contains years of tuned optimization math. Claude translates the dense output into plain English. And Slack or Teams delivers it to the people who need to act. We're not reinventing the math — we're fixing the human friction and communication bottleneck around it. And critically, this is decision support only. We never touch a valve. We never override an operator. We show the data, show the math, show the dollar impact, and let the human decide."
deep_dive: "docs/product-transcript.md"
visual_description: "Left-to-right flow diagram with 6 connected boxes: [Process Historian (sensor data)] --> [Reflex Edge Agent (data quality + triggers)] --> [Excel LP Model (existing math)] --> [Claude (plain English translation)] --> [Slack/Teams (delivery)] --> [Operator (decides + feedback)]. A feedback arrow loops from Operator back to Reflex labeled 'Constraint Registry'. Below the flow, two trigger icons: a gauge icon labeled 'Process Trigger: equipment drifts outside window' and a dollar icon labeled 'Price Trigger: crack spread moves materially'."
---END---

---SLIDE---
type: content
title: "Business Model: Fraction of Enterprise Cost, Massive ROI"
bullets:
- "Price: $75K-$125K/site/year — a fraction of $300K-$800K enterprise RTO"
- "Target market: 80-120 sites (North America + Europe + specialty chemicals)"
- "ARR potential: $8-15M at scale"
- "Conservative ROI: if Reflex captures even $500K/yr in margin improvement per site, customer gets 4-7x return"
- "Exit strategy: $100-250M acquisition by AspenTech, Honeywell, AVEVA, or Schneider Electric"
- "The moat isn't patents — it's site-specific constraint data, coefficient reconciliation history, and integration depth"
speaker_notes: "The business case is straightforward. At $75-125K per year, we're a no-brainer decision for a plant manager — especially compared to $300K-800K for enterprise RTO. If we capture even $500K in margin improvement per site — which is conservative given that Emerson estimates $12M/year in losses from outdated technology at a 250K bpd plant — that's a 4-7x ROI for the customer. The realistic exit isn't an IPO. It's a $100-250M acquisition by one of the industrial giants who'd rather buy this proven mid-market channel than try to build a lightweight version of their own heavy software. And the real moat isn't a patent — it's the site-specific data we accumulate. Every constraint logged, every coefficient reconciled, every integration customized makes us stickier."
deep_dive: "docs/product-transcript.md"
---END---

---SLIDE---
type: content
title: "Why Us, Why Now"
bullets:
- "AI translation layer (Claude) didn't exist 3 years ago — LLMs make the 'dense math to plain English' step possible for the first time"
- "Seeq-style historian integration layers are maturing — connecting to plant data is easier than ever"
- "Incumbent distraction: Emerson/AspenTech merger (through 2027+), Honeywell restructuring into 3 companies, AVEVA post-acquisition integration — they can't respond for 2-4 years"
- "Mid-market is still completely ignored — no one is building for the 60-80 plants between 'too small for enterprise' and 'too complex for nothing'"
- "The market window is 5-7 years before energy transition closures and incumbent response catch up"
speaker_notes: "The timing is critical. Three years ago, you couldn't use an LLM to translate LP output into a sentence that says 'increase naphtha yield by 8% on units 3 and 4, estimated margin impact plus $44,000.' That capability simply didn't exist. Meanwhile, historian integration layers like Seeq have matured to the point where connecting to plant data is a known engineering problem, not a research project. And the incumbents are all distracted — Emerson is digesting AspenTech, Honeywell is splitting into three companies, AVEVA is integrating with Schneider. They can't build a lightweight mid-market product for at least 2-4 years. That's our window. Now let's talk about what could kill this."
deep_dive: "docs/product-transcript.md"
---END---

---

## SECTION 2: RISK ANALYSIS

---SLIDE---
type: divider
title: "Risk Analysis"
subtitle: "What Could Kill This"
speaker_notes: "Okay — now that we've seen the opportunity, let's be completely honest about what could go wrong. We ran a deep adversarial research process across technical, business, and adoption risks. We found 33 individual risks, deduplicated to 20 unique ones, and scored them on severity, likelihood, and timeline impact. Some of these findings fundamentally change how we need to build. I'd rather we hear this now than learn it the hard way at a customer site."
deep_dive: "research/run1/EXECUTIVE-SUMMARY.md"
---END---

---SLIDE---
type: content
title: "Top 5 Existential Risks — The Ones That Kill the Company"
bullets:
- "1. Excel COM automation is unsupported by Microsoft for server-side use. Documented failure modes: hangs, zombie processes, 50GB memory leaks, deadlocks. There is no supported path for what we need to do."
- "2. Slack/Teams doesn't reach refinery operators. They work on DCS consoles in ATEX hazardous zones where standard phones can't be carried. Typing in chemical gloves is physically impossible. Voice-to-text is 65% accurate at industrial noise levels."
- "3. Student founders can't get a meeting at a refinery. Every successful industrial software startup (Seeq, Imubit, OSIsoft) had founders with 10+ years of process industry experience. Without that, we don't get past the first meeting."
- "4. The market is smaller and slower than we projected. EIA data shows 60 mid-size US refineries, not 80-120. Real beachhead: 12-24 sites. Sales cycles: 9-18 months. Realistic Year 3 ARR: $2-3M, not $8-15M."
- "5. Deploying AI in a refinery triggers OSHA PSM regulations, MOC requirements, and union bargaining — 'it's just Slack messages' doesn't exempt us from federal safety law."
speaker_notes: "I want to be blunt about these. Number one: Microsoft literally says 'do not do this' about server-side Excel automation. We're building our entire product on top of something the vendor explicitly doesn't support. Number two: Slack doesn't reach the people who need to act. Operators work in hazardous zones with DCS consoles, not chat apps. Number three: nobody in this industry will take a meeting with us without a domain expert on the team. Number four: we overstated the market by 15-40%. Number five: OSHA PSM law applies to us whether we like it or not. These are all solvable — but we need to solve them before we build, not after."
deep_dive: "research/run1/EXECUTIVE-SUMMARY.md"
---END---

---SLIDE---
type: content
title: "Technical Risks: The Architecture Is Built on Unsupported Ground"
subtitle: "Severity-ranked findings from adversarial technical research"
bullets:
- "CRITICAL — Excel COM: Microsoft docs say 'do not recommend or support server-side Automation of Office.' Failure modes include modal dialog hangs, ContextSwitchDeadlock, 50GB memory leaks, zombie processes. VBA/COM add-ins force single-threaded execution: 30sec-7min per LP solve, no parallelization."
- "CRITICAL — Proprietary LP solvers: Many mid-size refineries use Aspen PIMS (400+ refineries globally), Haverly GRTMPS, or Honeywell RPMS — not Excel Solver. If our target customers use these, our Excel automation approach doesn't work at all."
- "CRITICAL — LLM hallucination: LLMs repeat planted numerical errors in 83% of cases. Misreading '2.3 MBPD' as '23 MBPD' in a refinery is not a UX bug — it's a safety incident."
- "CRITICAL — Shutdown/startup floods: 50% of safety incidents occur during startup/shutdown. If Reflex fires recommendations during these periods, operators get flooded at exactly the moment they can't process them."
speaker_notes: "Let's dig into the technical risks. The Excel COM problem is existential — we literally cannot build this product if we can't reliably automate Excel in an unattended environment, and Microsoft explicitly says we shouldn't. The LP solver landscape is equally critical — if most target customers use PIMS instead of Excel Solver, our whole architecture is wrong. We need to survey 10-15 refineries immediately to find out. The LLM hallucination risk is real but solvable — we just need to never let Claude touch raw numbers. Extract them programmatically, use the LLM only for natural language. And the shutdown flood problem requires an operating mode detection system from day one."
deep_dive: "research/run1/technical-risks.md"
---END---

---SLIDE---
type: table
title: "Technical Risks: Full Severity Ranking"
table:
  headers: ["Risk", "Severity", "Mitigation"]
  rows:
    - ["OT network security (Purdue model) forces edge deployment", "CRITICAL", "Build Reflex Edge Agent in customer DMZ; never require inbound firewall rules"]
    - ["Excel COM automation unsupported for server-side use", "CRITICAL", "Validate on real LP model for 72+ hours; invest in Python LP engine escape hatch"]
    - ["Proprietary LP solvers (PIMS/GRTMPS) block core architecture", "CRITICAL", "Survey 10-15 refineries immediately; segment market by LP tool"]
    - ["Shutdown/startup floods false recommendations", "CRITICAL", "Operating mode detection system; auto-suppress during non-normal modes"]
    - ["LLM numerical hallucination in safety-critical context", "CRITICAL", "Decouple numbers from LLM entirely; programmatic extraction + cross-validation"]
    - ["Sensor glitches vs. real process changes", "HIGH", "Never trigger on single sensor; require multi-signal corroboration"]
    - ["PI System integration complexity (Kerberos/Windows)", "HIGH", "Target PI Web API; budget 2-4 weeks per customer"]
    - ["Market data feed costs ($10-50K+/yr)", "HIGH", "'Bring your own data' model eliminates cost and licensing risk"]
    - ["Historian compression artifacts / stale data", "HIGH", "Build Data Quality Gateway; audit compression settings per tag"]
    - ["Excel single-threaded performance floor (30sec-7min)", "HIGH", "Queue backpressure; coalesce triggers; mandate 64-bit Excel"]
speaker_notes: "Here's the full technical risk table, severity-ranked. Five critical risks, five high risks. The architectural takeaway is that we need to build three things the transcript never mentions: a Reflex Edge Agent for Purdue-compliant deployment, a Data Quality Gateway between historian data and trigger logic, and an operating mode detection system. We also need to decouple all numbers from the LLM. These aren't optional improvements — they're prerequisites for the product to function in a real refinery."
deep_dive: "research/run1/technical-risks.md"
---END---

---SLIDE---
type: content
title: "Business Risks: Smaller Market, Longer Sales, Credibility Gap"
subtitle: "Findings from independent validation of every business claim"
bullets:
- "CRITICAL — Team credibility gap: Every successful industrial software startup had founders with 10+ years of process industry experience. A sales rep who can't distinguish a CDU from a coker gets dismissed in the first meeting. The refinery world is tiny — one bad impression travels fast."
- "CRITICAL — Brutal sales cycle: 9-18 months with multi-stakeholder sign-off (ops, engineering, IT, OT, safety, procurement, legal, C-suite). Getting on Approved Vendor List alone takes 3-6 months. Oil & gas is 'infamous for stalled deals, endless customization requests, and legacy tech headaches.'"
- "HIGH — Overstated TAM: EIA data shows exactly 60 mid-size US refineries (50K-200K bbl/day), ~68-70 including Canada. Many already use commercial LP tools. Realistic beachhead: 12-24 underserved refineries. Year 3 ARR: $2-3M, not $8-15M."
- "HIGH — Excel inertia: If refineries survived 30+ years on Excel, the urgency to switch is genuinely low. Mass retirement of experienced planners (the only champions for new tools) and failed digital transformation history create deep skepticism."
speaker_notes: "The business risks are sobering. The credibility gap is non-negotiable — we need a domain expert on the team before we talk to a single refinery. The sales cycle is real: 9-18 months minimum, with sign-off needed from operations, engineering, IT, OT security, safety, procurement, legal, and sometimes C-suite. And the market is smaller than we thought. EIA data shows 60 mid-size US refineries, not 80-120. Many already use commercial tools. Our realistic beachhead is 12-24 sites. That means every lost deal permanently shrinks our market by 4-8%. We need to be flawless."
deep_dive: "research/run1/business-risks.md"
---END---

---SLIDE---
type: table
title: "Business Risks: Full Severity Ranking"
table:
  headers: ["Risk", "Severity", "Addressable?"]
  rows:
    - ["Team credibility gap (student founders)", "CRITICAL", "Yes — hire domain expert co-founder/advisor with equity"]
    - ["Brutal sales cycle in tiny market (9-18 months)", "CRITICAL", "Partially — EPC partnerships, design partner strategy"]
    - ["Overstated TAM / ARR projections", "HIGH", "Yes — reset to 12-24 site beachhead, $2-3M Year 3 ARR"]
    - ["Excel inertia / 'good enough' problem", "HIGH", "Yes — lead with quantified ROI ($12.3M/yr loss per Emerson data)"]
    - ["Customer concentration (each lost deal = 1.4-1.7% of market)", "HIGH", "Partially — expand to petrochemicals, Europe over time"]
    - ["Energy transition / shrinking market window", "HIGH", "Partially — focus on Gulf Coast; plan 5-7 year window to exit"]
    - ["AVEVA/Schneider competitive threat (owns PI + cloud SaaS)", "MEDIUM-HIGH", "Yes — 2-4 year window; position as complement, not competitor"]
    - ["Regulatory / cybersecurity barriers (IEC 62443, TSA)", "MEDIUM", "Yes — invest in compliance early; it becomes a moat"]
    - ["Acquisition exit valuation optimistic at high end", "MEDIUM", "Yes — target $100-150M at $12-15M ARR (6.7-10x multiple)"]
    - ["Pricing may be too low for value delivered", "LOW-MEDIUM", "Yes — tier pricing, expand ACV over time to $200-500K"]
speaker_notes: "Here's the full business risk table. Two critical, four high, and the rest medium or lower. The good news: most of these are addressable. The credibility gap requires a hire. The TAM requires resetting expectations. The sales cycle requires a design partner strategy and EPC partnerships. The energy transition means we need to plan for a 5-7 year window and target Gulf Coast refineries that will run through 2035+. And interestingly, we might be underpricing — comparable industrial software costs $200-500K/year, and if we deliver $500K+ in margin improvement, $125K captures only 25% of value."
deep_dive: "research/run1/business-risks.md"
---END---

---SLIDE---
type: content
title: "Adoption Risks: Operators Can't Use What We're Building"
subtitle: "Human factors research from industrial safety studies, OSHA, and labor law"
bullets:
- "CRITICAL — Slack doesn't reach operators: Control rooms run DCS consoles (Honeywell Experion, Yokogawa CENTUM VP), not chat apps. Process areas are ATEX hazardous zones — standard phones prohibited. WiFi across a 3-4 sq mile refinery is 'spotty and unpredictable.' No published case study shows Slack/Teams used by frontline refinery operators on shift."
- "CRITICAL — NLP constraint extraction: 46-85% accuracy on complex industrial problems. 'Heat exchanger 201 is fouling' contains zero quantitative data — the LLM must hallucinate a number. NASA (2025) characterized LLM output as 'uttered without regard for its truth value.'"
- "CRITICAL — OSHA PSM: A tool that changes how operators make decisions about process parameters triggers Management of Change requirements. 'Just Slack messages' provides no legal exemption. The 2005 Texas City explosion was partly attributed to MOC failures."
- "CRITICAL — Union/labor: USW 2026 bargaining covers ~30,000 refinery workers and specifically targets AI monitoring. Tracking operator overrides with dollar costs = potential NLRA violation."
speaker_notes: "The adoption risks hit hardest because they challenge core product assumptions. We assumed operators would see Slack messages — they won't. They work on DCS consoles in hazardous zones. We assumed operators would type feedback — they can't. Chemical-resistant gloves make phone keyboards unusable. We assumed 'no training required' — it violates OSHA PSM law. And we assumed we could track operator overrides with dollar costs — the USW union is actively bargaining against exactly that. Each of these has a solution, but the solutions require redesigning how we think about the user. The primary user isn't the field operator — it's the shift supervisor and process engineer who works at a desk with IT network access."
deep_dive: "research/run1/adoption-risks.md"
---END---

---SLIDE---
type: table
title: "Adoption Risks: Full Severity Ranking"
table:
  headers: ["Risk", "Severity", "Core Issue"]
  rows:
    - ["Slack/Teams doesn't reach operators on shift", "CRITICAL", "Physical, network, and regulatory barriers to Slack in hazardous areas"]
    - ["NLP constraint extraction unreliable", "CRITICAL", "15-54% error rate on complex problems; safety implications"]
    - ["'No training required' violates OSHA PSM", "CRITICAL", "Federal MOC and training requirements are legally mandated"]
    - ["Union/labor blowback (USW 2026 bargaining)", "CRITICAL", "Override tracking = potential NLRA violation; chilling effect on safety"]
    - ["Constraint input impossible in PPE", "HIGH", "Typing on phone with chemical gloves is physically impossible"]
    - ["Algorithm aversion from early errors", "HIGH", "One bad recommendation destroys months of trust-building"]
    - ["Shift handover integration gap", "HIGH", "Piper Alpha (1988): 167 died from a constraint not communicated at handover"]
    - ["Dashboard creates blame culture, not behavior change", "HIGH", "Loss framing actually decreases performance 33% of the time"]
    - ["Cybersecurity procurement bottleneck", "MEDIUM", "6-18 month security review at critical infrastructure sites"]
    - ["Price trigger threshold miscalibration ($2/bbl too static)", "MEDIUM", "Needs volatility-adjusted thresholds, not fixed dollar amount"]
speaker_notes: "Four critical adoption risks, four high, two medium. The shift handover one deserves emphasis — Piper Alpha in 1988, 167 people died because a single constraint wasn't communicated at shift change. Our constraint registry maps to an existing concept called 'Standing Orders' in tools like Hexagon j5, but it only works if it's actively surfaced during handover and requires acknowledgment. The dashboard blame culture risk is counterintuitive — research shows that loss-framing feedback actually makes performance worse a third of the time. We need to track overrides by equipment, not by person, and frame everything as 'value captured' not 'value lost.'"
deep_dive: "research/run1/adoption-risks.md"
---END---

---SLIDE---
type: table
title: "Unified Risk Matrix: Top 10 Must-Solve-Before-Building"
subtitle: "Scored: Severity (1-5) x Likelihood (1-5) x Timeline Impact (1-5). Max = 125."
table:
  headers: ["Rank", "Risk", "Score", "Component", "GO/NO-GO"]
  rows:
    - ["1", "Excel COM automation unsupported & unscalable", "125", "LP Engine", "CONDITIONAL — validate 72hr on real model"]
    - ["2", "Operator delivery channel doesn't work (Slack/Teams/PPE)", "125", "Communication", "CONDITIONAL — redesign primary user"]
    - ["3", "Proprietary LP solvers (PIMS/GRTMPS) block architecture", "100", "LP Engine", "CONDITIONAL — survey 10-15 refineries"]
    - ["4", "Team credibility gap (student founders)", "100", "Sales", "CONDITIONAL — recruit domain expert"]
    - ["5", "LLM hallucination + NLP constraint extraction failures", "80", "AI Layer", "GO with guardrails — decouple numbers"]
    - ["6", "OT network security / Purdue model / cybersecurity", "80", "Infrastructure", "GO — build Edge Agent from day one"]
    - ["7", "OSHA PSM / MOC / training requirements", "80", "Compliance", "GO — build MOC package into sales"]
    - ["8", "Union/labor blowback + dashboard blame culture", "64", "Adoption", "GO — track by equipment, not operator"]
    - ["9", "Shutdown/startup floods + alert fatigue + trigger calibration", "64", "Triggers", "GO — build operating mode detection"]
    - ["10", "Brutal sales cycle in tiny, concentrating market", "75", "Sales", "GO — design partner + EPC strategy"]
speaker_notes: "This is the unified risk matrix — all risks scored and ranked. The top 4 are CONDITIONAL go/no-go, meaning we have specific validation steps that must pass before we commit to building. If we can't automate Excel reliably for 72+ hours on a real LP model, if most target customers use PIMS instead of Excel Solver, if we can't recruit a domain expert, or if we can't redesign the delivery channel — those are each individually project-killing. Risks 5-10 are GO with specific architectural requirements built in from day one. The key chain is R3 determines R1 determines R9 determines R14 — the LP solver question must be answered first because every downstream technical decision depends on it."
deep_dive: "research/run1/RISK-MATRIX.md"
---END---

---SLIDE---
type: content
title: "Easy Wins: 5 Changes That Derisk Cheaply"
subtitle: "Low cost, high impact — do these before writing production code"
bullets:
- "1. 'Bring Your Own Data' model — customer supplies their own OPIS/Platts feeds (they already have subscriptions). Eliminates $10-50K/yr cost and redistribution licensing risk. Cost: $0."
- "2. Decouple numbers from LLM — programmatically extract all values from LP output, use Claude only for natural language formatting. Cross-validate every number. Build template fallback for API downtime. Cost: ~1 week."
- "3. Structured constraint input — replace free-text Slack with 5-tap interface (select unit, constraint type, severity). Works with gloves, works offline, eliminates 15-54% NLP error rate. Cost: ~2 weeks."
- "4. Operating mode detection — simple state machine (Normal/Startup/Shutdown/Upset/Turnaround/Emergency). Auto-suppress optimization triggers during non-normal modes. Prevents catastrophic trust destruction. Cost: ~1-2 weeks."
- "5. Shadow mode deployment — show recommendations alongside existing workflows for 2-4 weeks without expecting action. Curate first 10-20 recommendations with human review. Matches Imubit's proven adoption pattern. Cost: $0 (deployment strategy, not a feature)."
speaker_notes: "Here's the good news. Five changes that cost almost nothing but substantially reduce our risk profile. 'Bring your own data' is free and eliminates market data licensing entirely. Decoupling numbers from the LLM is a week of work and eliminates the safety-critical hallucination risk. Structured constraint input is two weeks and eliminates both the PPE problem and the NLP accuracy problem. Operating mode detection is one to two weeks and prevents the alert fatigue scenario that would permanently destroy operator trust. And shadow mode is a deployment strategy that costs nothing but matches the proven adoption pattern from Imubit and other industrial AI tools. These five things together cost about a month of engineering time and eliminate or reduce six of our top ten risks."
deep_dive: "research/run1/EXECUTIVE-SUMMARY.md"
---END---
