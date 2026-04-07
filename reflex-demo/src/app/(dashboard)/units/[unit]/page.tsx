"use client";

import { use, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/AnimatedMetric";
import { KPICard } from "@/components/ui/KPICard";
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
        <h1 className="font-headline text-xl font-bold text-[#111827]">
          Unit not found
        </h1>
        <p className="text-sm font-body text-[#9CA3AF]">
          No dashboard exists for &ldquo;{unit}&rdquo;.
        </p>
        <Link
          href="/refinery-flow"
          className="text-sm font-headline text-[#0D9488] hover:underline"
        >
          ← Back to Refinery Flow
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs font-headline text-[#9CA3AF]">
        <Link href="/refinery-flow" className="hover:text-[#0D9488]">
          Refinery Flow
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[#111827]">{dashboard.name}</span>
      </nav>

      {/* Header: title + hero opportunity + Submit Constraint button */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-xl font-bold text-[#111827]">
              {dashboard.fullName}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-headline font-bold uppercase tracking-wider bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]">
              {dashboard.name}
            </span>
          </div>
          <span className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] mt-1">
            Optimization Opportunity
          </span>
          <div className="flex items-baseline gap-3">
            <AnimatedMetric
              value={dashboard.heroOpportunity}
              prefix="$"
              precision={0}
              className="text-4xl font-bold text-[#111827]"
            />
            <span className="text-sm font-mono text-[#9CA3AF]">/ day</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-mono bg-[#F0FDFA] text-[#0D9488]">
              +{dashboard.heroTrend}%
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="px-4 py-2 rounded text-sm font-headline font-semibold bg-[#0D9488] text-white hover:bg-[#0F766E] transition-colors cursor-pointer"
        >
          Submit Constraint
        </button>
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
            <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium">
              Recommendations
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F0FDFA] text-[#0D9488]">
              {dashboard.recommendations.length} active
            </span>
          </div>
          {dashboard.recommendations.length === 0 ? (
            <p className="text-xs font-body text-[#9CA3AF]">
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
            <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium">
              Active Constraints
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#92400E]">
              {dashboard.constraints.length}
            </span>
          </div>
          <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            {dashboard.constraints.length === 0 ? (
              <p className="text-xs font-body text-[#9CA3AF] py-4 text-center">
                No active constraints on this unit.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {dashboard.constraints.map((c) => (
                  <div
                    key={c.id}
                    className={clsx(
                      "border border-[#E5E7EB] rounded border-l-4 p-3",
                      constraintBorderColor[c.status],
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-headline font-semibold text-[#111827]">
                          {c.unit}
                        </span>
                        <span className="text-xs font-body text-[#4B5563]">
                          {c.equipment}
                        </span>
                      </div>
                      <ConstraintStatusBadge status={c.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono text-[#111827]">
                        {c.severity}
                      </span>
                      <span className="text-[#9CA3AF]">{c.age}</span>
                    </div>
                    {c.description && (
                      <p className="text-xs font-body text-[#4B5563] mt-1.5">
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
