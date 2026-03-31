# Reflex Platform — Cloud Platform Recommendation

> **Date:** 2026-03-27
> **For:** Founding team infrastructure decisions
> **Based on:** Product transcript analysis, Run 1 risk matrix (20 risks), and comparative research across Azure, AWS, and cloud-agnostic services
> **Addresses risks:** R6 (OT Security), R2 (Delivery Channel), R1 (Excel COM), R5 (LLM Safety), R12 (PI Integration)

---

## Executive Recommendation

**Azure-primary with cloud-agnostic services where cost or flexibility matters.**

| Layer | Recommendation | Why |
|-------|---------------|-----|
| **Edge / IoT** | Azure IoT Edge + IoT Hub | First-party OPC-UA Publisher, PI Integrator for Azure, Purdue Model guidance |
| **Compute** | Azure Container Apps + Azure Functions | Always-free tier covers pilot; serverless scales to zero |
| **Messaging** | Azure Bot Service + Adaptive Cards (Teams) | Refineries are Microsoft shops; native structured input for constraint capture |
| **Time-Series DB** | InfluxDB Cloud (cloud-agnostic) | Free tier covers pilot; Telegraf OPC-UA plugin; avoids $90+/mo ADX minimum |
| **LLM / AI** | Direct Anthropic Claude API | Provider-agnostic; no cloud lock-in; Haiku for routine translation (~$2-3/mo) |
| **Relational DB** | Azure Database for PostgreSQL Flexible Server | Free 12 months with student credits; constraint registry, user data, audit logs |
| **Security** | Microsoft Defender for IoT + Entra ID | OT-specific threat detection; IEC 62443-aligned; Purdue Model awareness |
| **CI/CD** | GitHub Actions | Cloud-agnostic; free 2000 min/mo for private repos; GitHub Student Pack |

### Why Azure Over AWS

The decision comes down to one factor: **industrial IoT connectivity is Reflex's hardest technical problem, and Azure is materially better at it.**

1. **Azure IoT Edge has a first-party OPC-UA Publisher module** (open source, Microsoft-maintained). AWS requires custom OPC-UA integration or the less flexible SiteWise Edge Gateway.

2. **PI Integrator for Azure** is an official AVEVA/OSIsoft product that streams PI historian data directly into Azure Event Hubs. No equivalent exists for AWS. This directly addresses R12 (PI System integration complexity).

3. **Microsoft Defender for IoT** (acquired from CyberX) provides Purdue Model-aware OT network monitoring, asset discovery for industrial protocols (Modbus, DNP3, OPC-UA), and IEC 62443-aligned security posture management. This directly addresses R6 (OT Security).

4. **Teams is the dominant messaging platform in oil & gas.** Azure Bot Service + Adaptive Cards gives native structured constraint input. Building Teams bots on AWS still requires Azure AD app registration — you end up on Azure anyway.

5. **Azure for Students** provides $100/year with just a .edu email (no credit card). Microsoft for Startups offers $1K-$150K in additional credits.

### Why Not Pure Azure

Azure Data Explorer ($90-150/mo minimum cluster) is overkill for 100 sensor tags. InfluxDB Cloud's free tier covers pilot needs at $0/mo. Similarly, Claude API is provider-agnostic — there's no reason to add Azure OpenAI complexity when you're committed to Claude.

---

## Category-by-Category Comparison

### 1. Student Credits & Free Tiers

| Program | Azure | AWS |
|---------|-------|-----|
| **Student credits** | $100/yr (Azure for Students, .edu email, instant) | No direct student credits since AWS Educate changed (~2022) |
| **Startup credits** | Microsoft for Startups: $1K-$150K | AWS Activate Founders: $1K; Portfolio: $25K (needs accelerator) |
| **Always-free compute** | Container Apps: 2M req + 180K vCPU-s/mo | Lambda: 1M req + 400K GB-s/mo (no always-on container equivalent) |
| **Always-free functions** | 1M executions + 400K GB-s/mo | 1M executions + 400K GB-s/mo |
| **Always-free API gateway** | APIM Consumption: 1M calls/mo | API Gateway: 1M calls/mo (12 months only) |
| **Always-free secrets** | Key Vault: 10K ops/mo | SSM Parameter Store: free (Secrets Manager: $0.40/secret/mo) |
| **12-month free VM** | B1s: 1 vCPU, 1 GB, 750 hrs/mo | t3.micro: 2 vCPU, 1 GB, 750 hrs/mo |
| **12-month free PostgreSQL** | Flexible B1ms: 1 vCPU, 2 GB, 32 GB storage | RDS db.t3.micro: 2 vCPU, 1 GB, 20 GB storage |

