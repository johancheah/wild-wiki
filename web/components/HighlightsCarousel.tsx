import { headshotUrl } from "@/lib/assets";
import type { HighlightEvent } from "@/lib/highlights";

// Mirrors src/wild_tracker/templates/macros.html::highlights_carousel — a
// card per event with the player's headshot bled against the left/bottom
// edge and the event label beside it. Hover is reported to the parent
// (MatchHighlightsSection) so it can highlight the matching round on the
// timeline rendered above this carousel.
export function HighlightsCarousel({
  highlights,
  onHoverRound,
}: {
  highlights: HighlightEvent[];
  onHoverRound?: (round: number | null) => void;
}) {
  if (highlights.length === 0) return null;
  return (
    <section className="highlights-section">
      <h2>Highlights</h2>
      <div className="highlights-scroll">
        {highlights.map((h, i) => {
          const url = headshotUrl(h.player.headshot_filename);
          return (
            <div
              key={i}
              className={`highlight-tile highlight-${h.type}`}
              title={`${h.player.display_name} · Round ${h.round}`}
              onMouseEnter={() => onHoverRound?.(h.round)}
              onMouseLeave={() => onHoverRound?.(null)}
            >
              <div className="highlight-photo">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={h.player.display_name} />
                ) : (
                  <span className="highlight-photo-fallback">{h.player.display_name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="highlight-text">
                <div className="highlight-label">{h.label}</div>
                <div className="highlight-meta">Round {h.round}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
