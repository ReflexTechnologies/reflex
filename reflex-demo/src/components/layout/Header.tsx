"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import clsx from "clsx";
import { LiveIndicator, ConnectionDot } from "@/components/ui/LiveIndicator";
import { connections, SITE } from "@/data/mock-data";

const tabs = [
  { href: "/operations", label: "Global View" },
  { href: "/assets", label: "Assets" },
  { href: "/compliance", label: "Compliance" },
  { href: "/safety", label: "Safety" },
];

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <header className="h-12 bg-white border-b border-[#E5E7EB] flex items-center px-4 gap-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="text-lg font-headline font-bold text-[#0D9488]">Reflex</span>
        <span className="text-xs text-[#9CA3AF] font-body">{SITE.name}</span>
      </div>

      {/* Nav tabs */}
      <nav className="flex items-center gap-1 ml-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={clsx(
                "px-3 py-1.5 rounded text-xs font-body transition-colors",
                isActive
                  ? "bg-[#F0FDFA] text-[#0D9488] font-medium"
                  : "text-[#4B5563] hover:text-[#111827] hover:bg-[#F9FAFB]"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Search */}
      <div className="flex-1 flex justify-center">
        <div className="relative w-64">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
          />
          <input
            type="text"
            placeholder="Search systems..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded font-body text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <LiveIndicator />
        <div className="flex items-center gap-2">
          {connections.map((c) => (
            <ConnectionDot key={c.name} label={c.label} status={c.status} />
          ))}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-7 h-7 rounded-full bg-[#0D9488] flex items-center justify-center text-white text-xs font-semibold cursor-pointer hover:bg-[#0F766E] transition-colors"
          >
            JM
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-36 bg-white border border-[#E5E7EB] rounded shadow-[0_4px_12px_rgba(0,0,0,0.1)] py-1 z-50">
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm font-body text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
              >
                Profile
              </Link>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm font-body text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
              >
                Sign Out
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