**Winner: Azure** — Always-free Container Apps is a standout (AWS has no equivalent). Student credits are easier to get. Both have comparable 12-month free tiers.

---

### 2. AI / LLM Integration

| Factor | Azure | AWS | Cloud-Agnostic |
|--------|-------|-----|----------------|
| **Native Claude hosting** | No | Yes (Bedrock) — same pricing as direct API | Direct Anthropic API |
| **Prompt management** | Azure AI Studio (optimized for OpenAI models) | Bedrock Prompt Management + Flows | LangSmith, Helicone |
| **LLM observability** | Azure Monitor (manual instrumentation for Claude) | CloudWatch (native for Bedrock) | Helicone, LangFuse |
| **Cost for Reflex workload** | Direct API: ~$2-60/mo depending on model | Bedrock: same pricing, single bill | Same pricing |
| **Caching** | APIM response caching | API Gateway caching | Application-level caching |

**Winner for Reflex: Direct Anthropic API (cloud-agnostic).**

Rationale: Reflex uses Claude only for natural language formatting of LP outputs (R5 mitigation — numbers are extracted programmatically, not by the LLM). This is a simple API call pattern. Bedrock's native integration is nice but not worth choosing AWS over Azure for. The Claude API works identically from both clouds.

**Cost estimate (Claude API):**
- Routine translation: Claude Haiku at ~$0.001/call average
- 50-100 calls/day = $1.50-3.00/month
- Complex constraint interpretation (Sonnet): ~10-20 calls/day = $5-15/month
- **Total: ~$7-18/month per site** (blended Haiku + Sonnet)

---

### 3. Time-Series Data Storage

| Factor | Azure Data Explorer | AWS Timestream | InfluxDB Cloud |
|--------|-------------------|----------------|----------------|
| **Architecture** | Column-store cluster | Serverless (memory + magnetic) | Purpose-built TSDB |
| **Industrial data fit** | Excellent (gap-filling, anomaly detection, KQL) | Adequate (basic SQL) | Good (Flux language, Telegraf ecosystem) |
| **Built-in anomaly detection** | Yes (`series_decompose_anomalies()`) | No | Limited |
| **PI System integration** | PI Integrator for Azure (official) | Custom only | Telegraf OPC-UA plugin |
| **Minimum cost** | ~$87/mo (Dev/Test SKU) | ~$10-30/mo (serverless) | Free tier (300 MB, 30-day retention) |
| **Cost for 100 tags @ 30s** | ~$90-150/mo | ~$10-30/mo | $0-50/mo |
| **Serverless / no cluster** | No (requires cluster) | Yes | Yes |

**Winner for pilot: InfluxDB Cloud (cloud-agnostic).**

Rationale: At 100 sensor tags (288K points/day, ~432 MB/month), InfluxDB's free tier is sufficient or near-sufficient. Telegraf's OPC-UA input plugin can read directly from PI's OPC-UA interface, simplifying the edge agent. ADX becomes cost-effective at 1,000+ tags (Phase 3+).

