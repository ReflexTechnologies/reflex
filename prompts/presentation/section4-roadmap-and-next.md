# Section 7: Implementation Roadmap & Section 8: Open Questions & Next Steps

---SLIDE---
type: divider
title: "What We Build & When"
subtitle: "Eating the elephant one bite at a time"
speaker_notes: "This section covers our phased approach. The key insight is that we DON'T build everything at once. We validate before we invest, we deploy in shadow mode before we go live, and we prove value at one site before scaling. Every phase has a clear go/no-go gate."
---END---

---SLIDE---
type: two-column
title: "Phase 0: Validation — Weeks 1-8"
subtitle: "Answer three binary questions before writing production code"
left_column:
  - "**Question 1:** What LP tools do target refineries actually use? Survey 10-15 mid-size refineries"
  - "**Question 2:** Can Excel COM automation run reliably for 72+ hours on a real LP model?"
  - "**Question 3:** Can we recruit a domain expert co-founder or advisor?"
right_column:
  - "**Go/No-Go 1:** If >60% use PIMS/GRTMPS instead of Excel Solver, pivot LP strategy"
  - "**Go/No-Go 2:** If COM can't sustain, invest in Python LP engine (PuLP + HiGHS) first"
  - "**Go/No-Go 3:** If no credible domain expert by Week 8, pause the project"
speaker_notes: "Phase 0 costs us nothing but time. These three questions are existential — if any answer comes back wrong, the whole architecture changes. This is the most important phase because it prevents us from building the wrong thing. We should start these surveys and outreach immediately."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: content
title: "Phase 1: MVP — Single Pilot Site"
subtitle: "Months 3-8 (~20 weeks, 2-3 engineers)"
bullets:
  - "**Goal:** Deploy a working system at 1 design partner refinery in shadow mode"
  - "**Weeks 1-4:** Edge Agent (PI Web API reader + data quality gateway) + Cloud backend (FastAPI + TimescaleDB)"
  - "**Weeks 5-8:** Trigger engine (process drift + price movement + operating mode state machine) + LP Orchestrator (Celery + Windows LP Worker)"
  - "**Weeks 9-12:** AI Translation (deterministic numbers + Claude formatting + template fallback) + Messaging (Teams/Slack + structured constraint input)"
  - "**Weeks 13-16:** Frontend (Operations dashboard + recommendation feed + constraint registry + shadow mode UX)"
  - "**Weeks 17-20:** Auth/RBAC, integration testing, shadow mode deployment, operator feedback collection"
  - "**Success metric:** Process engineers find recommendations accurate and actionable >80% of the time"
speaker_notes: "Notice the build order — each step derisks the next. We start with data connectivity because without reliable data, nothing else matters. LP automation comes next because that's our core value proposition. AI translation and messaging are built on top of working LP output. The frontend comes last because we need real data and real recommendations to display. Shadow mode means we're showing recommendations alongside existing workflows — operators compare our suggestions to their own judgment. We're building trust, not forcing adoption."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: two-column
title: "Phase 2: Beta & Phase 3: GA"
subtitle: "From proving value to repeatable sales"
left_column:
  - "**Phase 2: Beta (Months 9-14)**"
  - "Scale to 3-5 sites"
  - "Transition design partner from shadow to active mode"
  - "Build analytics dashboard (opportunity cost waterfall, coefficient drift, sensor health)"
  - "Add coefficient reconciliation + constraint pattern detection"
  - "Publish case study with quantified ROI"
  - "**Key metric:** Demonstrate $500K+/year margin improvement at a real site"
right_column:
  - "**Phase 3: GA (Months 15-24)**"
  - "Production-ready for 80+ sites"
  - "Standardized onboarding (MOC package, training, shadow mode playbook)"
  - "Multi-site management + fleet dashboards"
  - "LP model migration service (Excel to PuLP/HiGHS)"
  - "SOC 2 Type II certification"
  - "Tablet offline support, adjacent vertical exploration"
  - "**Key metric:** Repeatable sales process, <12 month cycle, NRR >120%"
