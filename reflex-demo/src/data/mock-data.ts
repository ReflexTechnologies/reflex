import type {
  KPICardData,
  Recommendation,
  Constraint,
  ConnectionHealth,
  OptimizationQueueItem,
  HandoverEvent,
  WaterfallDataPoint,
  DriftDataPoint,
  SensorHealthCell,
  ConstraintPattern,
  CrudeSlate,
  UllageByProduct,
  ProductReady,
} from "@/types";

export const SITE = {
  name: "Valero Memphis",
  capacity: "105,000 BPD",
  shift: "Day Shift (06:00–18:00)",
  shiftRemaining: "4h 23m remaining",
  marginCaptured: 1247832,
  marginTrend: 14.2,
  captureRate: 82,
};

export const heroKPIs: KPICardData[] = [
  { label: "Throughput", value: 412.8, unit: "MBPD", precision: 1, sparkline: [390, 395, 400, 405, 412, 410, 412.8] },
  { label: "Energy Index", value: 88.4, unit: "EEI", precision: 1, sparkline: [85, 86, 87, 88, 88.4] },
  { label: "Safety Health", value: 0.98, precision: 2, sparkline: [0.95, 0.96, 0.97, 0.98, 0.98] },
  { label: "Emissions", value: 14.2, unit: "MT/d", precision: 1, sparkline: [15.1, 14.8, 14.5, 14.3, 14.2], status: "healthy" },
];

export const recommendations: Recommendation[] = [
  {
    id: "rec-1",
    priority: "high",
    timestamp: "14:23",
    triggerType: "Price Movement",
    summary:
      "Crack spreads widened $1.80/bbl in the last 2 hours. Model recommends increasing naphtha yield by 2.6 percentage points on Units 3 and 4.",
    deltas: [
      { parameter: "Naphtha yield", current: "32.1%", recommended: "34.7%", delta: "+2.6%" },
      { parameter: "Units", current: "3, 4", recommended: "3, 4" },
      { parameter: "Margin impact", current: "—", recommended: "+$44,000/day" },
      { parameter: "Confidence", current: "—", recommended: "HIGH" },
    ],
    marginImpact: "+$44,000/day",
    confidence: "HIGH",
  },
  {
    id: "rec-2",
    priority: "medium",
    timestamp: "11:07",
    triggerType: "Inventory Slack",
    summary:
      "Adjust diesel blend ratio on Unit 6. Current diesel-to-gasoline ratio is suboptimal given Argus pricing update. Estimated margin impact: +$18,200/day.",
    deltas: [
      { parameter: "Diesel ratio", current: "29.8%", recommended: "27.2%", delta: "-2.6%" },
      { parameter: "Margin impact", current: "—", recommended: "+$18,200/day" },
      { parameter: "Confidence", current: "—", recommended: "MEDIUM" },
    ],
    marginImpact: "+$18,200/day",
    confidence: "MEDIUM",
  },
];

export const constraints: Constraint[] = [
  {
    id: "c-1",
    unit: "Unit 2",
    equipment: "HX-201 Fouling",
    severity: "-15% capacity",
    age: "3 days",
    status: "active",
    description: "Performance declining — monitor outlet temperature.",
  },
  {
    id: "c-2",
    unit: "Unit 6",
    equipment: "Catalyst Aging",
    severity: "-8% yield",
    age: "12 days",
    status: "monitoring",
    description: "Yield coefficient drift detected. LP model updated.",
  },
  {
    id: "c-3",
    unit: "Blend",
    equipment: "Staffing Constraint",
    severity: "Manual override",
    age: "This shift",
    status: "temporary",
    description: "Expires at shift end. Night shift has full staffing.",
  },
];

export const connections: ConnectionHealth[] = [
  { name: "pi", label: "PI", status: "connected" },
  { name: "mkt", label: "MKT", status: "connected" },
  { name: "lp", label: "LP", status: "connected" },
  { name: "ai", label: "AI", status: "connected" },
];

export const optimizationQueue: OptimizationQueueItem[] = [
  { assetId: "BLNK-041-ALPHA", name: "Blending Unit Alpha", stability: 99.6, trend: "stable" },
  { assetId: "HEAT-204-BRAVO", name: "Heat Exchanger 204", stability: 92.1, trend: "down" },
  { assetId: "FCC-102-GAMMA", name: "FCC Reactor Gamma", stability: 97.3, trend: "up" },
];