**Migration path:** Start InfluxDB Cloud free tier → upgrade to InfluxDB usage-based as data grows → migrate to Azure Data Explorer when scaling to 10+ sites (ADX's anomaly detection and KQL become worth the cost).

---

### 4. Real-Time Data Pipeline

| Factor | Azure | AWS |
|--------|-------|-----|
| **Event ingestion** | Event Hubs Basic: ~$11/mo | Kinesis On-Demand: ~$30-35/mo |
| **Stream processing** | Stream Analytics: ~$80/mo (overkill) | Kinesis Analytics: ~$110/mo (overkill) |
| **Event-driven functions** | Azure Functions: free tier | Lambda: free tier |
| **Simplest cheap path** | Event Hubs + Functions: ~$11/mo | SQS + Lambda: ~$0/mo (within free tier) |
| **Developer experience** | Better portal, tighter service coupling | More docs, larger community |

**Winner: Azure Functions (trigger-based, no event broker needed).**

Rationale: Reflex doesn't need Kafka-scale event streaming. The data pipeline is: Edge Agent pushes data via HTTPS → Azure Function processes it → writes to InfluxDB + checks triggers → if threshold crossed, triggers LP re-solve. At 4-8 LP solves/day, this is well within Azure Functions' free tier. No Event Hubs or Kinesis needed at pilot scale.

**Scale path:** Add Azure Event Hubs when ingestion exceeds what direct HTTPS push can handle (~10+ sites with 1,000+ tags each).

---

### 5. Industrial IoT Connectivity (Decisive Category)

| Factor | Azure | AWS |
|--------|-------|-----|
| **OPC-UA edge module** | IoT Edge OPC-UA Publisher (first-party, open source) | Custom build required, or SiteWise Edge (less flexible) |
| **PI System integration** | PI Integrator for Azure (official AVEVA product) | No official integration |
| **Purdue Model guidance** | Explicit architecture docs, nested edge support | Limited documentation |
| **OT security monitoring** | Defender for IoT (CyberX acquisition) — Purdue-aware | No equivalent |
| **Industrial partnerships** | Siemens, Rockwell, ABB, AVEVA/OSIsoft, Honeywell | GE Digital, PTC (weaker in process industries) |
| **Edge gateway** | IoT Edge: container-based, store-and-forward, nested | Greengrass v2: component-based, stream manager |
| **IoT Hub/Core pricing** | Free tier: 8K msg/day; S1: ~$25/mo (400K msg/day) | ~$1-9/mo at this scale |
| **Data diode compatibility** | Works (outbound-only HTTPS from IoT Edge) | Works (outbound-only from Greengrass) |

**Winner: Azure (decisive).**

This is the single most important category for Reflex. The Run 1 risk matrix identifies R6 (OT Security) as score 80 — CRITICAL. Azure's industrial IoT ecosystem directly mitigates this:

- **Edge Agent architecture (R6 mitigation):** Azure IoT Edge deploys as a container in the customer's DMZ (Purdue Level 3.5). The OPC-UA Publisher module reads from PI's OPC-UA interface. Data flows outbound via HTTPS to IoT Hub. No inbound firewall rules required. Microsoft publishes reference architectures for exactly this Purdue Model deployment pattern.

- **PI integration (R12 mitigation):** PI Integrator for Azure is a supported AVEVA product that streams historian data into Azure Event Hubs. For customers who have it, this eliminates custom PI connector work entirely.

- **Nested Edge (Purdue compliance):** IoT Edge supports hierarchical deployments — a Level 3 edge device talks to a Level 3.5 edge device which connects to cloud. This maps directly to Purdue Model requirements.

---

### 6. Messaging Integration

| Factor | Azure | AWS |
|--------|-------|-----|
| **Teams bot development** | Azure Bot Service (first-party SDK, native) | Must register Azure AD app anyway; more manual setup |
| **Adaptive Cards (Teams)** | Full support: dropdowns, buttons, number inputs, submit actions | Same cards work, but bot hosting has more friction |
| **Slack integration** | Equivalent (Bot Framework supports Slack) | Equivalent (Bolt SDK + Lambda) |
| **Structured constraint input** | Adaptive Cards: select unit → select type → select severity → submit | Same capability via Slack Block Kit or Teams Adaptive Cards |
| **Email fallback** | Azure Communication Services: $0.25/1K emails | AWS SES: $0.10/1K emails (cheaper, more mature) |

**Winner: Azure (for Teams-primary customers).**

Refineries overwhelmingly use Microsoft 365 and Teams. Azure Bot Service provides the shortest path to structured constraint capture via Adaptive Cards — directly addressing R2 (Delivery Channel) and the structured input recommendation from Run 1.

**Adaptive Card for constraint input (example):**
```
[Select Unit: ▼ Unit 2 / Unit 3 / Unit 6 / ...]
[Constraint Type: ▼ Equipment Fouling / Capacity Limit / Safety / Maintenance / ...]
[Severity: ● 5% ● 10% ● 15% ● 20% ● Other]
[Optional Note: ________________]
[Submit Constraint] [Dismiss]
```

This replaces free-text NLP extraction (46-85% accuracy) with structured input (100% accuracy) — directly mitigating R5.

---

### 7. Security & Compliance

| Factor | Azure | AWS |
|--------|-------|-----|
| **IEC 62443 tooling** | Defender for IoT: OT asset discovery, industrial protocol monitoring, Purdue awareness | No equivalent |
| **SOC 2 Type II prep** | Defender for Cloud compliance dashboard | Audit Manager (slightly better for first audit) |
| **Identity management** | Entra ID (Azure AD) — native to Microsoft 365 customers | IAM Identity Center — requires separate IdP setup |
| **SIEM** | Microsoft Sentinel (~$2.46/GB) | GuardDuty + Security Hub (simpler, cheaper) |
| **Threat detection cost** | Defender for Cloud free tier + paid plans ~$15/server/mo | GuardDuty ~$1/GB flow logs |
| **For small teams** | More comprehensive but steeper learning curve | Simpler "set and forget" security |

**Winner: Azure (for industrial compliance); AWS (for simplicity).**

For Reflex specifically, Azure wins because Defender for IoT directly addresses R6 and R7 (OSHA PSM / cybersecurity procurement). When a refinery CISO asks "how do you monitor OT network security?", having Defender for IoT in the architecture is a concrete answer. This shortens the 6-18 month security approval cycle identified in R6.

---

## Cost Projection Tables

### Year 1: Pilot (1 Refinery Site, ~100 Tags)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| **Azure Container Apps** | $0 | Always-free tier (dashboard + API backend) |
| **Azure Functions** | $0 | Always-free tier (data pipeline triggers, LP solve orchestration) |
| **Azure IoT Hub** | $0-25 | Free tier: 8K msg/day; S1 at $25/mo if exceeded |
| **Azure PostgreSQL** | $0 | Free 12 months (B1ms with student credits) |
| **Azure Key Vault** | $0 | Always-free tier |
| **Azure API Management** | $0 | Consumption tier, always-free |
| **Azure Bot Service** | $0 | Free for standard channels (Teams) |
| **Azure Blob Storage** | $0.10-0.50 | Archive, config, logs (~5-10 GB) |
| **InfluxDB Cloud** | $0-10 | Free tier covers 100 tags; usage-based if exceeded |
| **Claude API (Anthropic)** | $7-18 | Blended Haiku + Sonnet |
| **Windows VM (LP solver)** | $0-15 | Azure B2s for Excel COM automation; may use student credits |
| **Domain + DNS** | $1-2 | Namecheap via GitHub Student Pack or Azure DNS |
| | | |
| **TOTAL (Month 1-12)** | **$8-70/month** | |
| **Annual estimate** | **$100-840/year** | |
| **Covered by Azure for Students** | $100 credit covers ~2-12 months of Azure services | |

### Year 2: Scale (10 Refinery Sites, ~1,000 Tags Total)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| **Azure Container Apps** | $15-40 | Light usage beyond free tier |
| **Azure Functions** | $5-15 | 10x trigger volume, still low |
| **Azure IoT Hub** | $25-75 | S1 ($25/mo) or S2 depending on message volume |
| **Azure PostgreSQL** | $25-50 | Flexible Server, General Purpose for 10 sites |
| **Azure Key Vault** | $0-5 | Within or near free tier |
| **Azure API Management** | $0-10 | Consumption tier scales with usage |
| **Azure Bot Service** | $0-5 | Low message volume |
| **Azure Blob Storage** | $2-10 | 50-100 GB |
| **InfluxDB Cloud** | $50-200 | Usage-based plan, 1,000 tags |
| **Claude API (Anthropic)** | $70-180 | 10x sites, blended models |
| **Windows VMs (LP solvers)** | $50-150 | 2-3 B2s VMs (some sites share) |
| **Defender for IoT** | $0-50 | May need paid tier for 10 sites |
| **Monitoring / Logging** | $10-30 | Azure Monitor, Application Insights |
| | | |
| **TOTAL (per month)** | **$250-820/month** | |
| **Annual estimate** | **$3,000-9,800/year** | |

### Revenue Context

At $75K-$125K/site/year (from product transcript), 10 paying sites = $750K-$1.25M ARR. Cloud costs of $3K-$10K/year represent **<1.5% of revenue** — infrastructure is not a meaningful cost driver at scale.

---

## Architecture Description

```
                    REFINERY SITE (Customer Premises)
    ┌─────────────────────────────────────────────────────┐
    │  Purdue Level 0-2: Process Control Network (OT)     │
    │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
    │  │ DCS/PLC  │  │ Sensors  │  │ PI System        │  │
    │  │ (Control)│  │ (100 tags│  │ (Historian)       │  │
    │  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
    │       │              │                 │             │
    │  ─────┴──────────────┴─────────────────┘             │
    │                                                      │
    │  Purdue Level 3.5: DMZ                               │
    │  ┌──────────────────────────────────────────────┐   │
    │  │  REFLEX EDGE AGENT (Azure IoT Edge)          │   │
    │  │  ┌─────────────────┐  ┌───────────────────┐  │   │
    │  │  │ OPC-UA Publisher │  │ Data Quality      │  │   │
    │  │  │ Module           │  │ Gateway Module    │  │   │
    │  │  │ (reads PI tags)  │  │ (validates data)  │  │   │
    │  │  └────────┬────────┘  └────────┬──────────┘  │   │
    │  │           │   store-and-forward │             │   │
    │  │           └─────────┬──────────┘             │   │
    │  │                     │ HTTPS outbound only     │   │
    │  └─────────────────────┼────────────────────────┘   │
    └────────────────────────┼────────────────────────────┘
                             │
                    ═════════╪═════════  FIREWALL (outbound only)
                             │
                             ▼
              AZURE CLOUD (Reflex Platform)
    ┌────────────────────────────────────────────────────┐
    │                                                    │
    │  ┌──────────────┐         ┌────────────────────┐  │
    │  │ Azure IoT Hub│────────▶│ Azure Functions     │  │
    │  │ (ingestion)  │         │ (trigger logic)     │  │
    │  └──────────────┘         │                     │  │
    │                           │ - Data validation   │  │
    │                           │ - Process triggers   │  │
    │                           │ - Price triggers     │  │
    │                           │ - Mode detection     │  │
    │                           └──────┬──────────────┘  │
    │                                  │                  │
    │              ┌───────────────────┼────────────┐    │
    │              ▼                   ▼            ▼    │
    │  ┌──────────────────┐  ┌────────────┐  ┌───────┐  │
    │  │ InfluxDB Cloud   │  │ LP Solver  │  │ Azure │  │
    │  │ (time-series)    │  │ Orchestrator│  │ PgSQL │  │
    │  │                  │  │ (triggers  │  │       │  │
    │  │ - sensor history │  │  Windows VM│  │ -users│  │
    │  │ - market data    │  │  for Excel │  │ -const│  │
    │  │ - coefficients   │  │  COM auto) │  │ -audit│  │
    │  └──────────────────┘  └──────┬─────┘  └───────┘  │
    │                               │                    │
    │                               ▼                    │
    │                     ┌──────────────────┐           │
    │                     │ Claude API       │           │
    │                     │ (Anthropic)      │           │
    │                     │                  │           │
    │                     │ Input: LP deltas │           │
    │                     │  (numbers pre-   │           │
    │                     │   extracted)     │           │
    │                     │ Output: plain    │           │
    │                     │  English recs    │           │
    │                     └────────┬─────────┘           │
    │                              │                     │
    │                              ▼                     │
    │                   ┌────────────────────┐           │
    │                   │ Azure Bot Service  │           │
    │                   │ (Teams + Slack)    │           │
    │                   │                    │           │
    │                   │ Adaptive Cards:    │           │
    │                   │ - Recommendations  │           │
    │                   │ - Constraint input  │           │
    │                   │ - Override capture  │           │
    │                   └────────┬───────────┘           │
    │                            │                       │
    │              ┌─────────────┼──────────────┐       │
    │              ▼             ▼              ▼       │
    │     ┌────────────┐ ┌───────────┐ ┌────────────┐  │
    │     │ Teams      │ │ Slack     │ │ Email      │  │
    │     │ (primary)  │ │ (alt)     │ │ (fallback) │  │
    │     └────────────┘ └───────────┘ └────────────┘  │
    │                                                    │
    │  ┌─────────────────────────────────────────────┐  │
    │  │ Azure Container Apps (Dashboard + API)      │  │
    │  │                                             │  │
    │  │ - Management dashboard (value captured)     │  │
    │  │ - Constraint registry viewer                │  │
    │  │ - Coefficient reconciliation reports        │  │
    │  │ - Sensor health / maintenance prioritization│  │
    │  └─────────────────────────────────────────────┘  │
    │                                                    │
    │  Security: Entra ID + Defender for IoT + Key Vault │
    └────────────────────────────────────────────────────┘

    EXTERNAL SERVICES (cloud-agnostic)
    ┌────────────────────────────────────┐
    │ - Anthropic Claude API (LLM)       │
    │ - InfluxDB Cloud (time-series)     │
    │ - GitHub Actions (CI/CD)           │
    │ - EIA / OilPriceAPI (market data)  │
    │ - Customer-supplied OPIS/Platts    │
    └────────────────────────────────────┘
```

### Data Flow Summary

1. **Ingestion:** Edge Agent reads PI historian via OPC-UA → Data Quality Gateway validates → pushes to Azure IoT Hub via HTTPS (outbound only)
2. **Processing:** Azure Functions receives events → writes to InfluxDB Cloud → checks process/price triggers → detects operating mode
3. **LP Solve:** When triggered, orchestrator pushes live data into customer's Excel LP model (Windows VM with COM automation + watchdog) → extracts numerical results programmatically
4. **Translation:** LP deltas (numbers already extracted) sent to Claude API → returns plain-English recommendation with financial impact
5. **Delivery:** Azure Bot Service formats as Adaptive Card → delivers to Teams (primary) / Slack / email (fallback)
6. **Feedback:** Supervisor responds via structured Adaptive Card → constraint stored in PostgreSQL registry → logged by equipment, not operator → LP model updated with new bound
7. **Dashboard:** Container Apps serves management dashboard (value captured framing) and operator-facing view (upcoming recommendations, constraint status)

---

## Risk-Aligned Architecture Decisions

| Run 1 Risk | Score | Cloud Architecture Decision |
|------------|-------|-----------------------------|
| **R6: OT Security** | 80 | Azure IoT Edge in DMZ (Level 3.5), outbound-only HTTPS, OPC-UA Publisher for read-only historian access. Defender for IoT for OT monitoring. Never require inbound firewall rules. |
| **R2: Delivery Channel** | 125 | Azure Bot Service + Adaptive Cards in Teams for shift supervisors/process engineers. Structured 5-tap input replaces free-text. Email via Azure Communication Services as universal fallback. |
| **R1: Excel COM** | 125 | Windows VM (Azure B2s) for Excel COM automation with watchdog. Azure Functions orchestrates triggers and queue backpressure. Isolated from main platform — can be replaced with Python LP engine later. |
| **R5: LLM Hallucination** | 80 | Numbers extracted programmatically by Azure Functions before Claude API call. Claude receives pre-validated deltas and formats natural language only. Template-based fallback if API fails. Cross-validation on every output. |
| **R12: PI Integration** | 45 | Azure IoT Edge OPC-UA Publisher (first-party) for direct PI integration. PI Integrator for Azure available as official AVEVA product for customers who have it. Telegraf OPC-UA plugin as lightweight alternative. |
| **R9: Alert Fatigue** | 64 | Operating mode state machine in Azure Functions. All optimization triggers suppressed during non-normal modes. Mode state stored in PostgreSQL. |
| **R8: Union/Dashboard** | 64 | Dashboard in Azure Container Apps with audience-separated views. Override tracking by equipment in PostgreSQL, never by operator. "Value captured" framing. |
| **R7: OSHA/MOC** | 80 | Full audit trail in PostgreSQL (every recommendation, override, constraint change). Timestamps, operator acknowledgments, and constraint reasoning logged for MOC documentation. |

---

## Developer Experience & Tooling

| Tool | Recommendation | Notes |
|------|---------------|-------|
| **IaC** | Terraform (Azure provider) | Cloud-agnostic, team likely knows HCL; Bicep is Azure-only alternative |
| **CI/CD** | GitHub Actions | Free 2000 min/mo; GitHub Student Pack; works with Azure deployments |
| **Local Dev** | Azurite (storage emulator) + local Functions runtime | Azure's local dev is weaker than AWS/LocalStack; mitigate with Docker Compose for local InfluxDB + PostgreSQL |
| **Monitoring** | Azure Monitor + Application Insights | Free tier covers basics; add Helicone for Claude API observability |
| **Source Control** | GitHub | Free private repos; integrates with GitHub Actions and Azure deployments |

---

## Migration Path

### Phase 1 → Phase 2 (1 site → 3-5 sites)
- No architecture changes needed
- Scale IoT Hub tier if message volume exceeds free tier
- Upgrade PostgreSQL to General Purpose if performance requires it

### Phase 2 → Phase 3 (5 → 10+ sites)
- **Evaluate migrating InfluxDB Cloud → Azure Data Explorer** when tag count exceeds 500-1,000 and ADX's anomaly detection + KQL become worth the cost
- Add Azure Event Hubs if direct HTTPS push becomes a bottleneck
- Add Defender for IoT paid tier for multi-site OT monitoring
- Begin SOC 2 Type II preparation using Defender for Cloud compliance dashboard

### Phase 3 → Phase 4 (10+ → 20+ sites)
- Consider Azure Data Explorer as primary time-series store (ADX cost-effective at scale)
- Evaluate Azure Kubernetes Service if Container Apps scaling limits are hit
- Add regional deployments if expanding to Europe/Canada
- Consider Amazon Bedrock as secondary Claude API endpoint for redundancy

---

## Getting Started Checklist

1. **Today:**
   - [ ] Sign up for Azure for Students ($100 credit, .edu email)
   - [ ] Apply for GitHub Student Developer Pack
   - [ ] Create Anthropic API account (Claude API key)
   - [ ] Sign up for InfluxDB Cloud free tier

2. **Week 1:**
   - [ ] Apply for Microsoft for Startups program ($1K-$150K credits)
   - [ ] Set up Azure resource group + Terraform configuration
   - [ ] Deploy Azure Container Apps (dashboard skeleton) + PostgreSQL
   - [ ] Set up GitHub Actions CI/CD pipeline

3. **Week 2-4:**
   - [ ] Deploy Azure IoT Edge dev environment (local Docker simulation)
   - [ ] Build OPC-UA Publisher module configuration for PI historian
   - [ ] Implement Data Quality Gateway as IoT Edge module
   - [ ] Connect to InfluxDB Cloud from Azure Functions

4. **Month 2-3:**
   - [ ] Build Azure Bot Service Teams integration with Adaptive Cards
   - [ ] Implement structured constraint input cards
   - [ ] Set up Claude API integration with template fallback
   - [ ] Deploy Windows VM for Excel COM automation testing

---

*This recommendation should be revisited after Phase 0 validation (LP tool landscape survey) from the Executive Summary. If most target customers use PIMS/GRTMPS rather than Excel Solver, the Windows VM architecture for LP automation will need to change, but the cloud platform choice (Azure) remains valid regardless.*
