"use client";

import { useState } from "react";
import { RoundTimeline } from "./RoundTimeline";
import { HighlightsCarousel } from "./HighlightsCarousel";
import type { TimelineEntry } from "@/lib/timeline";
import type { HighlightEvent } from "@/lib/highlights";

// Owns the hover state linking a Highlights tile to its round on the round
// timeline above it — one instance per map, so the match-week page's
// several per-map sections don't cross-highlight each other.
export function MatchHighlightsSection({
  timeline,
  highlights,
  opponentName,
}: {
  timeline?: TimelineEntry[];
  highlights?: HighlightEvent[] | null;
  opponentName?: string | null;
}) {
  const [highlightedRound, setHighlightedRound] = useState<number | null>(null);

  const hasTimeline = timeline && timeline.length > 0;
  const hasHighlights = highlights && highlights.length > 0;
  if (!hasTimeline && !hasHighlights) return null;

  return (
    <div className="match-highlights-wrap">
      {hasTimeline && (
        <RoundTimeline timeline={timeline} opponentName={opponentName ?? null} highlightedRound={highlightedRound} />
      )}
      {hasHighlights && <HighlightsCarousel highlights={highlights} onHoverRound={setHighlightedRound} />}
    </div>
  );
}
