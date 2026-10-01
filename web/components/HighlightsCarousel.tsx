import { Avatar } from "./Avatar";
import type { HighlightEvent } from "@/lib/highlights";

// Mirrors src/wild_tracker/templates/macros.html::highlights_carousel —
// horizontally-scrolling tiles for standout match moments (4K+/ACE,
// clutches, thrifty round wins), one per event in round order.
export function HighlightsCarousel({ highlights }: { highlights: HighlightEvent[] }) {
  if (highlights.length === 0) return null;
  return (
    <section className="highlights-section">
      <h2>Highlights</h2>
      <div className="highlights-scroll">
        {highlights.map((h, i) => (
          <div key={i} className={`highlight-tile highlight-${h.type}`} title={`Round ${h.round}`}>
            <Avatar displayName={h.player.display_name} headshotFilename={h.player.headshot_filename} size="lg" />
            <div className="highlight-label">{h.label}</div>
            <div className="highlight-meta">
              {h.player.display_name} &middot; R{h.round}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
