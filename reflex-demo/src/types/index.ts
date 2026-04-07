export type Priority = "critical" | "high" | "medium" | "advisory";
export type OperatingMode = "normal" | "startup" | "shutdown" | "upset" | "emergency";
export type ConstraintStatus = "active" | "monitoring" | "temporary";
export type ConnectionStatus = "connected" | "busy" | "error";

export interface KPICardData {
  label: string;
  value: number;
  unit?: string;
  precision?: number;
  prefix?: string;
  trend?: number;
  trendLabel?: string;
  sparkline?: number[];
  status?: "healthy" | "warning" | "critical";
}

export interface RecommendationDelta {
  parameter: string;
  current: string;
  recommended: string;
  delta?: string;
}

export interface Recommendation {
  id: string;
  priority: Priority;
  timestamp: string;
  triggerType: string;
  summary: string;
  deltas: RecommendationDelta[];
  marginImpact: string;
  confidence: string;
}

export interface Constraint {
  id: string;
  unit: string;
  equipment: string;
  severity: string;
  age: string;
  status: ConstraintStatus;
  description?: string;
}

export interface ConnectionHealth {
  name: string;
  label: string;
  status: ConnectionStatus;
}

export interface OptimizationQueueItem {
  assetId: string;
  name: string;
  stability: number;
  trend: "up" | "down" | "stable";
}

export interface HandoverEvent {
  timestamp: string;
  description: string;
  type: "action" | "constraint" | "deferral" | "routine";
}

export interface WaterfallDataPoint {
  name: string;
  value: number;
}

export interface DriftDataPoint {
  date: string;
  predicted: number;
  actual: number;
}

export interface SensorHealthCell {
  unit: string;
  sensorType: string;
  status: "healthy" | "degraded" | "substituted";
}

export interface ConstraintPattern {
  name: string;
  count: number;
  annotation?: string;
}

export interface CrudeSlate {
  slate: string;
  barrels: number;
  daysOfSupply: number;
}

export interface UllageByProduct {
  product: string;
  barrels: number;
}

export interface ProductReady {
  product: string;
  barrels: number;
  ullageRemaining: number;
  alert?: "STORAGE FULL";
}

export interface WizardState {
  step: number;
  unit?: string;
  type?: string;
  constraint?: string;
  severity?: number;
  duration?: string;
}