speaker_notes: "Phase 2 is where we prove the money. The $500K+ margin improvement per site is the number that sells this product — it's the case study that opens every subsequent door. Phase 3 is about repeatability — can we onboard a new site without our founding engineers hand-holding every step? That's the difference between a services business and a product business. By Phase 3 we're also evaluating infrastructure upgrades: potentially moving from our lightweight Python edge agent to Azure IoT Edge, and from TimescaleDB to Azure Data Explorer if anomaly detection justifies the cost."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: visual
title: "Implementation Timeline"
subtitle: "24-month journey from validation to general availability"
visual_description: "Horizontal timeline spanning left to right across the full slide width. Four distinct phases shown as colored blocks along the timeline axis:\n\n1. PHASE 0 (orange block, narrow): 'Validation' — Weeks 1-8. Below it: three bullet icons for 'LP Survey', 'COM Stress Test', 'Domain Expert Search'. A diamond gate icon at the end labeled 'GO / NO-GO'.\n\n2. PHASE 1 (blue block, medium): 'MVP' — Months 3-8. Below it: milestone markers at 'Edge Agent', 'Trigger Engine', 'LP Orchestrator', 'AI + Messaging', 'Dashboard', 'Shadow Deploy'. A star icon at the end labeled '1 Site Live'.\n\n3. PHASE 2 (green block, medium): 'Beta' — Months 9-14. Below it: milestone markers at 'Active Mode', 'Analytics Dashboard', 'Case Study Published', '3-5 Sites'. A dollar icon at the end labeled 'First Revenue'.\n\n4. PHASE 3 (purple block, wide): 'GA' — Months 15-24. Below it: milestone markers at 'SOC 2', 'Multi-Site Mgmt', 'LP Migration Service', '8-12 Customers'. A rocket icon at the end labeled '$600K-$1.5M ARR'.\n\nA large red arrow labeled 'YOU ARE HERE' points to the very start of Phase 0. Below the timeline, a thin grey bar shows team size scaling: '2-3 engineers' under Phases 0-1, '3-4 engineers' under Phase 2, '4-6 engineers + 1 CS' under Phase 3."
speaker_notes: "Here's the full picture. We are right here at the start — Phase 0 validation. The key thing to notice is the gates between phases. We don't move to Phase 1 until Phase 0 answers come back positive. We don't scale to Phase 2 until our design partner says our recommendations are accurate 80%+ of the time. Each phase earns the right to proceed to the next. Also notice the team size scaling — we start lean and hire as revenue justifies it."
---END---

---SLIDE---
type: divider
title: "Open Questions & Next Steps"
subtitle: "What we need to decide together"
speaker_notes: "Now for the honest part — what we DON'T know yet, and what we need to do about it. These are discussion prompts, not solved problems. Some of these require team debate, some require external input, and some require just rolling up our sleeves and doing the work."
---END---

---SLIDE---
type: content
title: "Open Questions That Need Team Discussion"
bullets:
  - "**LP Tool Landscape (Existential):** Do our target refineries use Excel Solver, Aspen PIMS, or Haverly GRTMPS? This determines our entire LP automation strategy. If >60% use PIMS, we need a fundamentally different approach. *Decision needed by: Week 4*"
  - "**Excel COM Reliability:** Can we actually automate a real customer's LP model unattended for 72+ hours? Microsoft explicitly says 'don't do this.' We need a stress test with a real model, not a demo. *Decision needed by: Week 6*"
  - "**Domain Expert Recruitment:** Who in our network has 10+ years of refinery process engineering experience? Every successful industrial software startup (Seeq, Imubit, OSIsoft) was founded by industry veterans. *Decision needed by: Week 8 — this is non-negotiable*"
  - "**DCS Console Integration:** Should we push advisory notifications directly to Honeywell Experion or Yokogawa DCS systems? This reaches field operators but requires per-vendor OPC-UA integration. *Decision needed by: Phase 2 planning*"
  - "**Voice Note Handling:** Should constraint voice notes be transcribed (reintroduces NLP accuracy risk) or stored as audio-only attachments? *Decision needed by: Phase 1 Week 12*"
speaker_notes: "Let's talk about each of these. The first three are Phase 0 questions — they determine whether we build at all, and what we build. The LP tool question is the scariest because if the answer is PIMS, we're looking at a much harder integration path. The domain expert question is equally critical — we cannot fake industry credibility. DCS integration and voice notes are Phase 1-2 decisions we can defer, but should start thinking about."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: two-column
title: "Immediate Next Steps"
subtitle: "What we do THIS WEEK and THIS MONTH"
left_column:
  - "**THIS WEEK:**"
  - "Set up Azure account with student credits ($100/year education + apply for Microsoft for Startups up to $150K)"
  - "Create shared GitHub repo with engineering spec, research docs, and this presentation"
  - "Draft list of 10-15 target mid-size refineries (50K-200K BPD) from EIA data"
  - "Begin LinkedIn outreach for domain expert advisor — target retired process engineers, LP planners"
  - "Set up Anthropic API key and run first Claude prompt template test with sample LP output"
right_column:
  - "**THIS MONTH:**"
  - "Build historian data simulator (generate realistic PI tag data for 100-150 tags without needing real refinery access)"
  - "Prototype Edge Agent: Python script that reads from simulator, validates data quality, pushes to cloud endpoint"
  - "Stand up FastAPI skeleton + TimescaleDB on Azure Container Apps (free tier)"
  - "Write first Claude prompt template and test with sample LP solve output — validate number cross-checking works"
  - "Start LP tool survey: cold-email process engineers at target refineries, attend SPE/NPRA events if possible"
  - "Research Excel COM automation: set up Windows VM, test pywin32 + safexl with sample Solver models"
speaker_notes: "These are concrete actions we can start on tomorrow. The data simulator is key — we can't wait for a real refinery to start building. We simulate realistic data and build against that, then swap in real data when we have a design partner. The Azure setup with student credits gives us a free playground. And the LinkedIn outreach for a domain expert — start this immediately, because finding the right person takes time."
---END---

