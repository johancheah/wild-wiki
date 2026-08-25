"use client";

import { useRouter } from "next/navigation";

export function MapSelect({ maps, selected }: { maps: string[]; selected: string }) {
  const router = useRouter();
  return (
    <div className="comps-map-select">
      <select value={selected} onChange={(e) => router.push(`/comps?map=${encodeURIComponent(e.target.value)}`)}>
        {maps.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
