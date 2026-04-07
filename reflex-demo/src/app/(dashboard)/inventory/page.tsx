"use client";

import { KPICard } from "@/components/ui/KPICard";
import type { KPICardData } from "@/types";
import { crudeSlates, ullageByProduct, productReady } from "@/data/mock-data";

// Derive headline KPIs from the breakdown data so the aggregate numbers
// stay consistent with the per-slate / per-product panels below.
const totalCrudeBarrels = crudeSlates.reduce((sum, s) => sum + s.barrels, 0);
const weightedCrudeDays =
  crudeSlates.reduce((sum, s) => sum + s.daysOfSupply * s.barrels, 0) /
  (totalCrudeBarrels || 1);
const totalUllage = ullageByProduct.reduce((sum, u) => sum + u.barrels, 0);
const totalProductReady = productReady.reduce((sum, p) => sum + p.barrels, 0);

const kpis: KPICardData[] = [
  {
    label: "Crude Supply Days",
    value: weightedCrudeDays,
    unit: "days",
    precision: 1,
    trend: 0.5,
    trendLabel: "vs last week",
  },
  {
    label: "Total Ullage",
    value: totalUllage,
    unit: "bbl",
    precision: 0,
    trend: -3.2,
    trendLabel: "capacity used",
  },
  {
    label: "Product Ready",
    value: totalProductReady / 1000,
    unit: "K bbl",
    precision: 0,
    trend: 4.1,
    trendLabel: "vs target",
  },
  {
    label: "Tank Utilization",
    value: 78,
    unit: "%",
    precision: 0,
    trend: 2.0,
    trendLabel: "vs avg",
  },
];

const tanks = [
  { id: "TK-101", product: "Crude Oil", fillPct: 82, volume: 410000, capacity: 500000, temp: 95, quality: "On-Spec" as const },
  { id: "TK-102", product: "Crude Oil", fillPct: 45, volume: 225000, capacity: 500000, temp: 92, quality: "On-Spec" as const },
  { id: "TK-201", product: "Gasoline", fillPct: 91, volume: 182000, capacity: 200000, temp: 78, quality: "On-Spec" as const },
  { id: "TK-202", product: "Gasoline", fillPct: 67, volume: 134000, capacity: 200000, temp: 76, quality: "On-Spec" as const },
  { id: "TK-301", product: "Diesel", fillPct: 73, volume: 219000, capacity: 300000, temp: 85, quality: "On-Spec" as const },
  { id: "TK-302", product: "Diesel", fillPct: 88, volume: 264000, capacity: 300000, temp: 83, quality: "On-Spec" as const },
  { id: "TK-401", product: "Jet Fuel", fillPct: 56, volume: 112000, capacity: 200000, temp: 72, quality: "On-Spec" as const },
  { id: "TK-501", product: "Naphtha", fillPct: 34, volume: 51000, capacity: 150000, temp: 88, quality: "Testing" as const },
];

const inventory = [
  { product: "Crude Oil", grade: "WTI Midland", volume: 635000, tanks: 2, quality: "On-Spec", updated: "2024-04-05 06:30" },
  { product: "Gasoline", grade: "RBOB Regular", volume: 316000, tanks: 2, quality: "On-Spec", updated: "2024-04-05 06:28" },
  { product: "Diesel", grade: "ULSD #2", volume: 483000, tanks: 2, quality: "On-Spec", updated: "2024-04-05 06:25" },
  { product: "Jet Fuel", grade: "Jet-A", volume: 112000, tanks: 1, quality: "On-Spec", updated: "2024-04-05 06:20" },
  { product: "Naphtha", grade: "Light Virgin", volume: 51000, tanks: 1, quality: "Testing", updated: "2024-04-05 05:45" },
  { product: "LPG", grade: "Mix C3/C4", volume: 28000, tanks: 1, quality: "On-Spec", updated: "2024-04-05 06:15" },
  { product: "Reformate", grade: "High Octane", volume: 74000, tanks: 1, quality: "On-Spec", updated: "2024-04-05 06:10" },
];