export const flowNetworkData = [
  { unit: "CDU", performance: 94 },
  { unit: "FCC", performance: 88 },
  { unit: "HCU", performance: 91 },
  { unit: "REF", performance: 96 },
  { unit: "BLN", performance: 85 },
  { unit: "STR", performance: 93 },
];

/* ------------------------------------------------------------------ */
/* Refinery Flow — Sankey + unit status                               */
/* ------------------------------------------------------------------ */

export interface SankeyNode {
  name: string;
  itemStyle: { color: string };
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;        // actual kbpd
  target_value: number; // planned kbpd
}

export const sankeyNodes: SankeyNode[] = [
  { name: "Crude Feed", itemStyle: { color: "#0D9488" } },
  { name: "CDU", itemStyle: { color: "#0D9488" } },
  { name: "FCC", itemStyle: { color: "#0D9488" } },
  { name: "HCU", itemStyle: { color: "#0D9488" } },
  { name: "Reformer", itemStyle: { color: "#14B8A6" } },
  { name: "Blend", itemStyle: { color: "#14B8A6" } },
  { name: "Gasoline Pool", itemStyle: { color: "#5EEAD4" } },
  { name: "LPG", itemStyle: { color: "#5EEAD4" } },
  { name: "Diesel Pool", itemStyle: { color: "#5EEAD4" } },
  { name: "Naphtha", itemStyle: { color: "#5EEAD4" } },
  { name: "Reformate", itemStyle: { color: "#5EEAD4" } },
  { name: "H2", itemStyle: { color: "#5EEAD4" } },
  { name: "Product Out", itemStyle: { color: "#5EEAD4" } },
];

export const sankeyLinks: SankeyLink[] = [
  { source: "Crude Feed", target: "CDU", value: 105, target_value: 110 },
  { source: "CDU", target: "FCC", value: 38, target_value: 40 },
  { source: "CDU", target: "HCU", value: 28, target_value: 32 },
  { source: "CDU", target: "Reformer", value: 22, target_value: 22 },
  { source: "CDU", target: "Blend", value: 17, target_value: 17 },
  { source: "FCC", target: "Gasoline Pool", value: 32, target_value: 33 },
  { source: "FCC", target: "LPG", value: 6, target_value: 7 },
  { source: "HCU", target: "Diesel Pool", value: 24, target_value: 28 },
  { source: "HCU", target: "Naphtha", value: 4, target_value: 4 },
  { source: "Reformer", target: "Reformate", value: 18, target_value: 18 },
  { source: "Reformer", target: "H2", value: 4, target_value: 4 },
  { source: "Blend", target: "Product Out", value: 17, target_value: 17 },
];

export type RefineryUnitSlug =
  | "cdu"
  | "fcc"
  | "hcu"
  | "reformer"
  | "blend"
  | "storage";

export interface RefineryUnitStatus {
  slug: RefineryUnitSlug;
  name: string;
  status: "Online" | "Caution";
  throughput: number;
  throughputTarget: number;
  temp: number;
  pressure: number;
}

export const refineryUnits: RefineryUnitStatus[] = [
  { slug: "cdu",      name: "CDU",      status: "Online",  throughput: 105, throughputTarget: 110, temp: 725, pressure: 42 },
  { slug: "fcc",      name: "FCC",      status: "Online",  throughput: 38,  throughputTarget: 40,  temp: 985, pressure: 28 },
  { slug: "hcu",      name: "HCU",      status: "Caution", throughput: 28,  throughputTarget: 32,  temp: 780, pressure: 165 },
  { slug: "reformer", name: "Reformer", status: "Online",  throughput: 22,  throughputTarget: 22,  temp: 925, pressure: 350 },
  { slug: "blend",    name: "Blend",    status: "Online",  throughput: 17,  throughputTarget: 17,  temp: 180, pressure: 15 },
  { slug: "storage",  name: "Storage",  status: "Online",  throughput: 85,  throughputTarget: 90,  temp: 95,  pressure: 2 },
];

export interface UnitDashboard {
  slug: RefineryUnitSlug;
  name: string;
  fullName: string;
  heroOpportunity: number;
  heroTrend: number;
  kpis: KPICardData[];
  constraints: Constraint[];
  recommendations: Recommendation[];
}

