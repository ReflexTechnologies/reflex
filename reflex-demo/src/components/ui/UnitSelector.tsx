"use client";

import { useRouter, usePathname } from "next/navigation";
import { refineryUnits } from "@/data/mock-data";

export function UnitSelector() {
  const router = useRouter();
  const pathname = usePathname();

  const match = pathname.match(/^\/units\/([^/]+)/);
  const currentValue = match ? match[1] : "all";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === currentValue) return;
    if (v === "all") {
      router.push("/operations");
    } else {
      router.push(`/units/${v}`);
    }
  };

  return (
    <select
      value={currentValue}
      onChange={handleChange}
      className="px-3 py-2 rounded text-sm font-body border border-surface-border bg-surface-card text-text-primary hover:border-accent focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer"
      aria-label="Scope dashboard to unit"
    >
      <option value="all">All Units (Plant View)</option>
      {refineryUnits.map((u) => (
        <option key={u.slug} value={u.slug}>
          {u.name}
        </option>
      ))}
    </select>
  );
}
