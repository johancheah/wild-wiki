"use client";

import { useState } from "react";

export function Tabs({ tabs }: { tabs: { id: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <>
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${active === t.id ? "active" : ""}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} className={`tab-panel ${active === t.id ? "" : "hidden"}`}>
          {t.content}
        </div>
      ))}
    </>
  );
}
