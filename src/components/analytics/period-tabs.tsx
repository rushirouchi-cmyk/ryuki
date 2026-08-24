"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIOD_PRESETS } from "@/lib/analytics/period";
import { cn } from "@/lib/utils/cn";

export function PeriodTabs({ active }: { active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", key);
    params.delete("from");
    params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-ink-200 bg-white p-1">
      {PERIOD_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => select(preset.key)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            active === preset.key
              ? "bg-brand-600 text-white"
              : "text-ink-600 hover:bg-ink-100",
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