export const unitDashboards: Record<RefineryUnitSlug, UnitDashboard> = {
  cdu: {
    slug: "cdu",
    name: "CDU",
    fullName: "Crude Distillation Unit",
    heroOpportunity: 142000,
    heroTrend: 8.4,
    kpis: [
      { label: "Feed Rate", value: 105, unit: "K BPD", precision: 0, trend: -4.5, trendLabel: "vs target 110" },
      { label: "Naphtha Yield", value: 18.2, unit: "%", precision: 1, trend: 0.6, trendLabel: "vs plan" },
      { label: "Energy Index", value: 92.1, unit: "EEI", precision: 1, trend: -1.2, trendLabel: "vs plan" },
      { label: "Tower DP", value: 6.4, unit: "psi", precision: 1 },
    ],
    constraints: [],
    recommendations: [
      {
        id: "rec-cdu-1",
        priority: "high",
        timestamp: "13:48",
        triggerType: "Yield Optimization",
        summary:
          "Lift CDU feed rate from 105 to 108 kbpd. Current run is 4.5% under target — heat balance and tower DP both have headroom.",
        deltas: [
          { parameter: "Feed rate", current: "105 kbpd", recommended: "108 kbpd", delta: "+3 kbpd" },
          { parameter: "Margin impact", current: "—", recommended: "+$58,000/day" },
          { parameter: "Confidence", current: "—", recommended: "HIGH" },
        ],
        marginImpact: "+$58,000/day",
        confidence: "HIGH",
      },
    ],
  },
  fcc: {
    slug: "fcc",
    name: "FCC",
    fullName: "Fluid Catalytic Cracker",
    heroOpportunity: 88000,
    heroTrend: 5.1,
    kpis: [
      { label: "Feed Rate", value: 38, unit: "K BPD", precision: 0, trend: -5.0, trendLabel: "vs target 40" },
      { label: "Gasoline Yield", value: 48.6, unit: "%", precision: 1, trend: 0.4, trendLabel: "vs plan" },
      { label: "Reactor Temp", value: 985, unit: "°F", precision: 0 },
      { label: "Regen DP", value: 8.2, unit: "psi", precision: 1, status: "warning" },
    ],
    constraints: [],
    recommendations: [
      {
        id: "rec-fcc-1",
        priority: "medium",
        timestamp: "12:11",
        triggerType: "Catalyst Activity",
        summary:
          "Increase fresh catalyst addition by 0.4 t/d. Activity index trending down — model projects $26k/day from yield recovery.",
        deltas: [
          { parameter: "Cat addition", current: "2.1 t/d", recommended: "2.5 t/d", delta: "+0.4 t/d" },
          { parameter: "Margin impact", current: "—", recommended: "+$26,000/day" },
          { parameter: "Confidence", current: "—", recommended: "MEDIUM" },
        ],
        marginImpact: "+$26,000/day",
        confidence: "MEDIUM",
      },
    ],
  },
  hcu: {
    slug: "hcu",
    name: "HCU",
    fullName: "Hydrocracker Unit",
    heroOpportunity: 215000,
    heroTrend: 12.3,
    kpis: [
      { label: "Feed Rate", value: 28, unit: "K BPD", precision: 0, trend: -12.5, trendLabel: "vs target 32", status: "warning" },
      { label: "Diesel Yield", value: 62.4, unit: "%", precision: 1, trend: -0.8, trendLabel: "vs plan" },
      { label: "H2 Consumption", value: 1850, unit: "scf/bbl", precision: 0 },
      { label: "Reactor ΔT", value: 48, unit: "°F", precision: 0 },
    ],
    constraints: [
      {
        id: "c-1",
        unit: "HCU",
        equipment: "HX-201 Fouling",
        severity: "-15% capacity",
        age: "3 days",
        status: "active",
        description: "Performance declining — monitor outlet temperature.",
      },
    ],
    recommendations: [
      {
        id: "rec-hcu-1",
        priority: "critical",
        timestamp: "09:42",
        triggerType: "Constraint Resolution",
        summary:
          "Schedule HX-201 cleaning during next planned maintenance window. Capacity loss of 4 kbpd is costing ~$72k/day.",
        deltas: [
          { parameter: "Capacity recovery", current: "28 kbpd", recommended: "32 kbpd", delta: "+4 kbpd" },
          { parameter: "Margin impact", current: "—", recommended: "+$72,000/day" },
          { parameter: "Confidence", current: "—", recommended: "HIGH" },
        ],
        marginImpact: "+$72,000/day",
        confidence: "HIGH",
      },
    ],
  },
  reformer: {
    slug: "reformer",
    name: "Reformer",
    fullName: "Catalytic Reformer",
    heroOpportunity: 64000,
    heroTrend: 3.2,
    kpis: [
      { label: "Feed Rate", value: 22, unit: "K BPD", precision: 0, trend: 0, trendLabel: "on target" },
      { label: "Octane (RON)", value: 98.4, unit: "", precision: 1, trend: 0.2, trendLabel: "vs plan" },
      { label: "H2 Production", value: 4.0, unit: "K BPD", precision: 1 },
      { label: "Reactor Temp", value: 925, unit: "°F", precision: 0 },
    ],
    constraints: [],
    recommendations: [
      {
        id: "rec-ref-1",
        priority: "advisory",
        timestamp: "10:55",
        triggerType: "Severity Optimization",
        summary:
          "Bump reformer severity by 1°F. Octane premium widened in latest Argus update — small move, $14k/day upside.",
        deltas: [
          { parameter: "WAIT", current: "925°F", recommended: "926°F", delta: "+1°F" },
          { parameter: "Margin impact", current: "—", recommended: "+$14,000/day" },
          { parameter: "Confidence", current: "—", recommended: "MEDIUM" },
        ],
        marginImpact: "+$14,000/day",
        confidence: "MEDIUM",
      },
    ],
  },
  blend: {
    slug: "blend",
    name: "Blend",
    fullName: "Blending Unit",
    heroOpportunity: 41000,
    heroTrend: 2.1,
    kpis: [
      { label: "Throughput", value: 17, unit: "K BPD", precision: 0, trend: 0, trendLabel: "on target" },
      { label: "Octane Giveaway", value: 0.4, unit: "R+M/2", precision: 1, status: "warning" },
      { label: "RVP Margin", value: 0.3, unit: "psi", precision: 1 },
      { label: "Tank Utilization", value: 78, unit: "%", precision: 0 },
    ],
    constraints: [
      {
        id: "c-3",
        unit: "Blend",
        equipment: "Staffing Constraint",
        severity: "Manual override",
        age: "This shift",
        status: "temporary",
        description: "Expires at shift end. Night shift has full staffing.",
      },
    ],
    recommendations: [
      {
        id: "rec-blend-1",
        priority: "medium",
        timestamp: "11:30",
        triggerType: "Giveaway Reduction",
        summary:
          "Tighten octane giveaway from 0.4 to 0.2. Switch RBOB recipe to favor reformate-heavy blend during day shift.",
        deltas: [
          { parameter: "Octane giveaway", current: "0.4", recommended: "0.2", delta: "-0.2" },
          { parameter: "Margin impact", current: "—", recommended: "+$22,000/day" },
          { parameter: "Confidence", current: "—", recommended: "MEDIUM" },
        ],
        marginImpact: "+$22,000/day",
        confidence: "MEDIUM",
      },
    ],
  },
  storage: {
    slug: "storage",
    name: "Storage",
    fullName: "Storage Terminal",
    heroOpportunity: 18000,
    heroTrend: 0.9,
    kpis: [
      { label: "Throughput", value: 85, unit: "K BPD", precision: 0, trend: -5.5, trendLabel: "vs target 90" },
      { label: "Tank Utilization", value: 71, unit: "%", precision: 0 },
      { label: "Vapor Recovery", value: 99.2, unit: "%", precision: 1 },
      { label: "Pump Availability", value: 100, unit: "%", precision: 0 },
    ],
    constraints: [],
    recommendations: [
      {
        id: "rec-storage-1",
        priority: "advisory",
        timestamp: "08:22",
        triggerType: "Logistics",
        summary:
          "Open Tank T-407 for diesel rundown. Current rundown destination is approaching 92% — switch before next FCC kick.",
        deltas: [
          { parameter: "Rundown tank", current: "T-405", recommended: "T-407" },
          { parameter: "Margin impact", current: "—", recommended: "+$8,000/day" },
          { parameter: "Confidence", current: "—", recommended: "HIGH" },
        ],
        marginImpact: "+$8,000/day",
        confidence: "HIGH",
      },
    ],
  },
};