export default function InventoryPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-xl font-bold text-[#111827]">Inventory Management</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-headline font-bold uppercase tracking-wider bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]">
            System Normal
          </span>
        </div>
        <span className="text-xs font-mono text-[#9CA3AF]">Synced 12s ago</span>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} data={kpi} />
        ))}
      </div>

      {/* Storage Breakdown — per-slate crude + per-product ullage/ready */}
      <div className="grid grid-cols-2 gap-3">
        {/* Crude Supply by Slate */}
        <div>
          <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium mb-3">
            Crude Supply by Slate
          </h2>
          <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Slate</th>
                  <th className="text-right px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Barrels</th>
                  <th className="text-right px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Days of Supply</th>
                </tr>
              </thead>
              <tbody>
                {crudeSlates.map((row, i) => (
                  <tr
                    key={row.slate}
                    className={`border-b border-[#F3F4F6] last:border-0 ${i % 2 === 1 ? "bg-[#F9FAFB]" : ""}`}
                  >
                    <td className="px-4 py-2.5 text-sm font-body text-[#111827]">{row.slate}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[#111827]">{row.barrels.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[#111827]">{row.daysOfSupply.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Storage by Product (combined ullage + product ready + full-storage flag) */}
        <div>
          <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium mb-3">
            Storage by Product
          </h2>
          <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Product</th>
                  <th className="text-right px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Ready (bbl)</th>
                  <th className="text-right px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Ullage (bbl)</th>
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Status</th>
                </tr>
              </thead>
              <tbody>
                {productReady.map((row, i) => {
                  const isFull = row.alert === "STORAGE FULL";
                  const isTight = !isFull && row.ullageRemaining > 0 && row.ullageRemaining < row.barrels * 0.25;
                  const badgeClass = isFull
                    ? "bg-red-50 text-[#DC2626]"
                    : isTight
                      ? "bg-amber-50 text-[#D97706]"
                      : "bg-[#F0FDFA] text-[#0D9488]";
                  const badgeLabel = isFull ? "STORAGE FULL" : isTight ? "TIGHT" : "OK";
                  return (
                    <tr
                      key={row.product}
                      className={`border-b border-[#F3F4F6] last:border-0 ${i % 2 === 1 ? "bg-[#F9FAFB]" : ""}`}
                    >
                      <td className="px-4 py-2.5 text-sm font-body text-[#111827]">{row.product}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-[#111827]">{row.barrels.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-[#111827]">{row.ullageRemaining.toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-[10px] font-headline uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badgeClass}`}
                        >
                          {badgeLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tank Farm Overview */}
      <div>
        <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium mb-3">Tank Farm Overview</h2>
        <div className="grid grid-cols-4 gap-3">
          {tanks.map((tank) => (
            <div
              key={tank.id}
              className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono font-semibold text-[#111827]">{tank.id}</span>
                <span
                  className={`text-[10px] font-headline uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                    tank.quality === "On-Spec"
                      ? "bg-[#F0FDFA] text-[#0D9488]"
                      : tank.quality === "Testing"
                        ? "bg-amber-50 text-[#D97706]"
                        : "bg-red-50 text-[#DC2626]"
                  }`}
                >
                  {tank.quality}
                </span>
              </div>
              <p className="text-xs font-body text-[#4B5563] mb-2">{tank.product}</p>
              {/* Fill level bar */}
              <div className="w-full h-2 bg-[#F3F4F6] rounded-full mb-2">
                <div
                  className="h-full bg-[#0D9488] rounded-full"
                  style={{ width: `${tank.fillPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-mono text-[#111827]">
                  {tank.volume.toLocaleString()} / {tank.capacity.toLocaleString()}
                </span>
                <span className="font-mono text-[#0D9488] font-semibold">{tank.fillPct}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-body text-[#9CA3AF]">Temperature</span>
                <span className="font-mono text-[#111827]">{tank.temp} °F</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Inventory Table */}
      <div>
        <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium mb-3">Product Inventory</h2>
        <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Product</th>
                <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Grade</th>
                <th className="text-right px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Volume (bbl)</th>
                <th className="text-center px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Tanks</th>
                <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Quality</th>
                <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((row, i) => (
                <tr
                  key={row.product}
                  className={`border-b border-[#F3F4F6] last:border-0 ${i % 2 === 1 ? "bg-[#F9FAFB]" : ""}`}
                >
                  <td className="px-4 py-2.5 text-sm font-body text-[#111827]">{row.product}</td>
                  <td className="px-4 py-2.5 text-sm font-body text-[#4B5563]">{row.grade}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#111827]">{row.volume.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs text-[#111827]">{row.tanks}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-[10px] font-headline uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        row.quality === "On-Spec"
                          ? "bg-[#F0FDFA] text-[#0D9488]"
                          : row.quality === "Testing"
                            ? "bg-amber-50 text-[#D97706]"
                            : "bg-red-50 text-[#DC2626]"
                      }`}
                    >
                      {row.quality}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#9CA3AF]">{row.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
