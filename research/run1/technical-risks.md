# Reflex Platform: Technical Risk Assessment

> Compiled 2026-03-27 via adversarial deep-dive research across 8 risk domains. Risks are ranked from highest to lowest severity based on likelihood, blast radius, and difficulty of mitigation.

---

## RISK 1: OT Network Security Architecture (Purdue Model) Forces Edge Deployment

**Severity: CRITICAL**

### Description
Refineries enforce the Purdue Enterprise Reference Architecture (PERA), which creates strict network segmentation between IT (Levels 4-5) and OT (Levels 0-3). A cloud-based tool like Reflex **cannot directly connect** to the OT historian at Level 3. All data must flow through a DMZ (Level 3.5) via historian replicas, with connections initiated outbound from the OT side only. Some high-security sites use hardware data diodes enforcing physically one-way data flow.

### Evidence
- The Purdue model places firewalls between L3 (OT) and L4 (IT), prohibiting direct connections. Data diodes may enforce physical one-way flow. ([Palo Alto Networks](https://www.paloaltonetworks.com/cyberpedia/what-is-the-purdue-model-for-ics-security), [Claroty](https://claroty.com/blog/ics-security-the-purdue-model), [Fortinet](https://www.fortinet.com/resources/cyberglossary/purdue-model))
- IEC 62443 defines 7 foundational requirements and 5 security levels; large refiners will expect at minimum awareness of 62443-4-1 (secure development lifecycle) and 62443-4-2 (component security). ~127 CSMS requirements exist. ([ISA Standards](https://www.isa.org/standards-and-publications/isa-standards/isa-iec-62443-series-of-standards), [Dragos](https://www.dragos.com/blog/isa-iec-62443-concepts))
- Colonial Pipeline (May 2021) demonstrated that even IT-only compromises cause operators to preemptively shut down OT operations. The attack entered via an exposed VPN password with no MFA. ([CISA](https://www.cisa.gov/news-events/news/attack-colonial-pipeline-what-weve-learned-what-weve-done-over-past-two-years), [Dragos](https://www.dragos.com/blog/recommendations-following-the-colonial-pipeline-cyber-attack/))
- Vendor security approval at refineries takes **weeks to months**, requiring SOC 2 Type II, penetration test results, architecture review proving Purdue compliance, SBOM, MFA, and right-to-audit contract clauses. ([NIST SP 800-82r3](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-82r3.pdf))

### Suggested Mitigation
Build a **"Reflex Edge Agent"** deployed by the customer in their DMZ that reads from historian replicas and pushes data outbound via HTTPS to Reflex cloud. Never require inbound firewall rules. Begin SOC 2 Type II preparation immediately (6-12 month process). Build security features aligned with IEC 62443 from day one. Target smaller refiners first where approval cycles are shorter.

---

## RISK 2: Excel COM Automation Is Unsupported for Server-Side Production Use

**Severity: CRITICAL**

### Description
Microsoft **explicitly states** they "do not recommend or support server-side Automation of Office." The COM automation that Reflex depends on (via xlwings/pywin32) to drive Excel LP models is documented by Microsoft as exhibiting "unstable behavior and/or deadlock" in unattended scenarios. There is no vendor support path for production failures.

### Evidence
- Microsoft's own documentation: "Microsoft does not currently recommend, and does not support, Automation of Microsoft Office applications from any unattended, non-interactive client application or component." They identify five failure categories: user identity issues, interactive UI blocking, reentrancy/deadlock, auto-update interference, and security gaps. ([Microsoft Support](https://support.microsoft.com/en-us/topic/considerations-for-server-side-automation-of-office-48bcfe93-8a89-47f1-0bce-017433ad79e2), [Microsoft Learn](https://learn.microsoft.com/en-us/office/client-developer/integration/considerations-unattended-automation-office-microsoft-365-for-unattended-rpa))
- Documented failure modes include: modal dialog boxes that hang indefinitely, zombie Excel processes from COM reference leaks (xlwings issue #1789 with pywin32 > 301), `ContextSwitchDeadlock` errors, `System.OutOfMemoryException`, 50GB memory leaks in Excel 365, and clipboard crashes across multiple instances. ([xlwings #1789](https://github.com/xlwings/xlwings/issues/1789), [Microsoft TechCommunity](https://techcommunity.microsoft.com/discussions/excelgeneral/microsoft-excel-365-huge-memory-leak-50-gb-ram/3606514))
- No documented cases of successful, sustained, large-scale automation of complex Excel models with Solver/LP plugins were found in research.
- 88% of spreadsheets contain material errors (multiple industry studies).

### Suggested Mitigation
Isolate Excel in a dedicated Windows VM with a watchdog process that monitors for hangs, memory leaks, and zombies. Implement automatic process restart on schedule. Use `DispatchEx` (not `Dispatch`) for isolated instances. Pin pywin32 to version 301. Set `Application.DisplayAlerts = False`. Implement queue backpressure to coalesce triggers. **Long-term: invest in a Python LP engine (PuLP/Pyomo/OR-Tools) with Excel as transitional bridge.**

---

## RISK 3: Proprietary LP Solvers (PIMS/GRTMPS) May Not Be Automatable

**Severity: CRITICAL**

### Description
The transcript assumes LP models live in "Excel spreadsheets." In reality, many mid-size refineries use **Aspen PIMS** (400+ refineries worldwide), **Haverly GRTMPS**, or **Honeywell RPMS** -- standalone LP engines that use Excel only as a data I/O layer. The actual optimization runs in their proprietary engine, not Excel Solver. Automating these requires vendor-specific COM/API integration that is poorly documented and may require vendor cooperation that a startup cannot secure.

### Evidence
- Aspen PIMS-AO is used by 400+ refineries worldwide. PIMS uses OLE automation / COM for Windows interoperability with Excel, but the COM interface is "not especially well documented." ([AspenTech](https://www.aspentech.com/en/products/msc/aspen-pims-ao), [CMU](https://kitchingroup.cheme.cmu.edu/blog/2013/06/14/Running-Aspen-via-Python/))
- GRTMPS has a "Process Simulator Interface (PSI)" for external models, but GRTMPS itself is a standalone LP engine, not an Excel add-in. ([Haverly](https://www.haverly.com/grtmps))
- If target customers use PIMS/GRTMPS rather than Excel Solver, Reflex's generic Excel automation approach will not work at all. Each vendor's API is different, undocumented, and potentially requires separate licensing.

### Suggested Mitigation
**Discover early** whether target customers use pure Excel Solver models vs. PIMS/GRTMPS. Segment the market: target refineries that genuinely use Excel Solver for LP first. For PIMS/GRTMPS sites, explore vendor partnership or build dedicated integrations as a later phase. Consider offering LP model conversion to open-source solvers as a professional service.

---

## RISK 4: Shutdown/Startup/Upset Conditions Will Flood Operators with False Recommendations

**Severity: CRITICAL**

### Description
During plant shutdowns, startups, or upsets, nearly all sensor readings change dramatically. These changes are expected operational transitions, NOT signals that the LP model needs updating. If Reflex triggers re-solves during these periods, it will generate meaningless recommendations precisely when operators are under maximum cognitive load and least able to process them.

### Evidence
- Nearly **50% of safety incidents** occur during startup/shutdown -- the most dangerous operating periods. ([ISHN](https://www.ishn.com/articles/113870-mitigating-the-hidden-risks-of-start-up-and-shutdown-operations))
- At Milford Haven refinery, operators received **275 alarms in 11 minutes** before the explosion. They could not process them. ([Digital Refining](https://www.digitalrefining.com/article/1000558/alarm-floods-and-plant-incidents))
- EEMUA 191 / ISA 18.2 benchmark: operators can handle at most **1 alarm per 10 minutes** during normal operations. 100+ alarms per operator is excessive and operators will abandon the system entirely. ([EEMUA 191](https://www.eemua.org/), [Yokogawa](https://www.yokogawa.com/us/library/resources/media-publications/implementing-alarm-management-per-the-ansi-isa-182-standard-control-engineering/))
- Historian data during shutdowns shows tags going to zero, transitioning to digital states, being manually overridden, or reading ambient conditions rather than process conditions.

### Suggested Mitigation
Implement **operating mode detection** as a first-class concept (Normal, Startup, Shutdown, Upset, Turnaround, Emergency). Automatically suppress all triggers during non-normal modes. Allow operators to manually override mode. Enforce strict recommendation rate limits: target 1-2 per shift during normal operations. Batch related recommendations into single consolidated messages.

---

## RISK 5: LLM Numerical Hallucination in Safety-Critical Context

**Severity: CRITICAL**

### Description
Reflex uses Claude to translate LP output into plain-English recommendations with specific numbers (e.g., "increase naphtha yield by 8%", "$44,000 margin impact"). LLMs are documented to misread, invert, or fabricate numerical values. In a refinery context, misreading "2.3 MBPD" as "23 MBPD" or inverting an increase/decrease direction could have serious operational consequences.

### Evidence
- LLMs **repeat or elaborate on planted numerical errors in up to 83% of cases** (clinical research). ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12318031/))
- Documented cases: LLM reported "10-to-1 stock split" when source said "6-to-1"; compliance chatbot cited a non-existent Bank Secrecy Act clause; market analysis tool reported earnings from non-existent press releases. ([BizTech](https://biztechmagazine.com/article/2025/08/llm-hallucinations-what-are-implications-financial-institutions), [Chainlink](https://blog.chain.link/the-trust-dilemma/))
- Claude API uptime: **99.06% over 90 days** (~7 hours downtime/month) with **no published SLA or service credits**. ([Anthropic Status](https://status.anthropic.com/uptime))
- Cost is manageable: ~$60/site/month with Sonnet 4.6, reducible to ~$10-15 with prompt caching.

### Suggested Mitigation
**Never let the LLM handle raw numbers.** Programmatically extract all numerical values from the LP spreadsheet output. Use the LLM only for natural-language formatting/context. Cross-validate every number in the LLM output against the source data. Build a **deterministic template-based fallback** for when the LLM is down or fails validation. Implement direction verification (increase/decrease matches sign of delta).

---

## RISK 6: Sensor Glitches vs. Real Process Changes -- The Core Trust Problem

**Severity: HIGH**

### Description
Reflex's value proposition depends on detecting meaningful process changes and triggering LP re-solves. But sensors fail constantly in refinery environments, and a single bad reading triggering a re-solve erodes operator trust in the entire system. False sensor data has contributed to catastrophic industrial incidents.

### Evidence
- **42% of Safety Instrumented System dangerous failure modes come from sensors** (Offshore Reliability Database). Equipment failure rates: 12-15% annually. ([PI Process Instrumentation](https://www.piprocessinstrumentation.com/instrumentation/article/21230742/improve-the-reliability-of-safety-instrumented-systems-with-advanced-measurement-technologies))
- False sensor data contributed to: Texas City refinery explosion, Buncefield tank farm explosion, Three Mile Island, European blackout near-miss. A single erroneous voltage sensor caused **200MW load swings** at a power plant. ([Control Global](https://www.controlglobal.com/blogs/unfettered/blog/33036495/false-process-sensor-data-can-be-catastrophic-but-are-not-adequately-addressed))
- XAI methods can reduce false alarms by **90.25%** vs. standalone outlier detection. ([MDPI Sensors](https://www.mdpi.com/1424-8220/22/1/226))

### Suggested Mitigation
**Never trigger on a single sensor.** Require multi-signal corroboration from physically related measurements. Implement rate-of-change limits (faster than physically possible = sensor fault). Use 2-out-of-3 voting logic where redundant sensors exist. Require sustained change (3-5 consecutive readings) before triggering. Build a sensor health registry tracking reliability history.

---

## RISK 7: PI System Integration Complexity (Kerberos, Windows Dependencies)

**Severity: HIGH**

### Description
OSIsoft PI (now AVEVA PI) is the dominant historian in refining. Its primary cross-platform API (PI Web API) defaults to **Kerberos-only authentication**, requiring Active Directory domain integration, SPN registration, and constrained delegation. There is no native Python SDK. Every customer deployment will be different.

### Evidence
- PI Web API defaults to Kerberos authentication. Configuring it requires: AD domain membership, SPN registration, keytab files for non-Windows clients, and Kerberos Constrained Delegation. ([AVEVA Docs](https://docs.aveva.com/bundle/pi-web-api/page/1023024.html))
- The AF SDK is .NET/Windows-only with no Python support. Community workaround (pythonnet) is brittle. ([GitHub AF-SDK-for-Python](https://github.com/onamission21/AF-SDK-for-Python), [PIconnect](https://pypi.org/project/PIconnect/))
- Stream sets cap at ~400 WebIDs per request; a single error fails the entire batch. ([Cuurios](https://www.cuurios.com/blog/how-to-achieve-a-performance-boost-with-the-pi-web-api))
- AVEVA licensing is per-tag, custom-quoted only (illustrative example: ~$162K). ([IIoT World](https://www.iiot-world.com/smart-manufacturing/process-manufacturing/challenges-solutions-aveva-licensing-model/))
- Honeywell PHD has the least public documentation and Windows-only APIs; integration typically requires OPC DA/UA through the Uniformance OPC Server. ([Honeywell training docs](https://prod-edam.honeywell.com/content/dam/honeywell-edam/pmt/hps/products/training/trainingprograms/honeywell-connected-industrial-/uniformance-phd-(uni)/coursedescriptions/UNI-0004-Uniformance-PHD-Advanced-Interfaces-And-System-Administration.pdf))

### Suggested Mitigation
Target PI Web API exclusively (cross-platform REST). Build a Kerberos auth helper library once and reuse. Support AVEVA CONNECT cloud path as preferred alternative. Budget 2-4 weeks per customer for PI integration tuning. For Honeywell PHD, use OPC-UA/DA as primary path or Seeq's dedicated PHD connector.

---

## RISK 8: Market Data Feed Costs Are Prohibitive for a Startup

**Severity: HIGH**

### Description
OPIS and Platts -- the industry-standard petroleum pricing benchmarks that Reflex needs for crack spread monitoring -- are enterprise-priced with no startup-friendly tiers. Redistribution licensing is restrictive, and forwarding raw prices in Slack/Teams messages could trigger licensing violations.

### Evidence
- OPIS, Platts, Argus, and ICE do not publish pricing. Enterprise contracts typically start at **$10,000-$50,000+/year** with multi-week procurement. No startup-friendly tiers found. ([OPIS](https://www.opis.com/), [S&P Global Developer Portal](https://developer.spglobal.com/), [Argus Media](https://www.argusmedia.com/en))
- Platts explicitly tracks redistribution via IP monitoring and requires a signed **Derived Data Addendum**. Forwarding raw pricing data could trigger licensing violations. ([Platts MSA](https://www.contractsfinder.service.gov.uk/Notice/Attachment/e523dbcc-a730-4ca0-9af0-65c10d72ef65))
- Free alternatives (EIA, OilPriceAPI at $9-15/mo) provide crude benchmarks but **not** the granular rack/spot product pricing (gasoline blendstocks, jet fuel, heating oil) that LP optimization requires. ([EIA Open Data](https://www.eia.gov/opendata/), [OilPriceAPI](https://www.oilpriceapi.com/pricing))

### Suggested Mitigation
Design Reflex as a **"bring your own data"** tool where the refinery customer supplies their own OPIS/Platts subscription data. This eliminates cost and licensing risk entirely. For MVP/demo, use EIA + OilPriceAPI at near-zero cost with accepted latency tradeoffs. Never embed raw third-party pricing in operator-facing messages.

---

## RISK 9: Historian Compression Artifacts and Stale Data Create Phantom Triggers

**Severity: HIGH**

### Description
PI uses a two-stage filtering system (exception reporting + swinging door compression) that can silently remove real process changes or create artificial step changes. Stale/frozen sensors look identical to stable processes in the data. These data quality issues can cause both false triggers and missed triggers.

### Evidence
- Exception/compression filters can remove small but meaningful changes before they reach the archive. The swinging door algorithm can create false step changes at deadband edges and introduce false harmonics. ([Canary Labs](https://blog.canarylabs.com/the-dangers-of-data-interpolation-and-its-affect-on-data-historians), [AVEVA 2023 Presentation](https://cdn.osisoft.com/osi/presentations/2023-AVEVA-San-Francisco/UC23NA-3PGK04-AVEVA_Bregenzer_Brent-Exception-Compression-and-their-Impacts-On-PI-System-Performance.pdf))
- Stale data "looks perfectly normal -- dashboards render, calculations run, but every decision is based on outdated information." Distinguishing frozen sensors from stable processes is fundamentally difficult. ([Thomas Dhollander](https://thomas-dhollander.medium.com/robust-detection-of-stale-sensor-data-a-multi-faceted-challenge-bf9ed0609ef7))
- Over **70% of analytics time** in industrial settings is spent on data cleansing. Existing tools (Seeq, TrendMiner) are designed for human-in-the-loop analysis, not automated triggers. ([Seeq](https://www.seeq.com/resources/blog/making-data-fit-for-purpose/))

### Suggested Mitigation
Audit compression settings for every tag feeding trigger logic. Request tighter compression for Reflex-critical tags. Always request actual recorded values (not interpolated) for trigger conditions. Implement staleness detection per tag with configurable thresholds. Cross-reference related measurements to detect frozen sensors. Build a **Data Quality Gateway** that all data must pass through before reaching trigger logic.

---

## RISK 10: Excel Single-Threaded Execution Creates Hard Performance Floor

**Severity: HIGH**

### Description
VBA UDFs, COM add-in functions, and several Excel built-in functions force single-threaded recalculation. Since refinery LP models almost certainly use VBA or COM add-ins, Excel's multi-threaded recalculation (up to 1,024 threads) will not help. Combined with COM initialization, workbook loading, and solver execution, each LP run takes 30 seconds to 7+ minutes with no parallelization path.

### Evidence
- All VBA UDFs, COM add-in functions, XLM macro functions, and data table recalculations are forced to the main thread. ([Microsoft Learn](https://learn.microsoft.com/en-us/office/client-developer/excel/multithreaded-recalculation-in-excel))
- No server-side alternative supports Solver + VBA + COM add-ins. Excel Services (SharePoint) does not support VBA, COM add-ins, or Solver. Excel Online limits Solver to 200 variables / 100 constraints with 30-second timeout. Microsoft Graph API cannot run Solver. ([Microsoft Learn](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/excel-services-architecture))
- Running multiple Excel instances in parallel is unstable: Microsoft documents clipboard crashes across instances and recommends isolating instances in **separate VMs**. ([Microsoft Support](https://support.microsoft.com/en-us/office/excel-may-crash-when-running-multiple-instances-that-use-clipboard-functionality-programmatically-271a9236-97bf-462b-9ec9-400b30b888c6))
- 32-bit Excel (still common in enterprise) is capped at 2GB shared address space. ([Microsoft Learn](https://learn.microsoft.com/en-us/troubleshoot/microsoft-365-apps/excel/memory-usage-32-bit-edition-of-excel))

### Suggested Mitigation
Implement queue backpressure: if model solve time exceeds trigger interval, coalesce pending triggers into one run. Mandate 64-bit Excel. Run Excel in an isolated VM with watchdog monitoring. Long-term, offer model migration to Python solvers (PuLP/Pyomo) as professional service.

---

## RISK 11: Microsoft Teams Bot Deployment Requires IT Admin Approval Per Customer

**Severity: MEDIUM-HIGH**

### Description
Reflex delivers recommendations via Slack or Teams. Microsoft Teams -- the dominant platform in oil & gas (44% market share vs Slack's 18.6%) -- requires IT admin approval for every custom bot deployment, potentially adding weeks to each customer onboarding. Control room operators may not have access to Teams at all.

### Evidence
- Teams admins have granular control over which apps/bots are allowed. Many enterprises default to **blocking all third-party apps**. Each deployment requires IT admin approval via App Permission Policies. ([Microsoft Learn](https://learn.microsoft.com/en-us/microsoftteams/app-permissions), [Microsoft Learn](https://learn.microsoft.com/en-us/microsoftteams/teams-app-setup-policies))
- Multi-Tenant bot creation was **deprecated July 2025**. New multi-tenant bots cannot be created.
- Refinery planning teams work in offices with Teams/email, but **control room operators** (who execute recommendations) work on DCS/SCADA systems that are air-gapped from corporate IT. They will not see Slack/Teams messages.
- Slack's 2025 rate limit changes impose 1 req/min limits on non-Marketplace commercial apps. ([Slack Changelog](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/))

### Suggested Mitigation
Build **Teams-first** with Slack as secondary. Always offer **email as universal fallback**. Plan for 2-8 week IT approval cycles per customer. Get Slack Marketplace approval to avoid rate limit restrictions. For control room delivery, explore DCS integration or structured handoff protocols between planning and operations teams.

---

## RISK 12: Seeq Is the Wrong Abstraction Layer for Automated Data Access

**Severity: MEDIUM**

### Description
The transcript references Seeq as the integration layer between Reflex and historians. Seeq supports 30+ data sources, but it is designed as a human-facing analytics tool, not a programmatic data access middleware for automated systems.

### Evidence
- Seeq write-back is limited to **PI only**; all other historians are read-only. Signal export caps at hundreds, not thousands. ([Seeq Docs](https://support.seeq.com/kb/latest/cloud/exporting-signals-and-conditions-to-a-historian))
- Seeq is transitioning to SaaS-primary deployment; on-premise is de-emphasized. Enterprise pricing only -- likely expensive for a startup. ([Seeq](https://support.seeq.com/kb/latest/on-premise/seeq-saas-as-the-primary-deployment-model))
- Neither Seeq nor TrendMiner attempts to auto-correct bad data for automated triggering -- they assume human-in-the-loop analysis. ([dataPARC](https://www.dataparc.com/blog/the-data-foundation-seeq-assumes-you-have-but-you-might-not/))

### Suggested Mitigation
Do not depend on Seeq as the primary data access layer. Build direct historian connectors (PI Web API, ODBC for AVEVA/PHD, OPC-UA) in the Reflex Edge Agent. Use Seeq's connector architecture as design inspiration, and support Seeq as an optional integration for customers who already have it deployed.

---

## RISK 13: Claude API Has No SLA for 24/7 Industrial Use

**Severity: MEDIUM**

### Description
Claude API has shown 99.06% uptime over 90 days (~7 hours downtime/month). Anthropic publishes no SLA with guaranteed uptime or service credits. For a tool advising refinery operations 24/7, this requires a fallback strategy.

### Evidence
- Claude API: 99.06% uptime over 90 days; most outages resolve in 15-30 minutes. No published SLA. ([Anthropic Status](https://status.anthropic.com/uptime), [DeployFlow](https://deployflow.co/blog/claude-anthropic-outage-protect-claude-infrastructure/))
- Tier 1 rate limits (50 RPM) are sufficient for Reflex; Tier 2 (1,000 RPM) provides ample headroom. ([Claude Rate Limits](https://platform.claude.com/docs/en/api/rate-limits))
- Cost is very manageable: ~$60/site/month without caching, ~$10-15 with prompt caching (90% savings). ([Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing))

### Suggested Mitigation
Build a **deterministic template-based fallback** that generates recommendations without LLM involvement when the API is down. The fallback won't have natural language polish but will deliver the critical numbers and direction. Consider multi-provider strategy (Claude + OpenAI) for redundancy.

---

## Summary Risk Matrix

| # | Risk | Severity | Likelihood | Mitigation Difficulty |
|---|------|----------|------------|----------------------|
| 1 | OT network security / Purdue model forces edge deployment | **CRITICAL** | Certain | HIGH -- requires edge agent architecture |
| 2 | Excel COM automation unsupported for server-side use | **CRITICAL** | Certain | HIGH -- no alternative for Excel models |
| 3 | Proprietary LP solvers (PIMS/GRTMPS) may not be automatable | **CRITICAL** | High (many sites use these) | HIGH -- may require vendor partnerships |
| 4 | Shutdown/startup/upset floods false recommendations | **CRITICAL** | Medium (regular events) | MEDIUM -- requires mode detection system |
| 5 | LLM numerical hallucination in safety-critical context | **CRITICAL** | Medium | MEDIUM -- deterministic guardrails work |
| 6 | Sensor glitches vs. real process changes | **HIGH** | High (continuous) | HIGH -- requires sophisticated validation |
| 7 | PI System integration complexity | **HIGH** | Certain | MEDIUM -- known patterns, per-customer work |
| 8 | Market data feed costs prohibitive | **HIGH** | Certain for startup | LOW -- "bring your own data" solves it |
| 9 | Compression artifacts / stale data create phantom triggers | **HIGH** | High (always present) | MEDIUM -- requires data quality gateway |
| 10 | Excel single-threaded performance floor | **HIGH** | Certain for LP models | MEDIUM -- queue backpressure helps |
| 11 | Teams bot requires per-customer IT approval | **MEDIUM-HIGH** | High | LOW -- expected enterprise sales friction |
| 12 | Seeq is wrong abstraction layer | **MEDIUM** | Medium | LOW -- build direct connectors instead |
| 13 | Claude API has no SLA | **MEDIUM** | Medium | LOW -- template fallback is straightforward |

---

## Top 5 Architectural Recommendations

1. **Build a Reflex Edge Agent** deployed in the customer's DMZ (Level 3.5) that reads from historian replicas via PI Web API / ODBC / OPC-UA and pushes data outbound via HTTPS. Never require inbound firewall rules.

2. **Build a Data Quality Gateway** between historian data and trigger logic. Check for digital states, staleness, rate-of-change limits, cross-signal consistency, compression artifacts, and operating mode. No raw historian data should directly trigger an LP re-solve.

3. **Decouple numbers from LLM.** Programmatically extract all values from LP output; use the LLM only for natural-language context. Cross-validate every number. Build deterministic template fallback for LLM downtime.

4. **Validate the LP tool landscape immediately.** Survey target customers to determine whether they use Excel Solver, PIMS, GRTMPS, or RPMS. This single finding determines whether the core architecture is feasible.

5. **Design for "bring your own data"** across the board: customers supply historian access, market data feeds, and LP models. Reflex is the orchestration and translation layer, not a data provider.