export const handoverEvents: HandoverEvent[] = [
  { timestamp: "14:23", description: "Naphtha yield recommendation acknowledged by J. Martinez", type: "action" },
  { timestamp: "13:45", description: "HX-201 fouling constraint confirmed (previously flagged at 09:15)", type: "constraint" },
  { timestamp: "11:07", description: "Diesel blend recommendation deferred — awaiting feed quality results", type: "deferral" },
  { timestamp: "09:15", description: "HX-201 fouling constraint submitted by J. Martinez", type: "constraint" },
  { timestamp: "06:30", description: "Shift started. 2 constraints carried over from night shift.", type: "routine" },
];

// Analytics data
export const analyticsKPIs: KPICardData[] = [
  { label: "Total Margin Captured", value: 1.24, unit: "M", prefix: "$", precision: 2, trend: 12, trendLabel: "vs last quarter" },
  { label: "Capture Rate", value: 82, unit: "%", precision: 0 },
  { label: "Actionability", value: 85, unit: "%", precision: 0, trend: 3, trendLabel: "↑ high intent" },
  { label: "LP Model Accuracy", value: 96.2, unit: "%", precision: 1 },
  { label: "Sensor Health", value: 87, unit: "/100", precision: 0, status: "warning", trendLabel: "3 substitutions active" },
];

