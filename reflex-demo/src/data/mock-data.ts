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
