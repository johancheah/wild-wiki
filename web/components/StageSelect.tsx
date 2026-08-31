"use client";

import { useRouter } from "next/navigation";

export function StageSelect({ stages, selected }: { stages: string[]; selected: string | null }) {
  const router = useRouter();
  return (
    <div className="comps-map-select">
      <select
        value={selected ?? ""}
        onChange={(e) => router.push(e.target.value ? `/players?stage=${encodeURIComponent(e.target.value)}` : "/players")}
      >
        <option value="">All Stages</option>
        {stages.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