export const waterfallData: WaterfallDataPoint[] = [
  { name: "CDU", value: 420 },
  { name: "FCC", value: 380 },
  { name: "HCU", value: 260 },
  { name: "Blend", value: 180 },
];

export const driftData: DriftDataPoint[] = Array.from({ length: 90 }, (_, i) => ({
  date: `Day ${i + 1}`,
  predicted: 8.0,
  actual: 8.0 - (i > 30 ? ((i - 30) * 0.007) : 0),
}));

// Margin waterfall keyed by short-term LP horizon. The 30d rates roughly
// match the original waterfallData totals (CDU 14*30=420, FCC 12.67*30~380,
// HCU 8.67*30~260, Blend 6*30=180) so existing screenshots stay coherent.
export type WaterfallWindow = "1d" | "7d" | "30d";

export interface MarginWaterfallUnit {
  name: string;
  ratePerDay: number; // $K/day
}

export interface MarginWaterfallWindowData {
  units: MarginWaterfallUnit[];
  capturedRatePerDay: number;
  opportunityRatePerDay: number;
}

export const marginWaterfallByWindow: Record<WaterfallWindow, MarginWaterfallWindowData> = {
  "1d": {
    units: [
      { name: "CDU",   ratePerDay: 16.2 },
      { name: "FCC",   ratePerDay: 13.8 },
      { name: "HCU",   ratePerDay:  9.1 },
      { name: "Blend", ratePerDay:  6.4 },
    ],
    capturedRatePerDay:   45.5,
    opportunityRatePerDay: 11.2,
  },
  "7d": {
    units: [
      { name: "CDU",   ratePerDay: 14.7 },
      { name: "FCC",   ratePerDay: 13.1 },
      { name: "HCU",   ratePerDay:  8.9 },
      { name: "Blend", ratePerDay:  6.2 },
    ],
    capturedRatePerDay:   42.9,
    opportunityRatePerDay: 10.1,
  },
  "30d": {
    units: [
      { name: "CDU",   ratePerDay: 14.0 },
      { name: "FCC",   ratePerDay: 12.67 },
      { name: "HCU",   ratePerDay:  8.67 },
      { name: "Blend", ratePerDay:  6.0 },
    ],
    capturedRatePerDay:   41.34,
    opportunityRatePerDay: 9.33,
  },
};

// Where drift actually lives. Pumps and valves are intentionally absent —
// they don't drive LP coefficient drift; reactors, exchangers, fractionators,
// and blenders do (catalyst aging, fouling, composition shifts).
export interface ModelDriftEquipmentRow {
  area: "Reactor" | "Heat Exchanger" | "Fractionator" | "Blender";
  predicted: number;
  actual: number;
  unit: string;       // e.g. "% yield", "°F outlet", "% conv", "RVP"
  delta: number;
  deltaPct: number;
  status: "ok" | "watch" | "drift";
  trend7d: number[];  // 7 daily deltas for the sparkline
}

