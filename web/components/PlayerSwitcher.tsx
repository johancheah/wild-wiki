"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import type { NavPlayer } from "@/lib/PlayerHeaderContext";

// Player-switcher dropdown: a button that opens a list of the rest of the
// WILD roster to jump to. Used in two places — the nav bar (variant="nav",
// compact avatar+name+caret, only reachable once scrolled past the page's
// own big header) and the page header itself (variant="header", the full
// big avatar+name+caret, styled to read as the page's own h1) — sharing
// this one implementation so both read as the same component and behave
// the same, with the whole name (not just the caret) as the click target.
export function PlayerSwitcher({
  currentPlayer,
  roster,
  variant = "header",
}: {
  currentPlayer: NavPlayer;
  roster: NavPlayer[];
  variant?: "nav" | "header";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <span className={`player-switcher ${variant === "header" ? "player-switcher-header" : ""}`} ref={ref}>
      <button
        className="player-switcher-btn"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={variant === "header" ? "Switch player" : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Avatar
          displayName={currentPlayer.display_name}
          headshotFilename={currentPlayer.headshot_filename}
          size={variant === "header" ? "lg" : undefined}
        />
        <span className="player-switcher-name">{currentPlayer.display_name}</span>
        <span className="player-switcher-caret">▾</span>
      </button>
      <div className={`player-switcher-dropdown ${open ? "open" : ""}`}>
        {roster.map((p) => (
          <Link
            key={p.player_id}
            href={`/players/${p.player_id}`}
            className={p.player_id === currentPlayer.player_id ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            <Avatar displayName={p.display_name} headshotFilename={p.headshot_filename} />
            {p.display_name}
          </Link>
        ))}
      </div>
    </span>
  );
}
