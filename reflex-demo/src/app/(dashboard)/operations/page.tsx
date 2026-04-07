"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatedMetric } from "@/components/ui/AnimatedMetric";
import { KPICard } from "@/components/ui/KPICard";
import { UnitSelector } from "@/components/ui/UnitSelector";
import { RecommendationCard } from "@/components/operations/RecommendationCard";
import { FlowNetworkChart } from "@/components/operations/FlowNetworkChart";
import { ConstraintPanel } from "@/components/operations/ConstraintPanel";
import { OptimizationQueue } from "@/components/operations/OptimizationQueue";
import { ConstraintWizard } from "@/components/constraint-wizard/ConstraintWizard";
import { heroKPIs, recommendations, SITE } from "@/data/mock-data";

function useToast(duration = 3000) {
  const [visible, setVisible] = useState(false);
  const show = useCallback(() => {
    setVisible(true);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(id);
  }, [visible, duration]);
  return [visible, show] as const;
}

export default function OperationsPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [optimizeToast, showOptimizeToast] = useToast();
  const [exportToast, showExportToast] = useToast();

  const projection30 = (SITE.marginRatePerDay * 30) / 1_000_000;
  const projectionAnnual = (SITE.marginRatePerDay * 365) / 1_000_000;

  return (
    <div className="flex flex-col gap-5">
      {/* ================================================================ */}
      {/* TOP SECTION: Hero metrics + KPI row                              */}
      {/* ================================================================ */}
      <div className="flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-start justify-between">
          {/* Left: Total Realized Opportunity */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-headline uppercase tracking-wider text-text-muted">
              Total Realized Opportunity
            </span>
            <div className="flex items-baseline gap-3">
              <AnimatedMetric
                value={SITE.marginRatePerDay / 1_000_000}
                prefix="$"
                suffix="M / day"
                precision={1}
                className="text-4xl font-bold text-text-primary"
              />
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-mono bg-accent-muted text-accent">
                +{SITE.marginTrend}%
              </span>
            </div>
            <span className="text-xs font-body text-text-muted mt-1">
              30-day projection: ${projection30.toFixed(0)}M
              {" · "}
              Annual projection: ${projectionAnnual.toFixed(0)}M
            </span>
          </div>

          {/* Right: Unit selector + action buttons */}
          <div className="flex items-center gap-3">
            <UnitSelector />
            <button
              type="button"
              onClick={showOptimizeToast}
              className="px-4 py-2 rounded text-sm font-headline font-semibold bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer"
            >
              Optimize Run
            </button>
            <button
              type="button"
              onClick={showExportToast}
              className="px-4 py-2 rounded text-sm font-headline font-medium text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
            >
              Export Log
            </button>
          </div>
        </div>

        {/* KPI cards row */}
        <div className="grid grid-cols-3 gap-4">
          {heroKPIs.map((kpi) => (
            <KPICard
              key={kpi.label}
              data={kpi}
              href={kpi.label === "Emissions" ? "/emissions" : undefined}
              sparklineLabel={kpi.label === "Throughput" ? "daily avg" : undefined}
            />
          ))}
        </div>
      </div>

      {/* ================================================================ */}
      {/* MIDDLE SECTION: Recommendations + Flow Network / Constraints     */}
      {/* ================================================================ */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "55% 45%" }}>
        {/* Left column: Recommendation Feed */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-headline uppercase tracking-wider text-text-muted font-medium">
              Recommendation Feed
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-muted text-accent">
              {recommendations.length} active
            </span>
          </div>
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onAddConstraint={() => setWizardOpen(true)}
            />
          ))}
        </div>

        {/* Right column: Flow Network + Constraint Panel */}
        <div className="flex flex-col gap-5">
          {/* Flow Network chart */}
          <div className="bg-surface-card rounded border border-surface-border shadow-card p-4">
            <h2 className="text-xs font-headline uppercase tracking-wider text-text-muted font-medium mb-3">
              Refinery Flow Network
            </h2>
            <FlowNetworkChart />
          </div>

          {/* Constraint Panel */}
          <ConstraintPanel />
        </div>
      </div>

      {/* ================================================================ */}
      {/* BOTTOM SECTION: Optimization Queue                               */}
      {/* ================================================================ */}
      <OptimizationQueue />

      {/* Constraint Wizard Modal */}
      <ConstraintWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />

      {/* Toast notifications */}
      {optimizeToast && (
        <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-3 rounded shadow-elevated font-body text-sm animate-[fadeIn_0.2s_ease-out]">
          Optimization run queued. Estimated completion: 2.3s
        </div>
      )}
      {exportToast && (
        <div className="fixed top-4 right-4 z-50 bg-surface-card border border-surface-border text-text-primary px-4 py-3 rounded shadow-elevated font-body text-sm animate-[fadeIn_0.2s_ease-out]">
          Export started. File will download shortly.
        </div>
      )}
    </div>
  );
}
