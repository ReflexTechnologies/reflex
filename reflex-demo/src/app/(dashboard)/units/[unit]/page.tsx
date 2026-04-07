"use client";

import { use, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/AnimatedMetric";
import { KPICard } from "@/components/ui/KPICard";
import { UnitSelector } from "@/components/ui/UnitSelector";
import { ConstraintStatusBadge } from "@/components/ui/StatusBadge";
import { RecommendationCard } from "@/components/operations/RecommendationCard";
import { ConstraintWizard } from "@/components/constraint-wizard/ConstraintWizard";
import { unitDashboards } from "@/data/mock-data";
import type { ConstraintStatus } from "@/types";

const constraintBorderColor: Record<ConstraintStatus, string> = {
  active: "border-l-amber-500",
  monitoring: "border-l-blue-500",
  temporary: "border-l-gray-400",
};

export default function UnitPage({
  params,
}: {
  params: Promise<{ unit: string }>;
}) {
  const { unit } = use(params);
  const dashboard = unitDashboards[unit as keyof typeof unitDashboards];
  const [wizardOpen, setWizardOpen] = useState(false);

  if (!dashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <h1 className="font-headline text-xl font-bold text-text-primary">
          Unit not found
        </h1>
        <p className="text-sm font-body text-text-muted">
          No dashboard exists for &ldquo;{unit}&rdquo;.
        </p>
        <Link
          href="/refinery-flow"
          className="text-sm font-headline text-accent hover:underline"
        >
          ← Back to Refinery Flow
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs font-headline text-text-muted">
        <Link href="/refinery-flow" className="hover:text-accent">
          Refinery Flow
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-text-primary">{dashboard.name}</span>
      </nav>

      {/* Header: title + hero opportunity + Submit Constraint button */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-xl font-bold text-text-primary">
              {dashboard.fullName}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-headline font-bold uppercase tracking-wider bg-accent-muted text-accent border border-accent-light">
              {dashboard.name}
            </span>
          </div>
          <span className="text-xs font-headline uppercase tracking-wider text-text-muted mt-1">
            Optimization Opportunity
          </span>
          <div className="flex items-baseline gap-3">
            <AnimatedMetric
              value={dashboard.heroOpportunity}
              prefix="$"
              precision={0}
              className="text-4xl font-bold text-text-primary"
            />
            <span className="text-sm font-mono text-text-muted">/ day</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-mono bg-accent-muted text-accent">
              +{dashboard.heroTrend}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <UnitSelector />
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="px-4 py-2 rounded text-sm font-headline font-semibold bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Submit Constraint
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {dashboard.kpis.map((kpi) => (
          <KPICard key={kpi.label} data={kpi} />
        ))}
      </div>

      {/* Two-column: Recommendations | Active Constraints */}
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: "55% 45%" }}
      >
        {/* Recommendations */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-headline uppercase tracking-wider text-text-muted font-medium">
              Recommendations
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-muted text-accent">
              {dashboard.recommendations.length} active
            </span>
          </div>
          {dashboard.recommendations.length === 0 ? (
            <p className="text-xs font-body text-text-muted">
              No recommendations for this unit right now.
            </p>
          ) : (
            dashboard.recommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onAddConstraint={() => setWizardOpen(true)}
              />
            ))
          )}
        </section>

        {/* Active Constraints */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-headline uppercase tracking-wider text-text-muted font-medium">
              Active Constraints
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400">
              {dashboard.constraints.length}
            </span>
          </div>
          <div className="bg-surface-card rounded border border-surface-border shadow-card p-4">
            {dashboard.constraints.length === 0 ? (
              <p className="text-xs font-body text-text-muted py-4 text-center">
                No active constraints on this unit.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {dashboard.constraints.map((c) => (
                  <div
                    key={c.id}
                    className={clsx(
                      "border border-surface-border rounded border-l-4 p-3",
                      constraintBorderColor[c.status],
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-headline font-semibold text-text-primary">
                          {c.unit}
                        </span>
                        <span className="text-xs font-body text-text-secondary">
                          {c.equipment}
                        </span>
                      </div>
                      <ConstraintStatusBadge status={c.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono text-text-primary">
                        {c.severity}
                      </span>
                      <span className="text-text-muted">{c.age}</span>
                    </div>
                    {c.description && (
                      <p className="text-xs font-body text-text-secondary mt-1.5">
                        {c.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Constraint Wizard Modal */}
      <ConstraintWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
    </div>
  );
}
