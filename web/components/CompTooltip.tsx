"use client";

import { useEffect, useRef } from "react";

// Singleton hover tooltip for .comp-agent[data-headshot] icons — uses
// event delegation + position:fixed so it works regardless of how many
// icons render and is never clipped by the table's overflow-x:auto
// scrolling container (a per-icon absolutely positioned popover would be).
export function CompTooltip() {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const tooltip = tooltipRef.current;
    const img = imgRef.current;
    const name = nameRef.current;
    if (!tooltip || !img || !name) return;

    function onOver(e: Event) {
      const el = (e.target as HTMLElement).closest<HTMLElement>(".comp-agent[data-headshot]");
      if (!el) return;
      img!.src = el.dataset.headshot!;
      name!.textContent = el.dataset.name ?? "";
      tooltip!.style.display = "flex";

      const rect = el.getBoundingClientRect();
      const tw = tooltip!.offsetWidth;
      const th = tooltip!.offsetHeight;
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - tw / 2, window.innerWidth - tw - 8));
      let top = rect.bottom + 8;
      if (top + th > window.innerHeight - 8) top = rect.top - th - 8;
      tooltip!.style.left = `${left}px`;
      tooltip!.style.top = `${top}px`;
    }

    function onOut(e: Event) {
      const el = (e.target as HTMLElement).closest(".comp-agent[data-headshot]");
      if (!el) return;
      tooltip!.style.display = "none";
    }

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, []);

  return (
    <div id="comp-tooltip" className="comp-tooltip" ref={tooltipRef}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} alt="" />
      <span id="comp-tooltip-name" ref={nameRef} />
    </div>
  );
}