---SLIDE---
type: content
title: "Skills Gap & Learning Plan"
subtitle: "What we need to learn and where to start"
bullets:
  - "**Python/FastAPI backend:** Build the modular monolith. Start with FastAPI docs + Arjan Codes YouTube channel for async patterns. Most critical skill — this is 60% of the codebase."
  - "**TimescaleDB + PostgreSQL:** Time-series data modeling, hypertables, continuous aggregates, Row-Level Security. Start with TimescaleDB tutorials and the official PostgreSQL RLS docs."
  - "**Azure Cloud (Container Apps, Blob Storage, Key Vault):** Start with Microsoft Learn student paths. Focus on Container Apps deployment and managed PostgreSQL setup."
  - "**Claude API integration:** Prompt engineering for deterministic output, tool calling for constraint extraction. Start with Anthropic's cookbook and the prompt template in the engineering spec."
  - "**Industrial protocols (PI Web API, OPC-UA basics):** Understand how refineries expose data. AVEVA PI Web API documentation is freely available. OPC Foundation has learning resources."
  - "**Windows COM automation (pywin32):** Niche but critical for LP automation. Microsoft COM documentation + pywin32 examples. Test early — this is the highest technical risk."
  - "**React + Mantine UI:** Frontend dashboard following ISA-101 HMI principles. Mantine docs are excellent. Study ISA-101 High Performance HMI guidelines for industrial UI patterns."
speaker_notes: "Nobody on the team needs to be an expert in all of these on day one. Divide and conquer — assign ownership of each domain to a team member. The most critical skills to develop first are FastAPI backend and the PI Web API / COM automation layer, because those are on the critical path for Phase 1. Frontend and advanced analytics can come later. The Claude API integration is actually the easiest part — Anthropic's documentation is very good, and our usage pattern is straightforward."
---END---

---SLIDE---
type: table
title: "Complete File Index"
subtitle: "Your map to everything we've produced — bookmark this slide"
table:
  headers: ["File Path", "What It Contains", "When To Read It"]
  rows:
    - ["docs/product-transcript.md", "Original team discussion transcript — the product vision, market analysis, and founding assumptions", "Read first — this is where it all started"]
    - ["research/run1/EXECUTIVE-SUMMARY.md", "Top 5 existential risks, top 5 easy wins, honest feasibility assessment, phased approach recommendation", "Read second — the reality check on our assumptions"]
    - ["research/run1/RISK-MATRIX.md", "Unified risk matrix scoring all 33 identified risks by likelihood x impact", "When you need to understand why we made a specific design decision"]
    - ["research/run1/technical-risks.md", "Deep dive on technical risks: Excel COM automation, data connectivity, LLM safety, infrastructure", "When working on Edge Agent, LP Orchestrator, or AI Translation"]
    - ["research/run1/business-risks.md", "Market size reality, sales cycle length, competitive landscape, regulatory requirements", "When preparing for customer conversations or investor pitches"]
    - ["research/run1/adoption-risks.md", "Operator trust, algorithm aversion, union concerns, safety culture, training requirements", "When designing UX, onboarding flows, or MOC documentation"]
    - ["research/run2/cloud-platform-recommendation.md", "Why Azure wins (IoT Edge, PI Integrator, Teams, student credits), cost comparison across AWS/Azure/GCP", "When setting up cloud infrastructure or evaluating platform decisions"]
    - ["research/run2/data-architecture.md", "TimescaleDB schema, data flow from historian to dashboard, Edge Agent design, data quality gateway", "When building the data pipeline or Edge Agent"]
    - ["research/run2/api-backend-architecture.md", "FastAPI modular monolith design, API endpoints, Celery task queue, auth/RBAC, inter-service patterns", "When building backend services or API contracts"]
    - ["research/run2/frontend-ux-architecture.md", "ISA-101 HMI design, component hierarchy, dashboard specs, shadow mode UX, Slack/Teams bot design", "When building the frontend or messaging integrations"]
    - ["docs/api-contract.md", "Complete API endpoint specifications with request/response schemas", "When implementing or consuming API endpoints"]
    - ["docs/architecture-diagrams.md", "Mermaid diagrams: system context, container, data flow, deployment, operating mode state machine", "When you need a visual understanding of system architecture"]
    - ["docs/design/claude-translation-service.md", "Claude API integration design: prompt templates, number decoupling, cross-validation, template fallback", "When building the AI translation layer"]
    - ["docs/design/auth-multitenancy.md", "JWT auth, RBAC roles, PostgreSQL RLS multi-tenancy, API key management for Edge Agents", "When implementing authentication or multi-tenant isolation"]
    - ["ENGINEERING-SPEC.md", "The master document — synthesizes all research into a single buildable specification with implementation roadmap", "The reference you'll return to most often — read after the research docs"]
    - ["agent-orchestration.md", "How the research agents were orchestrated to produce these documents", "If you're curious about the research process itself"]
speaker_notes: "Bookmark this slide — it's your map to everything we've produced. The reading order matters: start with the transcript to understand the vision, then the executive summary for the reality check, then dive into specific research areas as needed. The engineering spec is the master document that ties everything together — but it makes much more sense after you've read the research that informed it. Every design decision in the spec traces back to a specific risk or finding in the research docs."
---END---
