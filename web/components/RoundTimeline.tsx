import { Fragment } from "react";
import { TeamBadge } from "./TeamBadge";
import { roundIconUrl } from "@/lib/assets";
import type { TimelineEntry } from "@/lib/timeline";

// Mirrors src/wild_tracker/templates/macros.html::round_timeline.
export function RoundTimeline({
  timeline,
  opponentName,
}: {
  timeline: TimelineEntry[];
  opponentName: string | null;
}) {
  if (timeline.length === 0) return null;

  return (
    <div className="timeline-scroll">
      <div className="timeline-grid">
        <div className="timeline-row timeline-round-nums">
          {timeline.map((t) => (
            <Fragment key={t.round_number}>
              <span>{t.label}</span>
              {(t.label === 12 || t.label === 24) && <span className="timeline-gap" />}
            </Fragment>
          ))}
        </div>
        {(["wild", "enemy"] as const).map((team) => (
          <div className="timeline-row" key={team}>
            <TeamBadge isWild={team === "wild"} name={opponentName} />
            {timeline.map((t) => (
              <Fragment key={t.round_number}>
                {t.winner === null && t.result === null ? (
                  <div className="timeline-cell empty" title={`Round ${t.label}`} />
                ) : t.winner === team ? (
                  <div
                    className={`timeline-cell ${t.win_side === "ATK" ? "side-atk" : t.win_side === "DEF" ? "side-def" : ""}`}
                    title={`Round ${t.label}: ${t.result}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="round-icon" src={roundIconUrl(t.result)} alt={t.result ?? ""} />
                  </div>
                ) : (
                  <div className="timeline-cell" title={`Round ${t.label}`} />
                )}
                {(t.label === 12 || t.label === 24) && <div className="timeline-gap" />}
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