export const modelDriftByEquipment: ModelDriftEquipmentRow[] = [
  {
    area: "Heat Exchanger",
    predicted: 412, actual: 397, unit: "°F outlet",
    delta: -15, deltaPct: -3.64, status: "drift",
    trend7d: [-8, -10, -11, -12, -13, -14, -15],
  },
  {
    area: "Reactor",
    predicted: 8.0, actual: 7.62, unit: "% yield",
    delta: -0.38, deltaPct: -4.75, status: "drift",
    trend7d: [-0.22, -0.25, -0.28, -0.31, -0.34, -0.36, -0.38],
  },
  {
    area: "Fractionator",
    predicted: 65.2, actual: 64.1, unit: "% conv",
    delta: -1.1, deltaPct: -1.69, status: "watch",
    trend7d: [-0.4, -0.6, -0.7, -0.8, -0.9, -1.0, -1.1],
  },
  {
    area: "Blender",
    predicted: 87.5, actual: 87.4, unit: "RVP",
    delta: -0.1, deltaPct: -0.11, status: "ok",
    trend7d: [0.0, -0.05, -0.05, -0.1, -0.1, -0.1, -0.1],
  },
];

// 30-day predicted-vs-actual series per equipment area for the
// /model-drift detail page chart. Worst-drifting first to match the table.
export const driftDataByEquipment: Record<string, DriftDataPoint[]> = {
  "Heat Exchanger": Array.from({ length: 30 }, (_, i) => ({
    date: `Day ${i + 1}`,
    predicted: 412,
    actual: 412 - (i > 5 ? (i - 5) * 0.62 : 0),
  })),
  "Reactor": Array.from({ length: 30 }, (_, i) => ({
    date: `Day ${i + 1}`,
    predicted: 8.0,
    actual: 8.0 - (i > 8 ? (i - 8) * 0.018 : 0),
  })),
  "Fractionator": Array.from({ length: 30 }, (_, i) => ({
    date: `Day ${i + 1}`,
    predicted: 65.2,
    actual: 65.2 - (i > 12 ? (i - 12) * 0.06 : 0),
  })),
  "Blender": Array.from({ length: 30 }, (_, i) => ({
    date: `Day ${i + 1}`,
    predicted: 87.5,
    actual: 87.5 - (i > 22 ? (i - 22) * 0.012 : 0),
  })),
};

// Hero KPI strip for the /model-drift page. Reuses the project KPICardData shape.
export const modelDriftKPIs: KPICardData[] = [
  { label: "Overall Drift",      value: 2.55, unit: "%",        precision: 2, status: "warning" },
  { label: "Worst Area",         value: 4.75, unit: "% Reactor", precision: 2, status: "warning", trendLabel: "HX close behind" },
  { label: "Last Recalibration", value: 48,   unit: "days ago", precision: 0, trendLabel: "2026-02-18" },
  { label: "7-Day Trend",        value: 0.34, unit: "% delta",  precision: 2, trend: -8, trendLabel: "worsening" },
];

export const sensorHealthData: SensorHealthCell[] = [
  // CDU
  { unit: "CDU", sensorType: "Temp", status: "healthy" },
  { unit: "CDU", sensorType: "Pressure", status: "substituted" },
  { unit: "CDU", sensorType: "Flow", status: "healthy" },
  { unit: "CDU", sensorType: "Level", status: "healthy" },
  { unit: "CDU", sensorType: "Comp", status: "healthy" },
  // FCC
  { unit: "FCC", sensorType: "Temp", status: "healthy" },
  { unit: "FCC", sensorType: "Pressure", status: "degraded" },
  { unit: "FCC", sensorType: "Flow", status: "healthy" },
  { unit: "FCC", sensorType: "Level", status: "healthy" },
  { unit: "FCC", sensorType: "Comp", status: "degraded" },
  // HCU
  { unit: "HCU", sensorType: "Temp", status: "healthy" },
  { unit: "HCU", sensorType: "Pressure", status: "healthy" },
  { unit: "HCU", sensorType: "Flow", status: "healthy" },
  { unit: "HCU", sensorType: "Level", status: "healthy" },
  { unit: "HCU", sensorType: "Comp", status: "healthy" },
  // Reformer
  { unit: "Reformer", sensorType: "Temp", status: "healthy" },
  { unit: "Reformer", sensorType: "Pressure", status: "healthy" },
  { unit: "Reformer", sensorType: "Flow", status: "substituted" },
  { unit: "Reformer", sensorType: "Level", status: "degraded" },
  { unit: "Reformer", sensorType: "Comp", status: "healthy" },
  // Blend
  { unit: "Blend", sensorType: "Temp", status: "healthy" },
  { unit: "Blend", sensorType: "Pressure", status: "healthy" },
  { unit: "Blend", sensorType: "Flow", status: "healthy" },
  { unit: "Blend", sensorType: "Level", status: "healthy" },
  { unit: "Blend", sensorType: "Comp", status: "healthy" },
];

