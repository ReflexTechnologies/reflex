# Reflex Platform — Executive Summary

> **Date:** 2026-03-27
> **For:** Founding team strategic decision-making
> **Based on:** Unified risk analysis synthesizing 33 risks across technical, business, and adoption domains

---

## The Core Insight Is Valid

There is a genuine, underserved gap in mid-market refinery optimization. The math exists, the data exists, the models exist — no one has connected them in a lightweight, affordable way. Every incumbent (AspenTech, Honeywell, AVEVA) is priced and scoped for large refineries. The 2-4 year competitive window from incumbent distractions (Emerson/AspenTech merger, Honeywell restructuring, AVEVA integration) is real.

**But the path from insight to product is harder than the transcript suggests.** The research uncovered fundamental assumptions that need to be validated or redesigned before significant engineering investment.

---

## Top 5 Existential Risks

These are the risks that could kill the project entirely, explained in plain language.

### 1. You can't reliably automate Excel in the way the product requires
Microsoft explicitly says "do not do this." Server-side Excel automation produces hangs, memory leaks, zombie processes, and deadlocks. There is no supported path for running complex LP models with Solver, VBA, and COM add-ins in an unattended server environment. And many refineries don't even use Excel Solver — they use proprietary LP engines (Aspen PIMS, Haverly GRTMPS) that have undocumented, vendor-specific APIs.

**What to do:** Before writing any code, survey 10-15 target refineries to find out what LP tools they actually use. Then validate that you can reliably automate a real customer's LP model (not a demo) for 72+ continuous hours. If either test fails, the product concept needs to change.

### 2. Slack messages don't reach the people who need to act
Refinery operators work in ATEX hazardous zones where standard phones can't be carried, monitor DCS consoles (not chat apps), wear chemical-resistant gloves that make phone keyboards unusable, and work on OT networks that are physically separated from corporate IT where Slack runs. No published case study shows Slack or Teams used by frontline refinery operators on shift.

**What to do:** Redesign the primary user. The shift supervisor and process engineer — who work at desks with IT access — are the realistic recipients. Field operators get information through existing channels (DCS, radio, supervisor handoff). Replace free-text Slack feedback with structured 5-tap input.

### 3. No one in the refinery industry will take a meeting with student founders
Every successful industrial software startup (Seeq, Imubit, OSIsoft) was founded by people with 10+ years of process industry experience. Refinery procurement requires vendors who speak fluently about FCC units, CDUs, APC systems, and LP models. The refinery world is extremely small — one bad impression travels to every process engineering VP within months.

**What to do:** Recruit a process industry veteran with real operating experience as a co-founder or equity advisor. This person leads all customer-facing conversations. The student team builds the product. This is non-negotiable.

### 4. The market is smaller and slower than projected
The transcript claims 80-120 target sites and $8-15M ARR. EIA data shows exactly 60 mid-size US refineries in the target range, ~68-70 including Canada. Many already use commercial LP tools. The realistic beachhead is 12-24 underserved refineries. Sales cycles are 9-18 months with multi-stakeholder sign-off. Each lost deal permanently shrinks the market by 1.4-1.7%.

**What to do:** Plan for 18-24 months of runway before meaningful revenue. Target $2-3M ARR in Year 3 as a realistic milestone, not $8-15M. Secure 2-3 design partner refineries for free or discounted pilots. Pursue EPC firm partnerships for leverage.

### 5. Deploying AI in a refinery triggers federal safety regulations you can't skip
OSHA Process Safety Management requires Management of Change documentation and training for any tool that changes how operators make decisions about process parameters. "It's just Slack messages" doesn't provide an exemption. If deployed without MOC, the customer faces OSHA citation risk — meaning their safety manager will block the purchase. The USW union is also actively bargaining over AI in refineries, and tracking operator overrides with dollar costs creates specific NLRB legal exposure.

**What to do:** Build MOC documentation packages into the sales process. Design phased onboarding (shadow mode → guided adoption → full deployment). Never claim "no training required." Track overrides by equipment, not by operator. Engage unions proactively.

