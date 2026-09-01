"use client";

import { useEffect } from "react";
import { usePlayerHeader, type NavPlayer } from "@/lib/PlayerHeaderContext";

// Renders nothing — just publishes this page's player + roster to the nav
// bar's context on mount, and clears it on unmount (navigating away from a
// player page) so the nav-player switcher doesn't linger on other pages.
export function PlayerHeaderSync({ player, roster }: { player: NavPlayer; roster: NavPlayer[] }) {
  const { setPlayerHeader } = usePlayerHeader();

  useEffect(() => {
    setPlayerHeader(player, roster);
    return () => setPlayerHeader(null, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.player_id]);

  return null;
}