export const constraintPatterns: ConstraintPattern[] = [
  { name: "Unit 2 HX-201 Fouling", count: 11, annotation: "Consider permanent seasonal constraint" },
  { name: "Unit 6 Catalyst Aging", count: 8 },
  { name: "Blend Staffing", count: 6 },
  { name: "CDU Feed Quality", count: 4 },
  { name: "FCC Regen Pressure", count: 3 },
];

// Constraint wizard options
export const wizardUnits = [
  { id: "unit-2", label: "Unit 2 — CDU" },
  { id: "unit-3", label: "Unit 3 — FCC" },
  { id: "unit-4", label: "Unit 4 — HCU" },
  { id: "unit-6", label: "Unit 6 — Reformer" },
  { id: "blend", label: "Blend" },
];

export const wizardTypes = [
  { id: "equipment", label: "Equipment Issue" },
  { id: "feed", label: "Feed Quality" },
  { id: "safety", label: "Safety" },
  { id: "staffing", label: "Staffing" },
  { id: "manual", label: "Other (Describe Manually)" },
];

export const wizardConstraints: Record<string, { id: string; label: string }[]> = {
  "unit-2": [
    { id: "hx-201", label: "HX-201 Fouling" },
    { id: "pump-202", label: "Pump P-202 Vibration" },
    { id: "valve-203", label: "Valve V-203 Sticking" },
  ],
  "unit-3": [
    { id: "catalyst", label: "Catalyst Deactivation" },
    { id: "regen", label: "Regenerator Pressure" },
  ],
  "unit-4": [
    { id: "h2-supply", label: "H2 Supply Constraint" },
    { id: "reactor-temp", label: "Reactor Temperature Limit" },
  ],
  "unit-6": [
    { id: "catalyst-aging", label: "Catalyst Aging" },
    { id: "feed-quality", label: "Feed Quality Issue" },
  ],
  blend: [
    { id: "staffing", label: "Staffing Constraint" },
    { id: "tank-level", label: "Tank Level Limit" },
  ],
};

// Inventory breakdowns — per-slate crude and per-product ullage/ready
export const crudeSlates: CrudeSlate[] = [
  { slate: "Sour", barrels: 145000, daysOfSupply: 3.2 },
  { slate: "Yellow Wax", barrels: 62000, daysOfSupply: 1.4 },
  { slate: "Utica", barrels: 98000, daysOfSupply: 2.1 },
  { slate: "Bakken", barrels: 110000, daysOfSupply: 2.4 },
  { slate: "Sweet WTI", barrels: 220000, daysOfSupply: 4.8 },
];

export const ullageByProduct: UllageByProduct[] = [
  { product: "Crude", barrels: 215000 },
  { product: "Gasoline", barrels: 84000 },
  { product: "Diesel", barrels: 117000 },
  { product: "Jet", barrels: 88000 },
  { product: "Propane", barrels: 0 },
  { product: "Butane", barrels: 12000 },
  { product: "Asphalt", barrels: 34000 },
];

export const productReady: ProductReady[] = [
  { product: "Propane", barrels: 50000, ullageRemaining: 0, alert: "STORAGE FULL" },
  { product: "Butane", barrels: 22000, ullageRemaining: 12000 },
  { product: "Gasoline", barrels: 316000, ullageRemaining: 84000 },
  { product: "Diesel", barrels: 483000, ullageRemaining: 117000 },
  { product: "Jet", barrels: 112000, ullageRemaining: 88000 },
  { product: "Asphalt", barrels: 18000, ullageRemaining: 34000 },
];