---

## Top 5 Easy Wins That Derisk the Project

These are changes that cost little but substantially reduce risk.

### 1. "Bring Your Own Data" model (eliminates market data cost risk)
Instead of buying OPIS/Platts subscriptions ($10K-$50K+/year with redistribution licensing restrictions), have customers supply their own market data feeds — they already have subscriptions. Reflex ingests the data, never redistributes it. For MVP/demo, use free EIA data + OilPriceAPI ($9-15/month). **Cost: $0. Risk eliminated: market data costs and licensing liability.**

### 2. Decouple numbers from LLM (eliminates hallucination risk)
Programmatically extract all numerical values from LP spreadsheet output. Use Claude only for natural language formatting and context. Cross-validate every number against the source. Build a simple template-based fallback for when the API is down. **Cost: ~1 week of engineering. Risk eliminated: safety-critical numerical errors.**

### 3. Structured constraint input instead of free text (eliminates PPE/NLP risk)
Replace "type your constraint in Slack" with a structured 5-tap interface: select unit → select constraint type → select severity → optional voice note. Works with gloves, works offline, eliminates the 15-54% NLP extraction error rate. **Cost: ~2 weeks of design and engineering. Risks eliminated: PPE impossibility, NLP unreliability.**

### 4. Operating mode detection (eliminates alert fatigue risk)
Implement a simple state machine: Normal / Startup / Shutdown / Upset / Turnaround / Emergency. Suppress all optimization triggers during non-normal modes. Allow manual override. This prevents the catastrophic trust-destroying scenario of flooding operators with meaningless recommendations during a shutdown. **Cost: ~1-2 weeks of engineering. Risk eliminated: false recommendation floods.**

### 5. Shadow mode deployment (eliminates algorithm aversion risk)
For the first 2-4 weeks at any site, show recommendations alongside existing workflows without expecting action. Let operators compare Reflex's suggestions to their own judgment and build calibrated trust. Curate the first 10-20 recommendations with human engineering review. This matches proven adoption patterns from Imubit and other industrial AI tools. **Cost: $0 (it's a deployment strategy, not a feature). Risk eliminated: premature trust destruction.**

---

## Honest Feasibility Assessment for a Student Team

### What's realistic

- **Building the core software** (data pipeline, LP automation, LLM translation, messaging integration, dashboard) is within reach for a strong student engineering team. The individual technical components are not novel — it's data plumbing, API integration, and web development.
- **The "workflow tool" framing is correct.** You're not inventing new optimization math. You're connecting existing systems. This is appropriate for the team's skill set.
- **Cloud infrastructure costs are manageable.** Claude API costs ~$10-60/site/month. Hosting is standard. No exotic hardware required.

### What's not realistic without help

- **Selling into refineries without a domain expert.** This is the hardest constraint. A student team cannot fake 15 years of process industry experience. You need a co-founder, CTO, or lead advisor with real refinery operating experience. Budget equity for this person.
- **Surviving the sales cycle without significant runway.** 9-18 month sales cycles mean 18-24 months before meaningful revenue. This requires either substantial funding, grant support, or revenue from adjacent work.
- **Navigating OT cybersecurity, OSHA PSM, union relations, and IEC 62443 compliance.** These are specialized domains where mistakes are expensive. You need advisors or consultants with specific industrial regulatory experience.
- **Building PI historian integrations alone.** Kerberos authentication, Active Directory integration, and per-customer PI configuration require Windows/enterprise IT expertise that is uncommon in student teams.

### The honest bottom line

The product concept is sound, the market gap is real, and the competitive window exists. But this is an **enterprise B2B sale into a heavily regulated, safety-critical industry with a tiny addressable market and 12-18 month sales cycles.** That's one of the hardest categories in software — harder than consumer apps, harder than SaaS for knowledge workers, harder than developer tools.

It is feasible, but only if you:
1. Get the right domain expert on the team (non-negotiable)
2. Validate the LP tool landscape before building (30-day exercise)
3. Secure sufficient runway (18-24 months minimum)
4. Accept that the realistic financial outcome is smaller and slower than the transcript projects

