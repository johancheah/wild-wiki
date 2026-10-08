"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { agentIcon, weaponIcon } from "@/lib/assets";
import type { MatchReplay, ReplayEvent } from "@/lib/replay";

// Mirrors src/wild_tracker/static/replay.js (the local app's vanilla-JS
// version) — keep the two in sync. Steps through a round's kill / plant /
// defuse events, drawing every alive player's position at that instant on
// the map's minimap. Positions exist only at these events, so this is
// event-to-event, not smooth playback.
const VIEW = 1000;
const MARKER_R = 22;

function fmtTime(ms: number | null) {
  const s = Math.round((ms ?? 0) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ReplayTab({ replay }: { replay: MatchReplay }) {
  const { cal, players, rounds } = replay;
  const [r, setR] = useState(0);
  const [e, setE] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const round = rounds[r];
  const ev = round.events[e];

  // Game (x, y) -> SVG coords: per the map calibration, the image's
  // horizontal axis follows the game's y and vertical follows x.
  const toPx = useCallback(
    (x: number, y: number): [number, number] => [
      (y * cal.xMultiplier + cal.xScalarToAdd) * VIEW,
      (x * cal.yMultiplier + cal.yScalarToAdd) * VIEW,
    ],
    [cal]
  );

  const step = useCallback(
    (delta: number) => {
      const next = e + delta;
      if (next >= 0 && next < round.events.length) return setE(next);
      const nr = r + (delta > 0 ? 1 : -1);
      if (nr < 0 || nr >= rounds.length) return;
      setR(nr);
      setE(delta > 0 ? 0 : rounds[nr].events.length - 1);
    },
    [e, r, round.events.length, rounds]
  );

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const onKey = (evt: KeyboardEvent) => {
      if (evt.key === "ArrowRight" || evt.key === "ArrowDown") {
        evt.preventDefault();
        step(1);
      } else if (evt.key === "ArrowLeft" || evt.key === "ArrowUp") {
        evt.preventDefault();
        step(-1);
      }
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [step]);

  const chip = (pid: string | null) => {
    const p = pid ? players[pid] : undefined;
    const icon = p ? agentIcon(p.agent) : null;
    return (
      <span className={`replay-chip replay-${p?.team ?? "enemy"}`}>
        {icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" />
        )}
        {p?.name ?? "?"}
      </span>
    );
  };

  const marker = (key: string, pid: string, x: number, y: number, view: number | null, dead = false) => {
    const p = players[pid];
    const team = p?.team ?? "enemy";
    const [px, py] = toPx(x, y);
    const icon = p ? agentIcon(p.agent) : null;
    const clipId = `rpclip-${key}`;
    const L = 46;
    const d = 12;
    return (
      <g key={key} className={`replay-marker replay-${team}${dead ? " dead" : ""}`}>
        <title>{p?.name ?? "?"}</title>
        {view !== null && !dead && (
          // view_radians is atan2(dy, dx) in game coords (verified against
          // killer->victim directions); in image space that's (sin, -cos).
          <line className="replay-view" x1={px} y1={py} x2={px + Math.sin(view) * L} y2={py - Math.cos(view) * L} />
        )}
        <clipPath id={clipId}>
          <circle cx={px} cy={py} r={MARKER_R - 2} />
        </clipPath>
        <circle className="replay-marker-bg" cx={px} cy={py} r={MARKER_R} />
        {icon && (
          <image
            href={icon}
            x={px - MARKER_R}
            y={py - MARKER_R}
            width={MARKER_R * 2}
            height={MARKER_R * 2}
            clipPath={`url(#${clipId})`}
          />
        )}
        <circle className="replay-marker-ring" cx={px} cy={py} r={MARKER_R} />
        {dead && (
          <>
            <line className="replay-x" x1={px - d} y1={py - d} x2={px + d} y2={py + d} />
            <line className="replay-x" x1={px - d} y1={py + d} x2={px + d} y2={py - d} />
          </>
        )}
      </g>
    );
  };

  // Spike stays on the map for every event from the plant onward.
  const plantIdx = round.events.findIndex((x) => x.kind === "plant");
  const plant: ReplayEvent | null = plantIdx >= 0 && e >= plantIdx ? round.events[plantIdx] : null;
  const positions = new Map(ev.players.map((p) => [p[0], toPx(p[1], p[2])] as const));
  const killLine =
    ev.kind === "kill" && ev.actor && ev.x !== null && ev.y !== null && positions.has(ev.actor)
      ? { from: positions.get(ev.actor)!, to: toPx(ev.x, ev.y), team: players[ev.actor]?.team ?? "enemy" }
      : null;

  return (
    <div className="replay" tabIndex={0} ref={rootRef}>
      <div className="replay-rounds">
        {rounds.map((rnd, i) => (
          <Fragment key={rnd.label}>
            <button
              type="button"
              className={`replay-round-btn${rnd.winner === "wild" ? " win" : rnd.winner === "enemy" ? " loss" : ""}${i === r ? " active" : ""}`}
              onClick={() => {
                setR(i);
                setE(0);
              }}
            >
              {rnd.label}
            </button>
            {(rnd.label === 12 || rnd.label === 24) && <span className="replay-round-gap" />}
          </Fragment>
        ))}
      </div>
      <div className="replay-body">
        <div className="replay-map-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="replay-minimap" src={`/maps/minimap/${cal.file}`} alt={`${replay.map} minimap`} />
          <svg className="replay-svg" viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true">
            {plant && plant.x !== null && plant.y !== null && (
              <g className="replay-spike">
                <title>Spike</title>
                {(() => {
                  const [sx, sy] = toPx(plant.x, plant.y);
                  return <rect x={sx - 10} y={sy - 10} width={20} height={20} rx={4} transform={`rotate(45 ${sx} ${sy})`} />;
                })()}
              </g>
            )}
            {killLine && (
              <line
                className={`replay-kill-line replay-${killLine.team}`}
                x1={killLine.from[0]}
                y1={killLine.from[1]}
                x2={killLine.to[0]}
                y2={killLine.to[1]}
              />
            )}
            {ev.players.map((p) => marker(`${r}-${e}-${p[0]}`, p[0], p[1], p[2], p[3]))}
            {/* The kill's victim isn't in the snapshot (already dead by then) — drawn from the event's own location with an X. */}
            {ev.kind === "kill" && ev.target && ev.x !== null && ev.y !== null &&
              marker(`${r}-${e}-victim`, ev.target, ev.x, ev.y, null, true)}
          </svg>
        </div>
        <div className="replay-side">
          <div className="replay-nav">
            <button type="button" aria-label="Previous event" onClick={() => step(-1)}>
              &#8249;
            </button>
            <span className="replay-round-label">
              Round {round.label} / {rounds[rounds.length - 1].label}
            </span>
            <button type="button" aria-label="Next event" onClick={() => step(1)}>
              &#8250;
            </button>
          </div>
          <div className="replay-events">
            {round.events.map((x, i) => {
              const wIcon = weaponIcon(x.weapon);
              return (
                <button
                  type="button"
                  key={i}
                  className={`replay-event${i === e ? " active" : ""}`}
                  onClick={() => setE(i)}
                >
                  <span className="replay-event-time">{fmtTime(x.t)}</span>
                  <span className="replay-event-body">
                    {x.kind === "kill" ? (
                      <>
                        {chip(x.actor)}
                        {wIcon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="replay-weapon" src={wIcon} alt={x.weapon ?? ""} />
                        ) : (
                          <span className="replay-weapon-text">{x.weapon ?? "—"}</span>
                        )}
                        {chip(x.target)}
                      </>
                    ) : (
                      <>
                        <span className="replay-spike-text">
                          {x.kind === "plant" ? `Spike planted${x.site ? ` (${x.site})` : ""} by` : "Spike defused by"}
                        </span>
                        {chip(x.actor)}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