---

## Recommended Phased Approach

### Phase 0: Validation (Weeks 1-8)
**Goal: Answer the three binary questions that determine whether to proceed.**

| Question | Method | Go/No-Go |
|----------|--------|----------|
| What LP tools do target refineries actually use? | Survey/interview 10-15 mid-size refineries | If >60% use PIMS/GRTMPS, pivot strategy |
| Can Excel COM automation work reliably on a real LP model? | 72-hour stress test with a real customer model | If it can't sustain, invest in Python LP engine path |
| Can you recruit a domain expert co-founder/advisor? | Network through industry conferences, LinkedIn, advisory boards | If no credible domain expert by Week 8, pause the project |

**Cost:** Near zero (time only). **Output:** Go/no-go decision on whether to proceed with current architecture.

### Phase 1: Design Partner MVP (Months 3-8)
**Goal: Deploy a working system at 1 design partner refinery in shadow mode.**

Build in this order (each step derisk the next):
1. **Edge Agent + Data Quality Gateway** — connects to historian, validates data quality, pushes to cloud
2. **Excel LP automation engine** — COM automation with watchdog, queue backpressure, error recovery
3. **LLM translation layer** — deterministic number extraction + Claude for natural language + template fallback
4. **Structured messaging** — shift supervisor / process engineer delivery via Teams + email fallback + structured constraint input
5. **Constraint registry** — equipment-level tracking, shift handover integration, audit trail

Deploy in shadow mode alongside existing workflow. Measure accuracy. Build trust. Collect feedback.

**Key metric:** Do process engineers find the recommendations accurate and actionable >80% of the time?

### Phase 2: Pilot Validation (Months 9-14)
**Goal: Prove measurable margin improvement at 1-2 sites. Get first paying customer.**

- Transition from shadow mode to active use at design partner
- Quantify margin improvement (target: $500K+/year per site)
- Build opportunity cost dashboard (management view only)
- Onboard 1-2 additional pilot customers
- Begin coefficient reconciliation feature
- Publish case study with quantified ROI

**Key metric:** Can you demonstrate $500K+ annual margin improvement at a real site?

### Phase 3: Commercial Launch (Months 15-24)
**Goal: 3-5 paying customers, $300K-$600K ARR, reference-ready case studies.**

- Standardize onboarding process (MOC package, training, shadow mode)
- Build sensor substitution and maintenance prioritization features
- Expand to 3-5 paying customers via design partner referrals and EPC partnerships
- Begin SOC 2 Type II certification
- Hire dedicated customer success / onboarding engineer

**Key metric:** Repeatable sales process with <12 month cycle.

### Phase 4: Scale (Months 24-36)
**Goal: 8-12 customers, $1-2M ARR, acquisition conversations begin.**

- Expand feature set (advanced analytics, predictive maintenance integration)
- Target adjacent verticals (petrochemical plants, fuel blenders)
- Explore European expansion if US traction is strong
- Build relationships with Emerson, Honeywell, and Schneider corporate development
- Consider LP model migration service (Excel → Python solvers) as professional services revenue

**Key metric:** Net revenue retention >120%, annual churn <5%.

---

## One-Page Decision Framework

```
                    Can you recruit a domain expert?
                           /              \
                         YES               NO
                          |                 |
                 Survey LP landscape     STOP — the #1
                    /          \         risk is unresolvable
                   /            \        without domain credibility
            Excel Solver     PIMS/GRTMPS
            prevalent        prevalent
               |                 |
        Validate COM        Investigate PIMS
        automation          COM/OLE automation
           /    \              /        \
         WORKS   FAILS      WORKS      FAILS
           |       |          |          |
        BUILD    Invest in   BUILD     PIVOT to
        MVP      Python LP   (harder   consulting/
                 engine      path)     advisory model
```

---

*This summary should be revisited after Phase 0 validation. The three binary questions in Phase 0 will materially change the risk profile and recommended approach.*
